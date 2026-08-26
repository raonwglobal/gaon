import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { McpPlugin, McpPluginManifest } from "../../packages/core/src/plugins/interface.js";

/**
 * Example Weather plugin.
 * Demonstrates the McpPlugin contract used by the core runtime.
 */
export class WeatherPlugin implements McpPlugin {
  readonly manifest: McpPluginManifest = {
    id: "weather",
    name: "Weather Plugin",
    version: "1.0.0",
    description: "Simple weather lookup example plugin",
    author: "mcp-sse-platform",
  };

  async initialize(_config: Record<string, unknown>): Promise<void> {
    // Load API keys or external clients here when needed.
  }

  async registerTools(server: Server): Promise<void> {
    // Minimal example tool registration.
    // Real implementations should use the SDK's tool registration APIs.
    server.setRequestHandler?.({"method": "tools/list"} as never, async () => {
      return {
        tools: [
          {
            name: "weather_get_current",
            description: "Get current weather for a city (example)",
            inputSchema: {
              type: "object",
              properties: {
                city: { type: "string", description: "City name" },
              },
              required: ["city"],
            },
          },
        ],
      };
    });
  }

  async shutdown(): Promise<void> {
    // Cleanup resources
  }

  async healthCheck() {
    return { status: "ok" as const, message: "weather plugin ready" };
  }
}

export default WeatherPlugin;
