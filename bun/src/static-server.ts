/**
 * Minimal static file server for live_preview's file/directory targets
 * (preview_serve_static). One server per served root dir, random free port,
 * bound to 127.0.0.1 — exposed only through the preview relay allowlist.
 */

import fs from "fs";
import path from "path";
import http from "http";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".map": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
  ".wasm": "application/wasm", ".pdf": "application/pdf",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".mp4": "video/mp4", ".webm": "video/webm",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
};

const servers = new Map<string, Promise<number>>(); // canonical rootDir → port (promise dedupes concurrent starts)

/** Serve `rootDir` on a random free localhost port (reused per dir). */
export function serveStaticDir(rootDir: string): Promise<number> {
  const root = fs.realpathSync(rootDir); // canonical — symlinked roots compare correctly below
  const existing = servers.get(root);
  if (existing !== undefined) return existing;

  const starting = startServer(root);
  servers.set(root, starting);
  starting.catch(() => servers.delete(root));
  return starting;
}

async function startServer(root: string): Promise<number> {
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
      let fp = path.normalize(path.join(root, urlPath));
      let st = fs.statSync(fp, { throwIfNoEntry: false });
      if (st?.isDirectory()) {
        fp = path.join(fp, "index.html");
        st = fs.statSync(fp, { throwIfNoEntry: false });
      }
      if (!st?.isFile()) { res.writeHead(404); res.end("Not found"); return; }
      // Traversal guard on the canonical path — catches both `../` and symlinks escaping root.
      const real = fs.realpathSync(fp);
      if (real !== root && !real.startsWith(root + path.sep)) {
        res.writeHead(403); res.end("Forbidden"); return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(fp).toLowerCase()] ?? "application/octet-stream" });
      fs.createReadStream(real).pipe(res);
    } catch (e: any) {
      res.writeHead(500); res.end(e?.message ?? "Internal error");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  server.unref(); // don't keep the edge process alive for this
  return (server.address() as http.AddressInfo).port;
}
