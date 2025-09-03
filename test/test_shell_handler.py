import asyncio
import pytest
from todoforai_edge.handlers.shell_handler import ShellProcess

class MockClient:
    def __init__(self):
        self.messages = []

    async def send_response(self, payload):
        # store as string to avoid dependence on exact structure
        self.messages.append(str(payload))

@pytest.mark.asyncio
async def test_successful_run_no_output():
    sp = ShellProcess()
    client = MockClient()
    block_id = "block-no-output"
    todo_id = "todo1"
    request_id = "req1"

    await sp.execute_block(block_id, "true", client, todo_id, request_id, timeout=5.0)

    # wait until process is gone (completed) or timeout
    for _ in range(200):
        if block_id not in sp.processes:
            break
        await asyncio.sleep(0.01)
    await asyncio.sleep(0.05)  # allow final messages to flush

    assert any("Finished with no output" in msg for msg in client.messages), f"Expected 'Finished with no output' message, got: {client.messages}"

@pytest.mark.asyncio
async def test_successful_run_with_output():
    sp = ShellProcess()
    client = MockClient()
    block_id = "block-with-output"
    todo_id = "todo2"
    request_id = "req2"

    await sp.execute_block(block_id, "echo hello", client, todo_id, request_id, timeout=5.0)

    # wait until process is gone (completed) or timeout
    for _ in range(200):
        if block_id not in sp.processes:
            break
        await asyncio.sleep(0.01)
    await asyncio.sleep(0.05)  # allow final messages to flush

    # ensure we got output
    assert any("hello" in msg for msg in client.messages), f"Expected echoed output, got: {client.messages}"
    # ensure we did not add the 'Finished with no output' synthetic message
    assert not any("Finished with no output" in msg for msg in client.messages), f"Did not expect 'Finished with no output' when there is output, got: {client.messages}"