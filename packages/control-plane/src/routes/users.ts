import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext } from "../auth/session.js";
import { requireRole } from "../auth/session.js";
import { userStore, publicUser, type Role } from "../auth/users.js";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function handleUsers(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  auth: AuthContext
): Promise<boolean> {
  if (!pathname.startsWith("/api/users")) return false;
  if (!requireRole(auth, ["admin"])) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Forbidden" }));
    return true;
  }
  if (pathname === "/api/users" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ users: userStore.list().map(publicUser) }));
    return true;
  }
  if (pathname === "/api/users" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as {
        username?: string;
        password?: string;
        role?: Role;
      };
      if (!body.username || !body.password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "username and password required" }));
        return true;
      }
      const user = userStore.create({
        username: body.username,
        password: body.password,
        role: body.role || "user",
      });
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ user: publicUser(user) }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: err instanceof Error ? err.message : "Invalid body",
      }));
    }
    return true;
  }
  const match = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (match && req.method === "PATCH") {
    const id = decodeURIComponent(match[1]);
    try {
      const body = JSON.parse(await readBody(req)) as {
        active?: boolean;
        role?: Role;
      };
      let user = userStore.findById(id);
      if (!user) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return true;
      }
      if (typeof body.active === "boolean")
        user = userStore.setActive(id, body.active) ?? user;
      if (body.role) user = userStore.setRole(id, body.role) ?? user;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ user: publicUser(user!) }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid body" }));
    }
    return true;
  }
  return false;
}
