# Bridge — C runtime

Native C port of the Bridge runtime (see `../zig/` for the reference Zig
implementation). Same wire protocol, same command set, same behavior.

## Layout

| File           | Purpose                                      |
|----------------|----------------------------------------------|
| `main.c`       | Event loop, session table, command dispatch  |
| `ws.c/.h`      | WebSocket frame codec + client handshake     |
| `tls.c/.h`     | OpenSSL TLS + plain TCP behind one API       |
| `pty.c/.h`     | `forkpty` session: read/write/resize/signal  |
| `identity.c/.h`| Host identity gathering (`uname`, `pwd`, cwd)|
| `json.h`       | Minimal JSON extraction (string/int by key)  |

## Build

Requires OpenSSL (`libssl` + `libcrypto`) and `libutil` (for `forkpty`,
except on macOS where it's in libc).

```sh
make
./build/bridge <token>
```

## Run

```sh
# TLS to api.todofor.ai (default)
./build/bridge <token>

# Local testing via plain TCP
./build/bridge <token> --plain --host 127.0.0.1 --port 4000

# Via env
EDGE_TOKEN=... EDGE_HOST=... EDGE_PORT=... ./build/bridge

# Firecracker sandbox: reads edge.token=<...> from /proc/cmdline
# and registers as DeviceType.SANDBOX automatically.
```

## Protocol

See `../zig/src/main.zig` header comment and `../PROTOCOL.md` (when
present). This binary speaks the same v2 multi-session protocol.

## Notes

- POSIX-only. Windows Bridge would require ConPTY (same limitation
  applies to the Zig version).
- Uses OpenSSL's `EVP_EncodeBlock` / `EVP_DecodeBlock` for base64 and
  `SHA1` for the WebSocket Accept header — no third-party deps.
- Session limit is 16 concurrent PTYs (`MAX_SESSIONS` in `main.c`).
