import type { IncomingMessage, ServerResponse } from "node:http";
import {
  clearManifestCache,
  runtimeCatalog,
} from "./runtime/catalog.js";
import { orchestrator } from "./runtime/orchestrator.js";
import type { PluginRuntimeRecord } from "./runtime/types.js";
import { metrics } from "./metrics.js";
import { logger } from "./logger.js";
import { sessionHub } from "./runtime/session-hub.js";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function handleCatalogRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  path: string
): Promise<boolean> {
  if (req.method === "GET" && path === "/internal/catalog") {
    metrics.recordHttp(path);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        epoch: runtimeCatalog.getEpoch(),
        plugins: runtimeCatalog.list(),
        sessions: sessionHub.size,
        orchestrator: process.env.ORCHESTRATOR || "endpoint",
      })
    );
    return true;
  }

  if (req.method === "PUT" && path === "/internal/catalog") {
    metrics.recordHttp(path);
    try {
      const body = JSON.parse(await readBody(req)) as {
        plugins?: PluginRuntimeRecord[];
      };
      if (!Array.isArray(body.plugins)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "plugins array required" }));
        return true;
      }
      clearManifestCache();
      runtimeCatalog.replaceAll(body.plugins);
      // onChange → list_changed fanout
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          epoch: runtimeCatalog.getEpoch(),
          plugins: runtimeCatalog.list(),
        })
      );
    } catch {
      metrics.recordHttp(path, true);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid body" }));
    }
    return true;
  }

  if (req.method === "POST" && path === "/internal/catalog/deploy") {
    metrics.recordHttp(path);
    try {
      const body = JSON.parse(await readBody(req)) as {
        id: string;
        version?: string;
        endpoint?: string;
        image?: string;
      };
      if (!body.id || (!body.endpoint && !body.image)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "id and (endpoint or image) required" }));
        return true;
      }
      const record = await orchestrator.deploy({
        id: body.id,
        version: body.version || "0.0.0",
        endpoint: body.endpoint,
        image: body.image,
      });
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          plugin: record,
          epoch: runtimeCatalog.getEpoch(),
          orchestrator: process.env.ORCHESTRATOR || "endpoint",
        })
      );
    } catch (err) {
      metrics.recordHttp(path, true);
      logger.error("deploy failed", { error: String(err) });
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "deploy failed",
          detail: err instanceof Error ? err.message : String(err),
        })
      );
    }
    return true;
  }

  const undeployMatch = path.match(/^\/internal\/catalog\/([^/]+)$/);
  if (req.method === "DELETE" && undeployMatch) {
    metrics.recordHttp(path);
    const id = decodeURIComponent(undeployMatch[1]);
    await orchestrator.undeploy(id);
    res.writeHead(204);
    res.end();
    return true;
  }

  if (req.method === "POST" && path === "/internal/catalog/rediscover") {
    metrics.recordHttp(path);
    const results = [];
    for (const p of runtimeCatalog.list()) {
      const ok = await orchestrator.healthCheck(p.id);
      results.push({ id: p.id, healthy: ok });
    }
    clearManifestCache();
    await sessionHub.notifyToolsListChanged();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        epoch: runtimeCatalog.getEpoch(),
        results,
      })
    );
    return true;
  }

  return false;
}
