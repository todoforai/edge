import asyncio
import subprocess
import signal
import sys
import os
import select
import re
import shlex
import logging
import psutil  # We'll need to add this dependency

from typing import Dict, Any, Optional
from .messages import block_message_result_msg, block_done_result_msg

logger = logging.getLogger("todo4ai-client")

# Make processes dictionary a global variable so it's shared across all instances
_processes: Dict[str, subprocess.Popen] = {}

class ShellProcess:
    def __init__(self):
        # Use the global processes dictionary
        global _processes
        self.processes = _processes
        
    async def execute_block(self, block_id: str, content: str, client, todo_id: str, request_id: str, timeout: float):
        """Execute a shell command block and stream results back to client."""
        logger.info(f"Executing shell block {block_id} with content: {content[:50]}...")
        print(f"DEBUG: Starting shell execution for block {block_id}")
        
        try:
            # Create process with pipes for stdin/stdout/stderr
            process = subprocess.Popen(
                ['/bin/bash', '-c', content],  # Use bash to execute the shell commands
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True,
                preexec_fn=os.setsid  # Create a new process group for better signal handling
            )
            
            print(f"DEBUG: Process created with PID {process.pid}")
            
            # Store process for potential interruption
            self.processes[block_id] = process
            
            # Start tasks to read stdout and stderr - don't wait for them
            asyncio.create_task(self._stream_output(process.stdout, client, todo_id, request_id, block_id, "stdout"))
            asyncio.create_task(self._stream_output(process.stderr, client, todo_id, request_id, block_id, "stderr"))
            
            # Start timeout task - don't wait for it
            asyncio.create_task(self._handle_timeout(block_id, timeout, client, todo_id, request_id))
            
            # Start a task to wait for process completion - don't wait for it
            asyncio.create_task(self._wait_for_process(process, block_id, client, todo_id, request_id))
            
            # Return immediately without waiting for any tasks
            return
                
        except Exception as e:
            logger.error(f"Error creating process: {str(e)}")
            print(f"DEBUG: Error creating process: {str(e)}")
            # Send error message to client
            await client._send_response(block_message_result_msg(
                todo_id, block_id, f"Error creating process: {str(e)}", request_id
            ))

    async def _handle_timeout(self, block_id: str, timeout: float, client, todo_id: str, request_id: str):
        """Handle timeout for a running process."""
        print(f"DEBUG: Timeout task started with timeout of {timeout} seconds for block {block_id}")
        
        # Wait for the specified timeout
        await asyncio.sleep(timeout)
        
        # After timeout, check if the process is still running
        if block_id in self.processes:
            print(f"DEBUG: Process timed out for block {block_id}")
            # Process is still running after timeout, terminate it
            self.interrupt_block(block_id)
            
            # Send timeout message
            timeout_msg = block_message_result_msg(
                    todo_id, block_id, f"Execution timed out after {timeout} seconds", request_id
                )
            print(f"DEBUG: Sending timeout message: {timeout_msg}")
            await client._send_response(timeout_msg)
        else:
            print(f"DEBUG: Timeout reached but process already completed for block {block_id}")

    async def _stream_output(self, stream, client, todo_id: str, request_id: str, block_id: str, stream_type: str):
        """Stream output from process to client."""
        print(f"DEBUG: Starting to stream {stream_type} for block {block_id}")
        
        # Use run_in_executor to read from the stream without blocking the event loop
        while block_id in self.processes:
            # Read a line using run_in_executor to avoid blocking
            line = await asyncio.get_event_loop().run_in_executor(None, stream.readline)
            
            if not line:  # EOF
                break
                
            print(f"DEBUG: Read line from {stream_type}: {line.rstrip()}")
            
            # Send the line immediately
            msg = block_message_result_msg(todo_id, block_id, line, request_id)
            print(f"DEBUG: Sending message: {msg}")
            await client._send_response(msg)
        
        print(f"DEBUG: Stream {stream_type} for block {block_id} finished")
    
    def interrupt_block(self, block_id: str):
        """Interrupt a running process."""
        if block_id in self.processes:
            process = self.processes[block_id]
            print(f"DEBUG: Interrupting process for block {block_id}")
            try:
                # Send interrupt signal to the entire process group
                # This ensures all child processes receive the signal
                pgid = os.getpgid(process.pid)
                print(f"DEBUG: Sending SIGINT to process group {pgid}")
                os.killpg(pgid, signal.SIGINT)
                
                # Give it a moment to handle the signal
                process.wait(timeout=1)
                print(f"DEBUG: Process interrupted successfully")
            except subprocess.TimeoutExpired:
                print(f"DEBUG: Process did not respond to interrupt, terminating")
                # Force terminate the entire process group
                try:
                    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                    process.wait(timeout=1)
                except (subprocess.TimeoutExpired, ProcessLookupError):
                    print(f"DEBUG: Process did not respond to terminate, killing")
                    # Kill as last resort
                    try:
                        os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                    except ProcessLookupError:
                        print(f"DEBUG: Process already gone")
            except ProcessLookupError:
                print(f"DEBUG: Process already gone")
            finally:
                # Clean up the process entry
                if block_id in self.processes:
                    del self.processes[block_id]
    
    async def send_input(self, block_id: str, input_text: str):
        """Send input to a running process."""
        print(f"DEBUG: Attempting to send input to block {block_id}: {input_text}")
        if block_id in self.processes:
            process = self.processes[block_id]
            if process.stdin:
                # Add newline if not present
                if not input_text.endswith('\n'):
                    input_text += '\n'
                    
                # Write to stdin
                print(f"DEBUG: Writing to stdin: {input_text}")
                process.stdin.write(input_text)
                process.stdin.flush()
                print(f"DEBUG: Input sent successfully")
                return True
        print(f"DEBUG: Failed to send input - process not found or stdin not available")
        return False

    async def _wait_for_process(self, process, block_id, client, todo_id, request_id):
        """Wait for process to complete and send completion message."""
        try:
            # Wait for process to complete
            return_code = await asyncio.get_event_loop().run_in_executor(None, process.wait)
            print(f"DEBUG: Process completed with return code {return_code}")
            
            # Send completion message
            done_msg = block_done_result_msg(todo_id, request_id, block_id, "execute", return_code)
            print(f"DEBUG: Sending done message: {done_msg}")
            await client._send_response(done_msg)
            
        except Exception as e:
            print(f"DEBUG: Error waiting for process: {str(e)}")
            # Send completion message even on error
            return_code = process.returncode if process.returncode is not None else -1
            done_msg = block_done_result_msg(todo_id, request_id, block_id, "execute", return_code)
            await client._send_response(done_msg)
        finally:
            # Clean up
            if block_id in self.processes:
                del self.processes[block_id]



