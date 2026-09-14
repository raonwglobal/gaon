import { loadConfig } from "./config.js";
import { ensurePluginDiscovery } from "./plugins/index.js";
import { createMcpSseServer } from "./server.js";
import { bootstrapFromControlPlane } from "./bootstrap-control-plane.js";
import { logger } from "./logger.js";

async function main() {
  const config = loadConfig();
  if (config.pluginsDir) {
    process.env.PLUGINS_DIR = config.pluginsDir;
  }
  await ensurePluginDiscovery();
  createMcpSseServer(config);

  // Push registry (enabled plugins) from Control Plane into this Core.
  // Retries cover CP still starting (depends_on alone is not enough).
  const boot = await bootstrapFromControlPlane();
  if (boot.attempted && !boot.ok) {
    logger.warn("started with env-seeded plugins only; sync later via POST /api/sync", {
      detail: boot.detail,
    });
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
