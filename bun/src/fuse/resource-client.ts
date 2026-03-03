/**
 * Synchronous-style HTTP client for the backend ResourceService.
 * Port of todoforai_edge/fuse/resource_client.py
 */

export interface ResourceMetadata {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: number | null;
  isDirectory: boolean;
}

export interface ResourceContent {
  data: Uint8Array;
  metadata: ResourceMetadata;
}

function parseMetadata(raw: Record<string, any>): ResourceMetadata {
  return {
    uri: raw.uri ?? "",
    name: raw.name ?? "",
    mimeType: raw.mimeType ?? "",
    size: raw.size ?? 0,
    createdAt: raw.createdAt ?? null,
    isDirectory: !!raw.isDirectory,
  };
}

export class ResourceClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private timeout: number;

  constructor(baseUrl: string, apiKey?: string, timeout = 30_000) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  private async request(path: string): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};
    if (this.apiKey) headers["x-api-key"] = this.apiKey;

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (res.ok) return res;

    const code = res.status;
    if (code === 404) throw Object.assign(new Error(`Not found: ${url}`), { code: "ENOENT" });
    if (code === 401 || code === 403) throw Object.assign(new Error(`Access denied: ${url}`), { code: "EACCES" });
    throw Object.assign(new Error(`HTTP ${code}: ${res.statusText}`), { code: "EIO" });
  }

  async getMetadata(uri: string): Promise<ResourceMetadata> {
    const res = await this.request(`/resources/metadata?uri=${encodeURIComponent(uri)}`);
    return parseMetadata(await res.json());
  }

  async fetch(uri: string): Promise<ResourceContent> {
    const res = await this.request(`/resources?uri=${encodeURIComponent(uri)}`);
    const data = new Uint8Array(await res.arrayBuffer());
    const metadata = await this.getMetadata(uri);
    return { data, metadata };
  }

  async list(uri: string): Promise<ResourceMetadata[]> {
    const res = await this.request(`/resources/list?uri=${encodeURIComponent(uri)}`);
    const json = await res.json();
    return (json.entries ?? []).map(parseMetadata);
  }
}
