/**
 * Plugin orchestrator interface + composite factory.
 */
import type { PluginRuntimeRecord } from "./types.js";
import { runtimeCatalog } from "./catalog.js";
import { HttpPluginTransport } from "./http-transport.js";
import { logger } from "../logger.js";
import { DockerOrchestrator } from "./docker-orchestrator.js";
import { K8sOrchestrator } from "./k8s-orchestrator.js";

export interface DeployRequest {
  id: string;
  version: string;
  /** Pre-started endpoint (dev) or service URL */
  endpoint?: string;
  /** Container image ref for Docker/K8s */
  image?: string;
}

export interface PluginOrchestrator {
  deploy(req: DeployRequest): Promise<PluginRuntimeRecord>;
  undeploy(id: string): Promise<void>;
  healthCheck(id: string): Promise<boolean>;
}

/**
 * Registers an already-running Tool Runtime HTTP server into the catalog.
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

/**
 * ORCHESTRATOR=endpoint|docker|k8s (default: endpoint)
 * - endpoint: register pre-started HTTP runtimes
 * - docker: docker pull/run with port publish
 * - k8s: Service DNS + optional kubectl apply
 */
export function createOrchestrator(): PluginOrchestrator {
  const mode = (process.env.ORCHESTRATOR || "endpoint").toLowerCase();
  if (mode === "docker") {
    logger.info("using DockerOrchestrator");
    return new DockerOrchestrator();
  }
  if (mode === "k8s" || mode === "kubernetes") {
    logger.info("using K8sOrchestrator");
    return new K8sOrchestrator();
  }
  logger.info("using EndpointOrchestrator");
  return new EndpointOrchestrator();
}

export const orchestrator: PluginOrchestrator = createOrchestrator();
