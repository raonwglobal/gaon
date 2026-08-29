import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse } from "node:url";
import { handlePlugins } from "./routes/plugins.js";
import { handleSessions } from "./routes/sessions.js";
import { handleConfig } from "./routes/config.js";
import { handleMetrics } from "./routes/metrics.js";
import { handleLogs } from "./routes/logs.js";
import { handleCatalog } from "./routes/catalog.js";
import { handleAuth } from "./routes/auth.js";
import { handleUsers } from "./routes/users.js";
import { handleVault } from "./routes/vault.js";
import { handleAudit } from "./routes/audit.js";
import { handleInternalVault } from "./routes/internal-vault.js";
import { syncAllToCore } from "./core-sync.js";
import { resolveAuth, requireRole, type AuthContext } from "./auth/session.js";
import { userStore } from "./auth/users.js";

const PORT = Number(process.env.CONTROL_PORT ?? 3001);

function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin || "*";
  const allowed = (process.env.ADMIN_CORS_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allow =
    allowed.includes("*") || (origin !== "*" && allowed.includes(origin))
      ? origin === "*" && allowed.includes("*")
        ? "*"
        : origin
      : allowed[0] || "*";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Admin-Token"
  );
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = parse(req.url || "", true);
  const pathname = url.pathname || "/";

  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === "/api/health" || pathname === "/health") {
    json(res, 200, {
      status: "ok",
      service: "control-plane",
      auth: userStore.list().length > 0 ? "users" : "bootstrap-required",
    });
    return;
  }

  if (await handleInternalVault(req, res, pathname)) return;
  if (await handleAuth(req, res, pathname)) return;

  const auth = resolveAuth(req);
  if (!auth) {
    json(res, 401, {
      error: "Unauthorized",
      hint: "POST /api/auth/login or configure BOOTSTRAP_ADMIN_PASSWORD",
    });
    return;
  }

  (req as IncomingMessage & { auth?: AuthContext }).auth = auth;

  if (await handleUsers(req, res, pathname, auth)) return;
  if (await handleVault(req, res, pathname, auth)) return;
  if (await handleAudit(req, res, pathname, auth)) return;

  if (req.method === "POST" && pathname === "/api/sync") {
    if (!requireRole(auth, ["operator"])) {
      json(res, 403, { error: "Forbidden" });
      return;
    }
    const result = await syncAllToCore();
    const ok = result.plugins.ok && result.config.ok;
    json(res, ok ? 200 : 502, { ok, ...result });
    return;
  }

  if (await handlePlugins(req, res, pathname, auth)) return;
  if (await handleSessions(req, res, pathname)) return;
  if (await handleConfig(req, res, pathname, auth)) return;
  if (await handleMetrics(req, res, pathname)) return;
  if (await handleLogs(req, res, pathname)) return;
  if (await handleCatalog(req, res, pathname)) return;

  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Control Plane listening on :${PORT}`);
  console.log(
    `Users: ${userStore.list().length} (bootstrap via BOOTSTRAP_ADMIN_PASSWORD)`
  );
});
