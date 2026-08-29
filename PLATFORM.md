# MCP SSE Platform v0.7

## Architecture (v2)

- **Management plane**: Dashboard + Control Plane (login, users, per-user connectors)
- **Data plane**: Core MCP SSE Gateway (deploy separately if needed)
- Design: [docs/design-gateway-v2.md](docs/design-gateway-v2.md)

## Auth (management plane)

```bash
export BOOTSTRAP_ADMIN_PASSWORD='your-strong-password'
npm run dev:control
# Dashboard: sign in as admin / that password
```

- Session cookie `gaon_session` (HttpOnly)
- No admin token in `/config.json`
- Roles: viewer, user, operator, admin
- Plugins are owned by the creating user

## Gateway client auth

```bash
GATEWAY_REQUIRE_AUTH=true
API_SECRET_TOKEN=your-gateway-token
# or: GATEWAY_TOKENS=tok1,tok2
```

Clients send `Authorization: Bearer <token>` or `X-API-Key`.

## Vault

Encrypted secrets at rest (AES-256-GCM). Master key: `VAULT_MASTER_KEY`.
API never returns plaintext values.

## Git install

```bash
GIT_ALLOW_HOSTS=github.com,gitlab.com
GIT_BLOCK_PRIVATE=true
```

## Quick start

```bash
npm install && npm test
npm run dev:core
npm run dev:control
npm run dev:dashboard
```
