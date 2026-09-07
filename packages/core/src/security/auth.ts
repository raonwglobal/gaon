import type { IncomingMessage } from "node:http";
import { getPlatformConfig } from "../runtime-state.js";

export interface GatewayAuthResult {
  ok: boolean;
  subject?: string;
  reason?: string;
}

function collectValidTokens(): string[] {
  const tokens = new Set<string>();
  // When open access is explicit, ignore platform-persisted secrets
  const requireAuth =
    process.env.GATEWAY_REQUIRE_AUTH === "true" ||
    process.env.GATEWAY_REQUIRE_AUTH === "1";
  if (requireAuth) {
    const fromPlatform = getPlatformConfig().apiSecretToken;
    if (fromPlatform) tokens.add(fromPlatform);
  }
  const envOne = process.env.API_SECRET_TOKEN;
  if (envOne) tokens.add(envOne);
  const multi = process.env.GATEWAY_TOKENS || "";
  for (const t of multi.split(",")) {
    const v = t.trim();
    if (v) tokens.add(v);
  }
  return [...tokens];
}

function extractCredential(req: IncomingMessage): string | undefined {
  const key = req.headers["x-api-key"];
  if (typeof key === "string" && key.trim()) return key.trim();
  const auth = req.headers.authorization;
  if (typeof auth === "string") {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  return undefined;
}

/**
 * Authenticate MCP SSE / message clients.
 * - GATEWAY_REQUIRE_AUTH=false (default): always allow; optional token only sets subject
 * - GATEWAY_REQUIRE_AUTH=true: credential required
 * - Tokens from API_SECRET_TOKEN, GATEWAY_TOKENS (and platform config only when require=true)
 */
export function authenticateGateway(req: IncomingMessage): GatewayAuthResult {
  const requireAuth =
    process.env.GATEWAY_REQUIRE_AUTH === "true" ||
    process.env.GATEWAY_REQUIRE_AUTH === "1";
  const valid = collectValidTokens();
  const credential = extractCredential(req);

  // Explicit open gateway: never block on missing credential
  if (!requireAuth) {
    if (credential && valid.length > 0 && valid.includes(credential)) {
      const subjectHeader =
        req.headers["x-client-id"] || req.headers["x-user-id"];
      const subject =
        typeof subjectHeader === "string" && subjectHeader.trim()
          ? subjectHeader.trim()
          : `token:${credential.slice(0, 8)}`;
      return { ok: true, subject };
    }
    return { ok: true, subject: "anonymous" };
  }

  if (valid.length === 0) {
    return {
      ok: false,
      reason: "gateway_auth_required_but_no_tokens_configured",
    };
  }

  if (!credential) {
    return { ok: false, reason: "missing_credential" };
  }

  if (!valid.includes(credential)) {
    return { ok: false, reason: "invalid_credential" };
  }

  const subjectHeader = req.headers["x-client-id"] || req.headers["x-user-id"];
  const subject =
    typeof subjectHeader === "string" && subjectHeader.trim()
      ? subjectHeader.trim()
      : `token:${credential.slice(0, 8)}`;

  return { ok: true, subject };
}

/** @deprecated use authenticateGateway */
export function authenticate(req: IncomingMessage): boolean {
  return authenticateGateway(req).ok;
}
