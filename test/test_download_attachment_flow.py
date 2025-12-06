import os
import asyncio
import pytest

from todoforai_edge.edge_functions import download_attachment, register_attachment


@pytest.mark.asyncio
async def test_download_attachment_roundtrip_public(tmp_path):
    """Upload a small public file then download it via the edge function."""
    api_key = os.getenv("TODOFORAI_API_KEY_DEV") or os.getenv("TODOFORAI_API_KEY_LOCAL")
    if not api_key:
        pytest.skip("TODOFORAI_API_KEY_DEV not set")

    api_url = os.getenv("TODOFORAI_API_BASE", "http://localhost:4000")
    upload_endpoint = f"{api_url}/api/v1/files/register"

    class DummyClient:
        def __init__(self, api_url: str, api_key: str):
            self.api_url = api_url
            self.api_key = api_key

    client = DummyClient(api_url, api_key)

    # Create a temp file to upload
    src = tmp_path / "edge-dl-test.txt"
    payload_bytes = b"hello download public test"
    src.write_bytes(payload_bytes)

    upload_result = await register_attachment(str(src), userId="test-user", isPublic=True, rootPath="", client_instance=client)
    assert upload_result.get("success"), f"Upload failed: {upload_result}"
    attachment_id = upload_result.get("attachmentId")
    assert attachment_id, "No attachmentId returned from upload"

    dest = tmp_path / "downloaded.txt"
    result = await download_attachment(attachment_id, str(dest), "", client)

    assert result.get("success"), f"Download failed: {result}"
    assert dest.exists(), "Downloaded file missing"
    assert dest.read_bytes() == payload_bytes, "Downloaded content mismatch"

