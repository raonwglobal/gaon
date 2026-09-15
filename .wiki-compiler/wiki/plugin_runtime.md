# Plugin Runtime

## Metadata
- created: 2026-09-15
- aliases: plugin-runtime, docs/plugin-runtime.md
- source: /home/runner/work/gaon/gaon/.wiki-compiler/raw_notes/30_doc_plugin_runtime.txt

## Related
- [[Core]]
- [[Gaon Platform]]

## Referenced By
- [[Architecture]]
- [[Ci Docker]]
- [[Control Plane]]
- [[Core]]
- [[Dashboard]]
- [[Docker Compose]]
- [[Gaon Platform]]
- [[GitHub Actions]]
- [[Install Worker]]
- [[Roadmap]]

## Body
Documentation file: docs/plugin-runtime.md.
Plugin Runtime documents Gaon Platform.
References packages: Core, Plugin Runtime.
Excerpt: | Env | Values | Behavior | |-----|--------|----------| | `PLUGIN_RUNTIME` | `inprocess` (default), `container` | In-process factories vs Catalog HTTP routing | | `ORCHESTRATOR` | `endpoint` (default), `docker`, `k8s` | How `/catalog/deploy` starts plugins | ```http GET  /health

## Notes
_(add your own notes here -- preserved on recompile)_
