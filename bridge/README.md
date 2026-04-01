# TODOforAI Bridge

Native Bridge app for TODOforAI.

This is the machine-side runtime that:
- understands the local system
- discovers machine capabilities
- exposes a flat machine abstraction to the agent
- runs local actions and commands
- bridges the OS / VM / host to the TODOforAI backend

## Scope

Bridge is broader than shell:
- system identity
- capability discovery
- session/runtime state
- command execution
- local machine integration

## Expected contents

- Zig/native runtime code
- protocol definitions
- machine abstraction code
- capability detection
- local transport / bridge client

## Naming

Product name: **TODOforAI Bridge**

Suggested internal terms:
- `bridge_view`
- `bridge_capabilities`
- `bridge_runtime`

## Bridge view

Bridge should maintain a **flat machine snapshot** so agents can reason about the host cheaply without repeatedly scraping shell output.

Suggested Redis storage:
- latest snapshot in edge metadata as `metadata.bridge_view`
- optional history in `edge:{edgeId}:bridge:history`

Suggested snapshot shape:

```json
{
  "version": 1,
  "capturedAt": 1710000000000,
  "host": {
    "hostname": "my-macbook",
    "os": "Darwin",
    "arch": "aarch64",
    "kernel": "23.4.0"
  },
  "user": {
    "name": "alice",
    "home": "/Users/alice",
    "shell": "/bin/zsh",
    "cwd": "/Users/alice/project"
  },
  "sessions": [
    {
      "todoId": "...",
      "shell": "/bin/sh",
      "cwd": "/tmp",
      "status": "running"
    }
  ],
  "workspaces": ["/Users/alice/project"],
  "summary": {
    "sessionCount": 1,
    "workspaceCount": 1
  }
}
```

## Non-goals

Do not turn Bridge into heavy surveillance or telemetry.
Avoid by default:
- raw terminal output storage
- deep process inspection
- keystroke logging
- screenshot streaming
- large event histories

## First implementation target

1. add `bridge_view` to edge metadata
2. populate from identity message
3. update `sessions` on exec/exit
4. expose through the existing edge router

## Note

Current Zig Bridge code lives in `edge/bridge/zig`.
Keep transport/protocol and machine-abstraction concerns separated where possible.
