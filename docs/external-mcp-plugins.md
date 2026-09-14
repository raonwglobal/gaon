# External MCP plugins (stdio bridge)

Gaon Core can run **full MCP servers** (Node or Python) via stdio by reading `plugin.meta.json` in each plugin directory.

## Core image

The Core Docker image includes `python3` / `pip` so Python MCP servers (e.g. kbsec) can be spawned.

```bash
docker compose build --no-cache core
docker compose up -d --force-recreate core
docker compose exec core python3 --version
```

> **Do not** run `pip install -r ...` against system Python inside Alpine/Debian images.
> PEP 668 marks that environment as externally managed (`apk` only). Use a **venv** under the plugin dir.

## plugin.meta.json

Place next to the installed plugin (e.g. `/srv/gaon/plugins/toss/plugin.meta.json`).

### toss (Node)

```json
{
  "id": "toss",
  "runtime": "stdio",
  "command": "node",
  "args": ["dist/index.js"],
  "description": "Toss Invest MCP"
}
```

```bash
cd /srv/gaon/plugins/toss
npm install
npm run build
test -f dist/index.js && echo OK
```

### kbsec (Python) — venv required

Create a venv **on the shared volume** and point `command` at that interpreter (path as seen **inside** the Core container: `/app/plugins/...`).

Inside the container:

```bash
podman-compose exec -u root core python3 -m venv /app/plugins/kbsec/.venv
podman-compose exec -u root core /app/plugins/kbsec/.venv/bin/pip install -U pip
podman-compose exec -u root core /app/plugins/kbsec/.venv/bin/pip install -r /app/plugins/kbsec/requirements.txt
```

On the host (if the volume is Linux and matches container arch):

```bash
cd /srv/gaon/plugins/kbsec
python3 -m venv .venv
.venv/bin/pip install -U pip
.venv/bin/pip install -r requirements.txt
```

```bash
cat > /srv/gaon/plugins/kbsec/plugin.meta.json << 'EOF'
{
  "id": "kbsec",
  "runtime": "stdio",
  "command": "/app/plugins/kbsec/.venv/bin/python",
  "args": ["server.py"],
  "description": "KB Securities MCP (venv)"
}
EOF
```

Avoid `python3 -m pip install ...` without a venv (triggers `externally-managed-environment`).

## Reload after changes

```bash
curl -s -X POST http://localhost:3000/internal/plugins/reload
# Open one SSE session (or reconnect Grok), then:
curl -s http://localhost:3000/health | jq .loadReport
```

Expect `loaded` to include plugin ids and non-empty `tools`.
