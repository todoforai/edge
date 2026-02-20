"""Tool definitions: registry entries and binary download URL resolvers."""

import json
import platform
import urllib.request


def _arch() -> str:
    m = platform.machine().lower()
    return "arm64" if m in ("arm64", "aarch64") else "amd64"


def _system() -> str:
    return platform.system().lower()


def _json_get(url: str, timeout: int = 15) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read())


def _text_get(url: str, timeout: int = 15) -> str:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return resp.read().decode("utf-8").strip()


def _github_latest_tag(repo: str) -> str:
    data = _json_get(f"https://api.github.com/repos/{repo}/releases/latest")
    return data["tag_name"]


# binary_name -> (package_spec, installer_type)
TOOL_REGISTRY = {
    "apollo-api": ("@todoforai/apollo-api", "npm"),
    "google-play-api": ("@todoforai/google-play-api", "npm"),
    "zele": ("zele", "npm"),
    "netlify": ("netlify-cli", "npm"),
    "vercel": ("vercel", "npm"),
    "wrangler": ("wrangler", "npm"),
    "shopify": ("@shopify/cli", "npm"),
    "datadog-ci": ("@datadog/datadog-ci", "npm"),
    "sentry-cli": ("@sentry/cli", "npm"),
    "todoai-cli": ("todoai-cli", "pip"),
    "firebase": ("firebase-tools", "npm"),
    "railway": ("@railway/cli", "npm"),
    "newman": ("newman", "npm"),
    "aws": ("awscli", "pip"),
    "jq": ("jq", "binary"),
    "yq": ("yq", "binary"),
    "rg": ("rg", "binary"),
    "fd": ("fd", "binary"),
    "bat": ("bat", "binary"),
    "glab": ("glab", "binary"),
    "lazygit": ("lazygit", "binary"),
    "stern": ("stern", "binary"),
    "kustomize": ("kustomize", "binary"),
    "terragrunt": ("terragrunt", "binary"),
    "vault": ("vault", "binary"),
    "sops": ("sops", "binary"),
    "age": ("age", "binary"),
    "duckdb": ("duckdb", "binary"),
    "k6": ("k6", "binary"),
    "gh": ("gh", "binary"),
    "cloudflared": ("cloudflared", "binary"),
    "kubectl": ("kubectl", "binary"),
    "helm": ("helm", "binary"),
    "terraform": ("terraform", "binary"),
    "flyctl": ("flyctl", "binary"),
    "supabase": ("supabase", "binary"),
    "stripe": ("stripe", "binary"),
    "pscale": ("pscale", "binary"),
}


def _gh_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("cli/cli").lstrip("v")
    arch = _arch()
    system = _system()
    if system == "darwin":
        return f"https://github.com/cli/cli/releases/download/v{version}/gh_{version}_macOS_{arch}.zip", True
    elif system == "windows":
        return f"https://github.com/cli/cli/releases/download/v{version}/gh_{version}_windows_{arch}.zip", True
    else:
        return f"https://github.com/cli/cli/releases/download/v{version}/gh_{version}_linux_{arch}.tar.gz", True


def _cloudflared_download_url() -> tuple[str, bool]:
    arch = _arch()
    system = _system()
    if system == "darwin":
        return f"https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-{arch}.tgz", True
    elif system == "windows":
        return f"https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-{arch}.exe", False
    else:
        return f"https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-{arch}", False


def _kubectl_download_url() -> tuple[str, bool]:
    arch = _arch()
    system = _system()
    version = _text_get("https://dl.k8s.io/release/stable.txt")
    ext = ".exe" if system == "windows" else ""
    return f"https://dl.k8s.io/release/{version}/bin/{system}/{arch}/kubectl{ext}", False


def _helm_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("helm/helm")
    arch = _arch()
    system = _system()
    if system == "windows":
        return f"https://get.helm.sh/helm-{version}-{system}-{arch}.zip", True
    return f"https://get.helm.sh/helm-{version}-{system}-{arch}.tar.gz", True


def _terraform_download_url() -> tuple[str, bool]:
    data = _json_get("https://checkpoint-api.hashicorp.com/v1/check/terraform")
    version = data["current_version"]
    arch = _arch()
    system = _system()
    return f"https://releases.hashicorp.com/terraform/{version}/terraform_{version}_{system}_{arch}.zip", True


def _flyctl_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("superfly/flyctl").lstrip("v")
    system = _system()
    arch = "x86_64" if _arch() == "amd64" else "arm64"
    os_name = {"linux": "Linux", "darwin": "macOS", "windows": "Windows"}.get(system, "Linux")
    ext = "zip" if system == "windows" else "tar.gz"
    return f"https://github.com/superfly/flyctl/releases/download/v{version}/flyctl_{version}_{os_name}_{arch}.{ext}", True


def _supabase_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("supabase/cli").lstrip("v")
    system = _system()
    arch = _arch()
    return f"https://github.com/supabase/cli/releases/download/v{version}/supabase_{system}_{arch}.tar.gz", True


def _stripe_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("stripe/stripe-cli").lstrip("v")
    system = _system()
    arch = "x86-64" if _arch() == "amd64" else "arm64"
    os_name = {"linux": "linux", "darwin": "mac-os", "windows": "windows"}.get(system, "linux")
    ext = "zip" if system == "windows" else "tar.gz"
    return f"https://github.com/stripe/stripe-cli/releases/download/v{version}/stripe_{version}_{os_name}_{arch}.{ext}", True


def _pscale_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("planetscale/cli").lstrip("v")
    system = _system()
    arch = _arch()
    if system == "windows":
        return f"https://github.com/planetscale/cli/releases/download/v{version}/pscale_{version}_{system}_{arch}.zip", True
    return f"https://github.com/planetscale/cli/releases/download/v{version}/pscale_{version}_{system}_{arch}.tar.gz", True


def _jq_download_url() -> tuple[str, bool]:
    arch = _arch()
    system = _system()
    if system == "windows":
        return f"https://github.com/jqlang/jq/releases/latest/download/jq-windows-{arch}.exe", False
    return f"https://github.com/jqlang/jq/releases/latest/download/jq-{system}-{arch}", False


def _yq_download_url() -> tuple[str, bool]:
    arch = _arch()
    system = _system()
    if system == "windows":
        return f"https://github.com/mikefarah/yq/releases/latest/download/yq_{system}_{arch}.exe", False
    return f"https://github.com/mikefarah/yq/releases/latest/download/yq_{system}_{arch}", False


def _rg_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("BurntSushi/ripgrep").lstrip("v")
    system = _system()
    if system == "linux":
        return f"https://github.com/BurntSushi/ripgrep/releases/download/{version}/ripgrep-{version}-x86_64-unknown-linux-musl.tar.gz", True
    if system == "darwin":
        return f"https://github.com/BurntSushi/ripgrep/releases/download/{version}/ripgrep-{version}-x86_64-apple-darwin.tar.gz", True
    return f"https://github.com/BurntSushi/ripgrep/releases/download/{version}/ripgrep-{version}-x86_64-pc-windows-msvc.zip", True


def _fd_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("sharkdp/fd").lstrip("v")
    system = _system()
    if system == "linux":
        return f"https://github.com/sharkdp/fd/releases/download/v{version}/fd-v{version}-x86_64-unknown-linux-musl.tar.gz", True
    if system == "darwin":
        return f"https://github.com/sharkdp/fd/releases/download/v{version}/fd-v{version}-x86_64-apple-darwin.tar.gz", True
    return f"https://github.com/sharkdp/fd/releases/download/v{version}/fd-v{version}-x86_64-pc-windows-msvc.zip", True


def _bat_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("sharkdp/bat").lstrip("v")
    system = _system()
    if system == "linux":
        return f"https://github.com/sharkdp/bat/releases/download/v{version}/bat-v{version}-x86_64-unknown-linux-musl.tar.gz", True
    if system == "darwin":
        return f"https://github.com/sharkdp/bat/releases/download/v{version}/bat-v{version}-x86_64-apple-darwin.tar.gz", True
    return f"https://github.com/sharkdp/bat/releases/download/v{version}/bat-v{version}-x86_64-pc-windows-msvc.zip", True


def _glab_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("gitlab-org/cli").lstrip("v")
    system = _system()
    arch = _arch()
    os_name = {"linux": "Linux", "darwin": "macOS", "windows": "Windows"}.get(system, "Linux")
    if system == "windows":
        return f"https://github.com/gitlab-org/cli/releases/download/v{version}/glab_{version}_{os_name}_{arch}.zip", True
    return f"https://github.com/gitlab-org/cli/releases/download/v{version}/glab_{version}_{os_name}_{arch}.tar.gz", True


def _lazygit_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("jesseduffield/lazygit").lstrip("v")
    system = _system()
    arch = "x86_64" if _arch() == "amd64" else "arm64"
    os_name = {"linux": "Linux", "darwin": "Darwin", "windows": "Windows"}.get(system, "Linux")
    if system == "windows":
        return f"https://github.com/jesseduffield/lazygit/releases/download/v{version}/lazygit_{version}_{os_name}_{arch}.zip", True
    return f"https://github.com/jesseduffield/lazygit/releases/download/v{version}/lazygit_{version}_{os_name}_{arch}.tar.gz", True


def _stern_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("stern/stern").lstrip("v")
    system = _system()
    arch = _arch()
    return f"https://github.com/stern/stern/releases/download/v{version}/stern_{version}_{system}_{arch}.tar.gz", True


def _kustomize_download_url() -> tuple[str, bool]:
    tag = _github_latest_tag("kubernetes-sigs/kustomize")  # e.g. "kustomize/v5.4.3"
    version = tag.split("/")[-1]  # "v5.4.3"
    system = _system()
    arch = _arch()
    return f"https://github.com/kubernetes-sigs/kustomize/releases/download/{tag}/kustomize_{version}_{system}_{arch}.tar.gz", True


def _terragrunt_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("gruntwork-io/terragrunt").lstrip("v")
    system = _system()
    arch = _arch()
    if system == "windows":
        return f"https://github.com/gruntwork-io/terragrunt/releases/download/v{version}/terragrunt_{system}_{arch}.exe", False
    return f"https://github.com/gruntwork-io/terragrunt/releases/download/v{version}/terragrunt_{system}_{arch}", False


def _vault_download_url() -> tuple[str, bool]:
    data = _json_get("https://checkpoint-api.hashicorp.com/v1/check/vault")
    version = data["current_version"]
    arch = _arch()
    system = _system()
    return f"https://releases.hashicorp.com/vault/{version}/vault_{version}_{system}_{arch}.zip", True


def _sops_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("getsops/sops").lstrip("v")
    system = _system()
    arch = _arch()
    if system == "windows":
        return f"https://github.com/getsops/sops/releases/download/v{version}/sops-v{version}.exe", False
    return f"https://github.com/getsops/sops/releases/download/v{version}/sops-v{version}.{system}.{arch}", False


def _age_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("FiloSottile/age").lstrip("v")
    system = _system()
    arch = _arch()
    return f"https://github.com/FiloSottile/age/releases/download/v{version}/age-v{version}-{system}-{arch}.tar.gz", True


def _duckdb_download_url() -> tuple[str, bool]:
    system = _system()
    if system == "darwin":
        return "https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-osx-universal.zip", True
    if system == "windows":
        return "https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-windows-amd64.zip", True
    return "https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-linux-amd64.zip", True


def _k6_download_url() -> tuple[str, bool]:
    version = _github_latest_tag("grafana/k6").lstrip("v")
    system = _system()
    arch = _arch()
    if system == "windows":
        return f"https://github.com/grafana/k6/releases/download/v{version}/k6-v{version}-{system}-{arch}.zip", True
    return f"https://github.com/grafana/k6/releases/download/v{version}/k6-v{version}-{system}-{arch}.tar.gz", True


BINARY_URL_FUNCS = {
    "gh": _gh_download_url,
    "cloudflared": _cloudflared_download_url,
    "kubectl": _kubectl_download_url,
    "helm": _helm_download_url,
    "terraform": _terraform_download_url,
    "flyctl": _flyctl_download_url,
    "supabase": _supabase_download_url,
    "stripe": _stripe_download_url,
    "pscale": _pscale_download_url,
    "jq": _jq_download_url,
    "yq": _yq_download_url,
    "rg": _rg_download_url,
    "fd": _fd_download_url,
    "bat": _bat_download_url,
    "glab": _glab_download_url,
    "lazygit": _lazygit_download_url,
    "stern": _stern_download_url,
    "kustomize": _kustomize_download_url,
    "terragrunt": _terragrunt_download_url,
    "vault": _vault_download_url,
    "sops": _sops_download_url,
    "age": _age_download_url,
    "duckdb": _duckdb_download_url,
    "k6": _k6_download_url,
}
