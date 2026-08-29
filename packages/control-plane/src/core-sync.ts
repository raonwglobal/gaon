import { registry } from "./registry.js";
import { store } from "./store.js";

const CORE_URL = process.env.CORE_URL || "http://localhost:3000";
const INTERNAL_TOKEN =
  process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || "";

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (INTERNAL_TOKEN) h["X-Internal-Token"] = INTERNAL_TOKEN;
  return h;
}

export async function syncPluginsToCore(): Promise<{ ok: boolean; detail?: string }> {
  const enabled = registry.enabledIds();
  const configs: Record<string, Record<string, unknown>> = {};
  const owners: Record<string, string> = {};
  for (const p of registry.list()) {
    if (p.enabled) {
      configs[p.id] = p.config;
      if (p.ownerUserId) owners[p.id] = p.ownerUserId;
    }
  }

  try {
    const res = await fetch(`${CORE_URL}/internal/plugins`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ enabled, configs, owners }),
    });
    if (!res.ok) return { ok: false, detail: await res.text() };
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: String(err) };
  }
}

export async function syncConfigToCore(): Promise<{ ok: boolean; detail?: string }> {
  const config = store.getConfig();
  try {
    const res = await fetch(`${CORE_URL}/internal/config`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({
        allowedOrigins: config.allowedOrigins,
        rateLimitPerMin: config.rateLimitPerMin,
        maxSessions: config.maxSessions,
        apiSecretToken: config.apiSecretToken,
      }),
    });
    if (!res.ok) return { ok: false, detail: await res.text() };
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: String(err) };
  }
}

export async function syncAllToCore(): Promise<{
  plugins: { ok: boolean; detail?: string };
  config: { ok: boolean; detail?: string };
}> {
  const plugins = await syncPluginsToCore();
  const config = await syncConfigToCore();
  return { plugins, config };
}
