# MCP SSE Platform

Universal **MCP over SSE** server with a plugin system and admin dashboard.

> Load multiple MCP tools as plugins, manage them from a web dashboard, and serve them over HTTP + Server-Sent Events.

## Quick start

```bash
npm install
npm run dev:core       # :3000 — MCP SSE Data Plane
npm run dev:control    # :3001 — Control Plane API
npm run dev:dashboard  # :5173 — Admin UI
```

Copy `.env.example` to `.env` and set `ADMIN_TOKEN` / `INTERNAL_TOKEN`.

See **[PLATFORM.md](./PLATFORM.md)** for full documentation.

## Structure

```text
packages/
  core/            # MCP SSE server
  control-plane/   # Plugin registry & management API
  dashboard/       # React admin UI
plugins/
  weather/         # Example plugin
  echo/            # Smoke-test plugin
  _template/       # Copy this to create a new plugin
docs/
  prd.md
  architecture.md
  roadmap.md
```

## Add a plugin

```bash
cp -r plugins/_template plugins/my-plugin
# edit plugins/my-plugin/index.ts
# register factory in packages/core/src/plugins/index.ts
# enable via Dashboard
```

## License

MIT
