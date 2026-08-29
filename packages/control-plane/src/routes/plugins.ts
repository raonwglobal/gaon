import type { IncomingMessage, ServerResponse } from "node:http";
import { registry } from "../registry.js";
import { installPlugin } from "../plugin-installer.js";
import type { AuthContext } from "../auth/session.js";
import { canAccessPlugin, requireRole } from "../auth/session.js";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function forbid(res: ServerResponse): void {
  res.writeHead(403, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Forbidden" }));
}

function isAdminLike(auth: AuthContext): boolean {
  return auth.role === "admin" || auth.role === "operator";
}

export async function handlePlugins(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  auth: AuthContext
): Promise<boolean> {
  if (req.method === "POST" && pathname === "/api/plugins/install") {
    if (!requireRole(auth, ["user"])) { forbid(res); return true; }
    try {
      const body = JSON.parse(await readBody(req)) as {
        id: string;
        source: { type: "git" | "npm"; ref: string; version?: string };
        name?: string;
        version?: string;
        description?: string;
        enabled?: boolean;
      };
      if (!body.id || !body.source?.type || !body.source?.ref) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "id and source.type/ref required" }));
        return true;
      }
      const result = await installPlugin({ id: body.id, source: body.source });
      if (!result.ok) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Install failed", detail: result.detail }));
        return true;
      }
      const record = registry.register({
        id: body.id,
        name: body.name || body.id,
        version: body.version || body.source.version || "0.0.0",
        description: body.description,
        source: {
          type: body.source.type,
          ref: body.source.ref,
          version: body.source.version,
          path: result.path,
        },
        enabled: body.enabled ?? true,
        ownerUserId: auth.user.id,
      });
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        plugin: record,
        install: result,
        note: "Restart Core to load the new plugin factory",
      }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "Invalid body or install error",
        detail: err instanceof Error ? err.message : String(err),
      }));
    }
    return true;
  }

  if (req.method === "GET" && pathname === "/api/plugins") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      plugins: registry.listForUser(auth.user.id, isAdminLike(auth)),
    }));
    return true;
  }

  if (req.method === "POST" && pathname === "/api/plugins") {
    if (!requireRole(auth, ["user"])) { forbid(res); return true; }
    try {
      const body = JSON.parse(await readBody(req));
      const record = registry.register({
        id: body.id,
        name: body.name,
        version: body.version ?? "1.0.0",
        description: body.description,
        source: body.source ?? { type: "local", path: body.path },
        config: body.config,
        ownerUserId: auth.user.id,
      });
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ plugin: record }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid body" }));
    }
    return true;
  }

  const match = pathname.match(/^\/api\/plugins\/([^/]+)(\/(enable|disable))?$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const action = match[3];
    const existing = registry.get(id);
    if (existing && !canAccessPlugin(auth, existing.ownerUserId)) {
      forbid(res);
      return true;
    }
    if (req.method === "GET" && !action) {
      if (!existing) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return true;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ plugin: existing }));
      return true;
    }
    if (req.method === "POST" && (action === "enable" || action === "disable")) {
      if (!requireRole(auth, ["user"])) { forbid(res); return true; }
      const plugin = action === "enable" ? registry.enable(id) : registry.disable(id);
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
      if (!requireRole(auth, ["user"])) { forbid(res); return true; }
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
      if (!requireRole(auth, ["user"])) { forbid(res); return true; }
      const ok = registry.uninstall(id);
      res.writeHead(ok ? 204 : 404);
      res.end();
      return true;
    }
  }
  return false;
}
