/** Tool definitions: registry entries and binary download URL resolvers. */

import os from "os";

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
  return data.tag_name;
}

// binary_name -> [package_spec, installer_type]
export const TOOL_REGISTRY: Record<string, [string, string]> = {
  "apollo-api": ["@todoforai/apollo-api", "npm"],
  "google-play-api": ["@todoforai/google-play-api", "npm"],
  zele: ["zele", "npm"],
  netlify: ["netlify-cli", "npm"],
  vercel: ["vercel", "npm"],
  wrangler: ["wrangler", "npm"],
  shopify: ["@shopify/cli", "npm"],
  "datadog-ci": ["@datadog/datadog-ci", "npm"],
  "sentry-cli": ["@sentry/cli", "npm"],
  "todoai-cli": ["todoai-cli", "pip"],
  firebase: ["firebase-tools", "npm"],
  railway: ["@railway/cli", "npm"],
  newman: ["newman", "npm"],
  aws: ["awscli", "pip"],
  jq: ["jq", "binary"],
  yq: ["yq", "binary"],
  rg: ["rg", "binary"],
  fd: ["fd", "binary"],
  bat: ["bat", "binary"],
  glab: ["glab", "binary"],
  lazygit: ["lazygit", "binary"],
  stern: ["stern", "binary"],
  kustomize: ["kustomize", "binary"],
  terragrunt: ["terragrunt", "binary"],
  vault: ["vault", "binary"],
  sops: ["sops", "binary"],
  age: ["age", "binary"],
  duckdb: ["duckdb", "binary"],
  k6: ["k6", "binary"],
  gh: ["gh", "binary"],
  cloudflared: ["cloudflared", "binary"],
  kubectl: ["kubectl", "binary"],
  helm: ["helm", "binary"],
  terraform: ["terraform", "binary"],
  flyctl: ["flyctl", "binary"],
  supabase: ["supabase", "binary"],
  stripe: ["stripe", "binary"],
  pscale: ["pscale", "binary"],
};

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
  async kubectl() {
    const a = arch(), s = system();
    const version = await textGet("https://dl.k8s.io/release/stable.txt");
    const ext = s === "windows" ? ".exe" : "";
    return [`https://dl.k8s.io/release/${version}/bin/${s}/${a}/kubectl${ext}`, false];
  },
  async helm() {
    const version = await githubLatestTag("helm/helm");
    const a = arch(), s = system();
    if (s === "windows") return [`https://get.helm.sh/helm-${version}-${s}-${a}.zip`, true];
    return [`https://get.helm.sh/helm-${version}-${s}-${a}.tar.gz`, true];
  },
  async terraform() {
    const data = await jsonGet("https://checkpoint-api.hashicorp.com/v1/check/terraform");
    const version = data.current_version;
    return [`https://releases.hashicorp.com/terraform/${version}/terraform_${version}_${system()}_${arch()}.zip`, true];
  },
  async flyctl() {
    const version = (await githubLatestTag("superfly/flyctl")).replace(/^v/, "");
    const s = system(), a = arch() === "amd64" ? "x86_64" : "arm64";
    const osName = { linux: "Linux", darwin: "macOS", windows: "Windows" }[s] || "Linux";
    const ext = s === "windows" ? "zip" : "tar.gz";
    return [`https://github.com/superfly/flyctl/releases/download/v${version}/flyctl_${version}_${osName}_${a}.${ext}`, true];
  },
  async supabase() {
    const version = (await githubLatestTag("supabase/cli")).replace(/^v/, "");
    return [`https://github.com/supabase/cli/releases/download/v${version}/supabase_${system()}_${arch()}.tar.gz`, true];
  },
  async stripe() {
    const version = (await githubLatestTag("stripe/stripe-cli")).replace(/^v/, "");
    const s = system(), a = arch() === "amd64" ? "x86-64" : "arm64";
    const osName = { linux: "linux", darwin: "mac-os", windows: "windows" }[s] || "linux";
    const ext = s === "windows" ? "zip" : "tar.gz";
    return [`https://github.com/stripe/stripe-cli/releases/download/v${version}/stripe_${version}_${osName}_${a}.${ext}`, true];
  },
  async pscale() {
    const version = (await githubLatestTag("planetscale/cli")).replace(/^v/, "");
    const s = system(), a = arch();
    const ext = s === "windows" ? "zip" : "tar.gz";
    return [`https://github.com/planetscale/cli/releases/download/v${version}/pscale_${version}_${s}_${a}.${ext}`, true];
  },
  async jq() {
    const a = arch(), s = system();
    if (s === "windows") return [`https://github.com/jqlang/jq/releases/latest/download/jq-windows-${a}.exe`, false];
    return [`https://github.com/jqlang/jq/releases/latest/download/jq-${s}-${a}`, false];
  },
  async yq() {
    const a = arch(), s = system();
    if (s === "windows") return [`https://github.com/mikefarah/yq/releases/latest/download/yq_${s}_${a}.exe`, false];
    return [`https://github.com/mikefarah/yq/releases/latest/download/yq_${s}_${a}`, false];
  },
  async rg() {
    const version = (await githubLatestTag("BurntSushi/ripgrep")).replace(/^v/, "");
    const s = system();
    if (s === "linux") return [`https://github.com/BurntSushi/ripgrep/releases/download/${version}/ripgrep-${version}-x86_64-unknown-linux-musl.tar.gz`, true];
    if (s === "darwin") return [`https://github.com/BurntSushi/ripgrep/releases/download/${version}/ripgrep-${version}-x86_64-apple-darwin.tar.gz`, true];
    return [`https://github.com/BurntSushi/ripgrep/releases/download/${version}/ripgrep-${version}-x86_64-pc-windows-msvc.zip`, true];
  },
  async fd() {
    const version = (await githubLatestTag("sharkdp/fd")).replace(/^v/, "");
    const s = system();
    if (s === "linux") return [`https://github.com/sharkdp/fd/releases/download/v${version}/fd-v${version}-x86_64-unknown-linux-musl.tar.gz`, true];
    if (s === "darwin") return [`https://github.com/sharkdp/fd/releases/download/v${version}/fd-v${version}-x86_64-apple-darwin.tar.gz`, true];
    return [`https://github.com/sharkdp/fd/releases/download/v${version}/fd-v${version}-x86_64-pc-windows-msvc.zip`, true];
  },
  async bat() {
    const version = (await githubLatestTag("sharkdp/bat")).replace(/^v/, "");
    const s = system();
    if (s === "linux") return [`https://github.com/sharkdp/bat/releases/download/v${version}/bat-v${version}-x86_64-unknown-linux-musl.tar.gz`, true];
    if (s === "darwin") return [`https://github.com/sharkdp/bat/releases/download/v${version}/bat-v${version}-x86_64-apple-darwin.tar.gz`, true];
    return [`https://github.com/sharkdp/bat/releases/download/v${version}/bat-v${version}-x86_64-pc-windows-msvc.zip`, true];
  },
  async glab() {
    const version = (await githubLatestTag("gitlab-org/cli")).replace(/^v/, "");
    const s = system(), a = arch();
    const osName = { linux: "Linux", darwin: "macOS", windows: "Windows" }[s] || "Linux";
    const ext = s === "windows" ? "zip" : "tar.gz";
    return [`https://github.com/gitlab-org/cli/releases/download/v${version}/glab_${version}_${osName}_${a}.${ext}`, true];
  },
  async lazygit() {
    const version = (await githubLatestTag("jesseduffield/lazygit")).replace(/^v/, "");
    const s = system(), a = arch() === "amd64" ? "x86_64" : "arm64";
    const osName = { linux: "Linux", darwin: "Darwin", windows: "Windows" }[s] || "Linux";
    const ext = s === "windows" ? "zip" : "tar.gz";
    return [`https://github.com/jesseduffield/lazygit/releases/download/v${version}/lazygit_${version}_${osName}_${a}.${ext}`, true];
  },
  async stern() {
    const version = (await githubLatestTag("stern/stern")).replace(/^v/, "");
    return [`https://github.com/stern/stern/releases/download/v${version}/stern_${version}_${system()}_${arch()}.tar.gz`, true];
  },
  async kustomize() {
    const tag = await githubLatestTag("kubernetes-sigs/kustomize");
    const version = tag.split("/").pop()!;
    return [`https://github.com/kubernetes-sigs/kustomize/releases/download/${tag}/kustomize_${version}_${system()}_${arch()}.tar.gz`, true];
  },
  async terragrunt() {
    const version = (await githubLatestTag("gruntwork-io/terragrunt")).replace(/^v/, "");
    const s = system(), a = arch();
    if (s === "windows") return [`https://github.com/gruntwork-io/terragrunt/releases/download/v${version}/terragrunt_${s}_${a}.exe`, false];
    return [`https://github.com/gruntwork-io/terragrunt/releases/download/v${version}/terragrunt_${s}_${a}`, false];
  },
  async vault() {
    const data = await jsonGet("https://checkpoint-api.hashicorp.com/v1/check/vault");
    return [`https://releases.hashicorp.com/vault/${data.current_version}/vault_${data.current_version}_${system()}_${arch()}.zip`, true];
  },
  async sops() {
    const version = (await githubLatestTag("getsops/sops")).replace(/^v/, "");
    const s = system(), a = arch();
    if (s === "windows") return [`https://github.com/getsops/sops/releases/download/v${version}/sops-v${version}.exe`, false];
    return [`https://github.com/getsops/sops/releases/download/v${version}/sops-v${version}.${s}.${a}`, false];
  },
  async age() {
    const version = (await githubLatestTag("FiloSottile/age")).replace(/^v/, "");
    return [`https://github.com/FiloSottile/age/releases/download/v${version}/age-v${version}-${system()}-${arch()}.tar.gz`, true];
  },
  async duckdb() {
    const s = system();
    if (s === "darwin") return ["https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-osx-universal.zip", true];
    if (s === "windows") return ["https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-windows-amd64.zip", true];
    return ["https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-linux-amd64.zip", true];
  },
  async k6() {
    const version = (await githubLatestTag("grafana/k6")).replace(/^v/, "");
    const s = system(), a = arch();
    const ext = s === "windows" ? "zip" : "tar.gz";
    return [`https://github.com/grafana/k6/releases/download/v${version}/k6-v${version}-${s}-${a}.${ext}`, true];
  },
};
