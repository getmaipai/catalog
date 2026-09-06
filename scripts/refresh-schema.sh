#!/usr/bin/env bash
# Refreshes schema/ from a sibling `home` checkout's spec/ (docs/dev.md's
# own "mirrored from home/spec/, not hand-edited here"). A maintainer-side
# script, not part of CI - a contributor's package PR never touches this,
# and CI runs against whatever schema/ already has committed. Regenerates
# home's own gitignored schemas.resolved/ (the cross-repo $ref already
# rewritten to a local file, home/spec/scripts/bundle-schemas.ts's own
# job) and copies just the four files a package's manifest/recipe/result
# actually conform to - not the full 15-schema household-record set,
# which a package never touches.
set -euo pipefail
cd "$(dirname "$0")/.."

HOME_DIR="${MAIPAI_HOME_DIR:-../home}"
if [ ! -d "$HOME_DIR/spec" ]; then
  echo "missing a home checkout with spec/ at $HOME_DIR (set MAIPAI_HOME_DIR to override)"
  exit 1
fi

(cd "$HOME_DIR/spec" && bun run scripts/bundle-schemas.ts)

for f in manifest.schema.json recipe.schema.json result.schema.json privacy-row.schema.json settings-key.schema.json; do
  cp "$HOME_DIR/spec/schemas.resolved/$f" "schema/$f"
done

echo "schema/ refreshed from $HOME_DIR/spec/schemas.resolved/"
