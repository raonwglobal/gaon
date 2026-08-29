import type { IncomingMessage, ServerResponse } from "node:http";
import { parse } from "node:url";
import { vault } from "../auth/vault.js";
import { audit } from "../auth/audit.js";

const INTERNAL_TOKEN =
  process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || "";

function authorized(req: IncomingMessage): boolean {
  if (!INTERNAL_TOKEN) return false;
  const token =
    req.headers["x-internal-token"] ||
    (typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "")
      : undefined);
  return token === INTERNAL_TOKEN;
}

/**
 * Internal-only: Core fetches plaintext secrets for session injection.
 * GET /internal/vault/session-secrets?userId=
 */
export async function handleInternalVault(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (!pathname.startsWith("/internal/vault")) return false;

  if (!authorized(req)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return true;
  }

  if (
    pathname === "/internal/vault/session-secrets" &&
    req.method === "GET"
  ) {
    const url = parse(req.url || "", true);
    const userId = String(url.query.userId || "").trim();
    if (!userId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "userId required" }));
      return true;
    }
    const secrets = vault.listPlainByUser(userId);
    audit({
      action: "vault.session_inject",
      resource: userId,
      detail: { count: Object.keys(secrets).length },
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ userId, secrets }));
    return true;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
  return true;
}
