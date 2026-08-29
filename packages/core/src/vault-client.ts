/**
 * Fetch user secrets from Control Plane for session injection.
 * Secrets exist only in memory for the SSE session lifetime.
 */

import { logger } from "./logger.js";

const CONTROL_URL =
  process.env.CONTROL_URL ||
  process.env.CONTROL_PLANE_URL ||
  "http://127.0.0.1:3001";
const INTERNAL_TOKEN =
  process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || "";

type IncomingHttpHeaders = Record<string, string | string[] | undefined>;

export async function fetchVaultSecretsForUser(
  userId: string
): Promise<Record<string, string>> {
  if (!userId || process.env.VAULT_SESSION_INJECT === "false") {
    return {};
  }
  if (!INTERNAL_TOKEN) {
    logger.warn("vault inject skipped: INTERNAL_TOKEN not set");
    return {};
  }

  const url = `${CONTROL_URL.replace(/\/$/, "")}/internal/vault/session-secrets?userId=${encodeURIComponent(userId)}`;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5_000);
    const res = await fetch(url, {
      headers: { "X-Internal-Token": INTERNAL_TOKEN },
      signal: ac.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      logger.warn("vault inject failed", {
        userId,
        status: res.status,
        body: await res.text().catch(() => ""),
      });
      return {};
    }
    const data = (await res.json()) as {
      secrets?: Record<string, string>;
    };
    return data.secrets && typeof data.secrets === "object"
      ? data.secrets
      : {};
  } catch (err) {
    logger.warn("vault inject error", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}

/**
 * Resolve durable user id for vault / plugin ownership.
 * Priority: X-User-Id → GATEWAY_TOKEN_MAP[credential] → subject if not token:/anonymous
 */
export function resolveUserIdForSession(
  req: { headers: IncomingHttpHeaders },
  subject?: string,
  credential?: string
): string | undefined {
  const h = req.headers["x-user-id"];
  if (typeof h === "string" && h.trim()) return h.trim();

  if (credential) {
    const map = parseTokenUserMap();
    if (map[credential]) return map[credential];
  }

  if (
    subject &&
    subject !== "anonymous" &&
    !subject.startsWith("token:")
  ) {
    return subject;
  }
  return undefined;
}

function parseTokenUserMap(): Record<string, string> {
  const raw = process.env.GATEWAY_TOKEN_MAP || "";
  if (!raw.trim()) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, string>;
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    const out: Record<string, string> = {};
    for (const part of raw.split(",")) {
      const [tok, uid] = part.split("=").map((s) => s.trim());
      if (tok && uid) out[tok] = uid;
    }
    return out;
  }
}
