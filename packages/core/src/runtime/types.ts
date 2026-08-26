/** Shared Tool Runtime API contract (plugin containers + Core). */

export interface RuntimeToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface RuntimeManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  tools: RuntimeToolDefinition[];
}

export interface RuntimeCallRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface RuntimeCallResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export type PluginRuntimeStatus =
  | "starting"
  | "ready"
  | "draining"
  | "stopped"
  | "error";

export interface PluginRuntimeRecord {
  id: string;
  version: string;
  /** http://host:port — Tool Runtime API base */
  endpoint: string;
  status: PluginRuntimeStatus;
  image?: string;
  containerId?: string;
  weight?: number;
  startedAt?: number;
  lastError?: string;
}

export type PluginRuntimeMode = "inprocess" | "container";
