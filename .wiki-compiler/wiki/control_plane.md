# Control Plane

## Metadata
- created: 2026-09-15
- aliases: control-plane, packages/control-plane, @mcp-sse/control-plane
- source: /home/runner/work/gaon/gaon/.wiki-compiler/raw_notes/10_package_control_plane.txt

## Related
- [[Core]]
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
- [[Core]]
- [[Dashboard]]
- [[Docker Compose]]
- [[Echo Plugin]]
- [[Gaon Platform]]
- [[GitHub Actions]]
- [[Install Worker]]
- [[Plugin Development Guide]]
- [[Weather Plugin]]

## Body
Code location: packages/control-plane.
npm name: @mcp-sse/control-plane.
Source files scanned: 24.
Control Plane is part of Gaon Platform.
Notable exports: PluginRegistry, registry, resolveInstallDir, InstallRequest, InstallResult, installPlugin, PluginRecord, PlatformConfig, maskConfig, store, syncPluginsToCore, syncConfigToCore, syncAllToCore, installViaWorker, handleMetrics, handleInternalVault, handleInternalSync, handleCatalog, handleSessions, handleConfig.
Top-level src: auth, core-sync.ts, index.ts, install-worker-client.ts, plugin-installer.ts, registry.ts, routes, security, store.ts.
Code couples to: Control Plane.
Sibling packages: Core, Dashboard, Install Worker, Plugin Runtime.
Docker Compose services: install-worker, plugin-runtime, control-plane, core, dashboard.
CI under GitHub Actions.

## Notes
_(add your own notes here -- preserved on recompile)_
