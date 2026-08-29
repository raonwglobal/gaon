/**
 * Session-scoped secrets and upstream fetch (no disk persistence).
 */

export type SecretMap = Map<string, string>;

export function createSessionSecrets(
  initial?: Record<string, string>
): SecretMap {
  const m = new Map<string, string>();
  if (initial) {
    for (const [k, v] of Object.entries(initial)) {
      if (k && v) m.set(k, v);
    }
  }
  return m;
}

/** Parse X-Session-Secrets: base64(JSON) or raw JSON object header */
export function parseSessionSecretsHeader(
  raw: string | string[] | undefined
): Record<string, string> {
  if (!raw) return {};
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s?.trim()) return {};
  try {
    let text = s.trim();
    if (!text.startsWith("{")) {
      text = Buffer.from(text, "base64").toString("utf8");
    }
    const obj = JSON.parse(text) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && v) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function parsePluginScopeHeader(
  raw: string | string[] | undefined
): string[] | null {
  if (!raw) return null;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s?.trim()) return null;
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function createUpstreamFetch(secrets: SecretMap) {
  return async function upstreamFetch(
    url: string,
    init?: RequestInit & { secretName?: string }
  ): Promise<Response> {
    const headers = new Headers(init?.headers || {});
    const secretName = init?.secretName;
    if (secretName) {
      const val = secrets.get(secretName);
      if (!val) {
        throw new Error(`Session secret not found: ${secretName}`);
      }
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${val}`);
      }
    }
    const { secretName: _, ...rest } = init || {};
    return fetch(url, { ...rest, headers });
  };
}

export function clearSecrets(secrets: SecretMap): void {
  secrets.clear();
}
