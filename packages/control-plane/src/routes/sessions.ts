import type { IncomingMessage, ServerResponse } from "node:http";

const CORE_URL = process.env.CORE_URL || "http://localhost:3000";

export async function handleSessions(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (req.method === "GET" && pathname === "/api/sessions") {
    try {
      const response = await fetch(`${CORE_URL}/internal/sessions`);
      const data = await response.json();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to reach core", detail: String(err) }));
    }
    return true;
  }

  return false;
}
