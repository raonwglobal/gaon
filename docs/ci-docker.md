# Docker Images CI & Compose

## GitHub Actions

Workflow: `.github/workflows/docker-images.yml`

Builds and pushes (on `main` / tags):

- `ghcr.io/<owner>/<repo>/core`
- `ghcr.io/<owner>/<repo>/control-plane`
- `ghcr.io/<owner>/<repo>/dashboard`
- `ghcr.io/<owner>/<repo>/plugin-runtime`

Dockerfiles are **self-contained** (copy package sources, `npm install && npm run build`) so CI does not depend on a root lockfile or workspace hoist.

## docker-compose

```bash
docker compose up --build
```

| Service | Port | Role |
|---------|------|------|
| `core` | 3000 | MCP SSE server |
| `plugin-runtime` | 8080 | Tool Runtime API (echo) sidecar |
| `control-plane` | 3001 | Admin API |
| `dashboard` | 5173→80 | UI |

### Container mode example

```bash
PLUGIN_RUNTIME=container docker compose up --build

# Register runtime into Core catalog (hot path)
curl -X POST http://localhost:3001/api/catalog/deploy \
  -H "Content-Type: application/json" \
  -d '{"id":"echo","endpoint":"http://plugin-runtime:8080","version":"1.0.0"}'
```

From the host, plugin-runtime is `http://127.0.0.1:8080`.  
From Core container, use service name `http://plugin-runtime:8080`.
