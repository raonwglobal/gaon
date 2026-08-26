import type { IncomingMessage, ServerResponse } from "node:http";
import { parse } from "node:url";

const CORE_URL = process.env.CORE_URL || "http://localhost:3000";
const INTERNAL_TOKEN =
  process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || "";

function coreHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (INTERNAL_TOKEN) h["X-Internal-Token"] = INTERNAL_TOKEN;
  return h;
}

export async function handleLogs(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (req.method === "GET" && pathname === "/api/logs") {
    const url = parse(req.url || "", true);
    const qs = new URLSearchParams();
    if (url.query.level) qs.set("level", String(url.query.level));
    if (url.query.limit) qs.set("limit", String(url.query.limit));
    const q = qs.toString();

    try {
      const response = await fetch(
        `${CORE_URL}/internal/logs${q ? `?${q}` : ""}`,
        { headers: coreHeaders() }
      );
      const data = await response.json();
      res.writeHead(response.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to reach core", detail: String(err) }));
    }
    return true;
  }

  return false;
}
