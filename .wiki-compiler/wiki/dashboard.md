# Dashboard

## Metadata
- created: 2026-09-15
- aliases: dashboard, packages/dashboard, @mcp-sse/dashboard
- source: /home/runner/work/gaon/gaon/.wiki-compiler/raw_notes/10_package_dashboard.txt

## Related
- [[Control Plane]]
- [[Core]]
- [[Docker Compose]]
- [[Gaon Platform]]
- [[GitHub Actions]]
- [[Install Worker]]
- [[Plugin Runtime]]

## Referenced By
- [[Architecture]]
- [[Ci Docker]]
- [[Control Plane]]
- [[Core]]
- [[Design Gateway V2]]
- [[Docker Compose]]
- [[Gaon Platform]]
- [[GitHub Actions]]
- [[Install Worker]]
- [[P1 Implementation Notes]]

## Body
Code location: packages/dashboard.
npm name: @mcp-sse/dashboard.
Source files scanned: 5.
Dashboard is part of Gaon Platform.
Notable exports: RuntimeConfig, loadRuntimeConfig, AuthUser, login, logout, fetchMe, fetchUsers, createUser, fetchPlugins, fetchBuiltins, registerPlugin, installRemotePlugin, updatePluginConfig, enablePlugin, disablePlugin, deletePlugin, syncToCore, fetchSessions, terminateSession, fetchMetrics.
Top-level src: App.tsx, api.ts, main.tsx, runtime-config.ts, types.ts.
Code couples to: Dashboard.
Sibling packages: Control Plane, Core, Install Worker, Plugin Runtime.
Docker Compose services: install-worker, plugin-runtime, control-plane, core, dashboard.
CI under GitHub Actions.

## Notes
_(add your own notes here -- preserved on recompile)_
