# MCP SSE Platform Roadmap

## Phase 1–5 ✅

## Phase 6 — Plugin Runtime ✅

- [x] Tool Runtime API + `plugin-runtime` package
- [x] RuntimeCatalog + hot upsert
- [x] RemotePluginManager (container mode)
- [x] Endpoint orchestrator
- [x] **Docker orchestrator** (`ORCHESTRATOR=docker`)
- [x] **K8s orchestrator** (`ORCHESTRATOR=k8s`, optional `K8S_APPLY`)
- [x] **tools/list_changed** fanout via `sessionHub`
- [x] Example manifests under `deploy/k8s/`

## Optional future

- Redis shared session store
- OpenTelemetry export
- Stricter container security profiles (gVisor / network policies)
- Image build pipeline from git/npm install → OCI image
