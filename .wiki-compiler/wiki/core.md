# Core

## Metadata
- created: 2026-09-15
- aliases: core, packages/core, @mcp-sse/core
- source: /home/runner/work/gaon/gaon/.wiki-compiler/raw_notes/10_package_core.txt

## Related
- [[Cluster]]
- [[Control Plane]]
- [[Dashboard]]
- [[Docker Compose]]
- [[Gaon Platform]]
- [[GitHub Actions]]
- [[Install Worker]]
- [[Plugin Runtime]]

## Referenced By
- [[Architecture]]
- [[Ci Docker]]
- [[Cluster]]
- [[Control Plane]]
- [[Dashboard]]
- [[Design Gateway V2]]
- [[Docker Compose]]
- [[Echo Plugin]]
- [[External Mcp Plugins]]
- [[Gaon Platform]]
- [[GitHub Actions]]
- [[Install Worker]]
- [[P1 Implementation Notes]]
- [[Plugin Development Guide]]
- [[Plugin Runtime]]
- [[Prd]]
- [[Weather Plugin]]

## Body
Code location: packages/core.
npm name: @mcp-sse/core.
Source files scanned: 42.
Core is part of Gaon Platform.
Notable exports: ToolMetric, MetricsSnapshot, metrics, SessionInitOptions, McpSession, LogLevel, LogEntry, logger, ServerConfig, loadConfig, BootstrapResult, bootstrapFromControlPlane, SecretMap, createSessionSecrets, parseSessionSecretsHeader, parsePluginScopeHeader, createUpstreamFetch, clearSecrets, SessionListItem, SessionManager.
Top-level src: bootstrap-control-plane.ts, cluster, config.ts, index.ts, logger.ts, metrics.test.ts, metrics.ts, plugins, runtime, runtime-state.test.ts, runtime-state.ts, security, server-catalog-routes.ts, server.ts, session-manager.ts.
Code couples to: Core.
Sibling packages: Control Plane, Dashboard, Install Worker, Plugin Runtime.
Docker Compose services: install-worker, plugin-runtime, control-plane, core, dashboard.
CI under GitHub Actions.

## Notes
_(add your own notes here -- preserved on recompile)_
