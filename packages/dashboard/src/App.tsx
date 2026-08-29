import { useCallback, useEffect, useState } from "react";
import {
  createUser,
  deletePlugin,
  disablePlugin,
  enablePlugin,
  fetchMe,
  fetchPlugins,
  fetchUsers,
  installRemotePlugin,
  login,
  logout,
  registerPlugin,
  type AuthUser,
} from "./api";
import type { PluginRecord } from "./types";

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"plugins" | "users">("plugins");
  const [form, setForm] = useState({ id: "", name: "", path: "" });
  const [remote, setRemote] = useState({ id: "", ref: "", version: "main" });
  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    role: "user",
  });

  useEffect(() => {
    fetchMe()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const reload = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      if (tab === "plugins") {
        const data = await fetchPlugins();
        setPlugins(data.plugins || []);
      } else if (tab === "users" && user.role === "admin") {
        const data = await fetchUsers();
        setUsers(data.users || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [user, tab]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!authChecked) {
    return (
      <div className="app">
        <p className="muted">Checking session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app login-page">
        <header>
          <h1>MCP SSE Platform</h1>
          <p className="muted">Management plane — sign in required</p>
        </header>
        {error && <div className="error">{error}</div>}
        <div className="card" style={{ maxWidth: 420 }}>
          <h2>Sign in</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void login(loginForm.username, loginForm.password)
                .then((r) => {
                  setUser(r.user);
                  setMessage(`Signed in as ${r.user.username}`);
                })
                .catch((err) =>
                  setError(err instanceof Error ? err.message : String(err))
                );
            }}
          >
            <label className="field">
              <span>Username</span>
              <input
                value={loginForm.username}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, username: e.target.value })
                }
                required
                autoComplete="username"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
                required
                autoComplete="current-password"
              />
            </label>
            <button type="submit">Sign in</button>
          </form>
          <p className="muted" style={{ marginTop: 12 }}>
            Set <code>BOOTSTRAP_ADMIN_PASSWORD</code> on control-plane to create
            the first admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>MCP SSE Platform</h1>
        <span className="muted">
          {user.username} ({user.role})
        </span>
        <button
          type="button"
          className="ghost"
          onClick={() =>
            void logout().then(() => {
              setUser(null);
              setMessage("Signed out");
            })
          }
        >
          Logout
        </button>
        <nav className="nav">
          <button
            type="button"
            className={tab === "plugins" ? "active" : ""}
            onClick={() => setTab("plugins")}
          >
            plugins
          </button>
          {user.role === "admin" && (
            <button
              type="button"
              className={tab === "users" ? "active" : ""}
              onClick={() => setTab("users")}
            >
              users
            </button>
          )}
        </nav>
      </header>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      {tab === "plugins" && (
        <>
          <div className="card">
            <h2>Register local plugin</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void registerPlugin({
                  id: form.id,
                  name: form.name || form.id,
                  source: { type: "local", path: form.path || `plugins/${form.id}` },
                })
                  .then(() => {
                    setMessage("Registered");
                    setForm({ id: "", name: "", path: "" });
                    return reload();
                  })
                  .catch((err) =>
                    setError(err instanceof Error ? err.message : String(err))
                  );
              }}
            >
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
                  placeholder="path"
                  value={form.path}
                  onChange={(e) => setForm({ ...form, path: e.target.value })}
                />
                <button type="submit">Register</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h2>Install from Git</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void installRemotePlugin({
                  id: remote.id,
                  source: {
                    type: "git",
                    ref: remote.ref,
                    version: remote.version || undefined,
                  },
                })
                  .then(() => {
                    setMessage("Installed — restart Core to load factory");
                    return reload();
                  })
                  .catch((err) =>
                    setError(err instanceof Error ? err.message : String(err))
                  );
              }}
            >
              <div className="form-grid">
                <input
                  required
                  placeholder="plugin id"
                  value={remote.id}
                  onChange={(e) => setRemote({ ...remote, id: e.target.value })}
                />
                <input
                  required
                  placeholder="https://github.com/org/repo.git"
                  value={remote.ref}
                  onChange={(e) => setRemote({ ...remote, ref: e.target.value })}
                />
                <input
                  placeholder="branch"
                  value={remote.version}
                  onChange={(e) =>
                    setRemote({ ...remote, version: e.target.value })
                  }
                />
                <button type="submit">Install</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h2>My connectors</h2>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plugins.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.id} <span className="muted">{p.version}</span>
                    </td>
                    <td className="mono">{p.source?.type}</td>
                    <td>
                      <span className={`badge ${p.enabled ? "ok" : "off"}`}>
                        {p.enabled ? "enabled" : "disabled"}
                      </span>
                    </td>
                    <td className="actions">
                      {p.enabled ? (
                        <button
                          type="button"
                          onClick={() => void disablePlugin(p.id).then(reload)}
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void enablePlugin(p.id).then(reload)}
                        >
                          Enable
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`Delete ${p.id}?`)) return;
                          void deletePlugin(p.id).then(reload);
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

      {tab === "users" && user.role === "admin" && (
        <>
          <div className="card">
            <h2>Create user</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void createUser(userForm)
                  .then(() => {
                    setMessage("User created");
                    setUserForm({ username: "", password: "", role: "user" });
                    return reload();
                  })
                  .catch((err) =>
                    setError(err instanceof Error ? err.message : String(err))
                  );
              }}
            >
              <div className="form-grid">
                <input
                  required
                  placeholder="username"
                  value={userForm.username}
                  onChange={(e) =>
                    setUserForm({ ...userForm, username: e.target.value })
                  }
                />
                <input
                  required
                  type="password"
                  placeholder="password"
                  value={userForm.password}
                  onChange={(e) =>
                    setUserForm({ ...userForm, password: e.target.value })
                  }
                />
                <select
                  value={userForm.role}
                  onChange={(e) =>
                    setUserForm({ ...userForm, role: e.target.value })
                  }
                >
                  <option value="viewer">viewer</option>
                  <option value="user">user</option>
                  <option value="operator">operator</option>
                  <option value="admin">admin</option>
                </select>
                <button type="submit">Create</button>
              </div>
            </form>
          </div>
          <div className="card">
            <h2>Users</h2>
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.role}</td>
                    <td>{u.active ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
