# Agent guide: building a MaiPai package

This file is what an AI agent (human-directed or autonomous) reads before
proposing a package here. It is a placeholder: the package-writing skills
it should link to (a `new-package`-style scaffolder scoped to this repo,
manifest and recipe linters runnable locally, the conformance fixture
runner) do not exist in this repo yet. Today, use the org's
[`new-package`](https://github.com/getmaipai/.github/blob/main/plugin/skills/new-package/SKILL.md)
plugin skill and
[docs/PACKAGES.md](https://github.com/getmaipai/.github/blob/main/docs/PACKAGES.md)
in `.github` for the manifest format and the bronze-tier definition of
done.

## The shape of a conforming package

One directory, one manifest, one format for every kind (`plugin`,
`skill`, `app`, `companion`, `integration`, `model`, `wakeword`, `voice`,
`theme`). Start
at Tier 0 (a recipe or a prompt body) unless the logic genuinely cannot be
expressed that way. See `docs/dev.md` in this repo for the target
directory layout.

## Before proposing anything

1. Check `docs/dev.md`'s review queue: if this rebuilds or redesigns a
   legacy feature, its one-line verdict must already be recorded there.
2. Confirm the package reaches bronze (tests, five-plus routing examples,
   a privacy row per data source, stated offline behavior, a smoke test,
   README and changelog, lint clean) before opening a PR.
3. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [ASSIGNMENT.md](ASSIGNMENT.md).

This file grows as the catalog's own tooling (`tools/`) lands.
