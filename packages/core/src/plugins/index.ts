import type { McpPluginFactory } from "./interface.js";

/**
 * Built-in plugin factories.
 * For the skeleton, weather is registered lazily to avoid hard path coupling.
 * Drop real plugin modules under /plugins and wire them here or via Control Plane.
 */
export const PLUGIN_FACTORIES: Record<string, McpPluginFactory> = {
  weather: async () => {
    const mod = await import("../../../../plugins/weather/index.js");
    return new mod.WeatherPlugin();
  },
};
