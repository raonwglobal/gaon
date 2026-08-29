# Plugin hot rediscovery (no Core process restart)

## Problem

Previously, installing a plugin required restarting Core so `ensurePluginDiscovery()` would run again (`discoveryDone` stayed true).

## Solution

1. **`reloadPluginDiscovery()`** — re-scans `PLUGINS_DIR`, rebuilds `PLUGIN_FACTORIES`
2. **ESM cache-bust** — dynamic `import(fileUrl + '?v=' + generation)` so updated code on disk is loaded
3. **Auto trigger** — `PUT /internal/plugins` (Control sync) calls rediscovery
4. **Manual** — `POST /internal/plugins/reload` with `X-Internal-Token`
5. **Control Plane** — install / enable / disable / delete auto-call `syncPluginsToCore()`

## Session semantics

| Session | Behavior |
|---------|----------|
| **New** SSE connections | Load current enabled plugins + latest factories |
| **Existing** SSE sessions | Keep the tool set from connect time (stable mid-conversation) |

Reconnect MCP client after install/enable to see new tools.

## Verify

```bash
curl -H "X-Internal-Token: $INTERNAL_TOKEN" http://localhost:3000/health
# discoveryEpoch increments after install/sync

curl -X POST -H "X-Internal-Token: $INTERNAL_TOKEN" \
  http://localhost:3000/internal/plugins/reload
```
