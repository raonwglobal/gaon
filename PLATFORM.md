# MCP SSE Platform v0.4

Plugin-based **MCP over SSE** with admin dashboard.

## Quick start

```bash
npm install
npm test
npm run dev:core
npm run dev:control
npm run dev:dashboard
```

## Features

| Area | Capability |
|------|------------|
| Config | Single-source Control → Core |
| Plugins | Local discover, Git/npm install, template |
| Security | CORS, API key, rate limit, optional worker sandbox |
| Ops | Metrics, structured logs UI, session terminate |
| Scale | Session affinity via `CLUSTER_PEERS` |

## Remote install

Dashboard → **Install from Git / npm**, or:

```bash
curl -X POST http://localhost:3001/api/plugins/install \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"demo","source":{"type":"git","ref":"https://github.com/example/mcp-plugin.git"}}'
```

Restart Core after install.

## Cluster

See [docs/cluster.md](docs/cluster.md).

## Docs

- [docs/prd.md](docs/prd.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/roadmap.md](docs/roadmap.md)
