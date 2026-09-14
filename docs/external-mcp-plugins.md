# External MCP plugins (stdio bridge)

Gaon Core can run **full MCP servers** (Node or Python) via stdio by reading `plugin.meta.json` in each plugin directory.

## Core image

The Core Docker image includes `python3` / `pip` so Python MCP servers (e.g. kbsec) can be spawned.

```bash
docker compose build --no-cache core
docker compose up -d --force-recreate core
docker compose exec core python3 --version
```

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

Prepare on the host (or inside the volume):

```bash
cd /srv/gaon/plugins/toss
npm install
npm run build
test -f dist/index.js && echo OK
# Set API keys via env or Control Plane plugin config
```

### kbsec (Python)

```json
{
  "id": "kbsec",
  "runtime": "stdio",
  "command": "python3",
  "args": ["server.py"],
  "description": "KB Securities MCP"
}
```

```bash
cd /srv/gaon/plugins/kbsec
python3 -m pip install --user -r requirements.txt
# or venv and set command to the venv python path visible inside the container
```

## Reload after changes

```bash
curl -s -X POST http://localhost:3000/internal/plugins/reload
# Open one SSE session (or reconnect Grok), then:
curl -s http://localhost:3000/health | jq .loadReport
```

Expect `loaded` to include plugin ids and non-empty `tools`.
