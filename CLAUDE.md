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

Commands: `bun run check` in `tools/` runs lint + the scorecard CLI
against every package in the repo (that's the tool a new package needs to
pass, not just its own tests). `bash scripts/check.sh` from the repo root
runs `tools/`'s own typecheck and tests, then that check, then the pinned
`@maipai/standards` core (needs a sibling `getmaipai/.github` checkout,
`../.github` by default, override with `MAIPAI_STANDARDS_DIR`, pinned to
std-v0.2.0).
