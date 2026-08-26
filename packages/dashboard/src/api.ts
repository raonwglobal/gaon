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
