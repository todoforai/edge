/**
 * Shared permission logic for tool autoRun.
 *
 * Pattern format: `serverId:toolName` or `serverId:*`
 * Used by both frontend and backend.
 */

import type { ToolPermissions, PermissionState } from './REST_types';

// ─── Normalize ──────────────────────────────────────────────────────────────

/** Normalize permissions with defaults for all lists. */
export const normalizePermissions = (p: ToolPermissions | undefined) => ({
  allow: p?.allow ?? [],
  ask: p?.ask ?? [],
  deny: p?.deny ?? [],
  remembered_allow: p?.remembered_allow ?? [],
  remembered_deny: p?.remembered_deny ?? [],
});

// ─── Pattern parsing / matching ─────────────────────────────────────────────

/** Parse a `serverId:toolName` pattern. */
export function parsePattern(pattern: string): { serverId: string; toolName: string } | null {
  const colonIndex = pattern.indexOf(':');
  if (colonIndex === -1) return null;
  return {
    serverId: pattern.slice(0, colonIndex),
    toolName: pattern.slice(colonIndex + 1),
  };
}

/** Check if a rule pattern matches a target (supports `serverId:*` wildcards). */
export function patternMatches(rulePattern: string, targetPattern: string): boolean {
  const rule = parsePattern(rulePattern);
  const target = parsePattern(targetPattern);
  if (!rule || !target) return rulePattern === targetPattern;

  // Exact match
  if (rule.serverId === target.serverId && rule.toolName === target.toolName) return true;

  // Wildcard match: serverId:* matches serverId:anything
  if (rule.toolName === '*' && rule.serverId === target.serverId) return true;

  return false;
}

// ─── List queries ───────────────────────────────────────────────────────────

export function isPatternInList(list: string[] | undefined, pattern: string): boolean {
  if (!list) return false;
  return list.some(p => patternMatches(p, pattern));
}

export function isPatternAllowed(permissions: ToolPermissions | undefined, pattern: string): boolean {
  return isPatternInList(permissions?.allow, pattern);
}

export function isPatternDenied(permissions: ToolPermissions | undefined, pattern: string): boolean {
  return isPatternInList(permissions?.deny, pattern);
}

export function isPatternAsk(permissions: ToolPermissions | undefined, pattern: string): boolean {
  return isPatternInList(permissions?.ask, pattern);
}

// ─── Evaluation ─────────────────────────────────────────────────────────────

/**
 * Get the effective permission state for a pattern from static lists only.
 * Evaluation order: deny → ask → allow → fallback.
 * Does NOT check remembered lists (those require param matching on the agent).
 */
export function getPermissionState(
  permissions: ToolPermissions | undefined,
  pattern: string,
  getDefault?: (pattern: string) => PermissionState,
): PermissionState {
  if (isPatternDenied(permissions, pattern)) return 'deny';
  if (isPatternAsk(permissions, pattern)) return 'ask';
  if (isPatternAllowed(permissions, pattern)) return 'allow';
  return getDefault ? getDefault(pattern) : 'ask';
}

// ─── Immutable list mutations ───────────────────────────────────────────────

export function addToAllow(permissions: ToolPermissions | undefined, pattern: string): ToolPermissions {
  const { allow, ask, deny, remembered_allow, remembered_deny } = normalizePermissions(permissions);
  return {
    allow: allow.includes(pattern) ? allow : [...allow, pattern],
    ask: ask.filter(p => p !== pattern),
    deny: deny.filter(p => p !== pattern),
    remembered_allow,
    remembered_deny,
  };
}

export function addToAsk(permissions: ToolPermissions | undefined, pattern: string): ToolPermissions {
  const { allow, ask, deny, remembered_allow, remembered_deny } = normalizePermissions(permissions);
  return {
    allow: allow.filter(p => p !== pattern),
    ask: ask.includes(pattern) ? ask : [...ask, pattern],
    deny: deny.filter(p => p !== pattern),
    remembered_allow,
    remembered_deny,
  };
}

export function addToDeny(permissions: ToolPermissions | undefined, pattern: string): ToolPermissions {
  const { allow, ask, deny, remembered_allow, remembered_deny } = normalizePermissions(permissions);
  return {
    allow: allow.filter(p => p !== pattern),
    ask: ask.filter(p => p !== pattern),
    deny: deny.includes(pattern) ? deny : [...deny, pattern],
    remembered_allow,
    remembered_deny,
  };
}

/** Remove a pattern from allow/ask/deny lists (not remembered lists). */
export function removePattern(permissions: ToolPermissions | undefined, pattern: string): ToolPermissions {
  const { allow, ask, deny, remembered_allow, remembered_deny } = normalizePermissions(permissions);
  return {
    allow: allow.filter(p => p !== pattern),
    ask: ask.filter(p => p !== pattern),
    deny: deny.filter(p => p !== pattern),
    remembered_allow,
    remembered_deny,
  };
}

// ─── Remember / forget helpers ──────────────────────────────────────────────

/**
 * Remember a permission decision for a pattern.
 * Adds to remembered_allow or remembered_deny, removes from the opposite list.
 * Immutable — returns a new ToolPermissions object.
 */
export function rememberPermission(
  permissions: ToolPermissions | undefined,
  pattern: string,
  state: 'allow' | 'deny',
): ToolPermissions {
  const norm = normalizePermissions(permissions);

  if (state === 'allow') {
    const rememberedAllow = norm.remembered_allow.includes(pattern)
      ? norm.remembered_allow
      : [...norm.remembered_allow, pattern];
    const rememberedDeny = norm.remembered_deny.filter(p => p !== pattern);
    return { ...norm, remembered_allow: rememberedAllow, remembered_deny: rememberedDeny };
  } else {
    const rememberedDeny = norm.remembered_deny.includes(pattern)
      ? norm.remembered_deny
      : [...norm.remembered_deny, pattern];
    const rememberedAllow = norm.remembered_allow.filter(p => p !== pattern);
    return { ...norm, remembered_allow: rememberedAllow, remembered_deny: rememberedDeny };
  }
}

/**
 * Remove a pattern from both remembered_allow and remembered_deny lists.
 */
export function removeRememberedPattern(
  permissions: ToolPermissions | undefined,
  pattern: string,
): ToolPermissions {
  const { allow, ask, deny, remembered_allow, remembered_deny } = normalizePermissions(permissions);
  return {
    allow,
    ask,
    deny,
    remembered_allow: remembered_allow.filter(p => p !== pattern),
    remembered_deny: remembered_deny.filter(p => p !== pattern),
  };
}
