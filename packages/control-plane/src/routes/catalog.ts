import type { IncomingMessage, ServerResponse } from "node:http";

const CORE_URL = process.env.CORE_URL || "http://localhost:3000";
const INTERNAL_TOKEN =
  process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || "";

function coreHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (INTERNAL_TOKEN) h["X-Internal-Token"] = INTERNAL_TOKEN;
  return h;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function handleCatalog(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (req.method === "GET" && pathname === "/api/catalog") {
    try {
      const r = await fetch(`${CORE_URL}/internal/catalog`, {
        headers: coreHeaders(),
      });
      const data = await r.json();
      res.writeHead(r.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return true;
  }

  if (req.method === "POST" && pathname === "/api/catalog/deploy") {
    try {
      const body = await readBody(req);
      const r = await fetch(`${CORE_URL}/internal/catalog/deploy`, {
        method: "POST",
        headers: coreHeaders(),
        body,
      });
      const data = await r.json();
      res.writeHead(r.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return true;
  }

  if (req.method === "POST" && pathname === "/api/catalog/rediscover") {
    try {
      const r = await fetch(`${CORE_URL}/internal/catalog/rediscover`, {
        method: "POST",
        headers: coreHeaders(),
      });
      const data = await r.json();
      res.writeHead(r.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return true;
  }

  const del = pathname.match(/^\/api\/catalog\/([^/]+)$/);
  if (req.method === "DELETE" && del) {
    try {
      const r = await fetch(
        `${CORE_URL}/internal/catalog/${encodeURIComponent(del[1])}`,
        { method: "DELETE", headers: coreHeaders() }
      );
      res.writeHead(r.status);
      res.end();
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return true;
  }

  return false;
}
