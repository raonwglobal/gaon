# MCP SSE Platform v0.7

## Architecture (v2)

- **Management plane**: Dashboard + Control Plane
- **Data plane**: Core MCP SSE Gateway
- Design: [docs/design-gateway-v2.md](docs/design-gateway-v2.md)

## Auth (management)

```bash
export BOOTSTRAP_ADMIN_PASSWORD='your-strong-password'
```

## Gateway client auth

```bash
GATEWAY_REQUIRE_AUTH=true
API_SECRET_TOKEN=your-gateway-token
```

## Session scope & secrets

```http
GET /sse
Authorization: Bearer <gateway-token>
X-User-Id: <user-uuid>
X-Enabled-Plugins: weather,echo
X-Session-Secrets: {"OVERRIDE_KEY":"..."}
```

## Vault → SSE session auto-inject

1. Dashboard vault tab: user stores `WEATHER_API_KEY` etc.
2. MCP client connects with `X-User-Id` (or `GATEWAY_TOKEN_MAP`)
3. Core calls Control `GET /internal/vault/session-secrets?userId=` with `INTERNAL_TOKEN`
4. Secrets load into session memory; plugins use `ctx.getSecret` / `ctx.upstreamFetch`
5. `X-Session-Secrets` header overrides vault values

```bash
# core
CONTROL_URL=http://control-plane:3001
INTERNAL_TOKEN=same-as-control-plane
VAULT_SESSION_INJECT=true
GATEWAY_TOKEN_MAP={"my-token":"user-uuid"}
```

## Git install

```bash
GIT_ALLOW_HOSTS=github.com,gitlab.com
GIT_BLOCK_PRIVATE=true
```
