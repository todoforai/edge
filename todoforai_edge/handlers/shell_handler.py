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

# Constants for output buffer limits
STREAM_FIRST_CHARS = 10000
STREAM_LAST_CHARS = 10000

# Make processes dictionary a global variable so it's shared across all instances
_processes: Dict[str, subprocess.Popen] = {}
_stdin_writers = {}  # Make stdin writers global too so all instances can access

class OutputBuffer:
    """
    Output buffer with truncation for long shell outputs.
    
    1. TRUNCATION: first 10k + last 10k chars kept, middle dropped
    2. STREAMING: only first 10k streamed real-time, last 10k sent at end
    3. INTERACTIVE: on user input (send_input) buffer resets, new 10k streams
    4. RESULT: all segments joined in get_output() for final result
    """
    def __init__(self, first_limit: int = STREAM_FIRST_CHARS, last_limit: int = STREAM_LAST_CHARS):
        self.first_limit = first_limit
        self.last_limit = last_limit
        self.first_part = ""
        self.last_part = ""
        self.total_len = 0
        self.truncated = False
        self._truncation_msg_sent = False
        self._saved_segments = []  # Accumulated output from previous interaction segments
    
    def append(self, text: str) -> str:
        """Append text and return what should be streamed to client."""
        self.total_len += len(text)
        to_stream = ""
        
        # Still filling first part - stream everything
        if len(self.first_part) < self.first_limit:
            remaining = self.first_limit - len(self.first_part)
            to_stream = text[:remaining]
            self.first_part += to_stream
            text = text[remaining:]
        
        # Past first limit - buffer for last part, don't stream middle
        if text:
            if not self.truncated:
                self.truncated = True
            self.last_part = (self.last_part + text)[-self.last_limit:]
        
        return to_stream
    
    def get_truncation_notice(self) -> str:
        """Get truncation notice if needed (call once when process ends)."""
        if self.truncated and not self._truncation_msg_sent:
            self._truncation_msg_sent = True
            return f"\n\n... [truncated {self.total_len - self.first_limit - len(self.last_part)} chars] ...\n\n{self.last_part}"
        return ""
    
    def reset_for_interaction(self):
        """Reset truncation state after user input - allows next 10k to stream.
        
        Saves current segment for final output, resets for new streaming.
        """
        # Save current segment if there's content
        if self.first_part or self.last_part:
            segment = self.first_part
            if self.truncated:
                segment += f"\n... [truncated {self.total_len - len(self.first_part) - len(self.last_part)} chars] ...\n{self.last_part}"
            self._saved_segments.append(segment)
        # Reset for new input
        self.first_part = ""
        self.last_part = ""
        self.total_len = 0
        self.truncated = False
        self._truncation_msg_sent = False
    
    def get_output(self) -> str:
        # Current segment
        current = self.first_part
        if self.truncated:
            current += f"\n\n... [truncated: showing first {len(self.first_part)} and last {len(self.last_part)} chars of {self.total_len} total] ...\n\n{self.last_part}"
        # Combine all segments
        all_segments = self._saved_segments + [current] if current else self._saved_segments
        return "\n".join(all_segments)

class ShellProcess:
    def __init__(self):
        self.processes = _processes
        self._output_buffer: Dict[str, OutputBuffer] = {}  # Add output buffer for sync calls
        self._stdin_writers = _stdin_writers  # Use the shared global writers
        
    async def execute_block(self, block_id: str, content: str, client, todo_id: str, request_id: str, timeout: float, root_path: str = ""):
        """Execute a shell command block and stream results back to client."""
        logger.info(f"Executing shell block {block_id} with content: {content[:50]}...")
        
        # Initialize output buffer for this block
        self._output_buffer[block_id] = OutputBuffer()
  
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
                 
            # Force UTF-8 and determine shell based on platform
            if os.name == 'nt':
                # Try PowerShell first (better streaming), fallback to cmd
                try:
                    # Test if PowerShell is available
                    subprocess.run(['powershell', '-Command', 'exit'], 
                                 capture_output=True, timeout=2)
                    # PowerShell with UTF-8 output encoding and no colors
                    shell_cmd = ['powershell', '-Command', 
                               f'[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; '
                               f'$OutputEncoding = [System.Text.Encoding]::UTF8; '
                               f'$env:NO_COLOR = "1"; $env:TERM = "dumb"; '
                               f'{content}']
                except (subprocess.TimeoutExpired, FileNotFoundError):
                    # Fallback to cmd with UTF-8 codepage and no colors
                    logger.warning("PowerShell not available, falling back to cmd.exe")
                    content = f'chcp 65001>nul & set NO_COLOR=1 & set TERM=dumb & {content}'
                    shell_cmd = ['cmd', '/c', content]
                preexec_fn = None
            else:  # Unix-like systems
                shell_cmd = ['/bin/bash', '-c', content]
                preexec_fn = os.setsid

            # Make stdin a TTY to prevent tools from reading from PIPE (only on Unix)
            if os.name != 'nt':
                master_fd, slave_fd = os.openpty()
                stdin_stream = slave_fd  # child sees a TTY
                stdin_writer = os.fdopen(master_fd, 'w', buffering=1)
            else:
                master_fd = None
                slave_fd = None
                stdin_stream = subprocess.PIPE
                stdin_writer = None
            
            # If sudo is used on Unix, attach stdout/stderr to the same PTY so prompts are visible
            use_pty_for_io = os.name != 'nt' and 'sudo' in content
            # Ensure sudo reads password from stdin if used
            if use_pty_for_io:
                content = f'sudo() {{ command sudo -S "$@"; }};\n' + content
                logger.debug("Wrapped sudo to always use use -S for stdin password input")

            # Create process
            process = subprocess.Popen(
                shell_cmd,
                stdin=stdin_stream,
                stdout=(stdin_stream if use_pty_for_io else subprocess.PIPE),
                stderr=(stdin_stream if use_pty_for_io else subprocess.PIPE),
                text=(False if use_pty_for_io else True),
                bufsize=(0 if use_pty_for_io else 1),
                universal_newlines=(False if use_pty_for_io else True),
                cwd=cwd,
                preexec_fn=preexec_fn,  # Only use setsid on Unix systems
                encoding='utf-8' if os.name == 'nt' else None,
                errors='replace' if os.name == 'nt' else None
            )

            # Close parent's copy of slave FD, keep master writer for input (Unix only)
            if slave_fd is not None:
                try:
                    os.close(slave_fd)
                except OSError:
                    pass

            # Store stdin writer (PTY master on Unix, PIPE on Windows)
            self._stdin_writers[block_id] = (process.stdin if os.name == 'nt' else stdin_writer)
            
            logger.debug(f"Process created with PID {process.pid}")
            
            # Store process for potential interruption
            self.processes[block_id] = process
            
            # Start tasks to read output
            if use_pty_for_io:
                asyncio.create_task(self._stream_from_fd(master_fd, client, todo_id, request_id, block_id))
            else:
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

    # Read from a raw file descriptor (PTY master)
    async def _stream_from_fd(self, fd, client, todo_id: str, request_id: str, block_id: str):
        logger.debug(f"Starting to stream PTY fd for block {block_id}")
        while block_id in self.processes:
            try:
                if select.select([fd], [], [], 0.3)[0]:
                    try:
                        data = os.read(fd, 1024)
                        if not data:
                            break
                        text = data.decode('utf-8', errors='replace')
                        if block_id in self._output_buffer:
                            to_stream = self._output_buffer[block_id].append(text)
                            if to_stream:
                                await client.send_response(shell_block_message_result_msg(todo_id, block_id, to_stream, request_id))
                    except OSError as e:
                        if e.errno == 5:  # EIO - process closed PTY
                            logger.debug(f"PTY closed for block {block_id}")
                            break
                        raise
                else:
                    await asyncio.sleep(0.01)
            except Exception as e:
                stack_trace = traceback.format_exc()
                logger.error(f"Error reading PTY fd: {str(e)}\nStacktrace:\n{stack_trace}")
                break
        logger.debug(f"PTY fd stream for block {block_id} finished")

    def _read_stream_thread(self, stream, output_queue, block_id):
        """Thread function to read from a stream and put data into a queue."""
        try:
            while block_id in self.processes:
                # For Windows, read character-by-character to catch prompts without newline
                if os.name == 'nt':
                    ch = stream.read(1)
                    if not ch:  # EOF
                        break
                    output_queue.put(ch)
                else:
                    # Read a line from the stream (Unix)
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
            
            # Buffer for accumulating characters on Windows
            char_buffer = ""
            
            # Read from the queue in the async context
            while block_id in self.processes:
                try:
                    # Try to get data from the queue with a timeout
                    try:
                        data = output_queue.get(timeout=0.1)
                    except queue.Empty:
                        # No data available; flush small prompt fragments if any
                        if char_buffer and block_id in self._output_buffer:
                            to_stream = self._output_buffer[block_id].append(char_buffer)
                            if to_stream:
                                await client.send_response(shell_block_message_result_msg(todo_id, block_id, to_stream, request_id))
                            char_buffer = ""
                        await asyncio.sleep(0.01)
                        continue
                    
                    if data is None:  # Thread signaled completion
                        # Flush any remaining buffer
                        if char_buffer and block_id in self._output_buffer:
                            to_stream = self._output_buffer[block_id].append(char_buffer)
                            if to_stream:
                                await client.send_response(shell_block_message_result_msg(todo_id, block_id, to_stream, request_id))
                        break
                    
                    # Accumulate characters
                    char_buffer += data
                    
                    # Flush on newline, common prompt patterns, or when buffer grows
                    if data in ['\n', '\r'] or char_buffer.endswith(': ') or char_buffer.endswith('> ') or len(char_buffer) > 64:
                        if block_id in self._output_buffer:
                            to_stream = self._output_buffer[block_id].append(char_buffer)
                            if to_stream:
                                await client.send_response(shell_block_message_result_msg(todo_id, block_id, to_stream, request_id))
                        char_buffer = ""
                    
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
                        
                        # Buffer and stream only what's needed
                        if block_id in self._output_buffer:
                            to_stream = self._output_buffer[block_id].append(data)
                            if to_stream:
                                await client.send_response(shell_block_message_result_msg(todo_id, block_id, to_stream, request_id))
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
                # Reset truncation so response to user input is streamed
                if block_id in self._output_buffer:
                    self._output_buffer[block_id].reset_for_interaction()
                
                writer = self._stdin_writers.get(block_id)
                if writer and not writer.closed:
                    if not input_text.endswith('\n'):
                        input_text += '\n'
                    writer.write(input_text)  # write text for both Windows and Unix
                    writer.flush()
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
            
            # Handle output buffer - send truncation notice or no-output message
            buf = self._output_buffer.get(block_id)
            if not buf or buf.total_len == 0:
                await client.send_response(shell_block_message_result_msg(
                    todo_id, block_id, "Finished with no output", request_id
                ))
            else:
                # Send truncation notice with last part if output was truncated
                truncation_msg = buf.get_truncation_notice()
                if truncation_msg:
                    await client.send_response(shell_block_message_result_msg(
                        todo_id, block_id, truncation_msg, request_id
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
