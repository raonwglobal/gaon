# Plugin hot rediscovery + live session tool swap

## Factory rediscovery (process stays up)

1. `reloadPluginDiscovery()` re-scans `PLUGINS_DIR`
2. ESM import uses `?v=generation` cache-bust
3. Triggered by Control sync / install / enable

## Live session tool handler swap

Open SSE sessions update **without reconnect**:

1. `PluginManager.reload(ids)` — shutdown old plugins, load new, rebuild **mutable** tool maps
2. `ListTools` / `CallTool` handlers close over those maps → next request sees new tools
3. `notifications/tools/list_changed` when SDK supports it
4. `SessionManager.reloadAllSessionTools()` after every rediscovery

### Scope on reload

- Uses `resolveSessionPlugins(session.scopeFilter, subject)`
- `X-Enabled-Plugins` from connect is stored as `explicitScope` and kept on reload

### Container runtime

Live swap is for **inprocess** mode. Container mode uses the runtime catalog.

### Verify

```bash
curl -X POST -H "X-Internal-Token: $INTERNAL_TOKEN" \
  http://localhost:3000/internal/plugins/reload
# liveSessions.updated / details[].tools
```
