/**
 * Optional FUSE mount for todoforai resources.
 * Port of todoforai_edge/fuse/__init__.py
 *
 * Requires `fuse-native` npm package + libfuse on the system.
 * Gracefully no-ops when unavailable.
 */

export { isFuseAvailable, FuseMountManager } from "./mount-manager.js";
export { ResourceClient } from "./resource-client.js";
export { ResourceOperations } from "./operations.js";
export { pathToUri, isRoot, isSchemeRoot, SCHEMES } from "./path-mapping.js";

import { isFuseAvailable, FuseMountManager } from "./mount-manager.js";

export class FuseExtension {
  readonly name = "fuse";
  private mountPath: string | undefined;
  private manager: FuseMountManager | null = null;

  constructor(config: { fuseMountPath?: string }) {
    this.mountPath = config.fuseMountPath;
  }

  async start(edge: { apiUrl: string; apiKey: string }): Promise<void> {
    if (!isFuseAvailable()) {
      console.log("[fuse] Not available (fuse-native not installed or libfuse missing)");
      return;
    }
    try {
      this.manager = new FuseMountManager(edge.apiUrl, edge.apiKey, this.mountPath);
      const ok = await this.manager.start();
      if (!ok) {
        console.warn("[fuse] Mount did not start successfully");
        this.manager = null;
      }
    } catch (e: any) {
      console.error("[fuse] Failed to start:", e.message);
      this.manager = null;
    }
  }

  async stop(): Promise<void> {
    if (!this.manager) return;
    try {
      await this.manager.stop();
    } catch (e: any) {
      console.error("[fuse] Error stopping:", e.message);
    } finally {
      this.manager = null;
    }
  }
}
