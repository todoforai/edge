# TODOforAI Bridge Shell Protocol v2

Lightweight WebSocket protocol for PTY relay between the Bridge Zig runtime and backend.

## Connection

```
Endpoint: wss://api.todofor.ai/ws/v2/edge-shell
Auth: Bearer token in Authorization header (or sec-websocket-protocol)
```

Note: The WebSocket server is mounted at `/ws`, and the edge-shell handler is at `/v2/edge-shell`.

## Multi-Session Support

Each edge connection can manage multiple PTY sessions, keyed by `todoId`. This allows different todos to have isolated shell environments on the same edge device.

### Constraints

- **`todoId`**: Must be a valid UUID (36 chars, format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- **`blockId`**: Optional, max 64 characters (longer values are truncated)
- **Max sessions**: 16 concurrent PTY sessions per edge connection
- **Input buffer**: 4096 bytes max per input message (after base64 decode)

## Block-Level Routing

Commands can include an optional `blockId` to enable routing of responses back to the specific code block that initiated the command. The edge echoes back the `blockId` in output/exit/error messages.

**Important**: The edge stores only one `blockId` per PTY session. Each `input` message updates the current `blockId`. This means:
- Output from earlier commands may be tagged with a newer `blockId` if commands interleave
- For reliable routing, ensure only one block sends input to a PTY at a time
- Alternatively, use separate `todoId` sessions for each block that needs isolated output

## Message Types

### Text Frames (JSON) - Control Messages

#### Edge → Server

**Identity** (sent on connect)
```json
{
  "type": "identity",
  "data": {
    "edge_version": "0.1.0",
    "os": "Linux",
    "arch": "x86_64",
    "hostname": "myhost",
    "kernel": "6.5.0-21-generic",
    "user": "alice",
    "shell": "/bin/zsh",
    "home": "/home/alice",
    "cwd": "/home/alice/projects"
  }
}
```

**Output** (PTY stdout, base64-encoded)
```json
{
  "type": "output",
  "todoId": "uuid-of-todo",
  "blockId": "block-id",   // echoed from input, if set
  "data": "base64-encoded-stdout"
}
```

**Exit** (when PTY process exits)
```json
{
  "type": "exit",
  "todoId": "uuid-of-todo",
  "blockId": "block-id",   // echoed from last input, if set
  "code": 0
}
```
- `code`: Exit code (negative = killed by signal, e.g., -9 = SIGKILL)

#### Server → Edge

**Exec** (spawn PTY for a session)
```json
{
  "type": "exec",
  "todoId": "uuid-of-todo",
  "blockId": "block-id",   // optional, echoed in responses
  "shell": "/bin/bash",    // optional, default: /bin/sh (not yet implemented)
  "cwd": "/tmp",           // optional (not yet implemented)
  "env": {"FOO": "bar"}    // optional (not yet implemented)
}
```
Note: `shell`, `cwd`, and `env` are defined in the protocol but not yet implemented in zig-edge.

**Input** (send stdin to PTY, base64-encoded)
```json
{
  "type": "input",
  "todoId": "uuid-of-todo",
  "blockId": "block-id",   // optional, sets current block for responses
  "data": "base64-encoded-stdin"
}
```

**Resize** (resize PTY window)
```json
{
  "type": "resize",
  "todoId": "uuid-of-todo",
  "rows": 24,
  "cols": 80
}
```

**Signal** (send signal to PTY process)
```json
{
  "type": "signal",
  "todoId": "uuid-of-todo",
  "sig": 2
}
```

**Kill** (terminate PTY session)
```json
{
  "type": "kill",
  "todoId": "uuid-of-todo"
}
```

Allowed signals:
| Signal | Value | Description |
|--------|-------|-------------|
| SIGINT | 2 | Interrupt (Ctrl+C) |
| SIGQUIT | 3 | Quit (Ctrl+\) |
| SIGKILL | 9 | Kill (cannot be caught) |
| SIGTERM | 15 | Terminate |
| SIGCONT | 18 | Continue |
| SIGSTOP | 19 | Stop (cannot be caught) |
| SIGTSTP | 20 | Terminal stop (Ctrl+Z) |
| SIGWINCH | 28 | Window size change |

## Connection Flow

```
1. Client connects to wss://api.todofor.ai/ws/v2/edge-shell
2. Server authenticates via Bearer token
3. Client sends "identity" message
4. Server stores identity in edge metadata
5. For each todo session:
   a. Server sends "exec" with todoId to spawn PTY
   b. Client spawns PTY, maps it to todoId
   c. Server sends "input" messages (base64)
   d. Client sends "output" messages (base64)
   e. On PTY exit, client sends "exit" with todoId
6. Server can send "resize"/"signal"/"kill" anytime with todoId
7. Multiple sessions can run concurrently (up to 16)
```

## Error Handling

```json
{
  "type": "error",
  "todoId": "uuid-of-todo",  // optional, for session-scoped errors
  "blockId": "block-id",     // optional, echoed from failed command
  "code": "ERROR_CODE",      // optional error code
  "message": "Description of error"
}
```

Error codes:
| Code | Description |
|------|-------------|
| MISSING_TODO_ID | Command requires todoId but none provided |
| INVALID_TODO_ID | todoId is not a valid UUID |
| SESSION_EXISTS | Session already exists for this todoId |
| SESSION_NOT_FOUND | No session exists for this todoId |
| SPAWN_FAILED | Failed to spawn PTY process |
| MAX_SESSIONS | Maximum concurrent sessions reached (16) |
| MISSING_DATA | input command requires data field |
| MISSING_SIG | signal command requires sig field |
| INVALID_BASE64 | Input data is not valid base64 |
| INPUT_TOO_LARGE | Input exceeds 4096 byte buffer |
| SIGNAL_NOT_ALLOWED | Signal number not in whitelist |

## TypeScript Types

See: `packages/shared-fbe/src/edgeShellProtocol.ts`

```typescript
import {
  EdgeShellMessageType,
  EdgeShellIdentity,
  ExecMessage,
  InputMessage,
  OutputMessage,
  ResizeMessage,
  SignalMessage,
  KillMessage,
  PtySignal,
  // ... etc
} from '@shared/fbe';
```
