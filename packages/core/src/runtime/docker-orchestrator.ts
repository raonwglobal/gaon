/**
 * Docker CLI-based orchestrator (no native deps).
 * Requires `docker` on PATH and daemon access.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PluginOrchestrator, DeployRequest } from "./orchestrator.js";
import type { PluginRuntimeRecord } from "./types.js";
import { runtimeCatalog } from "./catalog.js";
import { HttpPluginTransport } from "./http-transport.js";
import { logger } from "../logger.js";

const execFileAsync = promisify(execFile);

const PORT_MIN = Number(process.env.PLUGIN_PORT_MIN ?? 18000);
const PORT_MAX = Number(process.env.PLUGIN_PORT_MAX ?? 18999);
const NETWORK = process.env.DOCKER_PLUGIN_NETWORK || "bridge";
const HOST = process.env.DOCKER_PLUGIN_HOST || "127.0.0.1";

async function docker(args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync("docker", args, {
    timeout: 180_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return (stdout || stderr || "").toString().trim();
}

function containerName(id: string): string {
  return `mcp-plugin-${id}`.replace(/[^a-zA-Z0-9_.-]/g, "-");
}

function allocatePort(): number {
  const used = new Set(
    runtimeCatalog.list().map((r) => {
      try {
        return Number(new URL(r.endpoint).port);
      } catch {
        return 0;
      }
    })
  );
  for (let p = PORT_MIN; p <= PORT_MAX; p++) {
    if (!used.has(p)) return p;
  }
  return PORT_MIN + Math.floor(Math.random() * (PORT_MAX - PORT_MIN));
}

export class DockerOrchestrator implements PluginOrchestrator {
  async deploy(req: DeployRequest): Promise<PluginRuntimeRecord> {
    if (!req.image && !req.endpoint) {
      throw new Error("DockerOrchestrator requires image or endpoint");
    }

    if (req.endpoint && !req.image) {
      return this.registerEndpoint(req);
    }

    const name = containerName(req.id);
    const hostPort = allocatePort();
    const image = req.image!;

    try {
      await docker(["rm", "-f", name]);
    } catch {
      /* none */
    }

    try {
      await docker(["pull", image]);
    } catch (err) {
      logger.warn("docker pull failed (using local image?)", {
        image,
        error: String(err),
      });
    }

    const portMapping = `${hostPort}:8080`;
    const memory = process.env.PLUGIN_MEMORY || "256m";
    const cpus = process.env.PLUGIN_CPUS || "0.5";
    const pluginIdEnv = `PLUGIN_ID=${req.id}`;

    const runArgs = [
      "run",
      "-d",
      "--name",
      name,
      "--restart",
      "unless-stopped",
      "--network",
      NETWORK,
      "-p",
      portMapping,
      "--memory",
      memory,
      "--cpus",
      cpus,
      "--read-only",
      "--tmpfs",
      "/tmp",
      "-e",
      pluginIdEnv,
      "-e",
      "PORT=8080",
      image,
    ];

    if (process.env.PLUGIN_DOCKER_EXTRA_ARGS) {
      const extra = process.env.PLUGIN_DOCKER_EXTRA_ARGS.split(" ").filter(Boolean);
      runArgs.splice(runArgs.length - 1, 0, ...extra);
    }

    let containerId: string;
    try {
      containerId = await docker(runArgs);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`docker run failed: ${detail}`);
    }

    const endpoint = `http://${HOST}:${hostPort}`;
    const record: PluginRuntimeRecord = {
      id: req.id,
      version: req.version,
      endpoint,
      status: "starting",
      image,
      containerId: containerId.slice(0, 12),
      startedAt: Date.now(),
    };
    runtimeCatalog.upsert(record);

    const transport = new HttpPluginTransport(endpoint);
    let healthy = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await transport.health()) {
        healthy = true;
        break;
      }
    }

    if (!healthy) {
      record.status = "error";
      record.lastError = "health timeout";
      runtimeCatalog.upsert(record);
      try {
        await docker(["rm", "-f", name]);
      } catch {
        /* ignore */
      }
      throw new Error(`Plugin ${req.id} container failed health checks`);
    }

    try {
      const manifest = await transport.manifest();
      record.version = manifest.version || req.version;
    } catch {
      /* keep */
    }

    record.status = "ready";
    runtimeCatalog.upsert(record);
    logger.info("docker plugin deployed", {
      id: req.id,
      endpoint,
      containerId: record.containerId,
    });
    return record;
  }

  private async registerEndpoint(req: DeployRequest): Promise<PluginRuntimeRecord> {
    const record: PluginRuntimeRecord = {
      id: req.id,
      version: req.version,
      endpoint: req.endpoint!,
      status: "starting",
      image: req.image,
      startedAt: Date.now(),
    };
    runtimeCatalog.upsert(record);
    const transport = new HttpPluginTransport(req.endpoint!);
    if (!(await transport.health())) {
      record.status = "error";
      record.lastError = "health check failed";
      runtimeCatalog.upsert(record);
      throw new Error(`health failed: ${req.endpoint}`);
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
    const name = containerName(id);
    try {
      await docker(["rm", "-f", name]);
    } catch (err) {
      logger.warn("docker rm failed", { id, error: String(err) });
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
