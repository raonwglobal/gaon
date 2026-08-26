import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse } from "node:url";
import { handlePlugins } from "./routes/plugins.js";
import { handleSessions } from "./routes/sessions.js";
import { handleConfig } from "./routes/config.js";
import { handleMetrics } from "./routes/metrics.js";

const PORT = Number(process.env.CONTROL_PORT ?? 3001);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

function applyCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token");
}

function authorize(req: IncomingMessage): boolean {
  if (!ADMIN_TOKEN) return true;
  const token =
    req.headers["x-admin-token"] ||
    (typeof req.headers["authorization"] === "string"
      ? req.headers["authorization"].replace(/^Bearer\s+/i, "")
      : undefined);
  return token === ADMIN_TOKEN;
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = parse(req.url || "", true);
  const pathname = url.pathname || "/";

  applyCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health is public
  if (pathname === "/api/health" || pathname === "/health") {
    await handleMetrics(req, res, "/api/health");
    return;
  }

  if (!authorize(req)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  if (await handlePlugins(req, res, pathname)) return;
  if (await handleSessions(req, res, pathname)) return;
  if (await handleConfig(req, res, pathname)) return;
  if (await handleMetrics(req, res, pathname)) return;

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`Control Plane listening on port ${PORT}`);
});

process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});
