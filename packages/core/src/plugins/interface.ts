import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

export interface McpPluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
}

export interface McpPlugin {
  readonly manifest: McpPluginManifest;
  initialize(config: Record<string, unknown>): Promise<void>;
  registerTools(server: Server): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck?(): Promise<{ status: "ok" | "degraded" | "error"; message?: string }>;
}

export type McpPluginFactory = () => Promise<McpPlugin>;
