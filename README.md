# TODO for AI Edge

The **Web connector** for [TODO for AI](https://todofor.ai) — connects your machine to the TODO for AI server and gives TODOs shell, file, and browser access to get things done locally. Handles file operations, shell execution, DOCX/XLSX editing, and more.

For an overview, prebuilt binaries (Windows, macOS, Linux), and what the connector enables, see the [Edge download page](https://todofor.ai/downloads/edge).

## Quickstart

```bash
npm install -g @todoforai/edge
todoforai-edge
```

First run opens your browser for device-flow login and saves the key to `~/.todoforai/credentials.json`. No flags needed.

<details>
<summary>Other ways to authenticate</summary>

```bash
todoforai-edge --api-key sk_...          # one-shot, not persisted
export TODOFORAI_API_KEY=sk_...          # env var
```
Get a key at [todofor.ai/apikey](https://todofor.ai/apikey).
</details>

## From source

```bash
git clone https://github.com/todoforai/edge.git
cd edge/bun
bun install
bun run src/index.ts
```

### Compile standalone binary

```bash
cd bun
bun build src/index.ts --compile --outfile dist/todoforai-edge
```

## Development

```bash
export TODOFORAI_API_KEY_DEV="your-local-dev-api-key"

make run          # Production
make run-dev      # Local (http://localhost:4000)
```

## What it does

- **Shell** — execute commands with streaming output and PTY (interrupt, stdin)
- **Filesystem** — read/write/search files, workspace tree, gitignore-aware
- **Documents** — DOCX/XLSX/PDF read & edit
- **Managed runtimes** — auto-provisions Python venv, Node.js packages, and native binaries under `~/.todoforai/tools/` (added to PATH)
- **Tool catalog** — on-demand install of CLIs like `gh`, `rg`, `cloudflared`, `supabase`, `stripe`, `flyctl`, …
- **Browser bridge** — drive browsers via the [`todoforai-browser` extension](https://todofor.ai/downloads/extension) ([Chrome](https://chromewebstore.google.com/detail/todo-for-ai/oemlbhbggllbelfemliboclfagbchcoj) · [Firefox](https://addons.mozilla.org/firefox/addon/todo-for-ai/))

See [API_USAGE.md](API_USAGE.md) for the full function list and message protocol.

## License

MIT License with Notification Request - see the [LICENSE](LICENSE) file for details.
