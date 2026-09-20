# Contributing to the MaiPai catalog

This repo works differently from the rest of the `getmaipai` org: it is the
one place that accepts pull requests. Every other repo takes direct commits
from the maintainer only.

- **Packages, not patches.** A contribution here is almost always a new
  package (`plugins/`, `skills/`, `apps/`, `companions/`, `integrations/`,
  `models/`, `wakewords/`, `voices/`) or a fix to an existing one, not a
  change to core.
  See
  [docs/PACKAGES.md](https://github.com/getmaipai/.github/blob/main/docs/PACKAGES.md)
  in `.github` for the manifest format and the definition of done (bronze
  tier is the publish gate).
- **Sign the assignment first.** Every merge requires the signed copyright
  assignment in [ASSIGNMENT.md](ASSIGNMENT.md). No exceptions, however
  small the patch. Open your PR; a maintainer will point you to the
  assignment step before review starts. Once you have signed, a maintainer
  records your GitHub login in `signers.json` with the date and the assignment
  version; the CLA job on every pull request checks that file and leaves a note
  on your pull request with the steps if your login is not there yet. Nothing
  else changes on your side.
- **The gate has to be green, locally before you open the PR and in
  CI after.** `bash scripts/check.sh` from the repo root runs the
  tools' typecheck and tests, then `check` over every package
  (manifest and recipe lint, the scorecard, the vendoring scan, the
  licence check, the banned-API scan), then the org's standards core
  (gitleaks, the PII wordlist, the prose lint, the licence file).
  `cd tools && bun run check` runs the package half alone. What
  `check` prints is what a maintainer reads first; a red line there
  is answered before a human reviews anything. `cd tools && bun run check
  -- --only plugins/<category>/<id>` checks one package while you work on it.
- **Still to come, not yet enforced:** the permission-diff comment on
  a PR, recipe conformance on both interpreters, the speech lint, and
  screenshot generation with vision review of store images. They are
  listed in `docs/BACKLOG.md` under Tooling; a PR is not blocked on
  them today.
- **Trademarks and platform names stay out of ids and branding.** See the
  Trademarks section of
  [`CLAUDE.md`](https://github.com/getmaipai/.github/blob/main/CLAUDE.md)
  in `.github`. A package that names a compatible service descriptively is
  fine; one that borrows its logo, colors, or branded name is not.
- **A companion's prompt may not weaken the safety layer.** This is checked
  by the bypass suite, not by review discretion.

Bugs and ideas that are not yet a package can still go through a plain
GitHub Issue.

Full org standards live in
[`CLAUDE.md`](https://github.com/getmaipai/.github/blob/main/CLAUDE.md) and
[`STACK.md`](https://github.com/getmaipai/.github/blob/main/STACK.md) in
`.github`; this file only covers what differs here.
