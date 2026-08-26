import type { IncomingMessage, ServerResponse } from "node:http";

const CORE_URL = process.env.CORE_URL || "http://localhost:3000";
const INTERNAL_TOKEN =
  process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || "";

function coreHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (INTERNAL_TOKEN) h["X-Internal-Token"] = INTERNAL_TOKEN;
  return h;
}

export async function handleSessions(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (req.method === "GET" && pathname === "/api/sessions") {
    try {
      const response = await fetch(`${CORE_URL}/internal/sessions`, {
        headers: coreHeaders(),
      });
      const data = await response.json();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to reach core", detail: String(err) }));
    }
    return true;
  }

  const match = pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (req.method === "DELETE" && match) {
    const id = encodeURIComponent(decodeURIComponent(match[1]));
    try {
      const response = await fetch(`${CORE_URL}/internal/sessions/${id}`, {
        method: "DELETE",
        headers: coreHeaders(),
      });
      res.writeHead(response.status === 204 ? 204 : response.status);
      res.end();
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to reach core", detail: String(err) }));
    }
    return true;
  }

  if (req.method === "GET" && pathname === "/api/builtins") {
    try {
      const response = await fetch(`${CORE_URL}/internal/builtins`, {
        headers: coreHeaders(),
      });
      if (!response.ok) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ builtins: ["weather", "echo"] }));
        return true;
      }
      const data = await response.json();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ builtins: ["weather", "echo"] }));
    }
    return true;
  }

  return false;
}
