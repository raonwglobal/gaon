import type { IncomingMessage, ServerResponse } from "node:http";
import { store } from "../store.js";
import { syncConfigToCore } from "../core-sync.js";

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
  pathname: string
): Promise<boolean> {
  if (pathname !== "/api/config") return false;

  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ config: store.getConfig() }));
    return true;
  }

  if (req.method === "PUT") {
    try {
      const body = JSON.parse(await readBody(req));
      const updated = store.setConfig(body);
      // Single source: push to Core immediately
      const sync = await syncConfigToCore();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          config: updated,
          coreSync: sync,
        })
      );
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid body" }));
    }
    return true;
  }

  return false;
}
