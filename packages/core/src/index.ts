import { loadConfig } from "./config.js";
import { createMcpSseServer } from "./server.js";

const config = loadConfig();
createMcpSseServer(config);

console.log("Enabled plugins:", config.enabledPlugins.join(", ") || "(none)");
