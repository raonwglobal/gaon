/**
 * Kubernetes-oriented orchestrator.
 *
 * Modes:
 * 1) endpoint/service DNS only — register `http://plugin-<id>.<ns>.svc:8080`
 * 2) kubectl apply — when K8s_APPLY=true and kubectl available
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PluginOrchestrator, DeployRequest } from "./orchestrator.js";
import type { PluginRuntimeRecord } from "./types.js";
import { runtimeCatalog } from "./catalog.js";
import { HttpPluginTransport } from "./http-transport.js";
import { logger } from "../logger.js";

const execFileAsync = promisify(execFile);

const NS = process.env.K8S_NAMESPACE || "mcp-plugins";
const APPLY = process.env.K8S_APPLY === "true" || process.env.K8S_APPLY === "1";
const CLUSTER_DOMAIN = process.env.K8S_CLUSTER_DOMAIN || "svc.cluster.local";

function serviceHost(id: string): string {
  return `plugin-${id}.${NS}.${CLUSTER_DOMAIN}`;
}

function serviceEndpoint(id: string): string {
  return `http://${serviceHost(id)}:8080`;
}

function deploymentYaml(id: string, image: string): string {
  return `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: plugin-${id}
  namespace: ${NS}
  labels:
    app: mcp-plugin
    plugin-id: ${id}
spec:
  replicas: 1
  selector:
    matchLabels:
      plugin-id: ${id}
  template:
    metadata:
      labels:
        app: mcp-plugin
        plugin-id: ${id}
    spec:
      containers:
        - name: runtime
          image: ${image}
          ports:
            - containerPort: 8080
          env:
            - name: PORT
              value: "8080"
            - name: PLUGIN_ID
              value: ${id}
          resources:
            limits:
              memory: "256Mi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 2
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: plugin-${id}
  namespace: ${NS}
spec:
  selector:
    plugin-id: ${id}
  ports:
    - port: 8080
      targetPort: 8080
`;
}

async function kubectl(args: string[], input?: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync("kubectl", args, {
    timeout: 120_000,
    maxBuffer: 5 * 1024 * 1024,
    input,
  });
  return (stdout || stderr || "").toString().trim();
}

export class K8sOrchestrator implements PluginOrchestrator {
  async deploy(req: DeployRequest): Promise<PluginRuntimeRecord> {
    let endpoint = req.endpoint;

    if (!endpoint && req.image && APPLY) {
      try {
        await kubectl(["create", "namespace", NS, "--dry-run=client", "-o", "yaml"]);
        await kubectl(["apply", "-f", "-"], `apiVersion: v1\nkind: Namespace\nmetadata:\n  name: ${NS}\n`);
        await kubectl(["apply", "-f", "-"], deploymentYaml(req.id, req.image));
        endpoint = serviceEndpoint(req.id);
        logger.info("k8s apply ok", { id: req.id, endpoint });
      } catch (err) {
        throw new Error(
          `kubectl apply failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } else if (!endpoint && req.image) {
      // DNS-only registration (Deployment assumed external)
      endpoint = serviceEndpoint(req.id);
      logger.info("k8s DNS endpoint registered (no apply)", { id: req.id, endpoint });
    }

    if (!endpoint) {
      throw new Error("K8sOrchestrator requires endpoint or image");
    }

    const record: PluginRuntimeRecord = {
      id: req.id,
      version: req.version,
      endpoint,
      status: "starting",
      image: req.image,
      startedAt: Date.now(),
    };
    runtimeCatalog.upsert(record);

    const transport = new HttpPluginTransport(endpoint);
    let healthy = false;
    for (let i = 0; i < 40; i++) {
      if (await transport.health()) {
        healthy = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!healthy) {
      // In cluster DNS may only work inside cluster — still mark ready if APPLY skipped
      if (!APPLY && req.image && !req.endpoint) {
        record.status = "ready";
        record.lastError = "health not verified from this host (in-cluster DNS)";
        runtimeCatalog.upsert(record);
        return record;
      }
      record.status = "error";
      record.lastError = "health timeout";
      runtimeCatalog.upsert(record);
      throw new Error(`K8s plugin ${req.id} health failed at ${endpoint}`);
    }

    try {
      const manifest = await transport.manifest();
      record.version = manifest.version || req.version;
    } catch {
      /* keep */
    }

    record.status = "ready";
    runtimeCatalog.upsert(record);
    return record;
  }

  async undeploy(id: string): Promise<void> {
    const cur = runtimeCatalog.get(id);
    if (cur) runtimeCatalog.upsert({ ...cur, status: "draining" });

    if (APPLY) {
      try {
        await kubectl(["delete", "deployment", `plugin-${id}`, "-n", NS, "--ignore-not-found"]);
        await kubectl(["delete", "service", `plugin-${id}`, "-n", NS, "--ignore-not-found"]);
      } catch (err) {
        logger.warn("k8s delete failed", { id, error: String(err) });
      }
    }

    runtimeCatalog.remove(id);
  }

  async healthCheck(id: string): Promise<boolean> {
    const cur = runtimeCatalog.get(id);
    if (!cur) return false;
    const transport = new HttpPluginTransport(cur.endpoint);
    return transport.health();
  }
}
