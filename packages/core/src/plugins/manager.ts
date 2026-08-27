import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpPlugin, PluginToolDefinition, ToolCallResult } from "./interface.js";
import { createPlugin } from "./index.js";
import { metrics } from "../metrics.js";
import { logger } from "../logger.js";

export class PluginManager {
  private plugins: McpPlugin[] = [];
  private toolOwner = new Map<string, McpPlugin>();

  async loadPlugins(
    ids: string[],
    configs: Record<string, Record<string, unknown>> = {}
  ): Promise<void> {
    for (const id of ids) {
      try {
        const plugin = await createPlugin(id);
        await plugin.initialize(configs[id] ?? {});
        this.plugins.push(plugin);
        logger.info("plugin loaded", { id });
      } catch (err) {
        logger.error("plugin load failed", { id, error: String(err) });
      }
    }
  }

  async registerToolsToServer(server: Server): Promise<void> {
    const aggregated: PluginToolDefinition[] = [];

    for (const plugin of this.plugins) {
      if (plugin.registerTools) {
        await plugin.registerTools(server);
      }
      if (!plugin.listTools) continue;
      const tools = await plugin.listTools();
      for (const tool of tools) {
        const qualified = tool.name.startsWith(`${plugin.manifest.id}_`)
          ? tool.name
          : `${plugin.manifest.id}_${tool.name}`;
        aggregated.push({
          name: qualified,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
        this.toolOwner.set(qualified, plugin);
      }
    }

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: aggregated.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const name = request.params.name;
      const args = (request.params.arguments ?? {}) as Record<string, unknown>;
      const owner = this.toolOwner.get(name);

      if (!owner?.callTool) {
        metrics.recordToolCall(name, true);
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        } as ToolCallResult;
      }

      const localName = name.startsWith(`${owner.manifest.id}_`)
        ? name.slice(owner.manifest.id.length + 1)
        : name;

      try {
        const result = await owner.callTool({ name: localName, arguments: args });
        metrics.recordToolCall(name, Boolean(result.isError));
        return result as ToolCallResult;
      } catch (err) {
        metrics.recordToolCall(name, true);
        return {
          content: [
            {
              type: "text" as const,
              text: err instanceof Error ? err.message : String(err),
            },
          ],
          isError: true,
        } as ToolCallResult;
      }
    });
  }

  async shutdownAll(): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        await plugin.shutdown();
      } catch (err) {
        logger.warn("plugin shutdown error", { error: String(err) });
      }
    }
    this.plugins = [];
    this.toolOwner.clear();
  }
}
