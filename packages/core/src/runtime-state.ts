/**
 * Mutable runtime state shared across Core handlers.
 * Control Plane pushes plugin enable lists and platform config here.
 */
export interface RuntimePlatformConfig {
  allowedOrigins: string[];
  rateLimitPerMin: number;
  maxSessions: number;
  apiSecretToken?: string;
  sessionIdleTimeoutMs: number;
}

export const runtimeState = {
  enabledPlugins: [] as string[],
  pluginConfigs: {} as Record<string, Record<string, unknown>>,
  platform: {
    allowedOrigins: ["*"],
    rateLimitPerMin: 60,
    maxSessions: 1000,
    sessionIdleTimeoutMs: 1_800_000,
  } as RuntimePlatformConfig,
};

export function setEnabledPlugins(ids: string[]): void {
  runtimeState.enabledPlugins = [...ids];
}

export function setPluginConfig(id: string, config: Record<string, unknown>): void {
  runtimeState.pluginConfigs[id] = { ...config };
}

export function setPlatformConfig(partial: Partial<RuntimePlatformConfig>): RuntimePlatformConfig {
  runtimeState.platform = {
    ...runtimeState.platform,
    ...partial,
    allowedOrigins: partial.allowedOrigins
      ? [...partial.allowedOrigins]
      : runtimeState.platform.allowedOrigins,
  };
  return { ...runtimeState.platform };
}

export function getPlatformConfig(): RuntimePlatformConfig {
  return { ...runtimeState.platform };
}
