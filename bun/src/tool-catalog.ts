/** Tool definitions: re-exports shared catalog + binary download URL resolvers (edge-only). */

import os from "os";
export { TOOL_CATALOG } from "../../../packages/shared-fbe/src/toolCatalog";
export type { ToolEntry, ToolInstaller, ToolCategory } from "../../../packages/shared-fbe/src/toolCatalog";

function arch(): string {
  const m = os.machine?.() || os.arch();
  return ["arm64", "aarch64"].includes(m.toLowerCase()) ? "arm64" : "amd64";
}

function system(): string {
  const p = os.platform();
  if (p === "darwin") return "darwin";
  if (p === "win32") return "windows";
  return "linux";
}

async function jsonGet(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  return res.json();
}

async function textGet(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  return (await res.text()).trim();
}

async function githubLatestTag(repo: string): Promise<string> {
  const data = await jsonGet(`https://api.github.com/repos/${repo}/releases/latest`);
  if (!data?.tag_name) throw new Error(`No tag_name found for ${repo}`);
  return data.tag_name;
}

async function gitlabLatestTag(project: string): Promise<string> {
  const encoded = encodeURIComponent(project);
  const data = await jsonGet(`https://gitlab.com/api/v4/projects/${encoded}/releases`);
  if (!Array.isArray(data) || data.length === 0) throw new Error(`No releases found for ${project}`);
  return data[0].tag_name;
}

type UrlResult = [url: string, isArchive: boolean];

// Binary download URL resolvers
export const BINARY_URL_FUNCS: Record<string, () => Promise<UrlResult>> = {
  async gh() {
    const version = (await githubLatestTag("cli/cli")).replace(/^v/, "");
    const a = arch(), s = system();
    if (s === "darwin") return [`https://github.com/cli/cli/releases/download/v${version}/gh_${version}_macOS_${a}.zip`, true];
    if (s === "windows") return [`https://github.com/cli/cli/releases/download/v${version}/gh_${version}_windows_${a}.zip`, true];
    return [`https://github.com/cli/cli/releases/download/v${version}/gh_${version}_linux_${a}.tar.gz`, true];
  },
  async cloudflared() {
    const a = arch(), s = system();
    if (s === "darwin") return [`https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${a}.tgz`, true];
    if (s === "windows") return [`https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-${a}.exe`, false];
    return [`https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${a}`, false];
  },


  async supabase() {
    const version = (await githubLatestTag("supabase/cli")).replace(/^v/, "");
    return [`https://github.com/supabase/cli/releases/download/v${version}/supabase_${system()}_${arch()}.tar.gz`, true];
  },
  async stripe() {
    const version = (await githubLatestTag("stripe/stripe-cli")).replace(/^v/, "");
    const s = system(), a = arch() === "amd64" ? "x86_64" : "arm64";
    const osName = { linux: "linux", darwin: "mac-os", windows: "windows" }[s] || "linux";
    const ext = s === "windows" ? "zip" : "tar.gz";
    return [`https://github.com/stripe/stripe-cli/releases/download/v${version}/stripe_${version}_${osName}_${a}.${ext}`, true];
  },

  async flyctl() {
    const version = (await githubLatestTag("superfly/flyctl")).replace(/^v/, "");
    const s = system(), a = arch() === "amd64" ? "x86_64" : "arm64";
    const osName = { linux: "Linux", darwin: "macOS", windows: "Windows" }[s] || "Linux";
    const ext = s === "windows" ? "zip" : "tar.gz";
    return [`https://github.com/superfly/flyctl/releases/download/v${version}/flyctl_${version}_${osName}_${a}.${ext}`, true];
  },

  async glab() {
    const version = (await gitlabLatestTag("gitlab-org/cli")).replace(/^v/, "");
    const s = system(), a = arch();
    const ext = s === "windows" ? "zip" : "tar.gz";
    return [`https://gitlab.com/gitlab-org/cli/-/releases/v${version}/downloads/glab_${version}_${s}_${a}.${ext}`, true];
  },


  async vault() {
    const data = await jsonGet("https://checkpoint-api.hashicorp.com/v1/check/vault");
    return [`https://releases.hashicorp.com/vault/${data.current_version}/vault_${data.current_version}_${system()}_${arch()}.zip`, true];
  },

  async rclone() {
    const version = (await githubLatestTag("rclone/rclone")).replace(/^v/, "");
    const s = system(), a = arch();
    const ext = s === "windows" ? "zip" : "zip";
    return [`https://github.com/rclone/rclone/releases/download/v${version}/rclone-v${version}-${s}-${a}.${ext}`, true];
  },

};
