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
  assignment step before review starts.
- **CI has to be green.** Manifest lint, the permission diff, a banned-API
  scan, recipe conformance, the speech and prose lints, the PII wordlist, a
  licence check, a vendoring scan, and screenshot generation with vision
  review of any store images, plus the scorecard. No review SLA is
  promised; the scorecard is the first gate before a human reads anything.
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
