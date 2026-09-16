#!/usr/bin/env bash
# Publish .wiki-compiler/wiki/*.md to the official GitHub Wiki (*.wiki.git).
#
# Requirements:
#   - Settings → Features → Wikis enabled
#   - Ideally secrets.WIKI_TOKEN (PAT with contents:write on this repo).
#     Default GITHUB_TOKEN frequently cannot push to *.wiki.git.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/.wiki-compiler/wiki"
OWNER="${GITHUB_REPOSITORY_OWNER:-}"
REPO="${GITHUB_REPOSITORY:-}"
if [[ -n "$REPO" && "$REPO" == */* ]]; then
  OWNER="${OWNER:-${REPO%%/*}}"
  REPO="${REPO##*/}"
fi
OWNER="${OWNER:-raonwglobal}"
REPO="${REPO:-gaon}"
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "::error::No GH_TOKEN / GITHUB_TOKEN / WIKI_TOKEN"
  exit 1
fi

if [[ ! -d "$SRC" ]]; then
  echo "::error::Missing $SRC — run compile.sh first"
  exit 1
fi
mapfile -t PAGES < <(find "$SRC" -maxdepth 1 -type f -name '*.md' | sort)
if [[ ${#PAGES[@]} -eq 0 ]]; then
  echo "::error::No .md pages under $SRC"
  exit 1
fi
echo "Publishing ${#PAGES[@]} pages from $SRC"

WIKI_URL="https://x-access-token:${TOKEN}@github.com/${OWNER}/${REPO}.wiki.git"
WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

clone_ok=0
if git clone --depth 1 "$WIKI_URL" "$WORKDIR/wiki" 2>"$WORKDIR/clone.err"; then
  clone_ok=1
else
  echo "::warning::Clone failed (wiki may be empty or token lacks access):"
  cat "$WORKDIR/clone.err" || true
  mkdir -p "$WORKDIR/wiki"
  cd "$WORKDIR/wiki"
  git init
  git checkout -b master
  git remote add origin "$WIKI_URL"
fi

cd "$WORKDIR/wiki"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# Clear previous pages at repo root
find . -maxdepth 1 -type f \( -name '*.md' -o -name '_Sidebar.md' -o -name '_Footer.md' \) -delete

for f in "${PAGES[@]}"; do
  base="$(basename "$f")"
  if [[ "$base" == "INDEX.md" ]]; then
    cp "$f" Home.md
    continue
  fi
  stem="${base%.md}"
  if [[ "$stem" =~ ^[a-z0-9_]+$ ]]; then
    out="$(python3 -c "import sys; s=sys.argv[1]; print('_'.join(p.capitalize() for p in s.split('_'))+'.md')" "$stem")"
  else
    out="$base"
  fi
  cp "$f" "$out"
done

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
if git diff --staged --quiet 2>/dev/null; then
  echo "Official Wiki already up to date."
  exit 0
fi

git commit -m "chore(wiki): sync from .wiki-compiler (code-derived)"

# Default branch for wikis is often master
set +e
git push -u origin HEAD:master
push_master=$?
if [[ $push_master -ne 0 ]]; then
  git push -u origin HEAD:main
  push_main=$?
else
  push_main=0
fi
set -e

if [[ $push_master -ne 0 && $push_main -ne 0 ]]; then
  echo "::error::Push to ${OWNER}/${REPO}.wiki.git failed."
  echo "1) Enable Wikis and open the Wiki tab once in the GitHub UI."
  echo "2) Add repo secret WIKI_TOKEN = PAT with Contents: Read/Write (classic: repo scope)."
  echo "   Default GITHUB_TOKEN usually cannot write to the wiki remote."
  exit 1
fi

echo "Published to https://github.com/${OWNER}/${REPO}/wiki"
