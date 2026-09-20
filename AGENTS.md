# MaiPai Catalog

The public package catalog: every plugin, skill, app, companion,
integration, model, wake word, voice, and theme that runs on the hub or
the robot, as source, with CI, offline signing, and a TUF-style signed
static index published to GitHub Pages. `home` and `bot` install from
this catalog; the hub pushes packages to paired robots.

Org standards apply and are auto-loaded from the parent directory
CLAUDE.md (source:
[getmaipai/.github](https://github.com/getmaipai/.github)). This is the
one repo in the org that accepts community pull requests, gated on the
signed copyright assignment and CI; maintainers still land their own work
directly on `main` like everywhere else.

Full design record, repo layout, and the package-writing guide for
agents proposing a package here: [docs/dev.md](docs/dev.md). Package
definition of done, supply chain, and the CLA:
[docs/PACKAGES.md](https://github.com/getmaipai/.github/blob/main/docs/PACKAGES.md)
in `.github`.

Starting a package: the org's Claude plugin ships a scaffolder, the
`new-package` skill in
[getmaipai/.github](https://github.com/getmaipai/.github/blob/main/plugin/skills/new-package/SKILL.md)
(`/maipai:new-package` in a Claude Code session with the plugin loaded). It writes one directory with a conforming `manifest.json`, the bronze-tier files and the test stub for the kind you name; the routing examples, tests and README content are still yours to write, and `bun run check` in `tools/` is the bar the result has to pass before a pull request.

Commands: `bun run check` in `tools/` runs lint + the scorecard CLI
against every package in the repo (that's the tool a new package needs to
pass, not just its own tests). `bash scripts/check.sh` from the repo root
runs `tools/`'s own typecheck and tests, then that check, then the pinned
`@maipai/standards` core (needs a sibling `getmaipai/.github` checkout,
`../.github` by default, override with `MAIPAI_STANDARDS_DIR`, pinned to
std-v0.2.0).
