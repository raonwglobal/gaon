export interface RuntimeConfig {
  adminToken?: string;
  controlApiBase?: string;
}

let cached: RuntimeConfig | null = null;

/**
 * Loads /config.json written at container start from Docker env.
 * Safe to call multiple times; fails soft when file is missing (local vite).
 */
export async function loadRuntimeConfig(options?: {
  force?: boolean;
}): Promise<RuntimeConfig> {
  if (cached && !options?.force) return cached;
  try {
    const r = await fetch(`/config.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) {
      cached = {};
      return cached;
    }
    const data = (await r.json()) as RuntimeConfig;
    cached = data && typeof data === "object" ? data : {};
    return cached;
  } catch {
    cached = {};
    return cached;
  }
}
