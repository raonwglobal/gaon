import type {
  McpPlugin,
  McpPluginManifest,
  PluginToolDefinition,
  ToolCallContext,
  ToolCallResult,
} from "../../packages/core/src/plugins/interface.js";

/**
 * Template plugin — copy this folder and rename the class/id.
 */
export class TemplatePlugin implements McpPlugin {
  readonly manifest: McpPluginManifest = {
    id: "template", // change me
    name: "Template Plugin",
    version: "0.1.0",
    description: "Replace with your plugin description",
    author: "your-name",
  };

  async initialize(config: Record<string, unknown>): Promise<void> {
    // Read API keys, open DB connections, etc.
    void config;
  }

  async listTools(): Promise<PluginToolDefinition[]> {
    return [
      {
        name: "hello",
        description: "Return a greeting",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name to greet" },
          },
          required: ["name"],
        },
      },
    ];
  }

  async callTool(ctx: ToolCallContext): Promise<ToolCallResult> {
    if (ctx.name === "hello") {
      const name =
        typeof ctx.arguments.name === "string" ? ctx.arguments.name : "world";
      return {
        content: [{ type: "text", text: `Hello, ${name}!` }],
      };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${ctx.name}` }],
      isError: true,
    };
  }

  async shutdown(): Promise<void> {
    // Close connections / flush buffers
  }

  async healthCheck() {
    return { status: "ok" as const, message: "template plugin ready" };
  }
}

export default TemplatePlugin;
