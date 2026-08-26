# Plugin Runtime (Container + Hot Reload)

## Modes

| `PLUGIN_RUNTIME` | Behavior |
|------------------|----------|
| `inprocess` (default) | Load plugins from `PLUGINS_DIR` into Core process |
| `container` | Route `tools/*` via **RuntimeCatalog** → HTTP Tool Runtime API |

## Tool Runtime API

Every plugin container exposes:

```http
GET  /health
GET  /manifest
POST /tools/call   { "name", "arguments" }
POST /shutdown
```

Reference server: `packages/plugin-runtime`.

```bash
npm run dev -w @mcp-sse/plugin-runtime
# PORT=8080
```

## Hot reload (no Core restart)

1. Start plugin runtime on a port.
2. Register into catalog:

```bash
curl -X POST http://localhost:3000/internal/catalog/deploy \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: $INTERNAL_TOKEN" \
  -d '{"id":"echo","version":"1.0.0","endpoint":"http://127.0.0.1:8080"}'
```

Or via Control Plane:

```bash
curl -X POST http://localhost:3001/api/catalog/deploy \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"echo","endpoint":"http://127.0.0.1:8080"}'
```

3. Set `PLUGIN_RUNTIME=container` and open a new SSE session.
4. Swap version by deploying a new endpoint with the same `id` — **atomic catalog upsert**.

```http
PUT /internal/catalog
{ "plugins": [ { "id":"echo", "version":"2.0.0", "endpoint":"http://...", "status":"ready" } ] }
```

`RemotePluginManager` resolves tools on every call from the current catalog (no process restart).

## Core internal API

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/internal/catalog` | List + epoch |
| PUT | `/internal/catalog` | Full replace |
| POST | `/internal/catalog/deploy` | Health-check + upsert one |
| DELETE | `/internal/catalog/:id` | Undeploy |
| POST | `/internal/catalog/rediscover` | Re-probe health |

## Next (Docker Orchestrator)

`EndpointOrchestrator` registers pre-started HTTP runtimes. Replace with Docker API to `docker run` images and allocate ports — same catalog contract.
