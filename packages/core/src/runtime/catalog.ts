import type { PluginRuntimeRecord, RuntimeManifest } from "./types.js";
import { logger } from "../logger.js";

type Listener = (snapshot: PluginRuntimeRecord[]) => void;

/**
 * In-memory routing table: pluginId → runtime endpoint.
 * Hot-reload = atomic replace of a record (or full replace).
 */
class RuntimeCatalog {
  private map = new Map<string, PluginRuntimeRecord>();
  private listeners = new Set<Listener>();
  private epoch = 0;

  getEpoch(): number {
    return this.epoch;
  }

  list(): PluginRuntimeRecord[] {
    return [...this.map.values()].map((r) => ({ ...r }));
  }

  get(id: string): PluginRuntimeRecord | undefined {
    const r = this.map.get(id);
    return r ? { ...r } : undefined;
  }

  /** Atomic upsert single plugin runtime. */
  upsert(record: PluginRuntimeRecord): void {
    this.map.set(record.id, { ...record });
    this.epoch += 1;
    logger.info("catalog upsert", {
      id: record.id,
      version: record.version,
      endpoint: record.endpoint,
      status: record.status,
      epoch: this.epoch,
    });
    this.emit();
  }

  remove(id: string): boolean {
    const ok = this.map.delete(id);
    if (ok) {
      this.epoch += 1;
      logger.info("catalog remove", { id, epoch: this.epoch });
      this.emit();
    }
    return ok;
  }

  /** Full replace from Control Plane / orchestrator. */
  replaceAll(records: PluginRuntimeRecord[]): void {
    this.map.clear();
    for (const r of records) {
      this.map.set(r.id, { ...r });
    }
    this.epoch += 1;
    logger.info("catalog replaceAll", {
      count: records.length,
      epoch: this.epoch,
    });
    this.emit();
  }

  readyPlugins(): PluginRuntimeRecord[] {
    return this.list().filter((r) => r.status === "ready");
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const snap = this.list();
    for (const fn of this.listeners) {
      try {
        fn(snap);
      } catch (err) {
        logger.error("catalog listener error", { error: String(err) });
      }
    }
  }
}

export const runtimeCatalog = new RuntimeCatalog();

/** Optional cache of last fetched manifests per plugin id */
const manifestCache = new Map<string, { epoch: number; manifest: RuntimeManifest }>();

export function getCachedManifest(
  id: string,
  epoch: number
): RuntimeManifest | undefined {
  const c = manifestCache.get(id);
  if (c && c.epoch === epoch) return c.manifest;
  return undefined;
}

export function setCachedManifest(
  id: string,
  epoch: number,
  manifest: RuntimeManifest
): void {
  manifestCache.set(id, { epoch, manifest });
}

export function clearManifestCache(id?: string): void {
  if (id) manifestCache.delete(id);
  else manifestCache.clear();
}
