#!/usr/bin/env bash
# MaiPai Catalog pre-commit gate. Own checks (tools/: typecheck, tests,
# then the lint+scorecard CLI against every package in the repo), then
# the pinned @maipai/standards core.
set -euo pipefail
cd "$(dirname "$0")/.."

# @maipai/spec's pin, a full commons tag name (not a bare version),
# resolved to its own immutable per-tag worktree via getmaipai/commons's
# scripts/ensure-tag.sh (SHARED-PIN-01, 2026-09-20) instead of reading
# whatever the commons/ checkout itself happens to have checked out -
# that checkout is one mutable directory, and reading it directly let
# one session's tag change silently detach every other consumer's
# install underneath it (found live in home; see home/docs/dev.md,
# "Pins moved to per-tag worktrees"). Bumping the pin: edit the tag
# string here AND the matching file: path in tools/package.json (a
# review caught that checking only the worktree's own version, never
# whether tools/package.json's file: path actually names this same
# tag, lets the two silently drift - so that's checked too, below),
# then a plain `bun install` in tools/ to refresh bun.lock (this step's
# own `bun install --frozen-lockfile` won't do that for you - it fails
# loud instead if the lockfile's still stale).
SPEC_TAG="spec-v0.1.1"
COMMONS_REPO="${MAIPAI_COMMONS_DIR:-../commons}"
# `-f .../scripts/ensure-tag.sh`, not just `-d`: a directory that
# exists but isn't really getmaipai/commons (wrong path, stale copy)
# would otherwise fall through to ensure-tag.sh's own "unknown tag"
# error, which reads like a missing-tag problem rather than a
# missing-repo one.
if [ ! -f "$COMMONS_REPO/scripts/ensure-tag.sh" ]; then
  echo "getmaipai/commons is missing at $COMMONS_REPO (set MAIPAI_COMMONS_DIR); tools/ imports @maipai/spec from its spec/ workspace."
  exit 1
fi
# Plain (logical) cd+pwd on purpose, not `cd -P`/`realpath`: a symlinked
# `commons` (CI's own sibling-checkout workaround, see check.yml) keeps
# its ".." resolving back to the symlink's own containing directory in
# bash's default logical mode, which is exactly what lines up with
# tools/package.json's lexical "../../commons-tags/..." (bun resolves
# `file:` paths as plain string joins, never dereferencing symlinks
# either) - swapping this for a physical-path resolution would silently
# point the two at different directories in CI only.
COMMONS_REPO="$(cd "$COMMONS_REPO" && pwd)"

SPEC_DIR="$(bash "$COMMONS_REPO/scripts/ensure-tag.sh" spec "$SPEC_TAG")"
if [ ! -f "$SPEC_DIR/spec/package.json" ]; then
  echo "$SPEC_TAG's worktree at $SPEC_DIR has no spec/package.json - check the tag."
  exit 1
fi
SPEC_VERSION="$(bun -e 'console.log(JSON.parse(await Bun.file(process.argv[1]).text()).version)' "$SPEC_DIR/spec/package.json")"
EXPECTED_SPEC_VERSION="${SPEC_TAG#spec-v}"
if [ "$SPEC_VERSION" != "$EXPECTED_SPEC_VERSION" ]; then
  echo "@maipai/spec at $SPEC_DIR/spec is version $SPEC_VERSION, but its own tag is $SPEC_TAG - the tag was cut against the wrong commit in getmaipai/commons."
  exit 1
fi

# The doubled "spec-spec-v..." here is deliberate, not a typo:
# ensure-tag.sh's own worktree naming is `<workspace>-<tag>`
# (`commons/scripts/ensure-tag.sh` line 34), and `spec`'s tags already
# carry a `spec-` prefix of their own - confirmed live against the
# real worktree this session created (`commons-tags/spec-spec-v0.1.1`),
# not just read off the script.
EXPECTED_SPEC_DEPENDENCY="file:../../commons-tags/spec-$SPEC_TAG/spec"
ACTUAL_SPEC_DEPENDENCY="$(bun -e 'console.log(JSON.parse(await Bun.file(process.argv[1]).text()).dependencies["@maipai/spec"])' tools/package.json)"
if [ "$ACTUAL_SPEC_DEPENDENCY" != "$EXPECTED_SPEC_DEPENDENCY" ]; then
  echo "tools/package.json's @maipai/spec dependency is $ACTUAL_SPEC_DEPENDENCY, but SPEC_TAG here is $SPEC_TAG - update tools/package.json to $EXPECTED_SPEC_DEPENDENCY (they must name the same tag) and re-run bun install in tools/."
  exit 1
fi

echo "== tools: install"
(cd tools && bun install --frozen-lockfile)

echo "== tools: typecheck"
(cd tools && bun run lint)

echo "== tools: tests"
(cd tools && bun test)

echo "== tools: check (lint + scorecard, every package)"
(cd tools && bun run check)

STANDARDS_REPO="${MAIPAI_STANDARDS_DIR:-../.github}"
STD_TAG="std-v0.3.0"
if [ ! -x "$STANDARDS_REPO/standards/bin/ensure-tag.sh" ]; then
  echo "getmaipai/.github is missing at $STANDARDS_REPO or older than std-v0.3.0 (set MAIPAI_STANDARDS_DIR to a checkout that has standards/bin/ensure-tag.sh)"
  exit 1
fi
STANDARDS_DIR="$(bash "$STANDARDS_REPO/standards/bin/ensure-tag.sh" "$STD_TAG")"
export MAIPAI_STANDARDS_DIR="$STANDARDS_DIR"
if [ "$(cat "$STANDARDS_DIR/standards/VERSION")" != "${STD_TAG#std-v}" ]; then
  echo "@maipai/standards at $STANDARDS_DIR is $(cat "$STANDARDS_DIR/standards/VERSION"), but the tag is $STD_TAG"
  exit 1
fi

echo "== standards core ($STD_TAG)"
bash "$STANDARDS_DIR/standards/bin/check-core.sh" "$(pwd)"

echo "== all checks passed"
