#!/usr/bin/env bash
# MaiPai Catalog pre-commit gate. Own checks (tools/: typecheck, tests,
# then the lint+scorecard CLI against every package in the repo), then
# the pinned @maipai/standards core.
set -euo pipefail
cd "$(dirname "$0")/.."

SPEC_PIN="0.1.1"
SHARED_DIR="${MAIPAI_SHARED_DIR:-../shared}"
if [ ! -f "$SHARED_DIR/spec/package.json" ]; then
  echo "getmaipai/shared is missing at $SHARED_DIR (set MAIPAI_SHARED_DIR); tools/ imports @maipai/spec from its spec/ workspace."
  exit 1
fi
SPEC_VERSION="$(bun -e 'console.log(JSON.parse(await Bun.file(process.argv[1]).text()).version)' "$SHARED_DIR/spec/package.json")"
if [ "$SPEC_VERSION" != "$SPEC_PIN" ]; then
  echo "@maipai/spec at $SHARED_DIR/spec is version $SPEC_VERSION; this repo pins spec-v$SPEC_PIN. Check out the tag there or move the pin here."
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

STANDARDS_DIR="${MAIPAI_STANDARDS_DIR:-../.github}"
if [ ! -d "$STANDARDS_DIR/standards" ]; then
  echo "missing @maipai/standards checkout at $STANDARDS_DIR (pin std-v0.2.0)"
  exit 1
fi

echo "== standards core (std-v0.2.0)"
bash "$STANDARDS_DIR/standards/bin/check-core.sh" "$(pwd)"

echo "== all checks passed"
