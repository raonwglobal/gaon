import type { IncomingMessage, ServerResponse } from "node:http";
import { parse } from "node:url";
import type { AuthContext } from "../auth/session.js";
import { requireRole } from "../auth/session.js";
import { readAudit } from "../auth/audit.js";

export async function handleAudit(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  auth: AuthContext
): Promise<boolean> {
  if (pathname !== "/api/audit" || req.method !== "GET") return false;

  if (!requireRole(auth, ["admin"])) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Forbidden" }));
    return true;
  }

  const url = parse(req.url || "", true);
  const limit = Math.min(Number(url.query.limit || 100), 500);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ events: readAudit(limit) }));
  return true;
}
