# Changelog

All notable changes to the MaiPai catalog. Format follows
[Keep a Changelog](https://keepachangelog.com); versions follow semver.
Everything stays `0.x` until the product passes its battle-tested
checklist; no release has been cut yet.

## [Unreleased]

### Added
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
  as Markdown.
- The engine index: `engines/index.json`, the signed list of pinned
  engine builds MaiPai Stack installs from, with its builder.
- Public CI on pull requests and tags running the same `check.sh` a
  contributor runs locally.
- The first packages: the `info`, `fun` and `utilities` plugins and the
  `family` skill that ship bundled with MaiPai Home.
