# `.wiki-compiler` — code-derived project wiki

This folder is **not** a general-purpose notebook. It is maintained from **this repository’s code**.

Pipeline:

```text
packages/ plugins/ docs/ docker-compose.yml .github/workflows
        │
        ▼  scripts/sync_from_code.py
   raw_notes/*.txt          (regenerated; do not treat as hand-authored)
        │
        ▼  bin/compiler.py  (Emmimal/wiki-compiler)
   wiki/*.md                (linked pages + lint)
```

## Local update

```bash
cd .wiki-compiler
bash compile.sh
```

## CI

On pushes that change application code, `.github/workflows/wiki-compiler.yml`:

1. Checks out the repo
2. Runs `scripts/sync_from_code.py`
3. Compiles the wiki
4. Commits updates under `.wiki-compiler/` when the tree changes (`[skip ci]`)

## How this helps development

| Output | Use |
|--------|-----|
| `wiki/INDEX.md` | Map of platform + packages + plugins + docs |
| Package pages | Exports, src layout, import coupling to other packages |
| Plugin pages | In-repo plugins and which packages manage them |
| Doc pages | docs/*.md tied back to package names found in the text |
| Lint | Broken `[[links]]` / orphan pages after structural changes |

When you add a package, plugin, or doc, push to `main` (or run `compile.sh`) so the relationship graph stays aligned with the codebase.
