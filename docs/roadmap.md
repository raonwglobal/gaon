# MCP SSE Platform Roadmap

## Phase 1–4 ✅

## Phase 5 ✅

- Remote install, sandbox workers, affinity, tests

## Phase 6 — Plugin Runtime (Container + Hot Reload) ✅ foundation

- [x] Tool Runtime API contract (`packages/plugin-runtime`)
- [x] `RuntimeCatalog` + epoch + hot upsert
- [x] `HttpPluginTransport` + `RemotePluginManager`
- [x] `PLUGIN_RUNTIME=inprocess|container`
- [x] Core `/internal/catalog/*` + Control `/api/catalog/*`
- [x] `EndpointOrchestrator` (pre-started endpoints)
- [ ] Docker Engine orchestrator (image pull/run)
- [ ] MCP `tools/list_changed` notification on catalog swap
- [ ] K8s Service-based runtimes

## Optional future

- Redis session store
- OpenTelemetry export
- Full OS sandbox profiles per plugin container
