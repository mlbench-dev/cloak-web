#!/usr/bin/env bash
# Repo-wide malware scan. Runs in CI via .github/workflows/malware-scan.yml.
#
# Scans EVERY file (any name, any extension, including files disguised as fonts/images)
# for the backdoor that has repeatedly been planted in this repo (postcss.config.*, api.js,
# public/fonts/*.woff2/.eot, ...), plus the generic techniques it uses, so a copy hidden
# under a new filename is still caught.
#
# Usage:
#   bash scripts/security-scan.sh                  # working tree (tracked + untracked, not ignored)
#   bash scripts/security-scan.sh <git-ref>...     # specific commits/branches
#   bash scripts/security-scan.sh --all-branches   # every local + remote branch
#
# Exits 1 if anything suspicious is found. It never deletes files itself: a flagged file must
# be reviewed and removed by a human (see docs/02-repository-and-code-ownership.md).

set -uo pipefail

# This scanner and its workflow necessarily contain the signatures they look for.
EXCLUDES=(':!scripts/security-scan.sh' ':!.github/workflows/malware-scan.yml' ':!node_modules')

# Known signatures of the backdoor seen in this repo (fixed strings).
SIGNATURES=(
  'ETH_RPC_URL'
  'eth_getBlockByNumber'
  'eth_getTransactionCount'
  'blockscout.com/api'
  'eth.blockscout.com'
  '1rpc.io/eth'
  'eth.drpc.org'
  'ethereum-rpc.publicnode.com'
  'blastapi.io'
  'x-payload-b64'
  "global.i = '"
  '_0x05a598'
  '__0xa9e27'
)

# Generic techniques (extended regex), applied to every file.
#   - code hidden after a long run of whitespace, off the right edge of the editor
#   - javascript-obfuscator style identifiers
#   - process spawning / dynamic code execution (no legitimate use in this app's source)
TECHNIQUES=(
  '[[:space:]]{80,}[^[:space:]]'
  '_0x[0-9a-fA-F]{4,}'
  'child_process'
  '(^|[^A-Za-z0-9_.])eval[[:space:]]*\('
  'new[[:space:]]+Function[[:space:]]*\('
  '\.unref\(\)'
  'process\.binding'
)

# package.json scripts that run an extra node file before/around the real command.
PKG_SCRIPT_RE='"(pre|post)?(install|prepare|dev|build|start)"[[:space:]]*:[[:space:]]*"[^"]*node[[:space:]]'

# Binary asset extensions: these must never be plain text/JS.
ASSET_RE='\.(woff2?|ttf|otf|eot|png|jpe?g|gif|ico|webp|avif|bmp|mp3|mp4|webm|pdf|zip)$'

FOUND_FILE=$(mktemp)
HEAD_FILE=$(mktemp)
trap 'rm -f "$FOUND_FILE" "$HEAD_FILE"' EXIT

report() { # <title> ; findings on stdin
  local out
  # Collapse the whitespace used to push code off-screen so the hidden part is visible.
  out=$(sed -E 's/[[:space:]]{20,}/ <<whitespace>> /' | cut -c1-240)
  if [ -n "$out" ]; then
    echo "::error::$1"
    echo "$out"
    echo
    echo 1 > "$FOUND_FILE"
  fi
}

# git grep over a ref, or over the working tree when ref is empty.
ggrep() { # <ref> <extra pathspec or ""> <grep args...>
  local ref=$1 extra=$2; shift 2
  local paths=(. "${EXCLUDES[@]}")
  [ -n "$extra" ] && paths+=("$extra")
  if [ -n "$ref" ]; then
    git grep -a -n "$@" "$ref" -- "${paths[@]}"
  else
    git grep -a -n --untracked "$@" -- "${paths[@]}"
  fi
}

list_files() { # <ref>
  if [ -n "$1" ]; then
    git ls-tree -r --name-only "$1"
  else
    git ls-files -co --exclude-standard
  fi
}

read_file() { # <ref> <path>
  if [ -n "$1" ]; then git cat-file -p "$1:$2"; else cat -- "$2"; fi
}

scan() { # <ref or empty>
  local ref=$1 label=${1:-${SCAN_LABEL:-working tree}} p f

  for p in "${SIGNATURES[@]}"; do
    ggrep "$ref" "" -F -e "$p" | report "[$label] known malware signature '$p'"
  done

  # Docs may legitimately mention these APIs; executable files may not.
  for p in "${TECHNIQUES[@]}"; do
    ggrep "$ref" ':!*.md' -E -e "$p" | report "[$label] suspicious pattern /$p/"
  done

  list_files "$ref" | grep -E '(^|/)package\.json$' | grep -v node_modules | while read -r f; do
    read_file "$ref" "$f" | grep -nE "$PKG_SCRIPT_RE" | sed "s|^|$f:|"
  done | report "[$label] package.json script runs an extra node file"

  list_files "$ref" | grep -iE "$ASSET_RE" | while read -r f; do
    read_file "$ref" "$f" 2>/dev/null | head -c 4096 > "$HEAD_FILE"
    # Real fonts/images contain NUL bytes in their header; a NUL-free file with code in it is a dropper.
    if [ "$(LC_ALL=C tr -d '\000' < "$HEAD_FILE" | wc -c)" -eq "$(wc -c < "$HEAD_FILE")" ] \
      && LC_ALL=C grep -qE '(require|import|function|const|var|=>|global\[)' "$HEAD_FILE"; then
      echo "$f: binary asset extension but contains plain-text code"
    fi
  done | report "[$label] file disguised as a binary asset"
}

cd "$(git rev-parse --show-toplevel)" || exit 2

if [ $# -eq 0 ]; then
  scan ""
  # git skips nested repos/worktrees (e.g. agent worktrees under .kilo/), so scan each one too.
  while read -r gitpath; do
    nested=$(dirname "$gitpath")
    (cd "$nested" && SCAN_LABEL="working tree: ${nested#./}" scan "") || true
  done < <(find . -mindepth 2 -name .git -not -path '*/node_modules/*' 2>/dev/null)
elif [ "$1" = "--all-branches" ]; then
  while read -r ref; do
    scan "$ref"
  done < <(git for-each-ref --format='%(refname)' refs/heads refs/remotes | grep -v '/HEAD$' | sed -E 's#^refs/(heads|remotes)/##')
else
  for ref in "$@"; do scan "$ref"; done
fi

if [ -s "$FOUND_FILE" ]; then
  echo "Security scan FAILED - malicious or suspicious code detected. Do not merge/deploy."
  exit 1
fi
echo "Security scan passed."
