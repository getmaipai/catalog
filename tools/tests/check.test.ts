import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findPackages, checkPackage, checkAll } from "../src/check";

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "maipai-catalog-check-test-"));
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

function writeManifest(dir: string, id: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ id, kind: "companion", display: id }));
}

describe("findPackages", () => {
  test("finds a two-deep package under plugins/<category>/<id>/", () => {
    writeManifest(join(repoRoot, "plugins", "utilities", "weather"), "weather");
    const found = findPackages(repoRoot);
    expect(found).toEqual([join(repoRoot, "plugins", "utilities", "weather")]);
  });

  test("finds a one-deep package under apps/<id>/", () => {
    writeManifest(join(repoRoot, "apps", "storytime"), "storytime");
    const found = findPackages(repoRoot);
    expect(found).toEqual([join(repoRoot, "apps", "storytime")]);
  });

  test("an empty kind directory contributes nothing", () => {
    mkdirSync(join(repoRoot, "plugins"), { recursive: true });
    expect(findPackages(repoRoot)).toEqual([]);
  });

  test("every kind directory absent (a fresh clone before any content) is not an error", () => {
    expect(findPackages(repoRoot)).toEqual([]);
  });
});

describe("checkPackage", () => {
  test("a package with no other files fails lint (and so fails overall, regardless of scorecard)", () => {
    const dir = join(repoRoot, "apps", "bare");
    writeManifest(dir, "bare");
    const result = checkPackage(dir);
    expect(result.passing).toBe(false);
    expect(result.lintErrors.length).toBeGreaterThan(0);
  });
});

describe("checkAll", () => {
  test("reports one result per discovered package", () => {
    writeManifest(join(repoRoot, "apps", "one"), "one");
    writeManifest(join(repoRoot, "companions", "two"), "two");
    const results = checkAll(repoRoot);
    expect(results.length).toBe(2);
    expect(results.every((r) => r.passing === false)).toBe(true);
  });
});
