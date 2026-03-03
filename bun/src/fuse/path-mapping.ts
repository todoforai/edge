/**
 * Path ↔ URI mapping for the FUSE filesystem.
 * Port of todoforai_edge/fuse/path_mapping.py
 */

export const SCHEMES = ["todoforai", "http", "https", "gdrive", "edge"] as const;
const SCHEME_SET = new Set<string>(SCHEMES);

export function pathToUri(fsPath: string): string | null {
  const parts = fsPath.split("/").filter(Boolean);
  if (!parts.length) return null;

  const scheme = parts[0];
  if (!SCHEME_SET.has(scheme)) return null;

  if (scheme === "todoforai") {
    return `todoforai://attachment/${parts.slice(1).join("/")}`;
  }
  return `${scheme}://${parts.slice(1).join("/")}`;
}

export function isSchemeRoot(fsPath: string): boolean {
  const parts = fsPath.split("/").filter(Boolean);
  return parts.length === 1 && SCHEME_SET.has(parts[0]);
}

export function isRoot(fsPath: string): boolean {
  return fsPath === "/";
}
