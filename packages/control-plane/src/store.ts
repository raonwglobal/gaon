/**
 * File-backed store (JSON) with in-memory cache.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  config: Record<string, unknown>;
  source: { type: string; [key: string]: unknown };
  ownerUserId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlatformConfig {
  allowedOrigins: string[];
  rateLimitPerMin: number;
  apiSecretToken?: string;
  maxSessions: number;
}

interface PersistShape {
  plugins: PluginRecord[];
  config: PlatformConfig;
}

const dataPath =
  process.env.DATABASE_PATH ||
  join(process.cwd(), "data", "platform.json");

const plugins = new Map<string, PluginRecord>();
let platformConfig: PlatformConfig = {
  allowedOrigins: ["*"],
  rateLimitPerMin: 60,
  maxSessions: 1000,
};

function persist(): void {
  try {
    mkdirSync(dirname(dataPath), { recursive: true });
    writeFileSync(
      dataPath,
      JSON.stringify(
        { plugins: [...plugins.values()], config: platformConfig },
        null,
        2
      ),
      "utf8"
    );
  } catch (err) {
    console.error("[store] persist failed:", err);
  }
}

function load(): void {
  if (!existsSync(dataPath)) return;
  try {
    const data = JSON.parse(readFileSync(dataPath, "utf8")) as PersistShape;
    plugins.clear();
    for (const p of data.plugins ?? []) plugins.set(p.id, p);
    if (data.config) platformConfig = { ...platformConfig, ...data.config };
  } catch (err) {
    console.error("[store] load failed:", err);
  }
}

export function maskConfig(config: PlatformConfig): PlatformConfig {
  const copy = { ...config };
  if (copy.apiSecretToken) copy.apiSecretToken = "***";
  return copy;
}

export const store = {
  listPlugins(): PluginRecord[] {
    return [...plugins.values()];
  },
  listPluginsForUser(userId: string, isAdmin: boolean): PluginRecord[] {
    if (isAdmin) return store.listPlugins();
    return store.listPlugins().filter((p) => p.ownerUserId === userId);
  },
  getPlugin(id: string): PluginRecord | undefined {
    return plugins.get(id);
  },
  upsertPlugin(record: PluginRecord): void {
    plugins.set(record.id, record);
    persist();
  },
  deletePlugin(id: string): boolean {
    const ok = plugins.delete(id);
    if (ok) persist();
    return ok;
  },
  getConfig(): PlatformConfig {
    return { ...platformConfig };
  },
  setConfig(partial: Partial<PlatformConfig>): PlatformConfig {
    platformConfig = { ...platformConfig, ...partial };
    persist();
    return { ...platformConfig };
  },
};

load();
