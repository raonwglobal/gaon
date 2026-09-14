import type { IncomingMessage, ServerResponse } from "node:http";
import { syncAllToCore } from "../core-sync.js";

const INTERNAL_TOKEN =
  process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || "";

function authorized(req: IncomingMessage): boolean {
  if (!INTERNAL_TOKEN) return true;
  const token =
    req.headers["x-internal-token"] ||
    (typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "")
      : undefined);
  return token === INTERNAL_TOKEN;
}

/**
 * Core calls this on startup (no user session required).
 * POST /internal/sync → pushes registry plugins + config to Core.
 */
export async function handleInternalSync(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname !== "/internal/sync") return false;

  if (!authorized(req)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return true;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return true;
  }

  const result = await syncAllToCore();
  const ok = result.plugins.ok && result.config.ok;
  res.writeHead(ok ? 200 : 502, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok, source: "internal-sync", ...result }));
  return true;
}
