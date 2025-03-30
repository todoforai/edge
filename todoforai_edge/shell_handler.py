import asyncio
import subprocess
import signal
import sys
import os
import select
import logging
from typing import Dict

from .messages import block_message_result_msg, block_done_result_msg

logger = logging.getLogger("todoforai-edge")

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
            
            logger.debug(f"Process created with PID {process.pid}")
            
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
            # Send error message to client
            await client._send_response(block_message_result_msg(
                todo_id, block_id, f"Error creating process: {str(e)}", request_id
            ))

    async def _handle_timeout(self, block_id: str, timeout: float, client, todo_id: str, request_id: str):
        """Handle timeout for a running process."""
        logger.debug(f"Timeout task started with timeout of {timeout} seconds for block {block_id}")
        
        # Wait for the specified timeout
        await asyncio.sleep(timeout)
        
        # After timeout, check if the process is still running
        if block_id in self.processes:
            logger.info(f"Process timed out for block {block_id}")
            # Process is still running after timeout, terminate it
            self.interrupt_block(block_id)
            
            # Send timeout message
            await client._send_response(block_message_result_msg(
                todo_id, block_id, f"Execution timed out after {timeout} seconds", request_id
            ))
            
    async def _stream_output(self, stream, client, todo_id: str, request_id: str, block_id: str, stream_type: str):
        """Stream output from process to client."""
        logger.debug(f"Starting to stream {stream_type} for block {block_id}")
        
        # Use non-blocking reads to get data as it becomes available
        while block_id in self.processes:
            try:
                # Check if data is available without blocking (shorter timeout for more responsiveness)
                if select.select([stream], [], [], 0.3)[0]:
                    # Read available data (smaller chunks for more responsiveness)
                    data = os.read(stream.fileno(), 1024).decode('utf-8', errors='replace')
                    
                    if not data:  # EOF
                        break
                    
                    # Send the data immediately
                    await client._send_response(block_message_result_msg(todo_id, block_id, data, request_id))
                else:
                    # Small sleep to prevent CPU spinning
                    await asyncio.sleep(0.01)
            except Exception as e:
                logger.error(f"Error reading from {stream_type}: {str(e)}")
                break
        
        logger.debug(f"Stream {stream_type} for block {block_id} finished")

    async def send_input(self, block_id: str, input_text: str):
        """Send input to a running process."""
        logger.info(f"Sending input to block {block_id}")
        
        if block_id in self.processes:
            process = self.processes[block_id]
            try:
                if process.stdin and not process.stdin.closed:
                    # Add newline if not present
                    if not input_text.endswith('\n'):
                        input_text += '\n'
                        
                    # Write to stdin
                    process.stdin.write(input_text)
                    process.stdin.flush()
                    
                    # Give the process a moment to process the input
                    await asyncio.sleep(0.1)
                    
                    return True
                else:
                    logger.warning(f"Process stdin is closed or not available for block {block_id}")
            except Exception as e:
                logger.error(f"Error sending input to process: {str(e)}")
        else:
            logger.warning(f"Process not found for block {block_id}")
        return False
    
    def interrupt_block(self, block_id: str):
        """Interrupt a running process."""
        if block_id in self.processes:
            process = self.processes[block_id]
            logger.info(f"Interrupting process for block {block_id}")
            try:
                # Send interrupt signal to the entire process group
                # This ensures all child processes receive the signal
                pgid = os.getpgid(process.pid)
                os.killpg(pgid, signal.SIGINT)
                
                # Give it a moment to handle the signal
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                logger.warning(f"Process did not respond to interrupt, terminating")
                # Force terminate the entire process group
                try:
                    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                    process.wait(timeout=1)
                except (subprocess.TimeoutExpired, ProcessLookupError):
                    logger.warning(f"Process did not respond to terminate, killing")
                    # Kill as last resort
                    try:
                        os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                    except ProcessLookupError:
                        pass
            except ProcessLookupError:
                pass
            finally:
                # Clean up the process entry
                if block_id in self.processes:
                    del self.processes[block_id]

    async def _wait_for_process(self, process, block_id, client, todo_id, request_id):
        """Wait for process to complete and send completion message."""
        try:
            # Wait for process to complete
            return_code = await asyncio.get_event_loop().run_in_executor(None, process.wait)
            logger.info(f"Process completed with return code {return_code}")
            
            # Send completion message
            await client._send_response(block_done_result_msg(
                todo_id, request_id, block_id, "execute", return_code
            ))
            
        except Exception as e:
            logger.error(f"Error waiting for process: {str(e)}")
            # Send completion message even on error
            return_code = process.returncode if process.returncode is not None else -1
            await client._send_response(block_done_result_msg(
                todo_id, request_id, block_id, "execute", return_code
            ))
        finally:
            # Clean up
            if block_id in self.processes:
                del self.processes[block_id]
