import { loadConfig } from "./config.js";
import { ensurePluginDiscovery } from "./plugins/index.js";
import { createMcpSseServer } from "./server.js";

async function main() {
  const config = loadConfig();
  if (config.pluginsDir) {
    process.env.PLUGINS_DIR = config.pluginsDir;
  }
  await ensurePluginDiscovery();
  createMcpSseServer(config);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
