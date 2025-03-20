import asyncio
import sys
import os
import time
import json

# Add parent directory to path to import the shell_handler module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shell_handler import ShellProcess


class MockClient:
    """Mock client to receive responses from the shell."""
    def __init__(self):
        self.responses = []
    
    async def _send_response(self, response):
        """Record responses and print them in a readable format."""
        self.responses.append(response)
        
        # Format the response for better readability
        if response.get("type") == "block_output":
            print(f"\n[{response.get('stream_type')}] {response.get('content').strip()}")
        elif response.get("type") == "block_done":
            print(f"\n[DONE] Action: {response.get('action')}")
            if "data" in response and response["data"]:
                for key, value in response["data"].items():
                    print(f"  {key}: {value}")
        else:
            print(f"\nResponse: {json.dumps(response, indent=2)}")

async def test_normal_execution():
    """Test normal execution of Python code."""
    print("\n=== Testing Normal Execution ===")
    client = MockClient()
    shell = ShellProcess()
    
    code = """
print("Hello, World!")
print("This is a test")
"""
    
    await shell.execute_block("block1", code, client, "todo1", "req1")
    print("\nNormal execution test completed")

async def test_input():
    """Test sending input to a running process."""
    print("\n=== Testing Input ===")
    client = MockClient()
    shell = ShellProcess()
    
    code = """
# Standard way to use input
name = input("Enter your name: ")
if name == "Test User":
    print(f"Hello, {name}! You are the one I was looking for.")
else:
    print(f"Hello, {name}. You are the wrong one.")
"""
    
    # Start execution in a task so we can send input
    task = asyncio.create_task(shell.execute_block("block2", code, client, "todo2", "req2"))
    
    # Wait a bit for the process to start and prompt for input
    await asyncio.sleep(2.5)
    
    # Send input
    success = await shell.send_input("block2", "Test User")
    print(f"\nInput sent successfully: {success}")
    
    # Wait for execution to complete
    await task
    print("\nInput test completed")

async def test_timeout():
    """Test timeout functionality."""
    print("\n=== Testing Timeout ===")
    client = MockClient()
    shell = ShellProcess()
    
    # Code that runs for longer than the timeout
    code = """
import time
print("Starting long-running task...")
for i in range(10):
    print(f"Working... {i+1}/10")
    time.sleep(0.5)  # This should exceed our timeout
print("This should not be printed due to timeout")
"""
    
    # Set a short timeout (2 seconds)
    await shell.execute_block("block3", code, client, "todo3", "req3", timeout=2.0)
    print("\nTimeout test completed")

async def test_interrupt():
    """Test interrupting a running process."""
    print("\n=== Testing Interrupt ===")
    client = MockClient()
    shell = ShellProcess()
    
    # Code that runs in an infinite loop
    code = """
import time
print("Starting infinite loop...")
count = 0
while True:
    count += 1
    print(f"Still running... iteration {count}")
    time.sleep(0.5)
"""
    
    # Start execution in a task
    task = asyncio.create_task(shell.execute_block("block4", code, client, "todo4", "req4"))
    
    # Wait a bit for the process to start
    await asyncio.sleep(2)
    
    # Interrupt the process
    shell.interrupt_block("block4")
    print("\nInterrupt signal sent")
    
    # Wait for execution to complete or be cancelled
    try:
        await task
    except asyncio.CancelledError:
        print("Task was cancelled")
    
    print("\nInterrupt test completed")


async def main():
    """Run all tests."""
    await test_normal_execution()
    await test_input()
    await test_timeout()
    await test_interrupt()

if __name__ == "__main__":
    asyncio.run(main())
