import type { IncomingMessage } from "node:http";
import { getPlatformConfig } from "../runtime-state.js";

export interface GatewayAuthResult {
  ok: boolean;
  subject?: string;
  reason?: string;
}

/** Normalize compose env: strip wrapping quotes and treat empty as unset. */
function envVal(name: string): string {
  let v = process.env[name];
  if (v == null) return "";
  v = v.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function isTruthyEnv(name: string): boolean {
  const v = envVal(name).toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

function collectValidTokens(): string[] {
  const tokens = new Set<string>();
  const requireAuth = isTruthyEnv("GATEWAY_REQUIRE_AUTH");
  if (requireAuth) {
    const fromPlatform = getPlatformConfig().apiSecretToken?.trim();
    if (fromPlatform) tokens.add(fromPlatform);
  }
  const envOne = envVal("API_SECRET_TOKEN");
  if (envOne) tokens.add(envOne);
  const multi = envVal("GATEWAY_TOKENS");
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
 * - GATEWAY_REQUIRE_AUTH=false (default): always allow anonymous
 * - GATEWAY_REQUIRE_AUTH=true: credential required
 */
export function authenticateGateway(req: IncomingMessage): GatewayAuthResult {
  const requireAuth = isTruthyEnv("GATEWAY_REQUIRE_AUTH");
  const valid = collectValidTokens();
  const credential = extractCredential(req);

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
