import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext } from "../auth/session.js";
import { requireRole } from "../auth/session.js";
import { vault } from "../auth/vault.js";
import { audit } from "../auth/audit.js";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isAdmin(auth: AuthContext): boolean {
  return auth.role === "admin" || auth.role === "operator";
}

export async function handleVault(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  auth: AuthContext
): Promise<boolean> {
  if (!pathname.startsWith("/api/vault")) return false;

  if (!requireRole(auth, ["user"])) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Forbidden" }));
    return true;
  }

  if (pathname === "/api/vault/secrets" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        secrets: vault.listMeta(auth.user.id, isAdmin(auth)),
      })
    );
    return true;
  }

  if (pathname === "/api/vault/secrets" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as {
        name?: string;
        value?: string;
      };
      if (!body.name || !body.value) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "name and value required" }));
        return true;
      }
      const meta = vault.put({
        userId: auth.user.id,
        name: body.name,
        value: body.value,
      });
      audit({
        actorId: auth.user.id,
        actorName: auth.user.username,
        action: "vault.secret.put",
        resource: meta.id,
        detail: { name: meta.name },
      });
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ secret: meta }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid body" }));
    }
    return true;
  }

  const match = pathname.match(/^\/api\/vault\/secrets\/([^/]+)$/);
  if (match && req.method === "DELETE") {
    const id = decodeURIComponent(match[1]);
    const ok = vault.delete(id, auth.user.id, isAdmin(auth));
    if (ok) {
      audit({
        actorId: auth.user.id,
        actorName: auth.user.username,
        action: "vault.secret.delete",
        resource: id,
      });
    }
    res.writeHead(ok ? 204 : 404);
    res.end();
    return true;
  }

  return false;
}
