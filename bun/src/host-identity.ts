// Host shape reported on connect, stored as edge.metadata.identity. The
// backend matches a web frontend's ClientContext.host (os, cores, screen,
// gpu, arch, osVersion) against it to guess which paired machine the browser
// is on — same fields, same spelling as the C bridge's identity.c.
import os from "os";
import { execSync } from "child_process";
import fs from "fs";

export interface HostIdentity {
  os: "Linux" | "Darwin" | "Windows";
  arch: string;
  kernel: string;
  distro_version?: string;
  cores: string;
  screen?: string;
  gpu?: string;
}

const sh = (cmd: string): string => {
  try { return execSync(cmd, { encoding: "utf-8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return ""; }
};

function detectScreen(): string {
  switch (process.platform) {
    case "win32":
      return sh(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; \\"$($s.Width)x$($s.Height)\\""`);
    case "darwin":
      return sh(`system_profiler SPDisplaysDataType 2>/dev/null | awk '/Resolution:/{print $2"x"$4; exit}'`);
    default:
      try {
        for (const e of fs.readdirSync("/sys/class/drm")) {
          if (!e.includes("-")) continue;
          const dir = `/sys/class/drm/${e}`;
          if (!fs.readFileSync(`${dir}/status`, "utf-8").startsWith("connected")) continue;
          const mode = fs.readFileSync(`${dir}/modes`, "utf-8").split("\n")[0].trim();
          if (mode) return mode;
        }
      } catch {}
      return "";
  }
}

function detectGpu(): string {
  switch (process.platform) {
    case "win32":
      return sh(`powershell -NoProfile -Command "(Get-CimInstance Win32_VideoController | Select-Object -First 1).Name"`);
    case "darwin":
      return sh(`system_profiler SPDisplaysDataType 2>/dev/null | awk -F': ' '/Chipset Model/{print $2; exit}'`);
    default:
      // "NVIDIA Corporation GA102 [GeForce RTX 3090]" — same pci.ids text the bridge emits.
      return sh(`lspci -mm 2>/dev/null | awk -F'"' '/VGA|3D controller/{print $4" "$6; exit}'`);
  }
}

export function hostIdentity(): HostIdentity {
  const p = process.platform;
  const id: HostIdentity = {
    os: p === "win32" ? "Windows" : p === "darwin" ? "Darwin" : "Linux",
    arch: os.machine?.() || os.arch(),
    kernel: os.release(),
    cores: String(os.cpus().length || os.availableParallelism?.() || ""),
  };
  if (p === "darwin") id.distro_version = sh("sw_vers -productVersion");
  const screen = detectScreen(), gpu = detectGpu();
  if (/^\d+x\d+$/.test(screen)) id.screen = screen;
  if (gpu) id.gpu = gpu.slice(0, 120);
  return id;
}
