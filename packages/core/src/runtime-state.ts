/**
 * Mutable runtime state shared across Core handlers.
 * Control Plane pushes plugin enable lists, owners, and platform config here.
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
  /** pluginId -> ownerUserId (empty = shared/global) */
  pluginOwners: {} as Record<string, string>,
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

export function setPluginConfig(
  id: string,
  config: Record<string, unknown>
): void {
  runtimeState.pluginConfigs[id] = { ...config };
}

export function setPluginOwners(owners: Record<string, string>): void {
  runtimeState.pluginOwners = { ...owners };
}

/**
 * Resolve plugins visible for a session subject.
 * - explicitScope: from X-Enabled-Plugins header
 * - subject as userId: only plugins with matching ownerUserId or no owner
 * - otherwise: all enabled
 */
export function resolveSessionPlugins(
  explicitScope: string[] | null,
  subject?: string
): string[] {
  const enabled = runtimeState.enabledPlugins;
  let base = enabled;

  if (explicitScope && explicitScope.length > 0) {
    const allow = new Set(explicitScope);
    base = enabled.filter((id) => allow.has(id));
  } else if (
    subject &&
    subject !== "anonymous" &&
    !subject.startsWith("token:")
  ) {
    const owners = runtimeState.pluginOwners;
    const hasOwnership = Object.keys(owners).length > 0;
    if (hasOwnership) {
      base = enabled.filter((id) => {
        const owner = owners[id];
        return !owner || owner === subject;
      });
    }
  }

  return base;
}

export function setPlatformConfig(
  partial: Partial<RuntimePlatformConfig>
): RuntimePlatformConfig {
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
