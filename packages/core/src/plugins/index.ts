import type { McpPluginFactory } from "./interface.js";
import { WeatherPlugin } from "../../../plugins/weather/index.js";

/**
 * Built-in plugin factories.
 * External plugins can be registered at runtime via Control Plane in later phases.
 */
export const PLUGIN_FACTORIES: Record<string, McpPluginFactory> = {
  weather: async () => new WeatherPlugin(),
};
