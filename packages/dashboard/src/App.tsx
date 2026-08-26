import { useEffect, useState } from "react";
import {
  deletePlugin,
  disablePlugin,
  enablePlugin,
  fetchConfig,
  fetchMetrics,
  fetchPlugins,
  fetchSessions,
  registerPlugin,
  syncToCore,
} from "./api";

type Tab = "plugins" | "sessions" | "metrics" | "settings";

export function App() {
  const [tab, setTab] = useState<Tab>("plugins");
  const [plugins, setPlugins] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");

  const [form, setForm] = useState({
    id: "",
    name: "",
    version: "1.0.0",
    description: "",
    path: "",
  });

  async function reload() {
    setError(null);
    try {
      if (tab === "plugins") {
        const data = await fetchPlugins();
        setPlugins(data.plugins || []);
      } else if (tab === "sessions") {
        const data = await fetchSessions();
        setSessions(data.sessions || []);
      } else if (tab === "metrics") {
        setMetrics(await fetchMetrics());
      } else if (tab === "settings") {
        const data = await fetchConfig();
        setConfig(data.config);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void reload();
  }, [tab]);

  function saveToken() {
    localStorage.setItem("adminToken", token);
    void reload();
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await registerPlugin({
        id: form.id.trim(),
        name: form.name.trim() || form.id.trim(),
        version: form.version || "1.0.0",
        description: form.description || undefined,
        source: { type: "local", path: form.path || `plugins/${form.id.trim()}` },
        enabled: true,
      });
      setMessage(`Registered plugin: ${form.id}`);
      setForm({ id: "", name: "", version: "1.0.0", description: "", path: "" });
      await reload();
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

      {error && <div className="error">{error}</div>}
      {message && (
        <div
          className="card"
          style={{ borderColor: "#86efac", background: "#f0fdf4" }}
        >
          {message}
        </div>
      )}

      {tab === "plugins" && (
        <>
          <div className="card">
            <h2>Register Plugin</h2>
            <form onSubmit={onRegister}>
              <div style={{ display: "grid", gap: 8, maxWidth: 480 }}>
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
              코드 플러그인은 <code>plugins/</code>에 두고 Core 팩토리에 등록한 뒤,
              여기서 메타데이터를 등록·활성화하세요.
            </p>
          </div>

          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ margin: 0 }}>Plugins</h2>
              <button
                onClick={() =>
                  syncToCore()
                    .then((r) =>
                      setMessage(r.ok ? "Synced to Core" : `Sync failed: ${r.detail}`)
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
                      <span className={`badge ${p.enabled ? "ok" : "off"}`}>
                        {p.enabled ? "enabled" : "disabled"}
                      </span>
                    </td>
                    <td className="actions">
                      {p.enabled ? (
                        <button
                          onClick={() =>
                            disablePlugin(p.id).then(reload).catch((e) => setError(String(e)))
                          }
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            enablePlugin(p.id).then(reload).catch((e) => setError(String(e)))
                          }
                        >
                          Enable
                        </button>
                      )}
                      <button
                        onClick={() =>
                          deletePlugin(p.id).then(reload).catch((e) => setError(String(e)))
                        }
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
          <h2>Active Sessions</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Created</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>{new Date(s.lastActivity).toLocaleString()}</td>
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
        <div className="card">
          <h2>Metrics</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(metrics, null, 2)}
          </pre>
        </div>
      )}

      {tab === "settings" && (
        <>
          <div className="card">
            <h2>Admin Token</h2>
            <p className="muted">
              Control Plane 인증용 토큰 (ADMIN_TOKEN)
            </p>
            <input
              style={{ width: "100%", padding: 8, marginBottom: 8 }}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Admin token"
            />
            <button onClick={saveToken}>Save</button>
          </div>
          <div className="card">
            <h2>Platform Config</h2>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
