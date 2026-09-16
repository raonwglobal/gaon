# `.wiki-compiler` — code-derived project wiki

Maintained from **this repository’s code** (not hand-written notes).

```text
packages/ plugins/ docs/ docker-compose.yml
        │
        ▼  scripts/sync_from_code.py
   raw_notes/   (generated, gitignored)
        │
        ▼  bin/compiler.py  (Emmimal/wiki-compiler)
   wiki/        (generated, gitignored)
        │
        ├─ CI artifact: wiki-compiler-pages
        └─ optional → GitHub Wiki tab (publish_github_wiki.sh)
```

## Local

```bash
cd .wiki-compiler
bash compile.sh
```

## CI (`.github/workflows/wiki-compiler.yml`)

| Job | Required | What it does |
|-----|----------|--------------|
| **Compile code-derived wiki** | yes | `compile.sh`, upload artifact `wiki-compiler-pages` |
| **Publish official GitHub Wiki** | no (`continue-on-error`) | push to `*.wiki.git` |

### Official Wiki tab (optional)

1. **Settings → Features → Wikis** on  
2. Open the **Wiki** tab once (creates the wiki repo)  
3. Add secret **`WIKI_TOKEN`**: PAT with Contents read/write (classic: `repo`)  
   - Default `GITHUB_TOKEN` often **cannot** push to `*.wiki.git`  
4. Actions → **Wiki Compiler** → Run workflow  

View: `https://github.com/<owner>/<repo>/wiki`  

If publish fails, the **Compile** job can still be green; download the `wiki-compiler-pages` artifact from the run.
