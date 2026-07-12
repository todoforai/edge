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

const servers = new Map<string, number>(); // rootDir → port

/** Serve `rootDir` on a random free localhost port (reused per dir). */
export async function serveStaticDir(rootDir: string): Promise<number> {
  const existing = servers.get(rootDir);
  if (existing !== undefined) return existing;

  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
      let fp = path.normalize(path.join(rootDir, urlPath));
      // Path traversal guard: resolved path must stay inside rootDir.
      if (fp !== rootDir && !fp.startsWith(rootDir + path.sep)) {
        res.writeHead(403); res.end("Forbidden"); return;
      }
      let st = fs.statSync(fp, { throwIfNoEntry: false });
      if (st?.isDirectory()) {
        fp = path.join(fp, "index.html");
        st = fs.statSync(fp, { throwIfNoEntry: false });
      }
      if (!st?.isFile()) { res.writeHead(404); res.end("Not found"); return; }
      res.writeHead(200, { "content-type": MIME[path.extname(fp).toLowerCase()] ?? "application/octet-stream" });
      fs.createReadStream(fp).pipe(res);
    } catch (e: any) {
      res.writeHead(500); res.end(e?.message ?? "Internal error");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  server.unref(); // don't keep the edge process alive for this
  const port = (server.address() as http.AddressInfo).port;
  servers.set(rootDir, port);
  return port;
}
