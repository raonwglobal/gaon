#!/usr/bin/env bash
# Regenerate code-derived raw_notes, then compile linked wiki pages.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="$ROOT/bin${PYTHONPATH:+:$PYTHONPATH}"
mkdir -p "$ROOT/bin"

# Ensure wiki-compiler stages exist (vendored or fetched)
for f in compiler extractor graph linter rewriter; do
  if [[ ! -f "$ROOT/bin/${f}.py" ]]; then
    curl -fsSL "https://raw.githubusercontent.com/Emmimal/wiki-compiler/main/${f}.py" -o "$ROOT/bin/${f}.py"
  fi
done
# Prefer compile_pages API
if grep -q 'write_all' "$ROOT/bin/compiler.py" 2>/dev/null; then
  sed -i 's/from rewriter import write_all/from rewriter import compile_pages/;s/write_all(/compile_pages(/g' "$ROOT/bin/compiler.py"
fi

python3 "$ROOT/scripts/sync_from_code.py"

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
