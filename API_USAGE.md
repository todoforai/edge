# TODOforAI Edge - API Usage

## Running

```bash
cd bun
bun run src/index.ts --api-key YOUR_KEY --api-url https://api.todofor.ai
```

## Registered Functions

Functions available via the function call protocol:

| Function | Description |
|---|---|
| `read_file` | Read file content (supports .docx/.xlsx) |
| `create_file` | Create/overwrite a file |
| `read_file_base64` | Read file as base64 (max 50MB) |
| `search_files` | Search with ripgrep (auto-installs if missing) |
| `execute_shell_command` | Run shell command with streaming output |
| `get_workspace_tree` | Directory tree with gitignore support |
| `create_directory` | Create directory recursively |
| `get_system_info` | OS, shell info |
| `get_current_directory` | Current working directory |
| `get_environment_variable` | Read env var |
| `download_attachment` | Download file from backend |
| `download_chat` | Download todo with messages |
| `register_attachment` | Upload file to backend |

## Message Types Handled

| Message | Direction | Handler |
|---|---|---|
| `block:execute` | Server → Edge | Shell execution with PTY |
| `block:save` | Server → Edge | File save (text, docx, xlsx) |
| `block:signal` | Server → Edge | Interrupt running process |
| `block:keyboard` | Server → Edge | Send stdin to process |
| `edge:file_chunk_request` | Server → Edge | Read file content |
| `edge:function_call` | Server → Edge | Execute registered function |
| `frontend:get_folders` | Frontend → Edge | List directory contents |
| `frontend:create_folder` | Frontend → Edge | Create directory |
| `frontend:delete_path` | Frontend → Edge | Delete file/directory |
| `frontend:write_file` | Frontend → Edge | Write binary file |
| `frontend:cd` | Frontend → Edge | Change workspace |

## Runtime Environments

The edge provides more than just shell access — it ships with managed runtime environments:

### Python

A Python venv is automatically created at `~/.todoforai/tools/venv/` and added to PATH.
This means `python3` and `pip` are always available for:
- Running `.py` scripts directly via `execute_shell_command`
- Installing packages with `pip install`
- Data processing, API calls, automation, web scraping
- Any Python library ecosystem (numpy, pandas, requests, etc.)

Python packages installed via the tool catalog (e.g. `tiktok-uploader`, `instagrapi`) also live in this venv.

### Node.js / npm

npm packages from the tool catalog are installed to `~/.todoforai/tools/node_modules/` with binaries in `.bin/`.

### Native binaries

Binary tools (e.g. `gh`, `rg`, `fd`, `duckdb`) are downloaded to `~/.todoforai/tools/bin/`.

All three directories are prepended to PATH, so tools are available immediately after install.

## Compile Standalone Binary

```bash
bun build src/index.ts --compile --outfile dist/todoforai-edge
```
