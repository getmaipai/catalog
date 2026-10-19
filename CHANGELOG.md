# Changelog

All notable changes to the MaiPai catalog. Format follows
[Keep a Changelog](https://keepachangelog.com); versions follow semver.
Everything stays `0.x` until the product passes its battle-tested
checklist; no release has been cut yet.

## [Unreleased]

### Added
- Splash 1.3.2 for macOS Apple silicon in the engine index, with the verified
  archive pin, hardware admission notes and the offline privacy requirement
  (CODE-STACK-01 C1).
- The model package schema gaps blocking CODE-STACK-01 C2 are recorded in
  `models/README.md`; no unsupported manifest fields were added.
- The repo skeleton: `LICENSE`, `NOTICE`, `README.md`, `CONTRIBUTING.md`,
  `ASSIGNMENT.md`, `AGENTS.md`, the per-kind package directories and
  `scripts/check.sh` pinned to `@maipai/standards`.
- Tooling under `tools/`: manifest and recipe lint, the scorecard, pack,
  sign, the package index builder, and the `check` CLI that runs them
  over every package (`--json` for machines).
- Three supply-chain scans inside `check`: the vendoring scan (copied
  third-party code, minified bundles, foreign copyright headers), the
  licence check (an accepted AGPL-3.0-compatible SPDX id, a LICENSE
  file beside a non-AGPL manifest), and the banned-API scan (thirteen
  calls a sandboxed handler can never make).
- The permission diff: a tool that renders what a change does to a
  package's permissions, data sources, role floor and offline stance
  as Markdown, and the CI job that posts it on every pull request.
- The engine index: `engines/index.json`, the signed list of pinned
  engine builds MaiPai Stack installs from, with its builder.
- The moves pack (PKG-MOVES-01): `moves/index.json`, the signed `moves-index.json` of 80 Pollen emotion clips and 19 dance
  clips pinned by commit revision, sha256 and size, with its `NOTICE`, validator and builder. No clip file is stored here.
- Public CI on pull requests and tags running the same `check.sh` a
  contributor runs locally.
- The first packages: the `info`, `fun` and `utilities` plugins and the
  `family` skill that ship bundled with MaiPai Home.
- The CLA check: `signers.json` (maintainers and signers with the
  assignment version they signed), `tools/src/cla.ts`, and a
  pull-request job that fails for a login that has not signed.
- `check --only <dir>` to check one package while working on it, and
  a CI step summary rendered from `check --json`.
- A CI step summary rendered from `check --json`.
- The engine index accepts only https urls on the projects' own release
  hosts (GitHub and Hugging Face).
- `build-index` publishes the signed engine index beside the package index,
  so a hub verifies engine pins against the same signed site.
- The CLA job tells a contributor how to sign and clears its note once they
  have; `permission-diff --json` for scripts.

### Changed

- The `knowledge` and `media-lookup` plugins' Deno import of zod moved from `npm:zod@4.5.4` to `npm:zod@4.6.5` (b876690, with Home's CHAT-SDK-01: the assistant-ui 0.15.21 floor), so their handlers resolve against the same zod Home bundles.
