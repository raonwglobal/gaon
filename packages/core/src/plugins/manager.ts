import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  McpPlugin,
  PluginToolDefinition,
  ToolCallContext,
} from "./interface.js";
import { createPlugin } from "./index.js";
import { metrics } from "../metrics.js";
import { logger } from "../logger.js";
import type { SecretMap } from "../session-secrets.js";
import { createUpstreamFetch } from "../session-secrets.js";

export interface PluginManagerOptions {
  sessionId: string;
  subject?: string;
  secrets: SecretMap;
}

export class PluginManager {
  private plugins: McpPlugin[] = [];
  private toolOwner = new Map<string, McpPlugin>();
  private opts: PluginManagerOptions;

  constructor(opts: PluginManagerOptions) {
    this.opts = opts;
  }

  async loadPlugins(
    ids: string[],
    configs: Record<string, Record<string, unknown>> = {}
  ): Promise<void> {
    for (const id of ids) {
      try {
        const plugin = await createPlugin(id);
        await plugin.initialize(configs[id] ?? {});
        this.plugins.push(plugin);
        logger.info("plugin loaded", { id, sessionId: this.opts.sessionId });
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

    const secrets = this.opts.secrets;
    const sessionId = this.opts.sessionId;
    const subject = this.opts.subject;
    const upstreamFetch = createUpstreamFetch(secrets);

    server.setRequestHandler(
      CallToolRequestSchema,
      (async (request: {
        params: { name: string; arguments?: Record<string, unknown> };
      }) => {
        const name = request.params.name;
        const args = (request.params.arguments ?? {}) as Record<
          string,
          unknown
        >;
        const owner = this.toolOwner.get(name);

        if (!owner?.callTool) {
          metrics.recordToolCall(name, true);
          return {
            content: [
              { type: "text" as const, text: `Unknown tool: ${name}` },
            ],
            isError: true,
          };
        }

        const localName = name.startsWith(`${owner.manifest.id}_`)
          ? name.slice(owner.manifest.id.length + 1)
          : name;

        const ctx: ToolCallContext = {
          name: localName,
          arguments: args,
          sessionId,
          subject,
          getSecret: (n: string) => secrets.get(n),
          upstreamFetch,
        };

        try {
          const result = await owner.callTool(ctx);
          metrics.recordToolCall(name, Boolean(result.isError));
          return result;
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
          };
        }
      }) as never
    );
  }

  getToolNames(): string[] {
    return [...this.toolOwner.keys()];
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
