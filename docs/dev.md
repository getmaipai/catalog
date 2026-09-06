# MaiPai Catalog: design record

Seeded 2026-09-03 from the platform plan (`purring-chasing-noodle.md`,
chapters 1 and 5). This is the dev-tier design doc: architecture, the why,
and the review-queue ledger this repo will accumulate as packages are
built. It grows from here; nothing below is final code, only the shape the
first packages build toward.

## What this repo is

The public package catalog: every plugin, skill, app, companion,
integration, model, wake word, voice, and theme that runs on the hub or
the robot, as source, with CI, offline signing, and a TUF-style signed
static index published to GitHub Pages. `home` and `bot` install from
this catalog; the hub pushes packages to paired robots. Full contract:
[docs/PACKAGES.md](https://github.com/getmaipai/.github/blob/main/docs/PACKAGES.md)
in `.github`.

## Repo layout (target shape)

```
plugins/<category>/<id>/
skills/<category>/<id>/
apps/<id>/
companions/<id>/
integrations/<id>/
models/<id>/
wakewords/<id>/
voices/<id>/
schema/          # mirrored from home/spec/, not hand-edited here
tools/           # lint, pack, sign, index, scorecard, the `check` CLI
AGENTS.md        # package-writing skills so an agent produces a conforming package
ASSIGNMENT.md    # the copyright assignment contributors sign
CONTRIBUTING.md
```

As of this seed, the directories exist and are empty; see "Step 0 status"
below for what has landed since.

## The one PR carve-out

This is the only repo in the org that accepts pull requests, gated on the
signed copyright assignment (`ASSIGNMENT.md`) and CI. Maintainers still
land their own work directly on `main`. See
[`CLAUDE.md`](https://github.com/getmaipai/.github/blob/main/CLAUDE.md) >
Git workflow.

## Step 0 status

- [x] Repo created, public, with LICENSE (AGPL-3.0), NOTICE, this design
      record, and `scripts/check.sh` pinned to `@maipai/standards`
      std-v0.2.0.
- [x] `tools/` (lint, pack, sign, index-builder, scorecard, check,
      build-index): built (session-d-packages-and-store.md step 6).
      `scripts/check.sh` runs the full suite, then `check` against every
      package in the repo.
- [ ] `AGENTS.md`, `ASSIGNMENT.md`, `CONTRIBUTING.md`: placeholders only;
      full text still to write.
- [x] The TUF-shaped signed index (`root`, `targets`, `timestamp`, each
      with a monotonic `version`): built. `bun run build-index` (in
      `tools/`) packs, signs, and indexes every package in the repo with
      a local dev keypair. The real maintainer release key (offline,
      Jesse's own future call) is still open.
- [x] The public CI workflow (`.github/workflows/check.yml`): tag- and
      PR-triggered, checks out the pinned `std-v0.2.0` standards ref and
      runs `scripts/check.sh` (session-d-packages-and-store.md step 6).
      The fuller CI feature set docs/PACKAGES.md eventually wants (a
      permission-diff PR comment, a vendoring scan, screenshot
      generation with vision review, the CLA check) is real, deferred
      scope beyond "running the same check" - a maintainer-review-plus-
      CLA merge gate is manual until then, and a tag-triggered publish
      to a real online timestamp key doesn't exist yet either.
- [x] The first packages: `define`, `joke`, `trivia`, `weather`,
      `knowledge`, and `storytime-style` moved here from `home`'s
      `backend/packages/` as their canonical source (2026-09-06, step 6);
      all six clear bronze. `home` keeps a signed copy of the default set
      under its own `backend/packages/`, refreshed from here. `recall`,
      `remember`, and the companion packages (`buddy`, `default`, `pal`,
      `tutor`) are still in `home` - not yet at bronze (no
      README/CHANGELOG/quality_scale.yaml/smoke declaration), and not
      this session's packages to complete (see `home`'s own
      `spec/tests/ts/package-bronze.test.ts` for the ownership map).
      They move here once their owning session brings them to bronze.
- [x] [`docs/BACKLOG.md`](BACKLOG.md) added (2026-09-06) - the scannable
      what's-built/what's-missing list per `getmaipai/CLAUDE.md`'s Backlog
      and status standard; feeds the org's status dashboard.

## Review queue

Every legacy hub feature and legacy robot plugin gets a one-line verdict
here before it becomes a package: rebuild as designed, redesign, merge, or
drop, with the reason. Empty until the legacy review pass runs (platform
plan section 5.8, open item in section 15).

| Legacy feature | Source | Verdict | Reason |
|---|---|---|---|
| _(none reviewed yet)_ | | | |
