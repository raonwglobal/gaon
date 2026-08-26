import type { PluginRuntimeMode } from "./types.js";

export function getPluginRuntimeMode(): PluginRuntimeMode {
  const m = (process.env.PLUGIN_RUNTIME || "inprocess").toLowerCase();
  return m === "container" ? "container" : "inprocess";
}
