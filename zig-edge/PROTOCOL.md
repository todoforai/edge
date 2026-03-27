# Edge Shell Protocol v2

Lightweight WebSocket protocol for PTY relay between zig-edge client and backend.

## Connection

```
Endpoint: wss://api.todofor.ai/ws/v2/edge-shell
Auth: Bearer token in Authorization header
```

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

**Exit** (when PTY process exits)
```json
{
  "type": "exit",
  "code": 0
}
```
- `code`: Exit code (negative = killed by signal, e.g., -9 = SIGKILL)

#### Server → Edge

**Exec** (spawn PTY)
```json
{
  "type": "exec",
  "shell": "/bin/bash",  // optional, default: system shell
  "cwd": "/tmp",         // optional, default: home
  "env": {"FOO": "bar"}  // optional
}
```

**Resize** (resize PTY window)
```json
{
  "type": "resize",
  "rows": 24,
  "cols": 80
}
```

**Signal** (send signal to PTY process)
```json
{
  "type": "signal",
  "sig": 2
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

### Binary Frames - PTY Data

Raw bytes, no encoding:
- **Server → Edge**: stdin (keyboard input to PTY)
- **Edge → Server**: stdout/stderr (terminal output from PTY)

## Connection Flow

```
1. Client connects to wss://api.todofor.ai/ws/v2/edge-shell
2. Server authenticates via Bearer token
3. Client sends "identity" message
4. Server stores identity in edge metadata
5. Server sends "exec" to spawn PTY
6. Client spawns PTY, starts forwarding I/O
7. Binary frames flow bidirectionally
8. On PTY exit, client sends "exit" message
9. Server can send "resize"/"signal" anytime
```

## Error Handling

```json
{
  "type": "error",
  "message": "Description of error",
  "code": "ERROR_CODE"  // optional
}
```

## TypeScript Types

See: `packages/shared-fbe/src/edgeShellProtocol.ts`

```typescript
import {
  EdgeShellMessageType,
  EdgeShellIdentity,
  ExecMessage,
  ResizeMessage,
  SignalMessage,
  PtySignal,
  // ... etc
} from '@shared/fbe';
```
