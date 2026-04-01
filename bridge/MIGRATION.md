# Bridge migration notes

Potential migration path from current layout:

- `edge/zig-edge/` -> `edge/bridge/zig/` ✅
- protocol docs -> `edge/bridge/protocol/`
- machine abstraction -> `edge/bridge/runtime/`

Suggested structure:

```text
edge/bridge/
  README.md
  MIGRATION.md
  zig/
  protocol/
  runtime/
```

Bridge view/runtime notes:
- store latest machine abstraction as `metadata.bridge_view`
- optional history key: `edge:{edgeId}:bridge:history`
- update from identity + exec/exit lifecycle

Recommended approach:
1. create the Bridge home first
2. migrate Zig code in a second step
3. migrate machine abstraction into `edge/bridge/runtime`
4. keep paths stable until imports/build scripts are updated
