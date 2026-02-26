import { loadConfig } from "./config.js";
import { TODOforAIEdge } from "./edge.js";

async function main() {
  const config = await loadConfig();

  if (config.debug) {
    console.log("[config]", { apiUrl: config.apiUrl, debug: config.debug, addWorkspacePath: config.addWorkspacePath });
  }

  const edge = new TODOforAIEdge(config);
  await edge.ensureApiKey(true);
  await edge.start();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
