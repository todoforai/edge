# live_preview Tool — Next Steps

Expose a locally running dev server as a shareable preview:
`live_preview(port, title)` → edge allowlists+probes port → backend mints capability
session (Redis, 24h TTL) → `https://<128-bit-hex>.preview.todofor.ai` → nginx →
`/preview/relay` → edge WS → `127.0.0.1:<port>`. Frontend block probes
`localUrl` first (zero-latency direct, working HMR), falls back to tunnel.

## Status
- [x] Initial implementation done (all 5 repos, committed):
  - packages `2108728`+`50f5683`: block type, protocol msgs, channels, permission
  - backend `38d8507`+`16cfa54`: PreviewSessionService, PreviewRelay, `preview_start`, nginx vhost, relay tests
  - edge `c3d4482`+`8df73b4`: preview.ts (localhost fetch → WS response), `preview_register_port`, port TTL
  - agent `09f5004`: LivePreviewTool.jl
  - frontend `daba535`: LivePreviewBlock (probe + fallback + manual override)

## Not done, but not important (v1 accepted limits)
- [ ] No WebSocket relay through the tunnel — HMR falls back to polling remotely (native on localhost)
- [ ] Responses buffered, 3.5MB cap (single WS frame); no streaming
- [ ] Probe false-positive when the VIEWER's machine runs something on the same port — manual "Use tunnel" toggle covers it; planned fix: backend IP-match (`sameNetwork` flag) gates whether `localUrl` is sent at all
- [ ] Failed tool run renders `null` instead of an error state in the block
- [ ] Session revoke API (TTL-only expiry for now); no revoke-on-edge-disconnect

## Deploy prerequisites (not yet live)
- [ ] DNS wildcard record `*.preview.todofor.ai` → api server
- [ ] Wildcard cert (DNS-01): `certbot certonly --preferred-challenges dns -d '*.preview.todofor.ai'` — `nginx/cmd.sh` skips enabling the vhost until the cert exists

## To investigate
- [ ] Check bridge whether it could have some support — bridge devices (Noise, C client) have no FUNCTION_REGISTRY; relay would need `preview:http_request` handling in BridgeHandler + bridge-side fetch. Sessions already carry `edgeId` generically, so backend side is mostly reusable.
- [ ] Tauri edge supports it? — verify the Tauri-bundled edge runs the same bun edge code path (`preview.ts`, `preview_register_port`) and that `fetch` to `127.0.0.1` works from within the Tauri sidecar context.
