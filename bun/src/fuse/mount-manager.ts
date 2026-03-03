/**
 * Lifecycle manager for the FUSE mount.
 * Port of todoforai_edge/fuse/mount_manager.py
 *
 * Requires `fuse-native` (npm) — loaded lazily so the module doesn't
 * crash when the native addon isn't installed.
 */

import os from "os";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { ResourceClient } from "./resource-client.js";
import { ResourceOperations } from "./operations.js";

const DEFAULT_MOUNT_PATH = path.join(os.homedir(), ".todoforai", "resources");

let Fuse: any = null;
try {
  Fuse = require("fuse-native");
} catch {}

export function isFuseAvailable(): boolean {
  return Fuse !== null;
}

export class FuseMountManager {
  private apiUrl: string;
  private apiKey: string | undefined;
  private mountPath: string;
  private fuse: any = null;
  private _mounted = false;

  constructor(apiUrl: string, apiKey?: string, mountPath?: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.mountPath = mountPath || DEFAULT_MOUNT_PATH;
  }

  get mounted() { return this._mounted; }

  async start(): Promise<boolean> {
    if (!isFuseAvailable()) {
      console.log("[fuse] fuse-native not installed, skipping mount");
      return false;
    }

    // Handle stale mount
    try {
      const stat = fs.statSync(this.mountPath);
      // If it exists but we can't list it, it's probably stale
      try { fs.readdirSync(this.mountPath); } catch {
        console.warn(`[fuse] Stale mount at ${this.mountPath}, unmounting`);
        this.forceUnmount();
        await sleep(500);
      }
    } catch {}

    fs.mkdirSync(this.mountPath, { recursive: true });

    const client = new ResourceClient(this.apiUrl, this.apiKey);
    const ops = new ResourceOperations(client);

    return new Promise((resolve) => {
      try {
        this.fuse = new Fuse(this.mountPath, {
          readdir: (p: string, cb: Function) => ops.readdir(p).then(e => cb(0, e)).catch(() => cb(Fuse.ENOENT)),
          getattr: (p: string, cb: Function) => ops.getattr(p).then(s => s ? cb(0, s) : cb(Fuse.ENOENT)).catch(() => cb(Fuse.ENOENT)),
          open: (p: string, _flags: number, cb: Function) => { const fd = ops.open(p); fd !== null ? cb(0, fd) : cb(Fuse.ENOENT); },
          read: (p: string, _fd: number, buf: Buffer, len: number, pos: number, cb: Function) => {
            ops.read(p, len, pos, _fd).then(data => { buf.set(data); cb(data.length); }).catch(() => cb(0));
          },
          release: (p: string, fd: number, cb: Function) => { ops.release(p, fd); cb(0); },
          statfs: (_p: string, cb: Function) => cb(0, ops.statfs()),
        });

        this.fuse.mount((err: Error | null) => {
          if (err) {
            console.error("[fuse] Mount failed:", err.message);
            this.fuse = null;
            resolve(false);
          } else {
            this._mounted = true;
            console.log(`[fuse] Mounted resources at ${this.mountPath}`);
            resolve(true);
          }
        });
      } catch (e: any) {
        console.error("[fuse] Failed to create FUSE instance:", e.message);
        resolve(false);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this._mounted || !this.fuse) return;

    return new Promise((resolve) => {
      this.fuse.unmount((err: Error | null) => {
        if (err) {
          console.warn("[fuse] Clean unmount failed, forcing:", err.message);
          this.forceUnmount();
        }
        this._mounted = false;
        this.fuse = null;
        console.log(`[fuse] Unmounted ${this.mountPath}`);
        resolve();
      });
    });
  }

  private forceUnmount() {
    const platform = os.platform();
    try {
      if (platform === "linux") {
        execSync(`fusermount -u ${this.mountPath}`, { stdio: "pipe", timeout: 10_000 });
      } else {
        execSync(`umount ${this.mountPath}`, { stdio: "pipe", timeout: 10_000 });
      }
    } catch {}
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
