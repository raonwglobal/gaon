# Plugin Runtime (Container + Hot Reload)

## Modes

| Env | Values | Behavior |
|-----|--------|----------|
| `PLUGIN_RUNTIME` | `inprocess` (default), `container` | In-process factories vs Catalog HTTP routing |
| `ORCHESTRATOR` | `endpoint` (default), `docker`, `k8s` | How `/catalog/deploy` starts plugins |

## Tool Runtime API

```http
GET  /health
GET  /manifest
POST /tools/call
POST /shutdown
```

Reference: `packages/plugin-runtime` (+ Dockerfile).

## Hot reload + list_changed

Catalog upsert/replace clears manifest cache and fans out
`notifications/tools/list_changed` to all active SSE sessions (`sessionHub`).

Clients should re-call `tools/list` after the notification.

## Orchestrators

### endpoint (default)

Register a pre-started runtime:

```bash
curl -X POST http://localhost:3001/api/catalog/deploy \
  -H "Content-Type: application/json" \
  -d '{"id":"echo","endpoint":"http://127.0.0.1:8080","version":"1.0.0"}'
```

### docker

Requires Docker CLI + daemon.

```bash
# Build runtime image
docker build -t mcp-plugin-runtime:local packages/plugin-runtime

ORCHESTRATOR=docker PLUGIN_RUNTIME=container npm run dev:core

curl -X POST http://localhost:3000/internal/catalog/deploy \
  -H "Content-Type: application/json" \
  -d '{"id":"echo","image":"mcp-plugin-runtime:local","version":"1.0.0"}'
```

Publishes host ports in `PLUGIN_PORT_MIN`–`PLUGIN_PORT_MAX` (default 18000–18999).

### k8s

```bash
# Optional: let Core apply manifests
ORCHESTRATOR=k8s K8S_APPLY=true K8S_NAMESPACE=mcp-plugins PLUGIN_RUNTIME=container npm run dev:core

curl -X POST http://localhost:3000/internal/catalog/deploy \
  -H "Content-Type: application/json" \
  -d '{"id":"echo","image":"mcp-plugin-runtime:local","version":"1.0.0"}'
```

Without `K8S_APPLY`, registers DNS `http://plugin-<id>.<ns>.svc.cluster.local:8080`
(see `deploy/k8s/*.yaml` for manual apply).

## Env reference

| Variable | Default | Meaning |
|----------|---------|--------|
| `ORCHESTRATOR` | `endpoint` | endpoint / docker / k8s |
| `PLUGIN_RUNTIME` | `inprocess` | inprocess / container |
| `PLUGIN_PORT_MIN/MAX` | 18000/18999 | Docker host ports |
| `DOCKER_PLUGIN_HOST` | `127.0.0.1` | Published bind host |
| `DOCKER_PLUGIN_NETWORK` | `bridge` | Docker network |
| `PLUGIN_MEMORY` | `256m` | Docker memory |
| `PLUGIN_CPUS` | `0.5` | Docker CPUs |
| `K8S_NAMESPACE` | `mcp-plugins` | K8s namespace |
| `K8S_APPLY` | false | kubectl apply on deploy |
| `K8S_CLUSTER_DOMAIN` | `svc.cluster.local` | DNS suffix |
| `PLUGIN_RPC_TIMEOUT_MS` | 15000 | HTTP RPC timeout |
