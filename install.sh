#!/bin/sh
# TODOforAI Edge installer. Run -h for usage.
# Env overrides: TODOFORAI_PREFIX, TODOFORAI_TAG.
set -eu
REPO="todoforai/edge"
PREFIX="${TODOFORAI_PREFIX:-$HOME/.todoforai/bin}"
TAG="${TODOFORAI_TAG:-}"
DO_SERVICE=0
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m::\033[0m %s\n' "$*" >&2; }
ok() { printf '\033[32m✓\033[0m %s\n' "$*" >&2; }
usage() {
cat <<'EOF'
TODOforAI Edge installer.
curl -fsSL https://todofor.ai/edge | sh
curl -fsSL https://todofor.ai/edge | sh -s -- --service
Options:
--prefix DIR  install dir (default: $HOME/.todoforai/bin)
--tag TAG     specific release tag (default: latest)
--service     install systemd/launchd supervisor so edge auto-starts at login
EOF
}
need_val() { [ -n "${2:-}" ] || die "$1 requires a value"; }
# ── parse args ──────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
case "$1" in
--prefix) need_val "$1" "${2:-}"; PREFIX=$2; shift 2 ;;
--tag) need_val "$1" "${2:-}"; TAG=$2; shift 2 ;;
--service) DO_SERVICE=1; shift ;;
-h|--help) usage; exit 0 ;;
*) die "unknown option: $1" ;;
esac
done
# ── detect OS / arch ────────────────────────────────────────────────────────
uname_s=$(uname -s)
uname_m=$(uname -m)
case "$uname_s" in
Linux) os=linux ;;
Darwin) os=macos ;;
*) die "unsupported OS: $uname_s (Windows: irm https://todofor.ai/edge.ps1 | iex)" ;;
esac
case "$uname_m" in
x86_64|amd64) arch=x64 ;;
aarch64|arm64) arch=arm64 ;;
*) die "unsupported arch: $uname_m" ;;
esac
asset="todoforai-edge-${os}-${arch}"
# ── fetch tool ──────────────────────────────────────────────────────────────
if command -v curl >/dev/null 2>&1; then
fetch() { curl -fsSL "$1" -o "$2"; }
fetch_progress() { curl -fL --progress-bar "$1" -o "$2"; }  # clean one-line bar for the big binary
elif command -v wget >/dev/null 2>&1; then
fetch() { wget -q "$1" -O "$2"; }
fetch_progress() { wget --show-progress -q "$1" -O "$2"; }
else
die "need curl or wget"
fi
# ── resolve release tag (default: latest) ──────────────────────────────────
if [ -z "$TAG" ]; then
TAG=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null \
| grep '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
[ -z "$TAG" ] && die "could not determine latest release (see https://github.com/$REPO/releases)"
fi
url="https://github.com/$REPO/releases/download/$TAG/$asset"
# ── download + verify (sha256 best-effort; not all releases publish it) ─────
mkdir -p "$PREFIX"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
info "downloading $asset $TAG ..."
fetch_progress "$url" "$tmp/todoforai-edge" || die "download failed: $url"
if fetch "${url}.sha256" "$tmp/todoforai-edge.sha" 2>/dev/null; then
expected=$(awk '{print $1}' "$tmp/todoforai-edge.sha")
if command -v sha256sum >/dev/null 2>&1; then
actual=$(sha256sum "$tmp/todoforai-edge" | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
actual=$(shasum -a 256 "$tmp/todoforai-edge" | awk '{print $1}')
fi
[ -n "${actual:-}" ] && [ "$expected" != "$actual" ] && die "sha256 mismatch: expected $expected, got $actual"
fi
size=$(wc -c <"$tmp/todoforai-edge" | tr -d ' ')
human=$(awk -v b="$size" 'BEGIN{ s="BKMGT"; for(i=1; b>=1024 && i<5; i++) b/=1024; printf (i==1?"%d %s":"%.1f %siB"), b, substr(s,i,1) }')
ok "downloaded $asset $TAG ($human)"
chmod +x "$tmp/todoforai-edge"
mv "$tmp/todoforai-edge" "$PREFIX/todoforai-edge"
EDGE="$PREFIX/todoforai-edge"
CMD="$EDGE" # what to suggest in user-facing messages
WHERE="$PREFIX/todoforai-edge"
HINT=""
# ── PATH setup ──────────────────────────────────────────────────────────────
# 1) prefix already on PATH → done
# 2) ~/.local/bin on PATH → symlink there (no rc mutation)
# 3) fallback → append to active shell's rc file
case ":$PATH:" in
*":$PREFIX:"*)
CMD=todoforai-edge
;;
*)
case ":$PATH:" in
*":$HOME/.local/bin:"*)
mkdir -p "$HOME/.local/bin"
ln -sf "$PREFIX/todoforai-edge" "$HOME/.local/bin/todoforai-edge"
CMD=todoforai-edge
WHERE="$WHERE, linked into ~/.local/bin"
;;
*)
line="export PATH=\"$PREFIX:\$PATH\""
case "${SHELL##*/}" in
zsh) rc="$HOME/.zshrc" ;;
bash) rc="$HOME/.bashrc" ;;
*) rc="$HOME/.profile" ;;
esac
if ! grep -qsF "$line" "$rc" 2>/dev/null; then
# ensure trailing newline before appending
[ -s "$rc" ] && [ -n "$(tail -c1 "$rc" 2>/dev/null)" ] && printf '\n' >>"$rc"
printf '\n# added by todoforai edge installer\n%s\n' "$line" >>"$rc"
WHERE="$WHERE, added to PATH in ~/${rc#$HOME/}"
fi
CMD=todoforai-edge
HINT=" (in a new shell, or: $line)"
;;
esac
;;
esac
ok "installed $WHERE$HINT"
# ── next step ───────────────────────────────────────────────────────────────
# `todoforai-edge` auto-opens the browser for device-flow login on first run,
# then connects. So the installer just tells the user the one command to start.
printf '\n \033[1mStart edge:\033[0m\n\n' >&2
printf ' \033[1;36m$\033[0m \033[1;32m%s\033[0m\n\n' "$CMD" >&2
# ── supervisor setup ────────────────────────────────────────────────────────
install_systemd_user() {
unit_dir="$HOME/.config/systemd/user"
mkdir -p "$unit_dir"
cat >"$unit_dir/todoforai-edge.service" <<EOF
[Unit]
Description=TODOforAI Edge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$EDGE
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable todoforai-edge
systemctl --user start todoforai-edge
loginctl enable-linger "${USER:-$(id -un)}" 2>/dev/null || true
ok "systemd user service enabled and started"
}
install_launchd() {
plist="$HOME/Library/LaunchAgents/ai.todofor.todoforai-edge.plist"
mkdir -p "$(dirname "$plist")"
cat >"$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>ai.todofor.todoforai-edge</string>
	<key>ProgramArguments</key>
	<array>
		<string>$EDGE</string>
	</array>
	<key>KeepAlive</key>
	<true/>
	<key>RunAtLoad</key>
	<true/>
	<key>ThrottleInterval</key>
	<integer>2</integer>
	<key>StandardOutPath</key>
	<string>/tmp/todoforai-edge.log</string>
	<key>StandardErrorPath</key>
	<string>/tmp/todoforai-edge.log</string>
</dict>
</plist>
EOF
launchctl unload "$plist" 2>/dev/null || true
launchctl load -w "$plist"
ok "launchd agent loaded"
}
if [ "$DO_SERVICE" = 1 ]; then
if [ "$os" = linux ] && command -v systemctl >/dev/null 2>&1 && \
systemctl --user show-environment >/dev/null 2>&1; then
install_systemd_user
elif [ "$os" = macos ]; then
install_launchd
else
info "no supervisor detected; run manually: nohup $EDGE >/tmp/todoforai-edge.log 2>&1 &"
fi
fi
