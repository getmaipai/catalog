// The catalog's own CI/local entry point (session-d-packages-and-store.md
// step 6): walks every kind directory, finds each real package (a
// directory with its own manifest.json - `<kind>/<category>/<id>/` for
// plugins and skills, `<kind>/<id>/` for the rest, per docs/dev.md's
// "Repo layout"), runs lint.ts and scorecard.ts on each, and prints one
// report. This is the ONE place the rule set runs; a contributor's local
// `bun run check` and the public CI workflow both call this same
// function, never a second copy of what "passing" means (lint.ts's own
// header comment).
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { lintPackage } from "./lint";
import { scorecard } from "./scorecard";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const KIND_DIRS = ["plugins", "skills", "apps", "companions", "integrations", "models", "wakewords", "voices"];

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function subdirs(dir: string): string[] {
  if (!isDir(dir)) return [];
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter(isDir);
}

function hasManifest(dir: string): boolean {
  try {
    statSync(join(dir, "manifest.json"));
    return true;
  } catch {
    return false;
  }
}

/** Finds every real package directory under the repo's kind directories.
 * `plugins/` and `skills/` nest one category level deeper
 * (`plugins/<category>/<id>/`) than the rest (`<kind>/<id>/`) - rather
 * than hardcode that split, a directory counts as a package the moment
 * it has its own manifest.json, and anything without one is walked one
 * level deeper. This also means an empty kind directory (every one of
 * them, before the first package migration) contributes nothing, and a
 * stray non-package directory never gets misread as a category. */
export function findPackages(repoRoot: string): string[] {
  const packages: string[] = [];
  for (const kind of KIND_DIRS) {
    const kindDir = join(repoRoot, kind);
    for (const candidate of subdirs(kindDir)) {
      if (hasManifest(candidate)) {
        packages.push(candidate);
      } else {
        packages.push(...subdirs(candidate).filter(hasManifest));
      }
    }
  }
  return packages;
}

export interface PackageCheckResult {
  dir: string;
  lintErrors: string[];
  scorecardMissing: string[];
  passing: boolean;
}

export function checkPackage(dir: string): PackageCheckResult {
  const lint = lintPackage(dir);
  const score = scorecard(dir);
  return {
    dir,
    lintErrors: lint.errors,
    scorecardMissing: score.missing,
    passing: lint.ok && score.passing,
  };
}

export function checkAll(repoRoot: string): PackageCheckResult[] {
  return findPackages(repoRoot).map(checkPackage);
}

function main(): void {
  const results = checkAll(REPO_ROOT);
  if (results.length === 0) {
    console.log("no packages found yet (every kind directory is still empty) - nothing to check");
    return;
  }

  let failing = 0;
  for (const result of results) {
    const relDir = result.dir.slice(REPO_ROOT.length + 1);
    if (result.passing) {
      console.log(`ok    ${relDir}`);
      continue;
    }
    failing += 1;
    console.log(`FAIL  ${relDir}`);
    for (const error of result.lintErrors) console.log(`        lint: ${error}`);
    for (const missing of result.scorecardMissing) console.log(`        scorecard: ${missing}`);
  }

  console.log(`\n${results.length - failing}/${results.length} packages passing`);
  if (failing > 0) process.exit(1);
}

if (import.meta.main) {
  main();
}
