const BASE = "";

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("adminToken");
  if (token) h["X-Admin-Token"] = token;
  return h;
}

export async function fetchPlugins() {
  const r = await fetch(`${BASE}/api/plugins`, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
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
}) {
  const r = await fetch(`${BASE}/api/plugins`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function enablePlugin(id: string) {
  const r = await fetch(`${BASE}/api/plugins/${id}/enable`, {
    method: "POST",
    headers: headers(),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function disablePlugin(id: string) {
  const r = await fetch(`${BASE}/api/plugins/${id}/disable`, {
    method: "POST",
    headers: headers(),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deletePlugin(id: string) {
  const r = await fetch(`${BASE}/api/plugins/${id}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!r.ok && r.status !== 204) throw new Error(await r.text());
}

export async function syncToCore() {
  const r = await fetch(`${BASE}/api/sync`, {
    method: "POST",
    headers: headers(),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchSessions() {
  const r = await fetch(`${BASE}/api/sessions`, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchMetrics() {
  const r = await fetch(`${BASE}/api/metrics`, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchConfig() {
  const r = await fetch(`${BASE}/api/config`, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
