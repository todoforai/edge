/**
 * Holds the active edge's API connection so shell-spawned subprocesses
 * (e.g. `subagent`, `todoforai`) inherit `TODOFORAI_API_URL` / `TODOFORAI_API_TOKEN`
 * matching the backend the edge is currently connected to.
 *
 * Lazy: stores a getter so updates to the session token (pushed by the server
 * on connect and re-minted every 12h) are picked up automatically.
 *
 * Matches the C bridge (bridge/main.c), which exports the same env vars for
 * its PTY children. Token is the short-lived `dst_…` bearer the server pushes
 * via Server2Edge.SESSION_TOKEN — the raw API key is rejected on /dst/v1.
 */

let getter: (() => { apiUrl: string; sessionToken: string }) | null = null;

export function setConnectionContext(get: () => { apiUrl: string; sessionToken: string }): void {
  getter = get;
}

export function getConnectionEnv(): Record<string, string> {
  if (!getter) return {};
  const { apiUrl, sessionToken } = getter();
  if (!apiUrl || !sessionToken) return {};
  return { TODOFORAI_API_URL: apiUrl, TODOFORAI_API_TOKEN: sessionToken };
}
