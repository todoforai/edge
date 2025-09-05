#!/usr/bin/env python3
"""
Test various shell edge cases to ensure proper handling.
"""
import asyncio
import uuid
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from todoforai_edge.handlers.shell_handler import ShellProcess

class TestClient:
    def __init__(self):
        self.messages = []
    
    async def send_response(self, message):
        self.messages.append(message)
        content = message.get('payload', {}).get('content', '')
        if content:
            print(content, end='', flush=True)

async def test_case(name, command, input_text=None, expected_patterns=None):
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"COMMAND: {command}")
    print(f"{'='*60}")
    
    client = TestClient()
    sp = ShellProcess()
    block_id = str(uuid.uuid4())
    
    try:
        await sp.execute_block(block_id, command, client, "test", "test", 10, "")
        
        if input_text:
            await asyncio.sleep(1)  # Wait for prompt
            print(f"\n[SENDING INPUT: {input_text}]")
            await sp.send_input(block_id, input_text)
        
        await asyncio.sleep(3)  # Wait for completion
        
        # Check if process is still running and interrupt if needed
        if block_id in sp.processes:
            print("\n[INTERRUPTING PROCESS]")
            sp.interrupt_block(block_id)
            
    except Exception as e:
        print(f"\nERROR: {e}")
    
    print(f"\n[TEST COMPLETED: {name}]")

async def main():
    print("Testing Shell Handler Edge Cases")
    print("=" * 60)
    
    # Test 1: Basic command that works
    await test_case(
        "Basic Command", 
        "echo 'Hello World'"
    )
    
    # Test 2: Interactive command with input
    await test_case(
        "Interactive Read",
        "read -p 'Enter name: ' name && echo Hello $name",
        "Alice"
    )
    
    # Test 3: Command that expects stdin but we don't provide it (should timeout/fail gracefully)
    await test_case(
        "Stdin Reader (unsupported - should timeout)",
        "cat"  # Will wait for stdin indefinitely
    )
    
    # Test 4: Command with pipes (should work)
    await test_case(
        "Pipe Command",
        "echo 'line1\nline2\nline3' | grep line2"
    )
    
    # Test 5: Command that fails
    await test_case(
        "Failing Command",
        "ls /nonexistent/directory"
    )
    
    # Test 6: Long running command
    await test_case(
        "Long Running Command (will be interrupted)",
        "sleep 20"
    )
    
    # Test 7: Command with environment variables
    await test_case(
        "Environment Variables",
        "export TEST_VAR='hello' && echo $TEST_VAR"
    )
    
    # Test 8: Multi-line command
    await test_case(
        "Multi-line Command",
        """
        for i in {1..3}; do
            echo "Count: $i"
            sleep 0.5
        done
        """
    )
    
    # Test 9: Command with special characters
    await test_case(
        "Special Characters",
        "echo 'Special chars: !@#$%^&*()'"
    )
    
    # Test 10: Interactive sudo (if available)
    if os.geteuid() != 0:  # Only test if not already root
        await test_case(
            "Interactive Sudo",
            "sudo -k whoami",
            "wrongpassword"  # This will fail but show the interaction
        )
    
    print(f"\n{'='*60}")
    print("EDGE CASES NOT SUPPORTED:")
    print("- Commands that read from stdin pipe (like 'rg -', 'cat', etc.)")
    print("- Commands that require continuous stdin input")
    print("- Commands that need raw terminal mode")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())