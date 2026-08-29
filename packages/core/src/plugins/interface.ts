import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

export interface McpPluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
}

export interface PluginToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface ToolCallResult {
  content: Array<
    { type: "text"; text: string } | { type: string; [k: string]: unknown }
  >;
  isError?: boolean;
}

export interface ToolCallContext {
  name: string;
  arguments: Record<string, unknown>;
  sessionId: string;
  subject?: string;
  getSecret(name: string): string | undefined;
  upstreamFetch(
    url: string,
    init?: RequestInit & { secretName?: string }
  ): Promise<Response>;
}

export interface McpPlugin {
  manifest: McpPluginManifest;
  initialize(config: Record<string, unknown>): Promise<void>;
  listTools?(): Promise<PluginToolDefinition[]>;
  callTool?(ctx: ToolCallContext): Promise<ToolCallResult>;
  registerTools?(server: Server): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck?(): Promise<{
    status: "ok" | "degraded" | "error";
    message?: string;
  }>;
}

export type McpPluginFactory = () => Promise<McpPlugin> | McpPlugin;
