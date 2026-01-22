# Shell Execution

## Overview

Shell execution is the most complex component to port due to Python's PTY (pseudo-terminal) support which is unavailable in Neutralino.js. This document covers what can and cannot be ported.

## Python Implementation

Location: `/edge/todoforai_edge/handlers/shell_handler.py`

### Key Features

1. **PTY Support** - Creates pseudo-terminals for interactive programs
2. **Platform-specific shells** - Bash on Unix, PowerShell/cmd on Windows
3. **Process group management** - Signals sent to entire process tree
4. **Real-time streaming** - Output streamed as it's produced
5. **Interactive input** - stdin handling for prompts
6. **Timeout management** - Kills long-running processes

```python
class ShellProcess:
    def __init__(self, client, block_id, todo_id, timeout=120):
        self.client = client
        self.block_id = block_id
        self.timeout = timeout

    async def execute_block(self, content, cwd=None, request_id=None):
        # Platform-specific shell selection
        if os.name == 'nt':
            # Windows: PowerShell or cmd
            shell_cmd = self._get_windows_shell(content)
        else:
            # Unix: bash with PTY
            shell_cmd = ['/bin/bash', '-c', content]

        # Create process with PTY (Unix only)
        if os.name != 'nt':
            master_fd, slave_fd = os.openpty()
            process = subprocess.Popen(
                shell_cmd,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                preexec_fn=os.setsid,  # New process group
                cwd=cwd
            )
        else:
            process = subprocess.Popen(
                shell_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=cwd
            )

        # Stream output and handle completion
        ...
```

## Neutralino.js Implementation

### What Works

- Basic command execution
- Output capture (stdout/stderr)
- Process termination
- Working directory
- Environment variables

### What Doesn't Work

- PTY (pseudo-terminal)
- Interactive programs (vim, less, etc.)
- Password prompts (sudo)
- Process group signals
- Full stdin streaming

### Shell Handler

```typescript
// src/ShellHandler.ts

interface ShellProcess {
  id: number;
  pid: number;
  blockId: string;
  startTime: number;
}

interface ExecuteOptions {
  blockId: string;
  content: string;
  cwd?: string;
  timeout?: number;
  todoId?: string;
  requestId?: string;
}

export class ShellHandler {
  private processes: Map<string, ShellProcess> = new Map();
  private outputBuffers: Map<string, string> = new Map();

  constructor(private edge: Edge) {}

  async executeBlock(options: ExecuteOptions): Promise<void> {
    const { blockId, content, cwd, timeout = 120000 } = options;

    // Send start message
    await this.edge.sendResponse({
      type: 'block:sh_msg_start',
      payload: { blockId }
    });

    try {
      // Build command based on platform
      const command = this.buildCommand(content);

      // Spawn process
      const proc = await Neutralino.os.spawnProcess(command, {
        cwd: cwd || undefined
      });

      // Track process
      this.processes.set(blockId, {
        id: proc.id,
        pid: proc.pid,
        blockId,
        startTime: Date.now()
      });

      // Set up output handler
      this.outputBuffers.set(blockId, '');
      const handler = this.createOutputHandler(blockId);
      Neutralino.events.on('spawnedProcess', handler);

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.interruptBlock(blockId, 'Timeout exceeded');
      }, timeout);

      // Store cleanup info
      this.processes.get(blockId)!.cleanup = () => {
        clearTimeout(timeoutId);
        Neutralino.events.off('spawnedProcess', handler);
      };

    } catch (error) {
      await this.edge.sendResponse({
        type: 'block:error_result',
        payload: { blockId, error: String(error) }
      });
    }
  }

  private buildCommand(content: string): string {
    // Detect platform
    const isWindows = NL_OS === 'Windows';

    if (isWindows) {
      // Use PowerShell with UTF-8 encoding
      const escaped = content.replace(/"/g, '\\"');
      return `powershell -NoProfile -Command "${escaped}"`;
    } else {
      // Use bash
      const escaped = content.replace(/'/g, "'\\''");
      return `/bin/bash -c '${escaped}'`;
    }
  }

  private createOutputHandler(blockId: string): (evt: CustomEvent) => void {
    return async (evt: CustomEvent) => {
      const proc = this.processes.get(blockId);
      if (!proc || evt.detail.id !== proc.id) return;

      const { action, data } = evt.detail;

      switch (action) {
        case 'stdOut':
        case 'stdErr':
          // Buffer and send output
          await this.handleOutput(blockId, data);
          break;

        case 'exit':
          // Process completed
          await this.handleExit(blockId, parseInt(data) || 0);
          break;
      }
    };
  }

  private async handleOutput(blockId: string, data: string): Promise<void> {
    // Send output immediately (real-time streaming)
    await this.edge.sendResponse({
      type: 'block:sh_msg_result',
      payload: { blockId, output: data }
    });
  }

  private async handleExit(blockId: string, exitCode: number): Promise<void> {
    const proc = this.processes.get(blockId);
    if (proc?.cleanup) {
      proc.cleanup();
    }

    this.processes.delete(blockId);
    this.outputBuffers.delete(blockId);

    await this.edge.sendResponse({
      type: 'block:sh_done',
      payload: { blockId, returnCode: exitCode }
    });
  }

  async sendInput(blockId: string, input: string): Promise<void> {
    const proc = this.processes.get(blockId);
    if (!proc) {
      console.warn(`No process found for block ${blockId}`);
      return;
    }

    try {
      await Neutralino.os.updateSpawnedProcess(proc.id, 'stdIn', input);
    } catch (error) {
      console.error(`Failed to send input to ${blockId}:`, error);
    }
  }

  async interruptBlock(blockId: string, reason?: string): Promise<void> {
    const proc = this.processes.get(blockId);
    if (!proc) return;

    try {
      // Neutralino only supports terminating the process
      // No SIGINT/SIGTERM distinction
      await Neutralino.os.updateSpawnedProcess(proc.id, 'exit');

      if (reason) {
        await this.edge.sendResponse({
          type: 'block:sh_msg_result',
          payload: { blockId, output: `\n[${reason}]\n` }
        });
      }
    } catch (error) {
      console.error(`Failed to interrupt ${blockId}:`, error);
    }

    // Cleanup will happen in handleExit
  }

  // Get all running processes
  getRunningProcesses(): string[] {
    return Array.from(this.processes.keys());
  }

  // Interrupt all processes (for cleanup)
  async interruptAll(): Promise<void> {
    for (const blockId of this.processes.keys()) {
      await this.interruptBlock(blockId);
    }
  }
}
```

## Limitations and Workarounds

### 1. No PTY Support

**Problem**: Interactive programs expect a terminal.

**Impact**:
- `vim`, `nano`, `less` won't work
- Progress bars may not display correctly
- Color output may be stripped
- Line editing won't work

**Workarounds**:
- Set `TERM=dumb` to disable terminal features
- Use `--no-pager` flags where available
- Use non-interactive alternatives (`cat` instead of `less`)

```typescript
private buildCommand(content: string): string {
  // Add environment variables to disable terminal features
  const env = 'TERM=dumb NO_COLOR=1';

  if (NL_OS === 'Windows') {
    return `cmd /c "set ${env} && ${content}"`;
  } else {
    return `/bin/bash -c 'export ${env}; ${content}'`;
  }
}
```

### 2. No Process Group Signals

**Problem**: Can't send SIGINT to child processes.

**Impact**:
- `Ctrl+C` equivalent won't stop child processes
- Pipeline commands may leave orphans
- Background jobs won't be cleaned up

**Workarounds**:
- Use `timeout` command wrapper
- Kill by PID (if we can get child PIDs)
- Accept some orphan processes

```typescript
// Wrap commands with timeout
private buildCommand(content: string, timeout: number): string {
  const timeoutSec = Math.floor(timeout / 1000);

  if (NL_OS !== 'Windows') {
    // Use timeout command on Unix
    return `/bin/bash -c 'timeout ${timeoutSec} bash -c "${content.replace(/"/g, '\\"')}"'`;
  }
  // Windows doesn't have timeout command for this purpose
  return content;
}
```

### 3. No Password Prompts

**Problem**: `sudo` requires password input with echo disabled.

**Impact**:
- `sudo` commands will fail or hang
- Any password prompt will be problematic

**Workarounds**:
- Document that sudo isn't supported
- Use passwordless sudo in sudoers
- Run edge as root (not recommended)
- Pre-authenticate with `sudo -v`

```typescript
// Check for sudo and warn
private checkForSudo(content: string): boolean {
  if (content.includes('sudo ')) {
    console.warn('sudo commands may not work - password prompts not supported');
    return true;
  }
  return false;
}
```

### 4. Limited Real-time Streaming

**Problem**: Some programs buffer output.

**Impact**:
- Output may come in chunks
- Progress updates may be delayed

**Workarounds**:
- Use `stdbuf -oL` on Linux to force line buffering
- Use `python -u` for unbuffered Python
- Accept buffered output

```typescript
private buildCommand(content: string): string {
  if (NL_OS !== 'Windows') {
    // Force line buffering
    return `/bin/bash -c 'stdbuf -oL ${content}'`;
  }
  return content;
}
```

## Handler Integration

```typescript
// src/handlers/index.ts

export function registerShellHandlers(
  router: MessageRouter,
  shellHandler: ShellHandler
): void {
  router.on('block:execute', async (payload) => {
    await shellHandler.executeBlock({
      blockId: payload.blockId,
      content: payload.content,
      cwd: payload.cwd,
      timeout: payload.timeout,
      todoId: payload.todoId,
      requestId: payload.requestId
    });
  });

  router.on('block:keyboard', async (payload) => {
    await shellHandler.sendInput(payload.blockId, payload.input);
  });

  router.on('block:interrupt', async (payload) => {
    await shellHandler.interruptBlock(payload.blockId);
  });
}
```

## Feature Comparison

| Feature | Python | Neutralino | Notes |
|---------|--------|------------|-------|
| Basic execution | Yes | Yes | Works well |
| Stdout capture | Yes | Yes | Works well |
| Stderr capture | Yes | Yes | Works well |
| Working directory | Yes | Yes | Works well |
| Environment vars | Yes | Partial | At spawn time only |
| Real-time output | Yes | Partial | May be buffered |
| Stdin input | Yes | Partial | No echo control |
| PTY | Yes | No | Cannot implement |
| Interactive | Yes | No | Cannot implement |
| SIGINT | Yes | No | Only terminate |
| SIGTERM | Yes | No | Only terminate |
| SIGKILL | Yes | Yes | Via terminate |
| Process groups | Yes | No | Cannot implement |
| Timeout | Yes | Yes | Manual implementation |

## Testing Shell Handler

```typescript
async function testShellHandler() {
  const handler = new ShellHandler(mockEdge);

  // Test basic command
  await handler.executeBlock({
    blockId: 'test-1',
    content: 'echo "Hello World"'
  });

  // Test with working directory
  await handler.executeBlock({
    blockId: 'test-2',
    content: 'pwd',
    cwd: '/tmp'
  });

  // Test timeout
  await handler.executeBlock({
    blockId: 'test-3',
    content: 'sleep 10',
    timeout: 2000
  });

  // Test interrupt
  await handler.executeBlock({
    blockId: 'test-4',
    content: 'sleep 100'
  });
  setTimeout(() => handler.interruptBlock('test-4'), 1000);
}
```

## Recommendations

1. **Document limitations clearly** - Users need to know sudo, vim, etc. won't work
2. **Provide alternatives** - Suggest non-interactive equivalents
3. **Test thoroughly** - Shell behavior varies by platform
4. **Handle errors gracefully** - Don't crash on unexpected output
5. **Consider a hybrid approach** - Use a small native helper for PTY if critical
