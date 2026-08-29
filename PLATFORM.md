# MCP SSE Platform v0.8

## Architecture

- Management: Dashboard + Control Plane
- Data plane: Core MCP SSE Gateway
- Install isolation: **install-worker** (git/npm)
- Design: [docs/design-gateway-v2.md](docs/design-gateway-v2.md)

## Install worker

```bash
INSTALL_WORKER_URL=http://install-worker:3002
INTERNAL_TOKEN=shared-secret
PLUGIN_SIGNING_KEY=optional-hmac-key
PLUGIN_SIGNATURE_REQUIRED=false
```

Flow: Dashboard → Control `/api/plugins/install` → Worker `POST /install` → `./plugins/<id>`.

If `INSTALL_WORKER_URL` is empty, Control installs in-process (needs git in image).

### Plugin signature (optional)

```json
{
  "mcpPluginId": "my-plugin",
  "version": "1.0.0",
  "mcpPluginSignature": "<hmac-sha256 hex>"
}
```

Payload: `mcpPluginId|version|<sha256 of files excluding node_modules/.git>`

## Vault session inject

Core uses `CONTROL_URL` + `INTERNAL_TOKEN` to load user secrets into SSE session memory.

## Gateway auth

```bash
GATEWAY_REQUIRE_AUTH=true
API_SECRET_TOKEN=...
```
