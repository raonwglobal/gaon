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
        │
        ▼  scripts/publish_github_wiki.sh  (CI)
   GitHub Wiki tab          https://github.com/<org>/<repo>/wiki
```

## Local update

```bash
cd .wiki-compiler
bash compile.sh
# optional: publish to official Wiki (needs token + Wikis enabled)
# GH_TOKEN=... bash scripts/publish_github_wiki.sh
```

## CI

On pushes that change application code, `.github/workflows/wiki-compiler.yml`:

1. Checks out the repo  
2. Runs `scripts/sync_from_code.py`  
3. Compiles the wiki  
4. Commits updates under `.wiki-compiler/` when the tree changes (`[skip ci]`)  
5. **Publishes** `wiki/*.md` to the **official GitHub Wiki** (`INDEX.md` → `Home.md`, plus `_Sidebar.md`)

### Enable the Wiki tab (one-time)

1. Repo **Settings → General → Features → Wikis**  
2. Open the **Wiki** tab once and create any initial page (so `*.wiki.git` exists)  
3. Re-run **Actions → Wiki Compiler → Run workflow**  

Then open: `https://github.com/<owner>/<repo>/wiki`

## How this helps development

| Output | Use |
|--------|-----|
| `wiki/INDEX.md` | Map of platform + packages + plugins + docs |
| Package pages | Exports, src layout, import coupling to other packages |
| Plugin pages | In-repo plugins and which packages manage them |
| Doc pages | docs/*.md tied back to package names found in the text |
| Lint | Broken `[[links]]` / orphan pages after structural changes |
| GitHub Wiki tab | Same content for in-browser navigation / sidebar |

When you add a package, plugin, or doc, push to `main` (or run `compile.sh`) so the relationship graph stays aligned with the codebase.
