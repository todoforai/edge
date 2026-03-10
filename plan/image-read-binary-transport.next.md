# Image Read: Future Improvements

## Current Flow
Edge reads image → base64 data URL in JSON (`content`) → backend relays JSON → agent decodes to raw bytes → `AttachmentDataCreate(mimeType, data)` → `ToolMessage(image_data)` → LLM API image content block.

Works, but base64 in JSON adds ~33% size overhead through the relay.

## Binary Transport (Edge → Agent)
Skip base64: send raw image bytes as a binary WebSocket frame, JSON metadata references it via `binaryId`.

### Why not yet
Requires coordinated changes across 3 repos:
1. **Edge**: add `sendBinary()`, send binary frame before JSON response
2. **Backend** (`EdgeHandler`): pair incoming binary frame from edge with `FILE_CHUNK_RESULT`, use `publishWithBinary()` to relay both to agent
3. **Agent**: in `send_response_sync` / `FILE_CHUNK_RESULT` handler, check `binaryId` and pair with `client.binary_buffer`

Infrastructure exists (`publishWithBinary`, `handle_binary_frame`, `pack_binary_frame`) but isn't wired for the file-read path.

### When it matters
- Images approaching 5MB limit (1.7MB overhead)
- High-frequency image reads
- Latency-sensitive workflows

### Propagate `content_type` from edge
Edge already sends `content_type` in `FILE_CHUNK_RESULT` but agent ignores it (`FileContentResponse` only has `content` + `full_path`). Using it would avoid re-deriving mime from file extension on the agent side. Requires adding `content_type` field to `FileContentResponse` and plumbing through `RemoteEdgePath.read()` → `doc_read()` → `ReadTool`.
