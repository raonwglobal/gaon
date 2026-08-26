import type {
  McpPlugin,
  McpPluginManifest,
  PluginToolDefinition,
  ToolCallContext,
  ToolCallResult,
} from "../../packages/core/src/plugins/interface.js";

/**
 * Minimal echo plugin — useful as a smoke-test tool.
 */
export class EchoPlugin implements McpPlugin {
  readonly manifest: McpPluginManifest = {
    id: "echo",
    name: "Echo Plugin",
    version: "1.0.0",
    description: "Echoes back the provided message",
    author: "mcp-sse-platform",
  };

  async initialize(_config: Record<string, unknown>): Promise<void> {}

  async listTools(): Promise<PluginToolDefinition[]> {
    return [
      {
        name: "echo",
        description: "Return the same message that was sent",
        inputSchema: {
          type: "object",
          properties: {
            message: { type: "string", description: "Text to echo" },
          },
          required: ["message"],
        },
      },
    ];
  }

  async callTool(ctx: ToolCallContext): Promise<ToolCallResult> {
    if (ctx.name !== "echo") {
      return {
        content: [{ type: "text", text: `Unknown tool: ${ctx.name}` }],
        isError: true,
      };
    }
    const message =
      typeof ctx.arguments.message === "string"
        ? ctx.arguments.message
        : JSON.stringify(ctx.arguments);
    return {
      content: [{ type: "text", text: message }],
    };
  }

  async shutdown(): Promise<void> {}
}

export default EchoPlugin;
