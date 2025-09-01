import asyncio
import subprocess
import signal
import os
import select
import logging
from typing import Dict
import traceback
import threading
import queue

from ..constants.messages import (
    shell_block_message_result_msg,
    shell_block_done_result_msg,
    shell_block_start_result_msg,
)

logger = logging.getLogger("todoforai-edge")

# Make processes dictionary a global variable so it's shared across all instances
_processes: Dict[str, subprocess.Popen] = {}
_stdin_writers = {}  # Make stdin writers global too so all instances can access

class ShellProcess:
    def __init__(self):
        self.processes = _processes
        self._output_buffer = {}  # Add output buffer for sync calls
        self._stdin_writers = _stdin_writers  # Use the shared global writers
        
    async def execute_block(self, block_id: str, content: str, client, todo_id: str, request_id: str, timeout: float, root_path: str = ""):
        """Execute a shell command block and stream results back to client."""
        logger.info(f"Executing shell block {block_id} with content: {content[:50]}...")
        
        # Initialize output buffer for this block
        self._output_buffer[block_id] = ""
  
        try:
            # Determine working directory
            cwd = None
            logger.info(f'root_path: {root_path}')
            if root_path:
                # Validate and use the provided root_path
                root_path = os.path.expanduser(root_path)
                if os.path.isdir(root_path):
                    cwd = root_path
                    logger.info(f"Using working directory: {cwd}")
                else:
                    logger.warning(f"Invalid root_path provided: {root_path}, using current directory")
            
            # Ensure sudo reads password from stdin if used
            if os.name != 'nt' and 'sudo' in content:
                content = f'sudo() {{ command sudo -S "$@"; }}; ' + content
                logger.debug("Wrapped sudo to always use use -S for stdin password input")
            
            # Determine shell and preexec_fn based on platform
            if os.name == 'nt':  # Windows
                shell_cmd = ['cmd', '/c', content]
                preexec_fn = None
            else:  # Unix-like systems
                shell_cmd = ['/bin/bash', '-c', content]
                preexec_fn = os.setsid

            # Make stdin a TTY to prevent tools from reading from PIPE
            master_fd, slave_fd = os.openpty()
            stdin_stream = slave_fd  # child sees a TTY
            stdin_writer = os.fdopen(master_fd, 'w', buffering=1)
            
            # Create process with pipes for stdin/stdout/stderr
            process = subprocess.Popen(
                shell_cmd,
                stdin=stdin_stream,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True,
                cwd=cwd,  # Add working directory
                preexec_fn=preexec_fn  # Only use setsid on Unix systems
            )

            # Close parent's copy of slave FD, keep master writer for input
            try:
                os.close(slave_fd)
            except OSError:
                pass

            # Store stdin writer (PTY master)
            self._stdin_writers[block_id] = stdin_writer
            
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
            stack_trace = traceback.format_exc()
            logger.error(f"Error creating process: {str(e)}\nStacktrace:\n{stack_trace}")
            # Send error message to client
            await client.send_response(shell_block_message_result_msg(
                todo_id, block_id, f"Error creating process: {str(e)}\n\nStacktrace:\n{stack_trace}", request_id
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
            await client.send_response(shell_block_message_result_msg(
                todo_id, block_id, f"Execution timed out after {timeout} seconds", request_id
            ))

    def _read_stream_thread(self, stream, output_queue, block_id):
        """Thread function to read from a stream and put data into a queue."""
        try:
            while block_id in self.processes:
                # Read a line from the stream
                line = stream.readline()
                if not line:  # EOF
                    break
                output_queue.put(line)
        except Exception as e:
            logger.error(f"Error in stream reader thread: {str(e)}")
        finally:
            # Signal that this thread is done
            output_queue.put(None)

    async def _stream_output(self, stream, client, todo_id: str, request_id: str, block_id: str, stream_type: str):
        """Stream output from process to client."""
        logger.debug(f"Starting to stream {stream_type} for block {block_id}")
        
        if os.name == 'nt':  # Windows - use threading approach
            # Create a queue for thread-safe communication
            output_queue = queue.Queue()
            
            # Start a thread to read from the stream
            reader_thread = threading.Thread(
                target=self._read_stream_thread,
                args=(stream, output_queue, block_id),
                daemon=True
            )
            reader_thread.start()
            
            # Read from the queue in the async context
            while block_id in self.processes:
                try:
                    # Try to get data from the queue with a timeout
                    try:
                        data = output_queue.get(timeout=0.1)
                    except queue.Empty:
                        # No data available, check if process is still running
                        await asyncio.sleep(0.01)
                        continue
                    
                    if data is None:  # Thread signaled completion
                        break
                    
                    # Send the data immediately
                    await client.send_response(shell_block_message_result_msg(todo_id, block_id, data, request_id))
                    # Buffer the output for sync calls
                    if block_id in self._output_buffer:
                        self._output_buffer[block_id] += data
                    
                except Exception as e:
                    stack_trace = traceback.format_exc()
                    logger.error(f"Error processing output from {stream_type}: {str(e)}\nStacktrace:\n{stack_trace}")
                    break
                    
        else:  # Unix-like systems - use select
            while block_id in self.processes:
                try:
                    # Check if data is available without blocking
                    if select.select([stream], [], [], 0.3)[0]:
                        # Read available data
                        data = os.read(stream.fileno(), 1024).decode('utf-8', errors='replace')
                        
                        if not data:  # EOF
                            break
                        
                        # Send the data immediately
                        await client.send_response(shell_block_message_result_msg(todo_id, block_id, data, request_id))
                        # Buffer the output for sync calls
                        if block_id in self._output_buffer:
                            self._output_buffer[block_id] += data
                    else:
                        # Small sleep to prevent CPU spinning
                        await asyncio.sleep(0.01)
                except Exception as e:
                    stack_trace = traceback.format_exc()
                    logger.error(f"Error reading from {stream_type}: {str(e)}\nStacktrace:\n{stack_trace}")
                    break
        
        logger.debug(f"Stream {stream_type} for block {block_id} finished")

    async def send_input(self, block_id: str, input_text: str):
        """Send input to a running process."""
        logger.info(f"Sending input to block {block_id}")
        
        if block_id in self.processes:
            try:
                writer = self._stdin_writers.get(block_id)
                if writer and not writer.closed:
                    # Add newline if not present
                    if not input_text.endswith('\n'):
                        input_text += '\n'
                        
                    # Write to stdin
                    writer.write(input_text)
                    writer.flush()
                    
                    # Give the process a moment to process the input
                    await asyncio.sleep(0.1)
                    
                    return True
                else:
                    logger.warning(f"Process stdin writer is closed or not available for block {block_id}")
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
                if os.name == 'nt':  # Windows
                    # On Windows, use terminate() as SIGINT is not reliable
                    process.terminate()
                    process.wait(timeout=1)
                else:  # Unix-like systems
                    # Send interrupt signal to the entire process group
                    # This ensures all child processes receive the signal
                    pgid = os.getpgid(process.pid)
                    os.killpg(pgid, signal.SIGINT)
                    
                    # Give it a moment to handle the signal
                    process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                logger.warning("Process did not respond to interrupt, terminating")
                # Force terminate the process
                try:
                    if os.name == 'nt':  # Windows
                        process.kill()
                    else:  # Unix-like systems
                        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                        process.wait(timeout=1)
                except (subprocess.TimeoutExpired, ProcessLookupError):
                    logger.warning("Process did not respond to terminate, killing")
                    # Kill as last resort
                    try:
                        if os.name == 'nt':  # Windows
                            process.kill()
                        else:  # Unix-like systems
                            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                    except ProcessLookupError:
                        pass
            except ProcessLookupError:
                pass
            finally:
                # Clean up the process entry
                if block_id in self.processes:
                    del self.processes[block_id]
                # Close and remove stdin writer if any
                writer = self._stdin_writers.pop(block_id, None)
                if writer:
                    try:
                        writer.close()
                    except Exception:
                        pass

    async def _wait_for_process(self, process, block_id, client, todo_id, request_id):
        """Wait for process to complete and send completion message."""
        try:
            # Wait for process to complete
            return_code = await asyncio.get_event_loop().run_in_executor(None, process.wait)
            logger.info(f"Process completed with return code {return_code}")
            
            # If no output was sent, send success message
            if not self._output_buffer.get(block_id):
                await client.send_response(shell_block_message_result_msg(
                    todo_id, block_id, "Successful run", request_id
                ))
            
            # Send completion message
            await client.send_response(shell_block_done_result_msg(
                todo_id, request_id, block_id, "execute", return_code
            ))
            
        except Exception as e:
            logger.error(f"Error waiting for process: {str(e)}")
            # Send completion message even on error
            return_code = process.returncode if process.returncode is not None else -1
            await client.send_response(shell_block_done_result_msg(
                todo_id, request_id, block_id, "execute", return_code
            ))
        finally:
            # Clean up
            if block_id in self.processes:
                del self.processes[block_id]
            # Close and remove stdin writer if any
            writer = self._stdin_writers.pop(block_id, None)
            if writer:
                try:
                    writer.close()
                except Exception:
                    pass
            # Note: Don't delete _output_buffer here, let the sync caller handle it
