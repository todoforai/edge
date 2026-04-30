/**
 * Holds the active edge's API connection so shell-spawned subprocesses
 * (e.g. `subagent`, `todoforai`) inherit `TODOFORAI_API_URL` / `TODOFORAI_API_KEY`
 * matching the backend the edge is currently connected to.
 *
 * Lazy: stores a getter so updates to the underlying ApiClient (login flow,
 * key rotation) are picked up automatically.
 *
 * TODO: Injecting the raw API key into every spawned shell env is a stopgap.
 * Replace with a short-lived, scope-limited token minted by the backend per
 * shell block. See `frontend/plan/subagent-short-lived-token.md`.
 */

let getter: (() => { apiUrl: string; apiKey: string }) | null = null;

export function setConnectionContext(get: () => { apiUrl: string; apiKey: string }): void {
  getter = get;
}

export function getConnectionEnv(): Record<string, string> {
  if (!getter) return {};
  const { apiUrl, apiKey } = getter();
  if (!apiUrl || !apiKey) return {};
  return { TODOFORAI_API_URL: apiUrl, TODOFORAI_API_KEY: apiKey };
}
