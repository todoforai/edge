# TODO for AI Edge

Edge agent that connects to the TODO for AI server. Handles file operations, shell execution, DOCX/XLSX editing, and more.

## Desktop App

The desktop app (Tauri) lives in a separate repo: [todoforai/edge-app](https://github.com/todoforai/edge-app)

## Installation

Recommended guide: [Connect PC](https://todofor.ai/connect-pc)

### Download Prebuilt Executables

See [todoforai/edge-app](https://github.com/todoforai/edge-app) for Windows, macOS, Linux downloads.

### From Source

```bash
git clone https://github.com/todoforai/edge.git
cd edge/bun
bun install
bun run src/index.ts --api-key YOUR_API_KEY
```

### Compile Standalone Binary

```bash
cd bun
bun build src/index.ts --compile --outfile dist/todoforai-edge
```

## Development

```bash
export TODOFORAI_API_KEY="your-production-api-key"
export TODOFORAI_API_KEY_DEV="your-local-dev-api-key"

make run          # Production
make run-dev      # Local development
```

## Previous Python Implementation

The original Python implementation is archived at [todoforai/edge-py](https://github.com/todoforai/edge-py).

## License

MIT License with Notification Request - see the [LICENSE](LICENSE) file for details.
