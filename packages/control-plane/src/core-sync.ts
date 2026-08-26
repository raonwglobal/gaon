import { registry } from "./registry.js";

const CORE_URL = process.env.CORE_URL || "http://localhost:3000";
const INTERNAL_TOKEN =
  process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || "";

/**
 * Push enabled plugin list + configs to Core so new SSE sessions pick them up.
 */
export async function syncPluginsToCore(): Promise<{ ok: boolean; detail?: string }> {
  const enabled = registry.enabledIds();
  const configs: Record<string, Record<string, unknown>> = {};
  for (const p of registry.list()) {
    if (p.enabled) configs[p.id] = p.config;
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (INTERNAL_TOKEN) headers["X-Internal-Token"] = INTERNAL_TOKEN;

    const res = await fetch(`${CORE_URL}/internal/plugins`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ enabled, configs }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, detail: text };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: String(err) };
  }
}
