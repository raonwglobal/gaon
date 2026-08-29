import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse } from "node:url";
import { randomUUID } from "node:crypto";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpSession } from "./session.js";
import { SessionManager } from "./session-manager.js";
import { applyCors } from "./security/cors.js";
import { authenticateGateway } from "./security/auth.js";
import {
  parsePluginScopeHeader,
  parseSessionSecretsHeader,
} from "./session-secrets.js";
import { rateLimit } from "./security/rate-limit.js";
import type { ServerConfig } from "./config.js";
import {
  runtimeState,
  setEnabledPlugins,
  setPluginOwners,
  resolveSessionPlugins,
  setPluginConfig,
  setPlatformConfig,
  getPlatformConfig,
} from "./runtime-state.js";
import {
  listBuiltinPluginIds,
  reloadPluginDiscovery,
  getDiscoveryEpoch,
} from "./plugins/index.js";
import { metrics } from "./metrics.js";
import { logger } from "./logger.js";
import {
  affinityHeaders,
  getInstanceId,
  listPeers,
  shouldOwnSession,
} from "./cluster/affinity.js";
import { handleCatalogRoutes } from "./server-catalog-routes.js";
import { getPluginRuntimeMode } from "./runtime/mode.js";
import { runtimeCatalog } from "./runtime/catalog.js";
import { initializeScopedSession } from "./sse-session-factory.js";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function internalAuth(req: IncomingMessage, config: ServerConfig): boolean {
  if (!config.internalToken) return true;
  const token =
    req.headers["x-internal-token"] ||
    (typeof req.headers["authorization"] === "string"
      ? req.headers["authorization"].replace(/^Bearer\s+/i, "")
      : undefined);
  return token === config.internalToken;
}

export function createMcpSseServer(config: ServerConfig) {
  const sessionManager = new SessionManager({
    idleTimeoutMs: config.sessionIdleTimeoutMs,
    maxSessions: config.maxSessions,
  });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = parse(req.url || "", true);
    const path = url.pathname || "/";

    if (req.method === "OPTIONS") {
      applyCors(req, res);
      res.writeHead(204);
      res.end();
      return;
    }

    applyCors(req, res);

    if (path.startsWith("/internal/")) {
      if (!internalAuth(req, config)) {
        metrics.recordHttp(path, true);
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      if (await handleCatalogRoutes(req, res, path)) return;

      if (req.method === "GET" && path === "/internal/sessions") {
        metrics.recordHttp(path);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            sessions: sessionManager.list(),
            instanceId: getInstanceId(),
          })
        );
        return;
      }

      const sessionMatch = path.match(/^\/internal\/sessions\/([^/]+)$/);
      if (req.method === "DELETE" && sessionMatch) {
        metrics.recordHttp(path);
        await sessionManager.remove(decodeURIComponent(sessionMatch[1]));
        logger.info("session terminated", { sessionId: sessionMatch[1] });
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === "GET" && path === "/internal/builtins") {
        metrics.recordHttp(path);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ builtins: listBuiltinPluginIds() }));
        return;
      }

      if (req.method === "GET" && path === "/internal/metrics") {
        metrics.recordHttp(path);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ...metrics.snapshot(sessionManager.size),
            instanceId: getInstanceId(),
            peers: listPeers(),
            pluginRuntime: getPluginRuntimeMode(),
            catalogEpoch: runtimeCatalog.getEpoch(),
            discoveryEpoch: getDiscoveryEpoch(),
          })
        );
        return;
      }

      if (req.method === "GET" && path === "/internal/logs") {
        metrics.recordHttp(path);
        const level = url.query.level as string | undefined;
        const limit = url.query.limit ? Number(url.query.limit) : 100;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            logs: logger.list({
              level: level as "debug" | "info" | "warn" | "error" | undefined,
              limit,
            }),
            instanceId: getInstanceId(),
          })
        );
        return;
      }

      if (req.method === "GET" && path === "/internal/plugins") {
        metrics.recordHttp(path);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            enabled: runtimeState.enabledPlugins,
            configs: runtimeState.pluginConfigs,
            owners: runtimeState.pluginOwners,
            builtins: listBuiltinPluginIds(),
            discoveryEpoch: getDiscoveryEpoch(),
            mode: getPluginRuntimeMode(),
            catalog: runtimeCatalog.list(),
          })
        );
        return;
      }

      if (req.method === "PUT" && path === "/internal/plugins") {
        metrics.recordHttp(path);
        try {
          const body = JSON.parse(await readBody(req)) as {
            enabled?: string[];
            configs?: Record<string, Record<string, unknown>>;
            owners?: Record<string, string>;
          };
          if (Array.isArray(body.enabled)) setEnabledPlugins(body.enabled);
          if (body.configs) {
            for (const [id, cfg] of Object.entries(body.configs)) {
              setPluginConfig(id, cfg);
            }
          }
          if (body.owners && typeof body.owners === "object") {
            setPluginOwners(body.owners);
          }
          const rediscovered = await reloadPluginDiscovery();
          logger.info("plugins synced", {
            enabled: runtimeState.enabledPlugins,
            owners: Object.keys(runtimeState.pluginOwners).length,
            discoveryEpoch: rediscovered.epoch,
            factories: rediscovered.ids,
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              enabled: runtimeState.enabledPlugins,
              discoveryEpoch: rediscovered.epoch,
              factories: rediscovered.ids,
              note: "factories reloaded; new SSE sessions pick up enabled plugins",
            })
          );
        } catch {
          metrics.recordHttp(path, true);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid body" }));
        }
        return;
      }

      if (req.method === "POST" && path === "/internal/plugins/reload") {
        metrics.recordHttp(path);
        const rediscovered = await reloadPluginDiscovery();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            discoveryEpoch: rediscovered.epoch,
            factories: rediscovered.ids,
          })
        );
        return;
      }

      if (req.method === "GET" && path === "/internal/config") {
        metrics.recordHttp(path);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ config: getPlatformConfig() }));
        return;
      }

      if (req.method === "PUT" && path === "/internal/config") {
        metrics.recordHttp(path);
        try {
          const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
          const updated = setPlatformConfig({
            allowedOrigins: Array.isArray(body.allowedOrigins)
              ? (body.allowedOrigins as string[])
              : undefined,
            rateLimitPerMin:
              typeof body.rateLimitPerMin === "number"
                ? body.rateLimitPerMin
                : undefined,
            maxSessions:
              typeof body.maxSessions === "number" ? body.maxSessions : undefined,
            apiSecretToken:
              typeof body.apiSecretToken === "string"
                ? body.apiSecretToken
                : undefined,
            sessionIdleTimeoutMs:
              typeof body.sessionIdleTimeoutMs === "number"
                ? body.sessionIdleTimeoutMs
                : undefined,
          });
          logger.info("platform config updated", { config: updated });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, config: updated }));
        } catch {
          metrics.recordHttp(path, true);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid body" }));
        }
        return;
      }
    }

    if (!rateLimit(req, res)) {
      metrics.recordHttp(path, true);
      return;
    }

    const gatewayAuth = authenticateGateway(req);
    if (!gatewayAuth.ok) {
      metrics.recordHttp(path, true);
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "Unauthorized", reason: gatewayAuth.reason })
      );
      return;
    }

    if (req.method === "GET" && path === "/sse") {
      if (!sessionManager.canAcceptNewSession()) {
        metrics.recordHttp(path, true);
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Too many sessions" }));
        return;
      }

      metrics.recordHttp(path);
      const sessionId = randomUUID();

      if (listPeers().length > 0 && !shouldOwnSession(sessionId)) {
        const owner = affinityHeaders(sessionId)["X-Session-Owner"];
        logger.info("affinity redirect", { sessionId, owner });
        res.writeHead(307, {
          "Content-Type": "application/json",
          Location: `http://${owner}/sse`,
          ...affinityHeaders(sessionId),
        });
        res.end(
          JSON.stringify({
            error: "session_affinity",
            owner,
            sessionId,
          })
        );
        return;
      }

      const transport = new SSEServerTransport("/message", res);
      const session = new McpSession(sessionId);
      sessionManager.add(session);

      try {
        const sessionPlugins = await initializeScopedSession(
          session,
          transport,
          req,
          gatewayAuth.subject
        );
        logger.info("session created", {
          sessionId,
          subject: gatewayAuth.subject,
          plugins: sessionPlugins,
        });
        res.on("close", () => {
          logger.info("session closed", { sessionId });
          void sessionManager.remove(sessionId);
        });
      } catch (error) {
        logger.error("session init failed", {
          sessionId,
          error: String(error),
        });
        await sessionManager.remove(sessionId);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Initialization failed" }));
        }
      }
      return;
    }

    if (req.method === "POST" && path === "/message") {
      const sessionId = url.query.sessionId as string | undefined;
      if (!sessionId) {
        metrics.recordHttp(path, true);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "sessionId required" }));
        return;
      }

      const session = sessionManager.get(sessionId);
      if (!session || !session.isInitialized || !session.transport) {
        metrics.recordHttp(path, true);
        if (listPeers().length > 0) {
          const headers = affinityHeaders(sessionId);
          res.writeHead(404, { "Content-Type": "application/json", ...headers });
          res.end(
            JSON.stringify({
              error: "Session not found or not ready",
              owner: headers["X-Session-Owner"],
            })
          );
          return;
        }
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found or not ready" }));
        return;
      }

      metrics.recordHttp(path);
      try {
        await session.transport.handlePostMessage(req, res);
      } catch (error) {
        logger.error("handlePostMessage error", { error: String(error) });
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal error" }));
        }
      }
      return;
    }

    if (req.method === "GET" && path === "/health") {
      metrics.recordHttp(path);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          instanceId: getInstanceId(),
          peers: listPeers(),
          sessions: sessionManager.size,
          uptime: process.uptime(),
          plugins: runtimeState.enabledPlugins,
          pluginRuntime: getPluginRuntimeMode(),
          catalogEpoch: runtimeCatalog.getEpoch(),
          discoveryEpoch: getDiscoveryEpoch(),
          catalogPlugins: runtimeCatalog.readyPlugins().map((p) => p.id),
          sandbox: process.env.SANDBOX_PLUGINS === "true",
          metrics: metrics.snapshot(sessionManager.size),
        })
      );
      return;
    }

    metrics.recordHttp(path, true);
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(config.port, () => {
    logger.info("core started", {
      port: config.port,
      instanceId: getInstanceId(),
      pluginRuntime: getPluginRuntimeMode(),
      plugins: runtimeState.enabledPlugins,
      rateLimit: getPlatformConfig().rateLimitPerMin,
    });
  });

  const shutdown = async () => {
    logger.info("shutting down core");
    await sessionManager.shutdownAll();
    server.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  return { server, sessionManager };
}
