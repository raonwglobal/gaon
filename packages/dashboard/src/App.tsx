import { useEffect, useState } from "react";
import {
  disablePlugin,
  enablePlugin,
  fetchConfig,
  fetchMetrics,
  fetchPlugins,
  fetchSessions,
} from "./api";

type Tab = "plugins" | "sessions" | "metrics" | "settings";

export function App() {
  const [tab, setTab] = useState<Tab>("plugins");
  const [plugins, setPlugins] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");

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

      {tab === "plugins" && (
        <div className="card">
          <h2>Plugins</h2>
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
                      <button onClick={() => disablePlugin(p.id).then(reload)}>
                        Disable
                      </button>
                    ) : (
                      <button onClick={() => enablePlugin(p.id).then(reload)}>
                        Enable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {plugins.length === 0 && (
            <p className="muted">No plugins registered yet.</p>
          )}
        </div>
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
              Control Plane 인증용 토큰을 입력하세요. (ADMIN_TOKEN)
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
