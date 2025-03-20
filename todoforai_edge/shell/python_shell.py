import asyncio
import subprocess
import signal
import sys
import time

from typing import Dict, Any, Optional


class PythonShell:
    def __init__(self):
        self.processes: Dict[str, subprocess.Popen] = {}
        
    async def execute_block(self, block_id: str, code: str, client, todo_id: str, request_id: str, timeout: Optional[float] = None):
        """Execute a Python code block and stream results back to client."""
        # Create process with pipes for stdin/stdout/stderr
        process = subprocess.Popen(
            [sys.executable, "-u", "-c", code],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Store process for potential interruption
        self.processes[block_id] = process
        
        # Set up tasks to read stdout and stderr
        stdout_task = asyncio.create_task(self._stream_output(process.stdout, client, todo_id, request_id, block_id, "stdout"))
        stderr_task = asyncio.create_task(self._stream_output(process.stderr, client, todo_id, request_id, block_id, "stderr"))
        
        # Set up timeout if specified
        timeout_task = None
        if timeout is not None:
            timeout_task = asyncio.create_task(self._handle_timeout(block_id, timeout, client, todo_id, request_id))
        
        # Wait for process to complete
        try:
            if timeout_task:
                # Wait for either the process to complete or timeout to occur
                await asyncio.gather(stdout_task, stderr_task, timeout_task)
            else:
                await asyncio.gather(stdout_task, stderr_task)
                
            return_code = await asyncio.get_event_loop().run_in_executor(None, process.wait)
            
            # Send completion message
            await client._send_response(block_done_result_msg(todo_id, request_id, block_id, "execute", {"return_code": return_code}))
            
        except asyncio.CancelledError:
            self.interrupt_block(block_id)
            raise
        finally:
            # Clean up
            if timeout_task and not timeout_task.done():
                timeout_task.cancel()
            if block_id in self.processes:
                del self.processes[block_id]
    
    async def _handle_timeout(self, block_id: str, timeout: float, client, todo_id: str, request_id: str):
        """Handle timeout for a running process."""
        await asyncio.sleep(timeout)
        if block_id in self.processes:
            # Process is still running after timeout, terminate it
            self.interrupt_block(block_id)
            
            # Send timeout message
            await client._send_response(block_done_result_msg(
                todo_id, request_id, block_id, "execute", 
                {"error": f"Execution timed out after {timeout} seconds", "status": "timeout"}
            ))
    
    async def _stream_output(self, stream, client, todo_id: str, request_id: str, block_id: str, stream_type: str):
        """Stream output from process to client."""
        while True:
            line = await asyncio.get_event_loop().run_in_executor(None, stream.readline)
            
            if not line:
                break
                
            # Send output to client
            await client._send_response(block_output_msg(todo_id, request_id, block_id, stream_type, line))
    
    def interrupt_block(self, block_id: str):
        """Interrupt a running process."""
        if block_id in self.processes:
            process = self.processes[block_id]
            try:
                # Send interrupt signal
                process.send_signal(signal.SIGINT)
                # Give it a moment to handle the signal
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                # Force terminate if it doesn't respond to interrupt
                process.terminate()
                try:
                    process.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    # Kill as last resort
                    process.kill()
    
    async def send_input(self, block_id: str, input_text: str):
        """Send input to a running process."""
        if block_id in self.processes:
            process = self.processes[block_id]
            if process.stdin:
                # Add newline if not present
                if not input_text.endswith('\n'):
                    input_text += '\n'
                    
                # Write to stdin
                process.stdin.write(input_text)
                process.stdin.flush()
                return True
        return False


# Helper functions to create response messages
def block_output_msg(todo_id: str, request_id: str, block_id: str, stream_type: str, content: str):
    return {
        "type": "block_output",
        "todo_id": todo_id,
        "request_id": request_id,
        "block_id": block_id,
        "stream_type": stream_type,
        "content": content
    }


def block_done_result_msg(todo_id: str, request_id: str, block_id: str, action: str, data: Optional[Dict[str, Any]] = None):
    return {
        "type": "block_done",
        "todo_id": todo_id,
        "request_id": request_id,
        "block_id": block_id,
        "action": action,
        "data": data or {}
    }


# Example handler function
async def handle_block_execute(payload, client):
    """Handle block execution request."""
    todo_id = payload.get("todo_id", "")
    request_id = payload.get("request_id", "")
    block_id = payload.get("block_id", "")
    code = payload.get("code", "")
    timeout = payload.get("timeout")  # Optional timeout in seconds
    
    shell = PythonShell()
    try:
        await shell.execute_block(block_id, code, client, todo_id, request_id, timeout)
    except Exception as e:
        # Send error message
        await client._send_response(block_done_result_msg(
            todo_id, request_id, block_id, "execute", 
            {"error": str(e), "status": "error"}
        ))


# Example handler for input
async def handle_block_input(payload, client):
    """Handle input to a running block."""
    block_id = payload.get("block_id", "")
    input_text = payload.get("input", "")
    
    shell = PythonShell()
    success = await shell.send_input(block_id, input_text)
    
    return {"success": success}


# Example handler for interruption
async def handle_block_interrupt(payload, client):
    """Handle block interruption request."""
    todo_id = payload.get("todo_id", "")
    request_id = payload.get("request_id", "")
    block_id = payload.get("block_id", "")
    
    shell = PythonShell()
    shell.interrupt_block(block_id)
    
    await client._send_response(block_done_result_msg(
        todo_id, request_id, block_id, "interrupt", 
        {"status": "interrupted"}
    ))