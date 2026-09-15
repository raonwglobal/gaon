# Plugin Hot Reload

## Metadata
- created: 2026-09-15
- aliases: plugin-hot-reload, docs/plugin-hot-reload.md
- source: /home/runner/work/gaon/gaon/.wiki-compiler/raw_notes/30_doc_plugin_hot_reload.txt

## Related
- [[Gaon Platform]]

## Referenced By
- [[Gaon Platform]]

## Body
Documentation file: docs/plugin-hot-reload.md.
Plugin Hot Reload documents Gaon Platform.
Excerpt: 1. `reloadPluginDiscovery()` re-scans `PLUGINS_DIR` 2. ESM import uses `?v=generation` cache-bust 3. Triggered by Control sync / install / enable Open SSE sessions update **without reconnect**: 1. `PluginManager.reload(ids)` — shutdown old plugins, load new, rebuild **mutable** tool maps 2. `ListTools` / `CallTool` handlers close over those maps → next request sees new tools

## Notes
_(add your own notes here -- preserved on recompile)_
