#!/usr/bin/env bash
# Worktree workflow for this repo (start, tmux, port, check, land, done, reap, tier).
# The logic is one shared script, getmaipai/.github standards/bin/wt.sh; this wrapper
# only says what is specific to this repo and runs it. The shared script is read from
# the sibling .github checkout's origin/main (never its working tree, which may be
# stale or mid-edit); `start` and `land` fetch it first. MAIPAI_WT_SHARED=<file>
# overrides the source.
set -euo pipefail

export WT_INSTALL_DIRS="tools"
export WT_T2_GLOBS="signers.json tools/src/sign.ts tools/src/cla.ts tools/src/licence.ts tools/src/bannedApi.ts tools/src/permission-diff.ts tools/src/vendoring.ts tools/src/pack.ts tools/src/lint.ts scripts/*"
export WT_TEST_WORKSPACES="tools"
common="$(git rev-parse --git-common-dir)"
case "$common" in /*) ;; *) common="$(cd "$common" && pwd)" ;; esac
std="$(cd "$common/.." && pwd)/../.github"

if [[ -n "${MAIPAI_WT_SHARED:-}" ]]; then exec bash "$MAIPAI_WT_SHARED" "$@"; fi
[[ -d "$std/.git" || -f "$std/.git" ]] || { echo "wt: getmaipai/.github is missing at $std; clone it next to this repo and retry." >&2; exit 1; }
case "${1:-}" in start|land) git -C "$std" fetch -q origin main 2>/dev/null || echo "wt: could not fetch .github; using its last known origin/main." >&2;; esac
shared="$(mktemp)"
trap 'rm -f "$shared"' EXIT
git -C "$std" show origin/main:standards/bin/wt.sh > "$shared" 2>/dev/null || { echo "wt: .github has no standards/bin/wt.sh on origin/main; fetch it and retry." >&2; exit 1; }
bash "$shared" "$@"
