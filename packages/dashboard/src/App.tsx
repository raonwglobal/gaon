import { useCallback, useEffect, useState } from "react";
import {
  deletePlugin,
  disablePlugin,
  enablePlugin,
  fetchBuiltins,
  fetchConfig,
  fetchLogs,
  fetchMetrics,
  fetchPlugins,
  fetchSessions,
  installRemotePlugin,
  registerPlugin,
  syncToCore,
  terminateSession,
  updateConfig,
  updatePluginConfig,
  type LogEntry,
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logLevel, setLogLevel] = useState("");
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

  const [remote, setRemote] = useState({
    id: "",
    type: "git" as "git" | "npm",
    ref: "",
    version: "",
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
      } else if (tab === "logs") {
        const data = await fetchLogs({
          level: logLevel || undefined,
          limit: 150,
        });
        setLogs(data.logs || []);
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
  }, [tab, logLevel]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (tab !== "sessions" && tab !== "metrics" && tab !== "logs") return;
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
        `"${id}" is not in Core factories (known: ${builtins.join(
          ", "
        )}). Continue?`
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

  async function onRemoteInstall(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await installRemotePlugin({
        id: remote.id.trim(),
        source: {
          type: remote.type,
          ref: remote.ref.trim(),
          version: remote.version.trim() || undefined,
        },
        enabled: true,
      });
      setMessage(
        `Installed ${remote.id} from ${remote.type}. Restart Core to load factory.`
      );
      setRemote({ id: "", type: "git", ref: "", version: "" });
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
      setMessage("Platform config updated (synced to Core)");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const tabs: Tab[] = ["plugins", "sessions", "metrics", "logs", "settings"];

  return (
    <div className="app">
      <header>
        <h1>MCP SSE Platform</h1>
        <nav className="nav">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
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
            <h2>Register Local Plugin</h2>
            <form onSubmit={onRegister}>
              <div className="form-grid">
                <input
                  required
                  placeholder="id"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                />
                <input
                  placeholder="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  placeholder="version"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                />
                <input
                  placeholder="path"
                  value={form.path}
                  onChange={(e) => setForm({ ...form, path: e.target.value })}
                />
                <button type="submit">Register</button>
              </div>
            </form>
            <p className="muted">Builtins: {builtins.join(", ")}</p>
          </div>

          <div className="card">
            <h2>Install from Git / npm</h2>
            <form onSubmit={onRemoteInstall}>
              <div className="form-grid">
                <input
                  required
                  placeholder="plugin id"
                  value={remote.id}
                  onChange={(e) => setRemote({ ...remote, id: e.target.value })}
                />
                <select
                  value={remote.type}
                  onChange={(e) =>
                    setRemote({
                      ...remote,
                      type: e.target.value as "git" | "npm",
                    })
                  }
                >
                  <option value="git">git</option>
                  <option value="npm">npm</option>
                </select>
                <input
                  required
                  placeholder={remote.type === "git" ? "git URL" : "package name"}
                  value={remote.ref}
                  onChange={(e) => setRemote({ ...remote, ref: e.target.value })}
                />
                <input
                  placeholder="branch/tag or version (optional)"
                  value={remote.version}
                  onChange={(e) =>
                    setRemote({ ...remote, version: e.target.value })
                  }
                />
                <button type="submit">Install</button>
              </div>
            </form>
            <p className="muted">
              Clones/installs into PLUGINS_DIR. Restart Core to pick up the factory.
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
                      setMessage(r.ok ? "Synced to Core" : `Sync: ${JSON.stringify(r)}`)
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
                  <th>Source</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plugins.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.id}{" "}
                      <span className="muted">{p.version}</span>
                    </td>
                    <td className="mono">{p.source?.type || "local"}</td>
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
                          if (!window.confirm(`Delete ${p.id}?`)) return;
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
          </div>
        </>
      )}

      {tab === "sessions" && (
        <div className="card">
          <div className="card-header">
            <h2>Sessions</h2>
            <button type="button" onClick={() => void reload()}>
              Refresh
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Created</th>
                <th>Last Activity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.id.slice(0, 8)}…</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>{new Date(s.lastActivity).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm("Terminate?")) return;
                        terminateSession(s.id)
                          .then(reload)
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
        </div>
      )}

      {tab === "metrics" && (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Core</div>
              <div className="metric-value">{metrics?.core?.status ?? "-"}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Sessions</div>
              <div className="metric-value">{metrics?.core?.sessions ?? "-"}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Plugins</div>
              <div className="metric-value">
                {metrics?.plugins?.enabled ?? "-"}/{metrics?.plugins?.total ?? "-"}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Uptime</div>
              <div className="metric-value">
                {formatUptime(metrics?.core?.uptime as number | undefined)}
              </div>
            </div>
          </div>
          <div className="card">
            <pre className="code-block">{JSON.stringify(metrics, null, 2)}</pre>
          </div>
        </>
      )}

      {tab === "logs" && (
        <div className="card">
          <div className="card-header">
            <h2>Structured Logs</h2>
            <div className="row-actions" style={{ marginTop: 0 }}>
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
              >
                <option value="">all</option>
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
              <button type="button" onClick={() => void reload()}>
                Refresh
              </button>
            </div>
          </div>
          <p className="muted">Auto-refresh 10s · ring buffer from Core</p>
          <div className="log-list">
            {logs
              .slice()
              .reverse()
              .map((l, i) => (
                <div key={`${l.ts}-${i}`} className={`log-line level-${l.level}`}>
                  <span className="log-ts">
                    {new Date(l.ts).toLocaleTimeString()}
                  </span>
                  <span className="log-level">{l.level}</span>
                  <span className="log-msg">{l.message}</span>
                  {l.context && (
                    <span className="log-ctx">
                      {JSON.stringify(l.context)}
                    </span>
                  )}
                </div>
              ))}
            {logs.length === 0 && <p className="muted">No logs yet.</p>}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <>
          <div className="card">
            <h2>Admin Token</h2>
            <input
              className="full"
              value={token}
              onChange={(e) => setToken(e.target.value)}
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
                <span>Allowed origins</span>
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
              <button type="submit">Save (sync to Core)</button>
            </form>
            {config && (
              <pre className="code-block">{JSON.stringify(config, null, 2)}</pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
