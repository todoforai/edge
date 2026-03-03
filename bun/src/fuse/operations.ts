/**
 * FUSE filesystem operations for todoforai resources.
 * Port of todoforai_edge/fuse/operations.py
 *
 * These callbacks are designed for fuse-native or any Node FUSE binding
 * that follows the { getattr, readdir, open, read, release } pattern.
 */

import { SCHEMES, isRoot, isSchemeRoot, pathToUri } from "./path-mapping.js";
import type { ResourceClient } from "./resource-client.js";

const S_IFDIR = 0o40000;
const S_IFREG = 0o100000;

export class ResourceOperations {
  private client: ResourceClient;
  private nextFd = 10;
  private openFiles = new Map<number, { uri: string; buf: Uint8Array | null }>();
  private uid: number;
  private gid: number;
  private now: number;

  constructor(client: ResourceClient) {
    this.client = client;
    this.uid = process.getuid?.() ?? 0;
    this.gid = process.getgid?.() ?? 0;
    this.now = Date.now() / 1000;
  }

  private dirStat() {
    return {
      mode: S_IFDIR | 0o755,
      nlink: 2,
      uid: this.uid,
      gid: this.gid,
      size: 0,
      atime: this.now,
      mtime: this.now,
      ctime: this.now,
    };
  }

  private fileStat(size: number, mtime: number) {
    return {
      mode: S_IFREG | 0o644,
      nlink: 1,
      uid: this.uid,
      gid: this.gid,
      size,
      atime: this.now,
      mtime,
      ctime: mtime,
    };
  }

  async getattr(path: string) {
    if (isRoot(path) || isSchemeRoot(path)) return this.dirStat();

    const uri = pathToUri(path);
    if (!uri) return null; // ENOENT

    const meta = await this.client.getMetadata(uri);
    if (meta.isDirectory) return this.dirStat();

    const mtime = meta.createdAt ? meta.createdAt / 1000 : this.now;
    return this.fileStat(meta.size, mtime);
  }

  async readdir(path: string): Promise<string[]> {
    const entries = [".", ".."];

    if (isRoot(path)) {
      entries.push(...SCHEMES);
      return entries;
    }

    let uri = pathToUri(path);
    if (!uri) {
      const parts = path.split("/").filter(Boolean);
      if (parts.length === 1 && SCHEMES.includes(parts[0] as any)) {
        uri = `${parts[0]}://`;
      } else {
        return entries;
      }
    }

    try {
      const items = await this.client.list(uri);
      entries.push(...items.map(i => i.name));
    } catch {}

    return entries;
  }

  open(path: string): number | null {
    const uri = pathToUri(path);
    if (!uri) return null; // ENOENT

    const fd = this.nextFd++;
    this.openFiles.set(fd, { uri, buf: null });
    return fd;
  }

  async read(path: string, size: number, offset: number, fd: number): Promise<Uint8Array> {
    const entry = this.openFiles.get(fd);
    if (!entry) return new Uint8Array(0);

    if (!entry.buf) {
      try {
        const content = await this.client.fetch(entry.uri);
        entry.buf = content.data;
      } catch {
        return new Uint8Array(0);
      }
    }

    return entry.buf.slice(offset, offset + size);
  }

  release(_path: string, fd: number) {
    this.openFiles.delete(fd);
  }

  statfs() {
    return {
      bsize: 4096,
      frsize: 4096,
      blocks: 2 ** 20,
      bfree: 2 ** 19,
      bavail: 2 ** 19,
      files: 2 ** 16,
      ffree: 2 ** 15,
      favail: 2 ** 15,
      namemax: 255,
    };
  }
}
