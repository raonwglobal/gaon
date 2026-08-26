# MCP SSE Platform v0.5

Plugin-based **MCP over SSE** with dual runtime modes.

## Quick start

```bash
npm install
npm test
npm run dev:core
npm run dev:control
npm run dev:dashboard
```

## Plugin runtime modes

### inprocess (default)

Loads `plugins/*` into Core. Same as v0.4.

### container (hot-reload foundation)

```bash
# terminal 1 — tool runtime sidecar
npm run dev:runtime   # :8080

# terminal 2 — core
PLUGIN_RUNTIME=container npm run dev:core

# register without restarting core
curl -X POST http://localhost:3001/api/catalog/deploy \
  -H "Content-Type: application/json" \
  -d '{"id":"echo","endpoint":"http://127.0.0.1:8080","version":"1.0.0"}'
```

See [docs/plugin-runtime.md](docs/plugin-runtime.md).

## Docs

- [docs/prd.md](docs/prd.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/plugin-runtime.md](docs/plugin-runtime.md)
- [docs/cluster.md](docs/cluster.md)
- [docs/roadmap.md](docs/roadmap.md)
