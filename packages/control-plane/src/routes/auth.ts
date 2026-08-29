import type { IncomingMessage, ServerResponse } from "node:http";
import { userStore, publicUser } from "../auth/users.js";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  resolveAuth,
  setSessionCookie,
} from "../auth/session.js";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function handleAuth(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === "/api/auth/login" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as {
        username?: string;
        password?: string;
      };
      if (!body.username || !body.password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "username and password required" }));
        return true;
      }
      const user = userStore.verify(body.username, body.password);
      if (!user) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid credentials" }));
        return true;
      }
      const sid = createSession(user.id);
      setSessionCookie(res, sid);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ user: publicUser(user) }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid body" }));
    }
    return true;
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    const auth = resolveAuth(req);
    if (auth && !auth.viaLegacyToken) destroySession(auth.sessionId);
    clearSessionCookie(res);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  if (pathname === "/api/auth/me" && req.method === "GET") {
    const auth = resolveAuth(req);
    if (!auth) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return true;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ user: auth.user }));
    return true;
  }

  return false;
}
