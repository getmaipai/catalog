# tools

The catalog's own tooling, run by `scripts/check.sh` and by CI, uses one rule set and never a second copy.

| Module | What it does | Run |
|---|---|---|
| `bannedApi.ts` | Defines patterns for calls that package handlers cannot use inside their sandbox. | library |
| `build-index.ts` | Ties package packing, signing, and index building into the signed artifact a store install needs. | `bun run build-index` |
| `check.ts` | Walks every package, runs lint and scorecard checks, and prints one report. | `bun run check -- --json` or `bun run check -- --only <dir>` |
| `cla.ts` | Loads the signed maintainer and contributor assignment records. | `bun run cla` |
| `engine-index.ts` | Validates and publishes the signed engine index used for installed and available engines. | `bun run src/engine-index.ts -- <outFile> [keysDir]` |
| `index-builder.ts` | Builds the TUF-shaped signed root, targets, and timestamp metadata with rollback and freshness information. | library |
| `licence.ts` | Defines accepted licences and checks package licence declarations. | library |
| `lint.ts` | Validates package manifests and recipes against the schema and checks the bronze package requirements. | library |
| `pack.ts` | Packs a package directory into a deterministic gzipped tarball and computes its SHA-256 digest. | `bun run pack` |
| `permission-diff.ts` | Compares package permissions and privacy data between catalog revisions. | `bun run permission-diff` (add `--json` for one JSON document) |
| `scorecard.ts` | Reads a package quality scale and reports the bronze, silver, and gold criteria it meets. | library |
| `sign.ts` | Generates Ed25519 keypairs and signs or verifies data with native `node:crypto`. | library |
| `vendoring.ts` | Scans source trees for vendored code and ownership or minification markers. | library |

`bun test` runs `tests/`, one file per module.
