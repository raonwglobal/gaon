/**
 * Written by install-worker (or by hand) next to an external MCP server.
 * Core uses this to spawn stdio bridges instead of expecting McpPlugin classes.
 */
export type ExternalPluginRuntime = "stdio" | "inprocess";

export interface ExternalPluginMeta {
  id: string;
  runtime: ExternalPluginRuntime;
  /** Executable, e.g. node, python3 */
  command?: string;
  args?: string[];
  /** Relative to plugin dir or absolute */
  cwd?: string;
  env?: Record<string, string>;
  /** Env var names to forward from process.env / session secrets */
  envFromHost?: string[];
  description?: string;
  version?: string;
}

export const PLUGIN_META_FILENAME = "plugin.meta.json";
