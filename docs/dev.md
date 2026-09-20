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
tools/           # lint, pack, sign, index, scorecard, the `check` CLI
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
- [x] `tools/` (manifest and recipe lint, the scorecard, pack, sign, the package index builder and `build-index`, the engine index builder, the vendoring, licence and banned-API scans, the permission diff, the CLA check, and the `check` CLI that runs the lint, scorecard and scans over every package, with `--json` and `--only`): built (session-d-packages-and-store.md step 6).
      `scripts/check.sh` runs the full suite, then `check` against every
      package in the repo.
- [x] `AGENTS.md` (repo orientation, org standards pointer) added
      2026-09-06, with `CLAUDE.md` as a one-line `@AGENTS.md` import per
      [code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)'s
      pattern for repos multiple agent tools read. The package-writing
      guide that used to live in `AGENTS.md` moved into "Package-writing
      guide for agents" below.
- [ ] `ASSIGNMENT.md`, `CONTRIBUTING.md`: placeholders only; full text
      still to write.
- [x] The TUF-shaped signed index (`root`, `targets`, `timestamp`, each
      with a monotonic `version`): built. `bun run build-index` (in
      `tools/`) packs, signs, and indexes every package in the repo with
      a local dev keypair. The real maintainer release key (offline,
      Jesse's own future call) is still open.
- [x] The public CI workflow (`.github/workflows/check.yml`): tag- and
      PR-triggered, checks out the pinned `std-v0.2.0` standards ref and
      runs `scripts/check.sh` (session-d-packages-and-store.md step 6).
      Of the fuller CI set docs/PACKAGES.md wants, the vendoring scan, the
      licence check, the banned-API scan and the permission-diff PR comment
      now run (the three scans inside `check`, the comment as its own job);
      screenshot generation with vision review and the CLA check are still
      deferred, so a maintainer-review-plus-CLA merge gate stays manual, and
      a tag-triggered publish to a real online timestamp key does not exist
      yet either.
- [x] The first packages: `define`, `joke`, `trivia`, `weather`,
      `knowledge`, and `storytime-style` moved here from `home`'s
      `backend/packages/` as their canonical source (2026-09-06, step 6);
      all six clear bronze. `home` keeps a signed copy of the default set
      under its own `backend/packages/`, refreshed from here. `recall`,
      `remember`, and the companion packages (`buddy`, `default`, `pal`,
      `tutor`) are still in `home` - not yet at bronze (no
      README/CHANGELOG/quality_scale.yaml/smoke declaration), and not
      this session's packages to complete (see `home`'s own
      `backend/tests/package-bronze.test.ts` for the ownership map).
      They move here once their owning session brings them to bronze.
- [x] [`docs/BACKLOG.md`](BACKLOG.md) added (2026-09-06) - the scannable
      what's-built/what's-missing list per `getmaipai/CLAUDE.md`'s Backlog
      and status standard; feeds the org's status dashboard.
- [x] `schema/` deleted, `@maipai/spec` pinned instead (2026-09-20,
      refocus step 6). `schema/` was a maintainer-refreshed copy of five
      of `home/spec`'s schemas (`scripts/refresh-schema.sh`, deleted with
      it); now that spec moved to `getmaipai/shared` and ships as a real
      `file:` dependency (`tools/package.json`), `tools/src/lint.ts`
      reads `manifest.schema.json`/`recipe.schema.json`/
      `settings-key.schema.json` straight from the installed package's
      own `schemas/`, no local copy to fall stale or a refresh step to
      remember before a release. The one cross-repo `$ref`
      (`manifest.schema.json`'s `data_sources[]` → `@maipai/standards`'
      `PrivacyRow`) resolves from the sibling `getmaipai/.github`
      checkout this repo's `check.sh` already requires
      (`MAIPAI_STANDARDS_DIR`, `../.github` default) - every schema now
      registers under its own real `$id`, so Ajv's built-in `$ref`
      resolution does the work the old mirror's manual bare-filename
      rewrite used to. `result.schema.json` was never actually read by
      `lint.ts`; not carried forward. `scripts/check.sh` gained a
      `SPEC_PIN` check (`$SHARED_DIR/spec/package.json`'s version must
      equal `0.1.1`), matching `home`'s own `CORE_PIN`/`UI_PIN`/
      `SPEC_PIN` pattern - the "honesty of the pin" contract every
      `shared` consumer carries (`shared/docs/dev.md`, "How a consumer
      pins a workspace"). CI (`.github/workflows/check.yml`) gained a
      `getmaipai/shared` checkout pinned to `spec-v0.1.1` at `../shared`
      (a true sibling of the catalog checkout, since `file:` deps are a
      real relative filesystem path bun resolves at install time, not
      an env-var override like the standards checkout above) -
      unverified against a live run as of this commit, confirm on the
      first real CI trigger.
- [x] `@maipai/spec`'s pin moved to a per-tag worktree (SHARED-PIN-01,
      2026-09-20): `tools/package.json`'s `file:` path now names
      `../../shared-tags/spec-spec-v0.1.1/spec` directly instead of the
      shared sibling checkout, and `scripts/check.sh` resolves it via
      `getmaipai/shared`'s own `scripts/ensure-tag.sh` before install -
      the mutable-checkout bug that replaced (one session's tag change
      under `../shared` silently detaching every other consumer reading
      it) is `home/docs/dev.md`'s "Pins moved to per-tag worktrees", the
      same day. `scripts/check.sh` also checks that `tools/package.json`'s
      `file:` path actually names the same tag as its own `SPEC_TAG` (a
      review caught the two being able to silently drift otherwise, since
      the worktree-version check alone never reads `package.json`).
      Bumping the pin: edit `SPEC_TAG` in `scripts/check.sh` and the
      matching `file:` path in `tools/package.json`, then a plain `bun
      install` in `tools/` to refresh `bun.lock` - `check.sh`'s own `bun
      install --frozen-lockfile` won't do that step for you. CI's shared
      checkout changed from a shallow single-tag `ref: spec-v0.1.1`
      checkout to `fetch-tags: true` on `shared`'s default branch, since
      `ensure-tag.sh` needs a real `git worktree add` against a
      resolvable `refs/tags/spec-v0.1.1` - `actions/checkout@v4`'s own
      `action.yml` documents `fetch-tags` defaulting to `false` (checked
      directly), so a shallow ref-only checkout couldn't be trusted to
      leave that ref resolvable, and `fetch-tags: true` at the default
      shallow depth is tried first over `fetch-depth: 0`'s full history
      (a real, growing transfer cost this repo doesn't otherwise pay) -
      to be confirmed live immediately after this commit lands, via a
      throwaway PR (`ci-verify/shared-pin`, closed unmerged, branch
      deleted after) rather than assumed; a follow-up commit switches to
      `fetch-depth: 0` if the shallow fetch doesn't leave the tag
      resolvable for `git worktree add`.

## Package-writing guide for agents

What an AI agent (human-directed or autonomous) should read before
proposing a package here. Use the org's
[`new-package`](https://github.com/getmaipai/.github/blob/main/plugin/skills/new-package/SKILL.md)
plugin skill and
[docs/PACKAGES.md](https://github.com/getmaipai/.github/blob/main/docs/PACKAGES.md)
in `.github` for the manifest format and the bronze-tier definition of
done; run this repo's own `tools/` (lint, pack, sign, index, scorecard,
the `check` CLI, described above) locally before opening a PR.
Run `bun run check` in `tools/` before a pull request; `bun run check --
--only <kind>/<category>/<id>` checks one package while you work on it.

The shape of a conforming package: one directory, one manifest, one
format for every kind (`plugin`, `skill`, `app`, `companion`,
`integration`, `model`, `wakeword`, `voice`, `theme`). Start at Tier 0 (a
recipe or a prompt body) unless the logic genuinely cannot be expressed
that way. See "Repo layout" above for the target directory layout.

Before proposing anything:

1. Check the review queue below: if this rebuilds or redesigns a legacy
   feature, its one-line verdict must already be recorded there.
2. Confirm the package reaches bronze (tests, five-plus routing examples,
   a privacy row per data source, stated offline behavior, a smoke test,
   README and changelog, lint clean) before opening a PR.
3. Read [CONTRIBUTING.md](../CONTRIBUTING.md) and
   [ASSIGNMENT.md](../ASSIGNMENT.md).

## Review queue

The knowledge handler reports fetch failures as `network_unreachable` so
the host can choose the manifest's fallback reply. This preserves Home's
existing behavior in the canonical catalog source. The registered handler
is exported for the package's offline regression test; it uses a rejected
host request and never fetches live data.

Every legacy hub feature and legacy robot plugin gets a one-line verdict
here before it becomes a package: rebuild as designed, redesign, merge, or
drop, with the reason. Empty until the legacy review pass runs (platform
plan section 5.8, open item in section 15).

| Legacy feature | Source | Verdict | Reason |
|---|---|---|---|
| _(none reviewed yet)_ | | | |
