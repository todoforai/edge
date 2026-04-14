# Shell Command Image Output

## What it does
When a shell command outputs a data URL image (`data:image/png;base64,...`), the edge detects it and passes `contentType` alongside the result. The agent creates an image attachment instead of text, so the LLM sees the actual image.

## Use case
Tools that output images to stdout as data URLs:
- `agent-browser` screenshots
- `todoforai-browser` screenshots  
- Any CLI that outputs base64-encoded images

## Full pipeline

```
Shell cmd stdout: "data:image/png;base64,iVBOR..."
  ↓
Edge (functions.ts): detectContentType() matches DATA_URL_IMAGE_REGEX
  ↓
Edge returns: { cmd, result: "data:image/png;base64,...", contentType: "image/png" }
  ↓
Agent (BashTool.jl): CommandResponse.contentType = "image/png"
  ↓
Agent get_result(): decode_data_url(result) → raw bytes → create_attachment(mimeType, data)
  ↓
send_block_result! → send_attachments! (binary WS frames) → BLOCK_UPDATE
  ↓
Backend stores attachment → ToolMessage(image_data=[data_url])
  ↓
OpenRouter.jl: to_anthropic_messages / to_openai_messages → image content block
  ↓
LLM sees image
```

## Implementation across repos

### Edge (`edge/bun/src/functions.ts`)
- `DATA_URL_IMAGE_REGEX` — matches `data:image/*;base64,...` as entire output
- `detectContentType(output, cmd)` — returns `{ result, contentType? }`
- `getBlockRawOutput(blockId)` — untruncated output (truncated base64 = useless)
- Applied in both streaming and non-streaming `execute_shell_command` paths

### Edge shell buffer (`edge/bun/src/shell.ts`)
- `getRawIfComplete()` — full untruncated output, or `null` if truncated
- If truncated → falls back to text result (no broken base64 sent)

### Agent (`agent/src/tool/edge/BashTool.jl`)
- `CommandResponse` has `contentType::Union{String,Nothing}`
- `get_result()` checks `contentType` — if `image/*`:
  - `decode_data_url(result)` → `Vector{UInt8}` (via ToolCallFormat.jl)
  - `create_attachment(name, data, mimeType)` → `AttachmentDataCreate`
  - Returns `ToolRunResult(attachments=[...])`
- Otherwise: `todo_attachment()` → text attachment

### ToolCallFormat.jl (`ToolCallFormat.jl/src/process_result.jl`)
- `decode_data_url(s)` — strips `data:mime;base64,` prefix, base64-decodes to bytes
- `Blob` type holds binary data with mime

### Agent transport (`agent/src/interfaces/clientAPI/client_types.jl`)
- `send_block_result!()` calls `get_result(tool)` → `send_attachments!()` (binary WS frames)
- Backend stores attachment, frontend/LLM gets image

### OpenRouter.jl (`OpenRouter.jl/src/messages.jl`)
- `ToolMessage` has `image_data::Union{Nothing, Vector{String}}`
- Anthropic: native `tool_result` with `image` content blocks (base64 inline)
- OpenAI: images deferred to user message after tool results (API limitation)

### EasyContext.jl (standalone/local path)
- `NativeExtractor.collect_tool_messages()` calls `resultimg2base64(tool)` → `ToolMessage(image_data=...)`
- `ShellBlockTool` (local bash) does NOT have image detection — runs locally, no edge
- Image support in standalone EasyContext would need: detect data URL in `cmd_all_info_stream` output, store as `process_result` Blob

## Testing needed

### TODO4AI agent (edge path) — primary target
1. **Screenshot via agent-browser:**
   ```
   agent-browser screenshot --url https://example.com --output stdout
   ```
   Verify: LLM sees screenshot image, not base64 text

2. **Screenshot via todoforai-browser:**
   ```
   todoforai-browser screenshot --url https://example.com
   ```

3. **Synthetic test:**
   ```bash
   echo "data:image/png;base64,$(base64 -w0 < test/input.png)"
   ```

4. **Large image (near truncation):**
   - If output truncated → should fall back to text (no broken base64)

5. **Non-image data URL should NOT match:**
   ```bash
   echo "data:text/plain;base64,SGVsbG8="
   ```

6. **Mixed output should NOT match:**
   - Regex requires entire output to be a single data URL

### EasyContext.jl (standalone) — not yet supported
- `ShellBlockTool` runs locally, no `contentType` detection
- Would need `resultimg2base64` override or `process_result` Blob from shell output
- Lower priority: standalone use case rarely needs image-from-shell

### Edge cases
- Trailing newline: handled (`output.trim()`)
- Very large images exceeding shell buffer → truncated → `getRawIfComplete()` returns null → text fallback
- Non-streaming path (no blockId) uses `exec` → always full output → detection works
