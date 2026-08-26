/**
 * Lightweight orchestrator interface + in-memory stub.
 * Production: swap for DockerOrchestrator (dockerode) or K8s.
 */
import type { PluginRuntimeRecord } from "./types.js";
import { runtimeCatalog } from "./catalog.js";
import { HttpPluginTransport } from "./http-transport.js";
import { logger } from "../logger.js";

export interface DeployRequest {
  id: string;
  version: string;
  /** Pre-started endpoint (dev) or image ref for real orchestrators */
  endpoint?: string;
  image?: string;
}

export interface PluginOrchestrator {
  deploy(req: DeployRequest): Promise<PluginRuntimeRecord>;
  undeploy(id: string): Promise<void>;
  healthCheck(id: string): Promise<boolean>;
}

/**
 * Registers an already-running Tool Runtime HTTP server into the catalog.
 * Used for local container sidecars and integration tests without Docker API.
 */
export class EndpointOrchestrator implements PluginOrchestrator {
  async deploy(req: DeployRequest): Promise<PluginRuntimeRecord> {
    if (!req.endpoint) {
      throw new Error("EndpointOrchestrator requires endpoint");
    }

    const record: PluginRuntimeRecord = {
      id: req.id,
      version: req.version,
      endpoint: req.endpoint,
      status: "starting",
      image: req.image,
      startedAt: Date.now(),
    };
    runtimeCatalog.upsert(record);

    const transport = new HttpPluginTransport(req.endpoint);
    const ok = await transport.health();
    if (!ok) {
      record.status = "error";
      record.lastError = "health check failed";
      runtimeCatalog.upsert(record);
      throw new Error(`Plugin ${req.id} health check failed at ${req.endpoint}`);
    }

    try {
      const manifest = await transport.manifest();
      record.version = manifest.version || req.version;
    } catch (err) {
      logger.warn("manifest fetch after deploy", { error: String(err) });
    }

    record.status = "ready";
    runtimeCatalog.upsert(record);
    return record;
  }

  async undeploy(id: string): Promise<void> {
    const cur = runtimeCatalog.get(id);
    if (cur) {
      runtimeCatalog.upsert({ ...cur, status: "draining" });
    }
    runtimeCatalog.remove(id);
  }

  async healthCheck(id: string): Promise<boolean> {
    const cur = runtimeCatalog.get(id);
    if (!cur) return false;
    const transport = new HttpPluginTransport(cur.endpoint);
    const ok = await transport.health();
    if (!ok && cur.status === "ready") {
      runtimeCatalog.upsert({
        ...cur,
        status: "error",
        lastError: "health failed",
      });
    }
    return ok;
  }
}

export const orchestrator: PluginOrchestrator = new EndpointOrchestrator();
