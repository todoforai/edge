import asyncio
import pytest
from todoforai_edge.handlers.shell_handler import ShellProcess
from todoforai_edge.constants.constants import Edge2Front as EF

class MockClient:
    def __init__(self):
        self.messages = []

    async def send_response(self, payload):
        self.messages.append(payload)

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

    # Should NOT send a synthetic "Finished with no output" message - just the done message
    msg_types = [msg["type"] for msg in client.messages]
    msg_contents = [msg.get("payload", {}).get("content", "") for msg in client.messages]
    assert not any("Finished with no output" in c for c in msg_contents), f"Did not expect 'Finished with no output' message, got: {client.messages}"
    assert EF.BLOCK_SH_DONE in msg_types, f"Expected {EF.BLOCK_SH_DONE} message, got types: {msg_types}"

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

    # ensure we got streamed output
    result_msgs = [msg for msg in client.messages if msg["type"] == EF.BLOCK_SH_MSG_RESULT]
    result_contents = "".join(msg["payload"]["content"] for msg in result_msgs)
    assert "hello" in result_contents, f"Expected echoed output, got: {result_contents}"
    # ensure we did not add the 'Finished with no output' synthetic message
    assert "Finished with no output" not in result_contents, f"Did not expect 'Finished with no output' when there is output, got: {result_contents}"
