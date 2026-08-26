# Multi-instance & Session Affinity

## Overview

Core supports lightweight multi-instance affinity when `CLUSTER_PEERS` is set.

| Env | Description |
|-----|-------------|
| `INSTANCE_ID` | This node's id (default: hostname) |
| `CLUSTER_PEERS` | Comma-separated peer instance ids (same order on all nodes) |

## Behavior

1. On `GET /sse`, a `sessionId` is generated.
2. Owner = `sha256(sessionId) % peers.length` mapped to peer id.
3. If this node is not the owner → **307** with `X-Session-Owner` and `Location`.
4. Sticky load balancers should route by `sessionId` or honor `X-Session-Owner`.

## Recommended LB

- Nginx `ip_hash` or sticky cookie on `/sse` and `/message`
- Or external session router that hashes `sessionId` the same way

## Sandbox

```bash
SANDBOX_PLUGINS=true
```

Runs plugin tool calls in Worker threads (`packages/core/src/plugins/sandbox.ts`).
Isolation is stronger than in-process, but not a full OS container.

## Remote plugins

```http
POST /api/plugins/install
{
  "id": "my-tool",
  "source": { "type": "git", "ref": "https://github.com/org/mcp-plugin.git", "version": "main" }
}
```

or `{ "type": "npm", "ref": "some-mcp-plugin", "version": "1.2.3" }`.

Installs into `PLUGINS_DIR`, registers in Control Plane. **Restart Core** to rediscover factories.
