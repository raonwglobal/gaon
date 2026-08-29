import type { McpPlugin, McpPluginFactory } from "./interface.js";
import { buildDiscoveredFactories, resolvePluginsDir } from "./discover.js";

const STATIC_FACTORIES: Record<string, McpPluginFactory> = {};

export let PLUGIN_FACTORIES: Record<string, McpPluginFactory> = {
  ...STATIC_FACTORIES,
};

let discoveryDone = false;
let discoveryEpoch = 0;
let discoveryInFlight: Promise<void> | null = null;

export function getDiscoveryEpoch(): number {
  return discoveryEpoch;
}

export async function ensurePluginDiscovery(): Promise<void> {
  if (discoveryDone) return;
  await reloadPluginDiscovery();
}

/**
 * Re-scan PLUGINS_DIR and rebuild factories without process restart.
 */
export async function reloadPluginDiscovery(): Promise<{
  epoch: number;
  ids: string[];
}> {
  if (discoveryInFlight) {
    await discoveryInFlight;
    return {
      epoch: discoveryEpoch,
      ids: Object.keys(PLUGIN_FACTORIES),
    };
  }

  discoveryInFlight = (async () => {
    const dir = resolvePluginsDir();
    console.log(`[plugins] Rediscovering from ${dir}`);
    try {
      const gen = Date.now();
      const discovered = await buildDiscoveredFactories(dir, gen);
      PLUGIN_FACTORIES = { ...STATIC_FACTORIES, ...discovered };
      discoveryEpoch += 1;
      discoveryDone = true;
      console.log(
        `[plugins] epoch=${discoveryEpoch} factories: ${
          Object.keys(PLUGIN_FACTORIES).join(", ") || "(none)"
        }`
      );
    } catch (err) {
      console.error("[plugins] Discovery failed:", err);
      if (Object.keys(PLUGIN_FACTORIES).length === 0) {
        PLUGIN_FACTORIES = { ...STATIC_FACTORIES };
      }
      discoveryDone = true;
    } finally {
      discoveryInFlight = null;
    }
  })();

  await discoveryInFlight;
  return {
    epoch: discoveryEpoch,
    ids: Object.keys(PLUGIN_FACTORIES),
  };
}

export function listBuiltinPluginIds(): string[] {
  return Object.keys(PLUGIN_FACTORIES);
}

export async function createPlugin(id: string): Promise<McpPlugin> {
  await ensurePluginDiscovery();
  const factory = PLUGIN_FACTORIES[id];
  if (!factory) {
    await reloadPluginDiscovery();
    const retry = PLUGIN_FACTORIES[id];
    if (!retry) {
      throw new Error(
        `Unknown plugin factory: ${id}. Known: ${
          Object.keys(PLUGIN_FACTORIES).join(", ") || "(none)"
        }`
      );
    }
    return retry();
  }
  return factory();
}

export function _resetDiscoveryForTests(): void {
  discoveryDone = false;
  discoveryEpoch = 0;
  PLUGIN_FACTORIES = { ...STATIC_FACTORIES };
}
