# Gaon Wiki (wiki-compiler)

This directory uses [Emmimal/wiki-compiler](https://github.com/Emmimal/wiki-compiler) (pure Python, no LLM) to maintain a **linked project wiki** from structured raw notes.

```text
raw_notes/*.txt  →  extractor → graph → rewriter → linter  →  wiki/*.md
```

## Layout

| Path | Purpose |
|------|---------|
| `raw_notes/` | Source entities (edit these) |
| `wiki/` | Compiled markdown pages with `[[wikilinks]]` |
| `bin/` | Vendored compiler stages (stdlib only) |
| `compile.sh` | One-shot compile script |

## Compile

```bash
cd .wiki-compiler
./compile.sh
# or
python3 bin/compiler.py raw_notes wiki
```

## How to manage the codebase with this wiki

1. **Add or change an architectural concept** → add/update a file under `raw_notes/` using the entity format below.
2. **Mention other entity display names** in the body so the graph creates bidirectional links.
3. **Recompile** → open `wiki/` pages for navigation, orphans, and broken links.
4. **Use lint output** to find documentation that nothing else references (orphans) or bad links.

### Raw note format

```text
# Entity Display Name
created: YYYY-MM-DD
aliases: Alt Name, Other Name

Free text body. Mention Core and Control Plane by display name to auto-link.
```

## Entity map (initial corpus)

Platform: Gaon Platform, Docker Compose, Security, Grok Connector  
Planes: Core, Control Plane, Dashboard, Install Worker, Plugin Runtime  
Runtime: Session, Session Manager, Plugin Manager, Runtime State, Discovery, Sync Lifecycle, Registry  
Plugins: Plugin Development Guide, Plugin Meta, Stdio Bridge, External MCP Plugins
