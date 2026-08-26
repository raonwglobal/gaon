/**
 * Mutable runtime state shared between server bootstrap and admin endpoints.
 * New SSE sessions read enabledPlugins from here so Control Plane changes
 * apply to subsequent connections without process restart.
 */
export const runtimeState = {
  enabledPlugins: [] as string[],
  pluginConfigs: {} as Record<string, Record<string, unknown>>,
};

export function setEnabledPlugins(ids: string[]): void {
  runtimeState.enabledPlugins = [...ids];
}

export function setPluginConfig(id: string, config: Record<string, unknown>): void {
  runtimeState.pluginConfigs[id] = { ...config };
}
