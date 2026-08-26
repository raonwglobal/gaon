import { useCallback, useEffect, useState } from "react";
import {
  deletePlugin,
  disablePlugin,
  enablePlugin,
  fetchBuiltins,
  fetchConfig,
  fetchMetrics,
  fetchPlugins,
  fetchSessions,
  registerPlugin,
  syncToCore,
  terminateSession,
  updateConfig,
  updatePluginConfig,
} from "./api";
import type {
  MetricsPayload,
  PlatformConfig,
  PluginRecord,
  SessionInfo,
  Tab,
} from "./types";

function formatUptime(sec?: number): string {
  if (sec == null || Number.isNaN(sec)) return "-";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

export function App() {
  const [tab, setTab] = useState<Tab>("plugins");
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [builtins, setBuiltins] = useState<string[]>(["weather", "echo"]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");

  const [form, setForm] = useState({
    id: "",
    name: "",
    version: "1.0.0",
    description: "",
    path: "",
  });

  const [editPluginId, setEditPluginId] = useState<string | null>(null);
  const [editConfigJson, setEditConfigJson] = useState("{}");

  const [platformForm, setPlatformForm] = useState({
    allowedOrigins: "*",
    rateLimitPerMin: 60,
    maxSessions: 1000,
    apiSecretToken: "",
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "plugins") {
        const [pdata, bdata] = await Promise.all([
          fetchPlugins(),
          fetchBuiltins(),
        ]);
        setPlugins(pdata.plugins || []);
        setBuiltins(bdata.builtins || ["weather", "echo"]);
      } else if (tab === "sessions") {
        const data = await fetchSessions();
        setSessions(data.sessions || []);
      } else if (tab === "metrics") {
        setMetrics(await fetchMetrics());
      } else if (tab === "settings") {
        const data = await fetchConfig();
        setConfig(data.config);
        setPlatformForm({
          allowedOrigins: (data.config.allowedOrigins || ["*"]).join(","),
          rateLimitPerMin: data.config.rateLimitPerMin ?? 60,
          maxSessions: data.config.maxSessions ?? 1000,
          apiSecretToken: data.config.apiSecretToken || "",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (tab !== "sessions" && tab !== "metrics") return;
    const t = setInterval(() => void reload(), 10_000);
    return () => clearInterval(t);
  }, [tab, reload]);

  function saveToken() {
    localStorage.setItem("adminToken", token);
    setMessage("Admin token saved");
    void reload();
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const id = form.id.trim();
    if (!id) return;

    if (!builtins.includes(id)) {
      const ok = window.confirm(
        `"${id}" is not in Core PLUGIN_FACTORIES (known: ${builtins.join(
          ", "
        )}).\n\nMetadata can still be registered, but tools will not load until you add a factory in packages/core/src/plugins/index.ts.\n\nContinue?`
      );
      if (!ok) return;
    }

    try {
      await registerPlugin({
        id,
        name: form.name.trim() || id,
        version: form.version || "1.0.0",
        description: form.description || undefined,
        source: { type: "local", path: form.path || `plugins/${id}` },
        enabled: true,
      });
      setMessage(`Registered plugin: ${id}`);
      setForm({ id: "", name: "", version: "1.0.0", description: "", path: "" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function openConfigEditor(p: PluginRecord) {
    setEditPluginId(p.id);
    setEditConfigJson(JSON.stringify(p.config ?? {}, null, 2));
  }

  async function savePluginConfig() {
    if (!editPluginId) return;
    setError(null);
    try {
      const parsed = JSON.parse(editConfigJson) as Record<string, unknown>;
      await updatePluginConfig(editPluginId, parsed);
      setMessage(`Config saved for ${editPluginId}`);
      setEditPluginId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function savePlatformConfig(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const partial: Partial<PlatformConfig> = {
        allowedOrigins: platformForm.allowedOrigins
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        rateLimitPerMin: Number(platformForm.rateLimitPerMin),
        maxSessions: Number(platformForm.maxSessions),
      };
      if (platformForm.apiSecretToken.trim()) {
        partial.apiSecretToken = platformForm.apiSecretToken.trim();
      }
      const data = await updateConfig(partial);
      setConfig(data.config);
      setMessage("Platform config updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="app">
      <header>
        <h1>MCP SSE Platform</h1>
        <nav className="nav">
          {(["plugins", "sessions", "metrics", "settings"] as Tab[]).map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      {loading && <p className="muted">Loading…</p>}
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      {tab === "plugins" && (
        <>
          <div className="card">
            <h2>Register Plugin</h2>
            <form onSubmit={onRegister}>
              <div className="form-grid">
                <input
                  required
                  placeholder="id (e.g. weather)"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                />
                <input
                  placeholder="display name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  placeholder="version"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                />
                <input
                  placeholder="description"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
                <input
                  placeholder="local path (optional)"
                  value={form.path}
                  onChange={(e) => setForm({ ...form, path: e.target.value })}
                />
                <button type="submit">Register</button>
              </div>
            </form>
            <p className="muted" style={{ marginTop: 8 }}>
              Core builtins: <code>{builtins.join(", ")}</code>. IDs not in this
              list will warn before register.
            </p>
          </div>

          {editPluginId && (
            <div className="card">
              <h2>Edit config: {editPluginId}</h2>
              <textarea
                className="code-area"
                rows={8}
                value={editConfigJson}
                onChange={(e) => setEditConfigJson(e.target.value)}
              />
              <div className="row-actions">
                <button type="button" onClick={() => void savePluginConfig()}>
                  Save config
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setEditPluginId(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h2>Plugins</h2>
              <button
                type="button"
                onClick={() =>
                  syncToCore()
                    .then((r) =>
                      setMessage(
                        r.ok ? "Synced to Core" : `Sync failed: ${r.detail}`
                      )
                    )
                    .catch((e) => setError(String(e)))
                }
              >
                Sync to Core
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Version</th>
                  <th>Builtin</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plugins.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <td>{p.version}</td>
                    <td>
                      <span
                        className={`badge ${
                          builtins.includes(p.id) ? "ok" : "warn"
                        }`}
                      >
                        {builtins.includes(p.id) ? "yes" : "no"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.enabled ? "ok" : "off"}`}>
                        {p.enabled ? "enabled" : "disabled"}
                      </span>
                    </td>
                    <td className="actions">
                      <button type="button" onClick={() => openConfigEditor(p)}>
                        Config
                      </button>
                      {p.enabled ? (
                        <button
                          type="button"
                          onClick={() =>
                            disablePlugin(p.id)
                              .then(reload)
                              .catch((e) => setError(String(e)))
                          }
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            enablePlugin(p.id)
                              .then(reload)
                              .catch((e) => setError(String(e)))
                          }
                        >
                          Enable
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`Delete plugin "${p.id}"?`)) return;
                          deletePlugin(p.id)
                            .then(reload)
                            .catch((e) => setError(String(e)));
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {plugins.length === 0 && (
              <p className="muted">No plugins registered yet.</p>
            )}
          </div>
        </>
      )}

      {tab === "sessions" && (
        <div className="card">
          <div className="card-header">
            <h2>Active Sessions</h2>
            <button type="button" onClick={() => void reload()}>
              Refresh
            </button>
          </div>
          <p className="muted">Auto-refreshes every 10s</p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Created</th>
                <th>Last Activity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.id.slice(0, 8)}…</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>{new Date(s.lastActivity).toLocaleString()}</td>
                  <td className="actions">
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm("Terminate this session?")) return;
                        terminateSession(s.id)
                          .then(() => {
                            setMessage("Session terminated");
                            return reload();
                          })
                          .catch((e) => setError(String(e)));
                      }}
                    >
                      Terminate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sessions.length === 0 && (
            <p className="muted">No active sessions.</p>
          )}
        </div>
      )}

      {tab === "metrics" && (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Core status</div>
              <div className="metric-value">
                {metrics?.core?.status ?? "unknown"}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Active sessions</div>
              <div className="metric-value">
                {metrics?.core?.sessions ?? "-"}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Plugins enabled</div>
              <div className="metric-value">
                {metrics?.plugins?.enabled ?? "-"}
                <span className="metric-sub">
                  / {metrics?.plugins?.total ?? "-"}
                </span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Core uptime</div>
              <div className="metric-value">
                {formatUptime(metrics?.core?.uptime)}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Control uptime</div>
              <div className="metric-value">
                {formatUptime(metrics?.uptime)}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <h2>Raw metrics</h2>
              <button type="button" onClick={() => void reload()}>
                Refresh
              </button>
            </div>
            <pre className="code-block">
              {JSON.stringify(metrics, null, 2)}
            </pre>
          </div>
        </>
      )}

      {tab === "settings" && (
        <>
          <div className="card">
            <h2>Admin Token</h2>
            <p className="muted">Control Plane auth (ADMIN_TOKEN)</p>
            <input
              className="full"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Admin token"
            />
            <div className="row-actions">
              <button type="button" onClick={saveToken}>
                Save token
              </button>
            </div>
          </div>

          <div className="card">
            <h2>Platform Config</h2>
            <form onSubmit={(e) => void savePlatformConfig(e)}>
              <label className="field">
                <span>Allowed origins (comma-separated)</span>
                <input
                  value={platformForm.allowedOrigins}
                  onChange={(e) =>
                    setPlatformForm({
                      ...platformForm,
                      allowedOrigins: e.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Rate limit / min</span>
                <input
                  type="number"
                  value={platformForm.rateLimitPerMin}
                  onChange={(e) =>
                    setPlatformForm({
                      ...platformForm,
                      rateLimitPerMin: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Max sessions</span>
                <input
                  type="number"
                  value={platformForm.maxSessions}
                  onChange={(e) =>
                    setPlatformForm({
                      ...platformForm,
                      maxSessions: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>API secret token (optional)</span>
                <input
                  value={platformForm.apiSecretToken}
                  onChange={(e) =>
                    setPlatformForm({
                      ...platformForm,
                      apiSecretToken: e.target.value,
                    })
                  }
                  placeholder="Leave empty to keep unchanged"
                />
              </label>
              <div className="row-actions">
                <button type="submit">Save platform config</button>
              </div>
            </form>
            {config && (
              <pre className="code-block" style={{ marginTop: 12 }}>
                {JSON.stringify(config, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
