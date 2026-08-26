import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

export interface McpPluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
}

/** JSON Schema style tool definition used for aggregation */
export interface PluginToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCallContext {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface McpPlugin {
  readonly manifest: McpPluginManifest;
  initialize(config: Record<string, unknown>): Promise<void>;
  /** Preferred: return tool defs for aggregation by PluginManager */
  listTools?(): Promise<PluginToolDefinition[]>;
  /** Preferred: handle a tool call for tools owned by this plugin */
  callTool?(ctx: ToolCallContext): Promise<ToolCallResult>;
  /** Legacy/direct registration (optional) */
  registerTools?(server: Server): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck?(): Promise<{ status: "ok" | "degraded" | "error"; message?: string }>;
}

export type McpPluginFactory = () => Promise<McpPlugin>;
