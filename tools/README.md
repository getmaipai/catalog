# tools/

The catalog's own tooling, `@maipai/catalog-tools`. A `bun install` here
pulls its dependencies; `bun run check` is what a contributor runs before
proposing a package, and what CI runs on every PR.

- `src/lint.ts`: validates a package directory's `manifest.json` (and,
  for tier-0 plugins, its `recipe.json`) against `../schema/`, and checks
  the rest of the bronze bar: five or more routing examples, a privacy
  row per `net:` permission, banned trademark vocabulary, README,
  CHANGELOG, and a `quality_scale.yaml`.
- `src/scorecard.ts`: reads a package's `quality_scale.yaml` and reports
  how many bronze/silver/gold criteria are actually met, not just claimed.
- `src/pack.ts`: packs a package directory into a deterministic gzipped
  tarball (same content, same bytes, on any machine) and its sha256.
- `src/sign.ts`: Ed25519 keypair generation and raw sign/verify, native
  `node:crypto`.
- `src/index-builder.ts`: builds and signs the TUF-shaped `root.json`,
  `targets.json`, and `timestamp.json`.
- `src/check.ts`: the CLI. Finds every package in the repo, runs lint and
  scorecard on each, and reports pass/fail. `bun run check`.

Run `bun test` for the tool suite itself, `bunx tsc --noEmit` to
typecheck. See `../docs/dev.md` for the repo's own status and
`docs/PACKAGES.md` (in `.github`) for the full package contract these
tools enforce.
