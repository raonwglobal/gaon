import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  McpPlugin,
  McpPluginManifest,
  PluginToolDefinition,
  ToolCallContext,
  ToolCallResult,
} from "./interface.js";
import type { ExternalPluginMeta } from "./external-meta.js";
import { logger } from "../logger.js";

/**
 * Wraps a full MCP server process (stdio) as a gaon in-process McpPlugin.
 * Used for external installs such as tossinvest-mcp (Node) or kbsec-mcp (Python).
 */
export class ExternalMcpServerPlugin implements McpPlugin {
  readonly manifest: McpPluginManifest;
  private meta: ExternalPluginMeta;
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: PluginToolDefinition[] = [];
  private pluginDir: string;

  constructor(meta: ExternalPluginMeta, pluginDir: string) {
    this.meta = meta;
    this.pluginDir = pluginDir;
    this.manifest = {
      id: meta.id,
      name: meta.id,
      version: meta.version || "0.0.0",
      description:
        meta.description ||
        `External MCP server (${meta.runtime}) — ${meta.command || "?"} ${(meta.args || []).join(" ")}`.trim(),
    };
  }

  async initialize(config: Record<string, unknown>): Promise<void> {
    if (this.meta.runtime !== "stdio") {
      throw new Error(
        `ExternalMcpServerPlugin only supports runtime=stdio (got ${this.meta.runtime})`
      );
    }
    const command = this.meta.command || "node";
    const args = this.meta.args || ["dist/index.js"];
    const cwd = this.meta.cwd
      ? this.meta.cwd.startsWith("/")
        ? this.meta.cwd
        : `${this.pluginDir}/${this.meta.cwd}`
      : this.pluginDir;

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...(this.meta.env || {}),
    };
    // Session/plugin config secrets override
    for (const [k, v] of Object.entries(config)) {
      if (typeof v === "string") env[k] = v;
    }
    if (this.meta.envFromHost) {
      for (const key of this.meta.envFromHost) {
        if (process.env[key]) env[key] = process.env[key]!;
      }
    }

    this.transport = new StdioClientTransport({
      command,
      args,
      cwd,
      env,
      stderr: "pipe",
    });

    this.client = new Client(
      { name: `gaon-bridge-${this.meta.id}`, version: "1.0.0" },
      { capabilities: {} }
    );

    logger.info("external MCP bridge starting", {
      id: this.meta.id,
      command,
      args,
      cwd,
    });

    await this.client.connect(this.transport);

    const listed = await this.client.listTools();
    this.tools = (listed.tools || []).map((t) => ({
      name: t.name,
      description: t.description || t.name,
      inputSchema: (t.inputSchema || {
        type: "object",
        properties: {},
      }) as Record<string, unknown>,
    }));

    logger.info("external MCP bridge ready", {
      id: this.meta.id,
      tools: this.tools.map((t) => t.name),
    });
  }

  async listTools(): Promise<PluginToolDefinition[]> {
    return this.tools;
  }

  async callTool(ctx: ToolCallContext): Promise<ToolCallResult> {
    if (!this.client) {
      return {
        content: [{ type: "text", text: "External MCP client not started" }],
        isError: true,
      };
    }
    try {
      const result = await this.client.callTool({
        name: ctx.name,
        arguments: ctx.arguments,
      });
      const content = Array.isArray((result as { content?: unknown }).content)
        ? ((result as { content: ToolCallResult["content"] }).content)
        : [
            {
              type: "text" as const,
              text: JSON.stringify(result),
            },
          ];
      return {
        content,
        isError: Boolean((result as { isError?: boolean }).isError),
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: err instanceof Error ? err.message : String(err),
          },
        ],
        isError: true,
      };
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.client?.close();
    } catch {
      /* ignore */
    }
    this.client = null;
    this.transport = null;
    this.tools = [];
  }

  async healthCheck() {
    return {
      status: this.client ? ("ok" as const) : ("error" as const),
      message: this.client
        ? `bridge up, ${this.tools.length} tools`
        : "bridge not connected",
    };
  }
}
