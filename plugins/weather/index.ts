import type {
  McpPlugin,
  McpPluginManifest,
  PluginToolDefinition,
  ToolCallContext,
  ToolCallResult,
} from "../../packages/core/src/plugins/interface.js";

export class WeatherPlugin implements McpPlugin {
  readonly manifest: McpPluginManifest = {
    id: "weather",
    name: "Weather Plugin",
    version: "1.0.2",
    description: "Simple weather lookup example plugin",
    author: "mcp-sse-platform",
  };

  private defaultCity = "Seoul";

  async initialize(config: Record<string, unknown>): Promise<void> {
    if (typeof config.defaultCity === "string") {
      this.defaultCity = config.defaultCity;
    }
  }

  async listTools(): Promise<PluginToolDefinition[]> {
    return [
      {
        name: "get_current",
        description: "Get current weather for a city (demo — returns mock data)",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name (default from plugin config)",
            },
          },
        },
      },
    ];
  }

  async callTool(ctx: ToolCallContext): Promise<ToolCallResult> {
    if (ctx.name !== "get_current") {
      return {
        content: [{ type: "text", text: `Unknown tool: ${ctx.name}` }],
        isError: true,
      };
    }

    const city =
      typeof ctx.arguments.city === "string" && ctx.arguments.city.trim()
        ? ctx.arguments.city.trim()
        : this.defaultCity;

    // Optional real upstream:
    // const res = await ctx.upstreamFetch("https://api.example.com/weather?q=" + city, {
    //   secretName: "WEATHER_API_KEY",
    // });
    const hasKey = Boolean(ctx.getSecret("WEATHER_API_KEY"));

    const payload = {
      city,
      tempC: 22,
      condition: "Partly cloudy",
      source: hasKey ? "mock-with-session-secret" : "mock",
      sessionId: ctx.sessionId,
      ts: new Date().toISOString(),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    };
  }

  async shutdown(): Promise<void> {}

  async healthCheck() {
    return { status: "ok" as const, message: "weather plugin ready" };
  }
}

export default WeatherPlugin;
