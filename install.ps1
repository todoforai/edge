# TODOforAI Edge installer (Windows). Run with -Help for usage.
# Env overrides: TODOFORAI_PREFIX, TODOFORAI_TAG.
#
# irm https://todofor.ai/edge.ps1 | iex
# iex "& { $(irm https://todofor.ai/edge.ps1) } -Service"
[CmdletBinding()]
param(
[string]$Prefix = "",
[string]$Tag = "",
[switch]$Service,
[switch]$Help
)
$ErrorActionPreference = 'Stop'
$Repo = 'todoforai/edge'
if (-not $Prefix) { $Prefix = $env:TODOFORAI_PREFIX }
if (-not $Prefix) { $Prefix = Join-Path $env:USERPROFILE '.todoforai\bin' }
if (-not $Tag) { $Tag = $env:TODOFORAI_TAG }
function Die($msg) { Write-Host "error: $msg" -ForegroundColor Red; exit 1 }
function Info($msg) { Write-Host ":: $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "✓ $msg" -ForegroundColor Green }
if ($Help) {
@"
TODOforAI Edge installer (Windows).
irm https://todofor.ai/edge.ps1 | iex
iex "& { $(irm https://todofor.ai/edge.ps1) } -Service"
Options:
-Prefix DIR  install dir (default: %USERPROFILE%\.todoforai\bin)
-Tag TAG     specific release tag (default: latest)
-Service     install Scheduled Task so edge auto-starts at logon
-Help        show this help
"@ | Write-Host
exit 0
}
# ── detect arch ─────────────────────────────────────────────────────────────
$pa = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
$arch = switch ($pa) {
'AMD64' { 'x64' }
'ARM64' { 'arm64' }
default { Die "unsupported arch: $pa" }
}
$asset = "todoforai-edge-windows-$arch.exe"
# ── resolve release tag (default: latest) ───────────────────────────────────
if (-not $Tag) {
try {
$Tag = (Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest").tag_name
} catch { Die "could not determine latest release (see https://github.com/$Repo/releases)" }
if (-not $Tag) { Die "could not determine latest release" }
}
$url = "https://github.com/$Repo/releases/download/$Tag/$asset"
# ── download + verify (sha256 best-effort; not all releases publish it) ─────
New-Item -ItemType Directory -Force -Path $Prefix | Out-Null
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("todoforai-edge-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
$bin = Join-Path $tmp 'todoforai-edge.exe'
$shaTxt = Join-Path $tmp 'todoforai-edge.sha'
try { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $bin } catch { Die "download failed: $url" }
try {
Invoke-WebRequest -UseBasicParsing -Uri "$url.sha256" -OutFile $shaTxt
$expected = ((Get-Content $shaTxt -Raw).Trim() -split '\s+')[0]
$actual = (Get-FileHash $bin -Algorithm SHA256).Hash.ToLower()
if ($expected.ToLower() -ne $actual) { Die "sha256 mismatch: expected $expected, got $actual" }
} catch {}
$size = (Get-Item $bin).Length
$human = if ($size -ge 1GB) { "{0:N1} GiB" -f ($size/1GB) }
elseif ($size -ge 1MB) { "{0:N1} MiB" -f ($size/1MB) }
elseif ($size -ge 1KB) { "{0:N1} KiB" -f ($size/1KB) }
else { "$size B" }
Ok "downloaded $asset $Tag ($human)"
$dest = Join-Path $Prefix 'todoforai-edge.exe'
# stop existing task if present so we can overwrite a running exe
Get-ScheduledTask -TaskName 'TODOforAI Edge' -ErrorAction SilentlyContinue | Stop-ScheduledTask -ErrorAction SilentlyContinue
Move-Item -Force $bin $dest
} finally {
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
$Edge = Join-Path $Prefix 'todoforai-edge.exe'
$Cmd = $Edge
$Where = $Edge
$Hint = ""
# ── PATH setup (user PATH) ──────────────────────────────────────────────────
$pathParts = ($env:Path -split ';') | Where-Object { $_ }
if ($pathParts -contains $Prefix) {
$Cmd = 'todoforai-edge'
} else {
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$userParts = if ($userPath) { ($userPath -split ';') | Where-Object { $_ } } else { @() }
if (-not ($userParts -contains $Prefix)) {
$newUserPath = if ($userPath) { "$userPath;$Prefix" } else { $Prefix }
[Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
$Where = "$Edge, added to user PATH"
$Hint = " (open a new shell to pick up PATH)"
}
$env:Path = "$env:Path;$Prefix"
$Cmd = 'todoforai-edge'
}
Ok "installed $Where$Hint"
# ── next step ───────────────────────────────────────────────────────────────
# `todoforai-edge` auto-opens the browser for device-flow login on first run,
# then connects.
Write-Host ""
Write-Host " Start edge:"
Write-Host ""
Write-Host " $ " -NoNewline -ForegroundColor Cyan
Write-Host $Cmd -ForegroundColor Green
Write-Host ""
# ── supervisor setup (Scheduled Task at logon) ──────────────────────────────
if ($Service) {
try {
$taskName = 'TODOforAI Edge'
$action = New-ScheduledTaskAction -Execute $Edge
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
-StartWhenAvailable -RestartInterval (New-TimeSpan -Seconds 5) -RestartCount 9999 `
-ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
-Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Ok "scheduled task '$taskName' registered and started"
} catch {
Info "could not register scheduled task ($($_.Exception.Message)); run manually: Start-Process -WindowStyle Hidden $Edge"
}
}
