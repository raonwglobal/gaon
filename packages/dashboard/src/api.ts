import type { MetricsPayload, PlatformConfig, PluginRecord, SessionInfo } from "./types";

const BASE = "";
const cred: RequestCredentials = "include";

function headers(json = true): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function parseError(r: Response): Promise<string> {
  const text = await r.text();
  try {
    const j = JSON.parse(text) as { error?: string; detail?: string; hint?: string };
    if (j.detail) return j.error ? `${j.error}: ${j.detail}` : j.detail;
    if (j.hint) return `${j.error || "Error"} (${j.hint})`;
    return j.error || text || r.statusText;
  } catch {
    return text || r.statusText;
  }
}

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  active: boolean;
}

export async function login(username: string, password: string) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: headers(),
    credentials: cred,
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<{ user: AuthUser }>;
}

export async function logout() {
  await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: headers(),
    credentials: cred,
  });
}

export async function fetchMe() {
  const r = await fetch(`${BASE}/api/auth/me`, {
    headers: headers(false),
    credentials: cred,
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<{ user: AuthUser }>;
}

export async function fetchUsers() {
  const r = await fetch(`${BASE}/api/users`, {
    headers: headers(false),
    credentials: cred,
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<{ users: AuthUser[] }>;
}

export async function createUser(body: {
  username: string;
  password: string;
  role?: string;
}) {
  const r = await fetch(`${BASE}/api/users`, {
    method: "POST",
    headers: headers(),
    credentials: cred,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<{ user: AuthUser }>;
}

async function apiGet(path: string) {
  const r = await fetch(`${BASE}${path}`, {
    headers: headers(false),
    credentials: cred,
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

async function apiSend(path: string, method: string, body?: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(body !== undefined),
    credentials: cred,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok && r.status !== 204) throw new Error(await parseError(r));
  if (r.status === 204) return;
  return r.json();
}

export async function fetchPlugins(): Promise<{ plugins: PluginRecord[] }> {
  return apiGet("/api/plugins");
}
export async function fetchBuiltins(): Promise<{ builtins: string[] }> {
  try {
    return await apiGet("/api/builtins");
  } catch {
    return { builtins: ["weather", "echo"] };
  }
}
export async function registerPlugin(body: Record<string, unknown>) {
  return apiSend("/api/plugins", "POST", body);
}
export async function installRemotePlugin(body: Record<string, unknown>) {
  return apiSend("/api/plugins/install", "POST", body);
}
export async function updatePluginConfig(id: string, config: Record<string, unknown>) {
  return apiSend(`/api/plugins/${encodeURIComponent(id)}`, "PATCH", { config });
}
export async function enablePlugin(id: string) {
  return apiSend(`/api/plugins/${encodeURIComponent(id)}/enable`, "POST");
}
export async function disablePlugin(id: string) {
  return apiSend(`/api/plugins/${encodeURIComponent(id)}/disable`, "POST");
}
export async function deletePlugin(id: string) {
  return apiSend(`/api/plugins/${encodeURIComponent(id)}`, "DELETE");
}
export async function syncToCore() {
  return apiSend("/api/sync", "POST");
}
export async function fetchSessions(): Promise<{ sessions: SessionInfo[] }> {
  return apiGet("/api/sessions");
}
export async function terminateSession(id: string) {
  return apiSend(`/api/sessions/${encodeURIComponent(id)}`, "DELETE");
}
export async function fetchMetrics(): Promise<MetricsPayload> {
  return apiGet("/api/metrics");
}
export async function fetchConfig(): Promise<{ config: PlatformConfig }> {
  return apiGet("/api/config");
}
export async function updateConfig(partial: Partial<PlatformConfig>) {
  return apiSend("/api/config", "PUT", partial);
}
export interface LogEntry {
  ts: number;
  level: string;
  message: string;
  context?: Record<string, unknown>;
}
export async function fetchLogs(opts?: { level?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (opts?.level) qs.set("level", opts.level);
  if (opts?.limit) qs.set("limit", String(opts.limit));
  const q = qs.toString();
  return apiGet(`/api/logs${q ? `?${q}` : ""}`);
}
