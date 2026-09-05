<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/getmaipai/.github/main/brand/maipai-brand-logo-dark.png">
    <img src="https://raw.githubusercontent.com/getmaipai/.github/main/brand/maipai-brand-logo-light.png" alt="MaiPai" width="360">
  </picture>
</p>

<h3 align="center">The MaiPai package catalog.</h3>

<p align="center">Documentation · <a href="https://github.com/getmaipai/home">Home</a> · <a href="https://github.com/getmaipai/bot">Bot</a></p>

Every plugin, skill, app, companion, integration, model, wake word,
voice, and theme for your hub and robot, in one signed catalog you review
and install with one click.

## Status

Pre-code. This repo is the seeded skeleton from the platform plan: repo
structure, licensing, and the standards pin are in place; the lint, pack,
sign, index, and scorecard tooling, and the first packages themselves, are
not built yet. See [docs/dev.md](docs/dev.md) for the design record and
the current step-0 checklist.

## What will live here

- `plugins/`, `skills/`, `apps/`, `companions/`, `integrations/`,
  `models/`, `wakewords/`, `voices/`: one directory per package, one
  manifest format for every kind.
- `schema/`: mirrored from `home/spec/`, the shapes every package's
  manifest and recipe conform to.
- `tools/`: the lint, pack, sign, index, and scorecard tooling, and the
  `check` CLI a contributor runs before proposing a package.

## Contributing

This is the one repo in the org that accepts pull requests. Every merge
needs a signed copyright assignment (`ASSIGNMENT.md`) and a green CI run.
See `CONTRIBUTING.md` and `AGENTS.md` once they land; both are placeholders
today.

## Development

See [docs/dev.md](docs/dev.md) for the design record. `scripts/check.sh`
runs the pinned `@maipai/standards` core; it needs a sibling checkout of
`getmaipai/.github`.

---

MaiPai is open-source software for personal, self-hosted, non-commercial
use by you and your household. It is not affiliated with, endorsed by, or
sponsored by any platform it can connect to. All product names and
trademarks belong to their respective owners. You are responsible for
complying with the terms and laws that apply to you and the services you
access.

Licensed under [AGPL-3.0](LICENSE).
