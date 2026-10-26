/** `agent-browser` shim for agent shells: labels TODOforAI CDP URLs
 *  (`connect <url>` / `--cdp <url>`) with `&todoId=$TODOFORAI_TODO_ID` so the
 *  extension can show which todo drives a tab. The agent only ever sees the bare
 *  `?token=` URL (stable per device); the todo comes from the shell env.
 *  Mirrors the C bridge's agent-browser-guard.sh and hands off to it when it is on
 *  PATH (pinning, whoami). POSIX only: Windows shells get no label. */

import fs from "fs";
import os from "os";
import path from "path";

const SHIM_DIR = path.join(os.homedir(), ".todoforai", "bin", "edge-shims");

const SCRIPT = `#!/bin/sh
# TODOFORAI_AGENT_BROWSER_SHIM: written by todoforai-edge; edits are overwritten.
me=$(cd -- "$(dirname -- "$0")" && pwd)
real=
IFS=:
for d in $PATH; do
  [ -n "$d" ] && [ "$d" != "$me" ] && [ -f "$d/agent-browser" ] && [ -x "$d/agent-browser" ] || continue
  head -c 256 "$d/agent-browser" 2>/dev/null | grep -q TODOFORAI_AGENT_BROWSER_SHIM && continue
  real=$d/agent-browser; break
done
unset IFS
[ -n "$real" ] || { echo "agent-browser: not installed" >&2; exit 127; }
# Only the --cdp value and args after connect are touched (never eval/fill payloads).
case \${TODOFORAI_TODO_ID:-} in ''|*[!A-Za-z0-9._-]*) ;; *)
  n=$#; i=0; prev=; conn=
  while [ $i -lt $n ]; do
    a=$1; shift; i=$((i + 1))
    [ "$a" = connect ] && conn=1
    if [ "$prev" = --cdp ] || [ -n "$conn" ]; then
      case $a in *"/ws/v2/cdp?token="*) case $a in *todoId=*) ;; *) a="$a&todoId=$TODOFORAI_TODO_ID";; esac;; esac
    fi
    prev=$a; set -- "$@" "$a"
  done;;
esac
exec "$real" "$@"
`;

/** Shim dir to prepend to PATH, or undefined (Windows, or unwritable HOME). */
export function ensureAgentBrowserShim(): string | undefined {
  if (os.platform() === "win32") return undefined;
  try {
    const file = path.join(SHIM_DIR, "agent-browser");
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== SCRIPT) {
      fs.mkdirSync(SHIM_DIR, { recursive: true, mode: 0o700 });
      const tmp = path.join(SHIM_DIR, `.agent-browser.${process.pid}`);
      fs.writeFileSync(tmp, SCRIPT, { mode: 0o755 });
      fs.renameSync(tmp, file); // atomic: a running shell never sees a half-written shim
    }
    return SHIM_DIR;
  } catch {
    return undefined;
  }
}

/** `env` with the shim dir in front of PATH. */
export function withAgentBrowserShim(env: Record<string, string>): Record<string, string> {
  const dir = ensureAgentBrowserShim();
  return dir ? { ...env, PATH: dir + path.delimiter + (env.PATH ?? "") } : env;
}
