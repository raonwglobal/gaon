/**
 * File-backed store (JSON) with in-memory cache.
 * Path: DATA_DIR/platform.json (default ./data/platform.json)
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
    const payload: PersistShape = {
      plugins: [...plugins.values()],
      config: platformConfig,
    };
    writeFileSync(dataPath, JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    console.error("[store] persist failed:", err);
  }
}

function load(): void {
  if (!existsSync(dataPath)) {
    // seed defaults
    store.upsertPlugin({
      id: "weather",
      name: "Weather Plugin",
      version: "1.0.1",
      description: "Simple weather lookup example",
      enabled: true,
      config: { defaultCity: "Seoul" },
      source: { type: "local", path: "plugins/weather" },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    store.upsertPlugin({
      id: "echo",
      name: "Echo Plugin",
      version: "1.0.0",
      description: "Echoes back the provided message",
      enabled: true,
      config: {},
      source: { type: "local", path: "plugins/echo" },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return;
  }

  try {
    const raw = readFileSync(dataPath, "utf8");
    const data = JSON.parse(raw) as PersistShape;
    plugins.clear();
    for (const p of data.plugins ?? []) {
      plugins.set(p.id, p);
    }
    if (data.config) {
      platformConfig = { ...platformConfig, ...data.config };
    }
  } catch (err) {
    console.error("[store] load failed:", err);
  }
}

export const store = {
  listPlugins(): PluginRecord[] {
    return [...plugins.values()];
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
