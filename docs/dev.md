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

As of this seed, the directories exist and are empty. Nothing has been
built yet; the first content is whatever survives the review queue below,
starting with the packages hub v0.1 bundles.

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
- [ ] `tools/` (lint, pack, sign, index, scorecard): not started; needed
      before any package can publish.
- [ ] `AGENTS.md`, `ASSIGNMENT.md`, `CONTRIBUTING.md`: placeholders only;
      full text still to write.
- [ ] The TUF signed index (`root`, `targets`, `timestamp`): not started;
      this is Hub v0.2 per the roadmap.
- [ ] The first packages: blocked on Hub v0.1's default bundled set being
      reviewed and built first (packages ship bundled with the release
      before this catalog's store exists).

## Review queue

Every legacy hub feature and legacy robot plugin gets a one-line verdict
here before it becomes a package: rebuild as designed, redesign, merge, or
drop, with the reason. Empty until the legacy review pass runs (platform
plan section 5.8, open item in section 15).

| Legacy feature | Source | Verdict | Reason |
|---|---|---|---|
| _(none reviewed yet)_ | | | |
