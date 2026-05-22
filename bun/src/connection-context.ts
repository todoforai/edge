/**
 * Holds the active edge's API connection so shell-spawned subprocesses
 * (e.g. `subagent`, `todoforai`) inherit `TODOFORAI_API_URL` / `TODOFORAI_API_TOKEN`
 * matching the backend the edge is currently connected to.
 *
 * Lazy: stores a getter so updates to the underlying ApiClient (login flow,
 * key rotation) are picked up automatically.
 *
 * Matches the C bridge (bridge/main.c), which exports the same env vars for
 * its PTY children. Token is a short-lived `dst_…` bearer minted post-auth.
 */

let getter: (() => { apiUrl: string; apiKey: string }) | null = null;

export function setConnectionContext(get: () => { apiUrl: string; apiKey: string }): void {
  getter = get;
}

export function getConnectionEnv(): Record<string, string> {
  if (!getter) return {};
  const { apiUrl, apiKey } = getter();
  if (!apiUrl || !apiKey) return {};
  return { TODOFORAI_API_URL: apiUrl, TODOFORAI_API_TOKEN: apiKey };
}
