import type { McpPluginFactory } from "./interface.js";
import { buildDiscoveredFactories, resolvePluginsDir } from "./discover.js";

/** Built-in static factories (always available). */
const STATIC_FACTORIES: Record<string, McpPluginFactory> = {};

/** Merged map: static + discovered (discovered fills gaps / overrides). */
export let PLUGIN_FACTORIES: Record<string, McpPluginFactory> = { ...STATIC_FACTORIES };

let discoveryDone = false;

export async function ensurePluginDiscovery(): Promise<void> {
  if (discoveryDone) return;
  const dir = resolvePluginsDir();
  console.log(`[plugins] Discovering from ${dir}`);
  try {
    const discovered = await buildDiscoveredFactories(dir);
    PLUGIN_FACTORIES = { ...STATIC_FACTORIES, ...discovered };
    console.log(
      `[plugins] Loaded factories: ${Object.keys(PLUGIN_FACTORIES).join(", ") || "(none)"}`
    );
  } catch (err) {
    console.error("[plugins] Discovery failed:", err);
    PLUGIN_FACTORIES = { ...STATIC_FACTORIES };
  }
  discoveryDone = true;
}

export function listBuiltinPluginIds(): string[] {
  return Object.keys(PLUGIN_FACTORIES);
}

/** test helper */
export function _resetDiscoveryForTests(): void {
  discoveryDone = false;
  PLUGIN_FACTORIES = { ...STATIC_FACTORIES };
}
