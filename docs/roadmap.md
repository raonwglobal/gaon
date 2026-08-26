# MCP SSE Platform Roadmap

## Phase 1 — Core ✅
## Phase 2 — Control Plane ✅
## Phase 3 — Dashboard ✅
## Phase 4 — Operations ✅

- [x] Metrics / observability counters
- [x] Structured log buffer + Dashboard **logs** tab
- [x] Config single-source sync

## Phase 5 — Advanced ✅

- [x] Plugin template + auto-discovery
- [x] **npm/Git remote install** (`POST /api/plugins/install`)
- [x] **Worker sandbox** (`SANDBOX_PLUGINS=true`)
- [x] **Multi-instance affinity** (`CLUSTER_PEERS`, `INSTANCE_ID`) — see [cluster.md](./cluster.md)
- [x] Unit tests (vitest)

## Future (optional)

- Full OS-level container sandbox per plugin
- Shared Redis session store across regions
- Hot-reload factories without Core restart
- OpenTelemetry export
