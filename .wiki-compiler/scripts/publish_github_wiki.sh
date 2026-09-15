#!/usr/bin/env bash
# Publish .wiki-compiler/wiki/*.md to the official GitHub Wiki (*.wiki.git).
# Requires: Wikis enabled on the repository; GITHUB_TOKEN or GH_TOKEN with push access.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/.wiki-compiler/wiki"
OWNER="${GITHUB_REPOSITORY_OWNER:-${GITHUB_REPOSITORY%%/*}}"
REPO="${GITHUB_REPOSITORY##*/}"
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
  # Local fallback when run outside Actions
  OWNER="${OWNER:-raonwglobal}"
  REPO="${REPO:-gaon}"
fi

if [[ -z "$TOKEN" ]]; then
  echo "::error::No GH_TOKEN / GITHUB_TOKEN; cannot push to wiki"
  exit 1
fi

if [[ ! -d "$SRC" ]] || [[ -z "$(find "$SRC" -maxdepth 1 -name '*.md' 2>/dev/null | head -1)" ]]; then
  echo "::error::No compiled pages under $SRC — run compile.sh first"
  exit 1
fi

WIKI_URL="https://x-access-token:${TOKEN}@github.com/${OWNER}/${REPO}.wiki.git"
WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

echo "Cloning wiki for ${OWNER}/${REPO}..."
if ! git clone --depth 1 "$WIKI_URL" "$WORKDIR/wiki" 2>"$WORKDIR/clone.err"; then
  echo "::error::Could not clone ${OWNER}/${REPO}.wiki.git"
  echo "Enable Settings → Features → Wikis, create the first page in the Wiki tab, then re-run."
  cat "$WORKDIR/clone.err" || true
  exit 1
fi

cd "$WORKDIR/wiki"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# Replace generated content (keep .git only)
find . -maxdepth 1 -type f -name '*.md' -delete

# Copy pages; INDEX.md becomes Home.md (Wiki home)
for f in "$SRC"/*.md; do
  base="$(basename "$f")"
  if [[ "$base" == "INDEX.md" ]]; then
    cp "$f" Home.md
  else
    # Prefer Title_Case filenames for readable Wiki URLs
    # core.md → Core.md
    stem="${base%.md}"
    # keep existing Pascal/underscore names; capitalize first letter only if all-lower
    if [[ "$stem" =~ ^[a-z0-9_]+$ ]]; then
      out="$(python3 -c "import sys; s=sys.argv[1]; print('_'.join(p.capitalize() for p in s.split('_'))+'.md')" "$stem")"
    else
      out="$base"
    fi
    cp "$f" "$out"
  fi
done

# Sidebar: list of pages for navigation in the Wiki UI
{
  echo "## Gaon architecture"
  echo ""
  echo "- [Home](Home)"
  for f in $(ls -1 *.md 2>/dev/null | grep -v '^Home.md$' | sort); do
    title="${f%.md}"
    echo "- [${title//_/ }](${title})"
  done
} > _Sidebar.md

git add -A
if git diff --staged --quiet; then
  echo "Official Wiki already up to date."
  exit 0
fi

git commit -m "chore(wiki): sync from .wiki-compiler (code-derived)"
git push origin HEAD:master 2>/dev/null || git push origin HEAD:main

echo "Published to https://github.com/${OWNER}/${REPO}/wiki"
