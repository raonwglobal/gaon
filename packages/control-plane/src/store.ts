/**
 * In-memory store for Phase 2.
 * Replace with SQLite/PostgreSQL/Redis for production.
 */

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  config: Record<string, unknown>;
  source: { type: string; [key: string]: unknown };
  createdAt: number;
  updatedAt: number;
}

export interface PlatformConfig {
  allowedOrigins: string[];
  rateLimitPerMin: number;
  apiSecretToken?: string;
  maxSessions: number;
}

const plugins = new Map<string, PluginRecord>();
let platformConfig: PlatformConfig = {
  allowedOrigins: ["*"],
  rateLimitPerMin: 60,
  maxSessions: 1000,
};

export const store = {
  listPlugins(): PluginRecord[] {
    return [...plugins.values()];
  },

  getPlugin(id: string): PluginRecord | undefined {
    return plugins.get(id);
  },

  upsertPlugin(record: PluginRecord): void {
    plugins.set(record.id, record);
  },

  deletePlugin(id: string): boolean {
    return plugins.delete(id);
  },

  getConfig(): PlatformConfig {
    return { ...platformConfig };
  },

  setConfig(partial: Partial<PlatformConfig>): PlatformConfig {
    platformConfig = { ...platformConfig, ...partial };
    return { ...platformConfig };
  },
};

// Seed example plugin
store.upsertPlugin({
  id: "weather",
  name: "Weather Plugin",
  version: "1.0.0",
  description: "Simple weather lookup example",
  enabled: true,
  config: {},
  source: { type: "local", path: "plugins/weather" },
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
