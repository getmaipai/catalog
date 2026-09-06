#!/usr/bin/env bash
# MaiPai Catalog pre-commit gate. Own checks (tools/: typecheck, tests,
# then the lint+scorecard CLI against every package in the repo), then
# the pinned @maipai/standards core.
set -euo pipefail
cd "$(dirname "$0")/.."

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
