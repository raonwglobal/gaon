import { store, type PluginRecord } from "./store.js";

export class PluginRegistry {
  list(): PluginRecord[] {
    return store.listPlugins();
  }

  get(id: string): PluginRecord | null {
    return store.getPlugin(id) ?? null;
  }

  register(input: {
    id: string;
    name: string;
    version: string;
    description?: string;
    source: PluginRecord["source"];
    config?: Record<string, unknown>;
  }): PluginRecord {
    const now = Date.now();
    const existing = store.getPlugin(input.id);
    const record: PluginRecord = {
      id: input.id,
      name: input.name,
      version: input.version,
      description: input.description,
      enabled: existing?.enabled ?? true,
      config: input.config ?? existing?.config ?? {},
      source: input.source,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    store.upsertPlugin(record);
    return record;
  }

  enable(id: string): PluginRecord | null {
    const p = store.getPlugin(id);
    if (!p) return null;
    p.enabled = true;
    p.updatedAt = Date.now();
    store.upsertPlugin(p);
    return p;
  }

  disable(id: string): PluginRecord | null {
    const p = store.getPlugin(id);
    if (!p) return null;
    p.enabled = false;
    p.updatedAt = Date.now();
    store.upsertPlugin(p);
    return p;
  }

  updateConfig(id: string, config: Record<string, unknown>): PluginRecord | null {
    const p = store.getPlugin(id);
    if (!p) return null;
    p.config = { ...p.config, ...config };
    p.updatedAt = Date.now();
    store.upsertPlugin(p);
    return p;
  }

  uninstall(id: string): boolean {
    return store.deletePlugin(id);
  }

  enabledIds(): string[] {
    return store.listPlugins().filter((p) => p.enabled).map((p) => p.id);
  }
}

export const registry = new PluginRegistry();
