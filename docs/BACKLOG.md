# Backlog

What's missing to go from "the repo skeleton exists" to a real catalog other
repos install from and outside contributors can send packages to. This is a
scannable list, not a narrative: full reasoning lives in `docs/dev.md`, or
the relevant standard in `getmaipai/.github`. Update this file whenever a gap
closes or a new one is found; don't let it drift from what `main` actually
does.

Rough size tags: **S** (a session or less), **M** (a real slice, days),
**L** (a platform-level capability, needs its own design pass first).

Checked 2026-09-06 against the real repo tree and `tools/` source, not
against README.md or CHANGELOG.md at the repo root, both of which are stale
(still say "no tooling, no packages" after `tools/` and the first six
packages landed).

## Supply-chain tooling (`tools/`)

- [x] **Lint** (`tools/src/lint.ts`, tested) - manifest/recipe shape
      checking.
- [x] **Pack** (`tools/src/pack.ts`, tested)
- [x] **Sign** (`tools/src/sign.ts`, tested) - local dev keypair only; the
      real offline maintainer release key doesn't exist yet (Jesse's own
      future call, noted in `docs/dev.md`'s Step 0 status).
- [x] **Index builder + build-index CLI** (`tools/src/index-builder.ts`,
      `tools/src/build-index.ts`, both tested) - produces a TUF-shaped
      signed index (`root`/`targets`/`timestamp`, monotonic `version`).
- [x] **Scorecard** (`tools/src/scorecard.ts`, tested)
- [x] **`check` CLI** (`tools/src/check.ts`, tested) - `scripts/check.sh`
      runs this against every package in the repo.
- [x] **Public CI** (`.github/workflows/check.yml`) - tag- and PR-triggered,
      checks out pinned `std-v0.2.0` and runs `scripts/check.sh`.
- [ ] **Permission-diff PR comment** (M) - `CONTRIBUTING.md` promises this
      as a CI gate; no code for it in `tools/src/`.
- [ ] **Banned-API scan** (M) - same: promised in `CONTRIBUTING.md`, not in
      `tools/src/`.
- [ ] **Vendoring scan** (S-M) - not in `tools/src/`.
- [ ] **Screenshot generation + vision review of store images** (M-L) - not
      in `tools/src/`; no screenshot pipeline exists in this repo at all.
- [ ] **Licence check** (S-M) - not in `tools/src/`.
- [ ] **Real online timestamp/release signing key** (M) - `sign.ts` only
      has a local dev keypair path; no tag-triggered publish to a real key.
- [ ] **CLA-signature bot: check a contributor signed `ASSIGNMENT.md` once,
      then gate future PRs automatically** (M) - `ASSIGNMENT.md` itself
      says "not yet wired up"; nothing in `tools/` reads or records a
      signature.

## Packages: plugins (Tier 0/1)

- [x] **`define`, `weather`** (Tier 0, recipe-based) - `plugins/utilities/`,
      each with `manifest.json`, `recipe.json`, `tests/`,
      `quality_scale.yaml`, `README.md`, `CHANGELOG.md`. Bronze per
      `docs/dev.md`.
- [x] **`joke`, `trivia`** (Tier 0, recipe-based) - `plugins/fun/`, same
      file set, bronze.
- [x] **`knowledge`** (Tier 1, sandboxed `handler.ts` + `handler_test.ts`,
      not a shared recipe interpreter) - `plugins/info/knowledge/`, bronze.
- [ ] **`recall`, `remember`** (M) - still live in `home/backend/packages/`,
      not yet moved here; not at bronze there either (no
      README/CHANGELOG/`quality_scale.yaml`/smoke declaration per `home`'s
      own `package-bronze.test.ts`). Move once their owning session in
      `home` brings them to bronze.

## Packages: skills (plain-instruction, no independent permissions)

- [x] **`storytime-style`** (`skills/family/storytime-style/`, has
      `SKILL.md` plus the standard manifest/README/CHANGELOG/
      quality_scale set) - the one real example proving the `skill` kind
      works end to end.
- [ ] **Any other skill** (S per skill) - none exist. `skills/README.md` is
      the only other file under `skills/`.

## Packages: companions

- [ ] **Any companion package** (M each) - `companions/` holds only a
      placeholder `README.md`, directory otherwise empty. The four
      bundled companions (`default`, `buddy`, `pal`, `tutor`) exist in
      `home` today (its own spec/manifest work, 2026-09-05) but have not
      moved here; none are at bronze yet by `home`'s own package-bronze
      test.

## Packages: apps

- [ ] **Any app package** (M each) - `apps/` is a placeholder `README.md`
      only.

## Packages: integrations

- [ ] **Any integration package** (M each) - `integrations/` is a
      placeholder `README.md` only.

## Packages: models

- [ ] **Any model package** (S-M each, mostly metadata + checksum) -
      `models/` is a placeholder `README.md` only.

## Packages: wakewords

- [ ] **Any wakeword package** (M each) - `wakewords/` is a placeholder
      `README.md` only.

## Packages: voices

- [ ] **Any voice package** (M each) - `voices/` is a placeholder
      `README.md` only.

## Governance and contributor flow

- [ ] **`ASSIGNMENT.md` legal review** (S, Jesse's call, not code) - the
      file states plainly it is a draft, not yet reviewed, and nothing can
      merge under it until he says it's ready.
- [ ] **`AGENTS.md` real package-scaffolder link** (S-M) - today it just
      points contributors at the org's general `new-package` skill and
      `docs/PACKAGES.md`; it says explicitly it will grow once this repo's
      own tooling lands, which it now partly has (`tools/` exists) but
      `AGENTS.md` hasn't been updated to reference it yet.
- [ ] **Refresh `README.md` and `CHANGELOG.md`** (S) - both still describe
      "no tooling, no packages," which is no longer true; drifted from
      `docs/dev.md`.

## Review queue

Empty (`docs/dev.md`'s own table has zero rows) - the legacy hub/robot
plugin review pass (platform plan section 5.8) hasn't run against this
repo yet.
