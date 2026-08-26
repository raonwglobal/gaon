import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpPlugin, PluginToolDefinition } from "./interface.js";
import { PLUGIN_FACTORIES } from "./index.js";

export class PluginManager {
  private plugins: McpPlugin[] = [];
  private toolOwner = new Map<string, McpPlugin>();

  async loadPlugins(names: string[], configs: Record<string, Record<string, unknown>> = {}): Promise<void> {
    this.plugins = [];
    this.toolOwner.clear();

    for (const name of names) {
      const factory = PLUGIN_FACTORIES[name];
      if (!factory) {
        console.warn(`[PluginManager] Unknown plugin: ${name}`);
        continue;
      }

      const plugin = await factory();
      await plugin.initialize(configs[name] ?? {});
      this.plugins.push(plugin);
      console.log(
        `[PluginManager] Loaded plugin: ${plugin.manifest.id}@${plugin.manifest.version}`
      );
    }
  }

  async registerToolsToServer(server: Server): Promise<void> {
    // Allow plugins that still use direct registerTools
    for (const plugin of this.plugins) {
      if (plugin.registerTools) {
        await plugin.registerTools(server);
      }
    }

    // Aggregate listTools/callTool from plugins that implement the preferred API
    const aggregated: PluginToolDefinition[] = [];
    this.toolOwner.clear();

    for (const plugin of this.plugins) {
      if (!plugin.listTools) continue;
      const tools = await plugin.listTools();
      for (const tool of tools) {
        // Prefix with plugin id to avoid collisions
        const qualified = tool.name.startsWith(`${plugin.manifest.id}_`)
          ? tool.name
          : `${plugin.manifest.id}_${tool.name}`;
        const def = { ...tool, name: qualified };
        aggregated.push(def);
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
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }

      // Strip plugin prefix when calling plugin-local name if plugin expects short name
      const localName = name.startsWith(`${owner.manifest.id}_`)
        ? name.slice(owner.manifest.id.length + 1)
        : name;

      try {
        return await owner.callTool({ name: localName, arguments: args });
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: err instanceof Error ? err.message : String(err),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async shutdownAll(): Promise<void> {
    await Promise.all(
      this.plugins.map(async (p) => {
        try {
          await p.shutdown();
        } catch (err) {
          console.error(`[PluginManager] Shutdown error for ${p.manifest.id}:`, err);
        }
      })
    );
    this.plugins = [];
    this.toolOwner.clear();
  }

  async healthCheckAll(): Promise<
    Array<{ id: string; status: "ok" | "degraded" | "error"; message?: string }>
  > {
    const results = [];
    for (const plugin of this.plugins) {
      if (plugin.healthCheck) {
        const result = await plugin.healthCheck();
        results.push({ id: plugin.manifest.id, ...result });
      } else {
        results.push({ id: plugin.manifest.id, status: "ok" as const });
      }
    }
    return results;
  }

  get loaded(): string[] {
    return this.plugins.map((p) => p.manifest.id);
  }
}
