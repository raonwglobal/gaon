import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse } from "node:url";
import { randomUUID } from "node:crypto";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpSession } from "./session.js";
import { SessionManager } from "./session-manager.js";
import { applyCors } from "./security/cors.js";
import { authenticate } from "./security/auth.js";
import { rateLimit } from "./security/rate-limit.js";
import type { ServerConfig } from "./config.js";
import { runtimeState, setEnabledPlugins, setPluginConfig } from "./runtime-state.js";

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
  // Seed runtime state from env
  setEnabledPlugins(config.enabledPlugins);

  const sessionManager = new SessionManager({
    idleTimeoutMs: config.sessionIdleTimeoutMs,
    maxSessions: config.maxSessions,
  });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = parse(req.url || "", true);

    if (req.method === "OPTIONS") {
      applyCors(req, res, config);
      res.writeHead(204);
      res.end();
      return;
    }

    applyCors(req, res, config);

    // Internal admin routes (Control Plane sync) — before rate limit for reliability
    if (url.pathname?.startsWith("/internal/")) {
      if (!internalAuth(req, config)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      if (req.method === "GET" && url.pathname === "/internal/sessions") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ sessions: sessionManager.list() }));
        return;
      }

      if (req.method === "GET" && url.pathname === "/internal/plugins") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            enabled: runtimeState.enabledPlugins,
            configs: runtimeState.pluginConfigs,
          })
        );
        return;
      }

      if (req.method === "PUT" && url.pathname === "/internal/plugins") {
        try {
          const body = JSON.parse(await readBody(req)) as {
            enabled?: string[];
            configs?: Record<string, Record<string, unknown>>;
          };
          if (Array.isArray(body.enabled)) {
            setEnabledPlugins(body.enabled);
          }
          if (body.configs) {
            for (const [id, cfg] of Object.entries(body.configs)) {
              setPluginConfig(id, cfg);
            }
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              enabled: runtimeState.enabledPlugins,
              note: "New SSE sessions will use the updated plugin list",
            })
          );
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid body" }));
        }
        return;
      }
    }

    if (!rateLimit(req, res, config)) return;

    if (config.apiSecretToken && !authenticate(req, config)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // SSE endpoint
    if (req.method === "GET" && url.pathname === "/sse") {
      if (!sessionManager.canAcceptNewSession()) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Too many sessions" }));
        return;
      }

      const sessionId = randomUUID();
      const transport = new SSEServerTransport("/message", res);
      const session = new McpSession(sessionId);
      sessionManager.add(session);

      try {
        await session.initialize(
          transport,
          [...runtimeState.enabledPlugins],
          runtimeState.pluginConfigs
        );
        res.on("close", () => {
          void sessionManager.remove(sessionId);
        });
      } catch (error) {
        console.error("Session init failed:", error);
        await sessionManager.remove(sessionId);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Initialization failed" }));
        }
      }
      return;
    }

    // Message endpoint
    if (req.method === "POST" && url.pathname === "/message") {
      const sessionId = url.query.sessionId as string | undefined;
      if (!sessionId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "sessionId required" }));
        return;
      }

      const session = sessionManager.get(sessionId);
      if (!session || !session.isInitialized || !session.transport) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found or not ready" }));
        return;
      }

      try {
        await session.transport.handlePostMessage(req, res);
      } catch (error) {
        console.error("handlePostMessage error:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal error" }));
        }
      }
      return;
    }

    // Health
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          sessions: sessionManager.size,
          uptime: process.uptime(),
          plugins: runtimeState.enabledPlugins,
        })
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(config.port, () => {
    console.log(`MCP SSE Server running on port ${config.port}`);
    console.log(`Enabled plugins: ${runtimeState.enabledPlugins.join(", ") || "(none)"}`);
  });

  const shutdown = async () => {
    console.log("Shutting down core...");
    await sessionManager.shutdownAll();
    server.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  return { server, sessionManager };
}
