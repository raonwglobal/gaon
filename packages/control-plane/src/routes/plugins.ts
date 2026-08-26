import type { IncomingMessage, ServerResponse } from "node:http";
import { registry } from "../registry.js";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function handlePlugins(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  // GET /api/plugins
  if (req.method === "GET" && pathname === "/api/plugins") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ plugins: registry.list() }));
    return true;
  }

  // POST /api/plugins
  if (req.method === "POST" && pathname === "/api/plugins") {
    try {
      const body = JSON.parse(await readBody(req));
      const record = registry.register({
        id: body.id,
        name: body.name,
        version: body.version ?? "1.0.0",
        description: body.description,
        source: body.source ?? { type: "local", path: body.path },
        config: body.config,
      });
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ plugin: record }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid body" }));
    }
    return true;
  }

  // GET /api/plugins/:id
  const match = pathname.match(/^\/api\/plugins\/([^/]+)(\/(enable|disable))?$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const action = match[3];

    if (req.method === "GET" && !action) {
      const plugin = registry.get(id);
      if (!plugin) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return true;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ plugin }));
      return true;
    }

    if (req.method === "POST" && action === "enable") {
      const plugin = registry.enable(id);
      if (!plugin) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return true;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ plugin }));
      return true;
    }

    if (req.method === "POST" && action === "disable") {
      const plugin = registry.disable(id);
      if (!plugin) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return true;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ plugin }));
      return true;
    }

    if (req.method === "PATCH" && !action) {
      try {
        const body = JSON.parse(await readBody(req));
        if (body.config) {
          const plugin = registry.updateConfig(id, body.config);
          if (!plugin) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Not found" }));
            return true;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ plugin }));
          return true;
        }
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No updatable fields" }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid body" }));
      }
      return true;
    }

    if (req.method === "DELETE" && !action) {
      const ok = registry.uninstall(id);
      res.writeHead(ok ? 204 : 404);
      res.end();
      return true;
    }
  }

  return false;
}
