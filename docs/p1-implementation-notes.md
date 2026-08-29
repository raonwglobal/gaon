# P1 implementation notes

## Landed on main
- Core `authenticateGateway` (`GATEWAY_REQUIRE_AUTH`, `GATEWAY_TOKENS`, `API_SECRET_TOKEN`)
- Control vault AES-GCM + `/api/vault`
- Audit log + `/api/audit`
- Git allowlist module (`GIT_ALLOW_HOSTS`, `GIT_BLOCK_PRIVATE`)
- Dashboard API client for vault/audit
- Compose env vars for gateway auth and vault

## Wire-up checklist after pull
```bash
git pull
# packages/core/src/server.ts should call authenticateGateway
# packages/control-plane plugin-installer should call assertGitRefAllowed
# Dashboard App tabs: plugins, sessions, metrics, logs, vault, users, audit
```

## Next (P1b)
- Tenant-scoped tools/list on gateway
- upstreamFetch secret injection into plugins
