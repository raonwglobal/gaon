import type { McpPluginFactory } from "./interface.js";

/**
 * Built-in plugin factories.
 * Add new entries when shipping first-party plugins.
 */
export const PLUGIN_FACTORIES: Record<string, McpPluginFactory> = {
  weather: async () => {
    const mod = await import("../../../../plugins/weather/index.js");
    return new mod.WeatherPlugin();
  },
  echo: async () => {
    const mod = await import("../../../../plugins/echo/index.js");
    return new mod.EchoPlugin();
  },
};

export function listBuiltinPluginIds(): string[] {
  return Object.keys(PLUGIN_FACTORIES);
}
