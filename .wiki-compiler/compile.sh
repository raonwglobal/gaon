#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="$ROOT/bin${PYTHONPATH:+:$PYTHONPATH}"
python3 "$ROOT/bin/compiler.py" "$ROOT/raw_notes" "$ROOT/wiki"
echo "Done. Pages in $ROOT/wiki"
