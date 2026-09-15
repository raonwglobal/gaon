#!/usr/bin/env bash
# Regenerate code-derived raw_notes, then compile linked wiki pages.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="$ROOT/bin${PYTHONPATH:+:$PYTHONPATH}"

python3 "$ROOT/scripts/sync_from_code.py"

# Drop stale pages from previous corpus (code-derived set is authoritative)
mkdir -p "$ROOT/wiki"
find "$ROOT/wiki" -maxdepth 1 -type f -name '*.md' -delete

python3 "$ROOT/bin/compiler.py" "$ROOT/raw_notes" "$ROOT/wiki"

python3 - "$ROOT/wiki" <<'PY'
import sys
from pathlib import Path
wiki = Path(sys.argv[1])
lines = [
    "# Gaon Architecture Wiki",
    "",
    "Auto-generated from **repository code** via `.wiki-compiler/scripts/sync_from_code.py`",
    "and compiled with [wiki-compiler](https://github.com/Emmimal/wiki-compiler).",
    "",
    "Do not hand-edit `raw_notes/` for long-term content — re-run sync after code changes",
    "(GitHub Action `wiki-compiler.yml` does this on push).",
    "",
    "## Pages",
    "",
]
for p in sorted(wiki.glob("*.md")):
    if p.name == "INDEX.md":
        continue
    title = p.read_text(encoding="utf-8", errors="replace").splitlines()[0].lstrip("# ").strip()
    lines.append(f"- [{title}]({p.name})")
lines.append("")
(wiki / "INDEX.md").write_text("\n".join(lines), encoding="utf-8")
print(f"INDEX -> {wiki / 'INDEX.md'}")
PY

echo "Done. Wiki at $ROOT/wiki"
