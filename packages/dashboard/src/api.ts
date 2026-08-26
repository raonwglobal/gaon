import type { MetricsPayload, PlatformConfig, PluginRecord, SessionInfo } from "./types";

const BASE = "";

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("adminToken");
  if (token) h["X-Admin-Token"] = token;
  return h;
}

async function parseError(r: Response): Promise<string> {
  const text = await r.text();
  try {
    const j = JSON.parse(text) as { error?: string };
    return j.error || text || r.statusText;
  } catch {
    return text || r.statusText;
  }
}

export async function fetchPlugins(): Promise<{ plugins: PluginRecord[] }> {
  const r = await fetch(`${BASE}/api/plugins`, { headers: headers() });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function fetchBuiltins(): Promise<{ builtins: string[] }> {
  const r = await fetch(`${BASE}/api/builtins`, { headers: headers() });
  if (!r.ok) return { builtins: ["weather", "echo"] };
  return r.json();
}

export async function registerPlugin(body: {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source?: { type: string; path?: string };
  config?: Record<string, unknown>;
  enabled?: boolean;
}): Promise<{ plugin: PluginRecord }> {
  const r = await fetch(`${BASE}/api/plugins`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function installRemotePlugin(body: {
  id: string;
  name?: string;
  source: { type: "git" | "npm"; ref: string; version?: string };
  enabled?: boolean;
}): Promise<unknown> {
  const r = await fetch(`${BASE}/api/plugins/install`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function updatePluginConfig(
  id: string,
  config: Record<string, unknown>
): Promise<{ plugin: PluginRecord }> {
  const r = await fetch(`${BASE}/api/plugins/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ config }),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function enablePlugin(id: string): Promise<{ plugin: PluginRecord }> {
  const r = await fetch(`${BASE}/api/plugins/${encodeURIComponent(id)}/enable`, {
    method: "POST",
    headers: headers(),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function disablePlugin(id: string): Promise<{ plugin: PluginRecord }> {
  const r = await fetch(`${BASE}/api/plugins/${encodeURIComponent(id)}/disable`, {
    method: "POST",
    headers: headers(),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function deletePlugin(id: string): Promise<void> {
  const r = await fetch(`${BASE}/api/plugins/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!r.ok && r.status !== 204) throw new Error(await parseError(r));
}

export async function syncToCore(): Promise<{ ok: boolean; detail?: string }> {
  const r = await fetch(`${BASE}/api/sync`, {
    method: "POST",
    headers: headers(),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function fetchSessions(): Promise<{ sessions: SessionInfo[] }> {
  const r = await fetch(`${BASE}/api/sessions`, { headers: headers() });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function terminateSession(id: string): Promise<void> {
  const r = await fetch(`${BASE}/api/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!r.ok && r.status !== 204) throw new Error(await parseError(r));
}

export async function fetchMetrics(): Promise<MetricsPayload> {
  const r = await fetch(`${BASE}/api/metrics`, { headers: headers() });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function fetchConfig(): Promise<{ config: PlatformConfig }> {
  const r = await fetch(`${BASE}/api/config`, { headers: headers() });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function updateConfig(
  partial: Partial<PlatformConfig>
): Promise<{ config: PlatformConfig }> {
  const r = await fetch(`${BASE}/api/config`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(partial),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export interface LogEntry {
  ts: number;
  level: string;
  message: string;
  context?: Record<string, unknown>;
}

export async function fetchLogs(opts?: {
  level?: string;
  limit?: number;
}): Promise<{ logs: LogEntry[]; instanceId?: string }> {
  const qs = new URLSearchParams();
  if (opts?.level) qs.set("level", opts.level);
  if (opts?.limit) qs.set("limit", String(opts.limit));
  const q = qs.toString();
  const r = await fetch(`${BASE}/api/logs${q ? `?${q}` : ""}`, {
    headers: headers(),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}
