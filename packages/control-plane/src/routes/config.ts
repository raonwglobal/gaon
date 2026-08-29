import type { IncomingMessage, ServerResponse } from "node:http";
import { store, maskConfig } from "../store.js";
import { syncConfigToCore } from "../core-sync.js";
import type { AuthContext } from "../auth/session.js";
import { requireRole } from "../auth/session.js";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function handleConfig(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  auth: AuthContext
): Promise<boolean> {
  if (pathname !== "/api/config") return false;
  if (req.method === "GET") {
    const raw = store.getConfig();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      config: auth.role === "admin" ? raw : maskConfig(raw),
    }));
    return true;
  }
  if (req.method === "PUT") {
    if (!requireRole(auth, ["admin"])) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return true;
    }
    try {
      const body = JSON.parse(await readBody(req));
      if (body.apiSecretToken === "***") delete body.apiSecretToken;
      const updated = store.setConfig(body);
      const sync = await syncConfigToCore();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ config: maskConfig(updated), coreSync: sync }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid body" }));
    }
    return true;
  }
  return false;
}
