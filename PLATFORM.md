# MCP SSE Platform v0.7

## Architecture (v2)

- **Management plane**: Dashboard + Control Plane (login, users, per-user connectors)
- **Data plane**: Core MCP SSE Gateway (deploy separately if needed)
- Design: [docs/design-gateway-v2.md](docs/design-gateway-v2.md)

## Auth (management plane)

```bash
export BOOTSTRAP_ADMIN_PASSWORD='your-strong-password'
```

- Session cookie `gaon_session` (HttpOnly)
- Roles: viewer, user, operator, admin

## Gateway client auth

```bash
GATEWAY_REQUIRE_AUTH=true
API_SECRET_TOKEN=your-gateway-token
```

Clients: `Authorization: Bearer <token>` or `X-API-Key`.

## Session scope & secrets (MCP clients)

```http
GET /sse
Authorization: Bearer <gateway-token>
X-User-Id: <user-uuid>
X-Enabled-Plugins: weather,echo
X-Session-Secrets: {"WEATHER_API_KEY":"sk-..."}
```

- `X-Enabled-Plugins` — tools/list limited to these plugins for the session
- `X-User-Id` — when Control Plane synced `owners`, only that user's plugins load
- `X-Session-Secrets` — JSON (or base64 JSON); memory only; cleared on disconnect
- Plugins: `ctx.getSecret(name)`, `ctx.upstreamFetch(url, { secretName })`

## Vault

AES-256-GCM at rest. `VAULT_MASTER_KEY`. API never returns plaintext.

## Git install

```bash
GIT_ALLOW_HOSTS=github.com,gitlab.com
GIT_BLOCK_PRIVATE=true
```
