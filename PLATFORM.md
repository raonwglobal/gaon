# MCP SSE Platform v0.6

## Quick start

```bash
npm install && npm test
npm run dev:core
npm run dev:control
npm run dev:dashboard
```

## Container runtime + orchestrators

```bash
npm run dev:runtime   # Tool Runtime API :8080

PLUGIN_RUNTIME=container ORCHESTRATOR=endpoint npm run dev:core

curl -X POST http://localhost:3001/api/catalog/deploy \
  -H "Content-Type: application/json" \
  -d '{"id":"echo","endpoint":"http://127.0.0.1:8080"}'
```

Docker:

```bash
docker build -t mcp-plugin-runtime:local packages/plugin-runtime
ORCHESTRATOR=docker PLUGIN_RUNTIME=container npm run dev:core
# deploy with { "id":"echo", "image":"mcp-plugin-runtime:local" }
```

Docs: [docs/plugin-runtime.md](docs/plugin-runtime.md) · [docs/cluster.md](docs/cluster.md)
