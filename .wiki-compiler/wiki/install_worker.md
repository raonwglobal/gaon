# Install Worker

## Metadata
- created: 2026-09-15
- aliases: install-worker, packages/install-worker, @gaon/install-worker
- source: /home/runner/work/gaon/gaon/.wiki-compiler/raw_notes/10_package_install_worker.txt

## Related
- [[Control Plane]]
- [[Core]]
- [[Dashboard]]
- [[Docker Compose]]
- [[Gaon Platform]]
- [[GitHub Actions]]
- [[Plugin Runtime]]

## Referenced By
- [[Control Plane]]
- [[Core]]
- [[Dashboard]]
- [[Docker Compose]]
- [[Echo Plugin]]
- [[Gaon Platform]]
- [[GitHub Actions]]
- [[Weather Plugin]]

## Body
Code location: packages/install-worker.
npm name: @gaon/install-worker.
Source files scanned: 4.
Install Worker is part of Gaon Platform.
Notable exports: assertGitRefAllowed, resolveInstallDir, InstallRequest, InstallResult, installPlugin, verifyPluginSignature, computePluginSignature.
Top-level src: git-allowlist.ts, index.ts, install.ts, signature.ts.
Code couples to: Install Worker.
Sibling packages: Control Plane, Core, Dashboard, Plugin Runtime.
Docker Compose services: install-worker, plugin-runtime, control-plane, core, dashboard.
CI under GitHub Actions.

## Notes
_(add your own notes here -- preserved on recompile)_
