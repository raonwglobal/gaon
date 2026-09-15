# External Mcp Plugins

## Metadata
- created: 2026-09-15
- aliases: external-mcp-plugins, docs/external-mcp-plugins.md
- source: /home/runner/work/gaon/gaon/.wiki-compiler/raw_notes/30_doc_external_mcp_plugins.txt

## Related
- [[Core]]
- [[Docker Compose]]
- [[Gaon Platform]]

## Referenced By
- [[Gaon Platform]]

## Body
Documentation file: docs/external-mcp-plugins.md.
External Mcp Plugins documents Gaon Platform.
References packages: Core.
Excerpt: Gaon Core can run **full MCP servers** (Node or Python) via stdio by reading `plugin.meta.json` in each plugin directory. The Core Docker image includes `python3` / `pip` so Python MCP servers (e.g. kbsec) can be spawned. ```bash docker compose build --no-cache core docker compose up -d --force-recreate core docker compose exec core python3 --version

## Notes
_(add your own notes here -- preserved on recompile)_
