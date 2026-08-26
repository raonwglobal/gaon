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

export function createMcpSseServer(config: ServerConfig) {
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
        await session.initialize(transport, config.enabledPlugins);
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
          plugins: config.enabledPlugins,
        })
      );
      return;
    }

    // Internal: list sessions (for control-plane)
    if (req.method === "GET" && url.pathname === "/internal/sessions") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ sessions: sessionManager.list() }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(config.port, () => {
    console.log(`MCP SSE Server running on port ${config.port}`);
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
