import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findPackages, checkPackage, checkAll, toJsonReport } from "../src/check";

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

  test("a package with a vendor/ directory fails the vendoring scan", () => {
    const dir = join(repoRoot, "apps", "with-vendor");
    writeManifest(dir, "with-vendor");
    mkdirSync(join(dir, "vendor"), { recursive: true });
    writeFileSync(join(dir, "vendor", "lib.js"), "var x = 1;");
    const result = checkPackage(dir);
    expect(result.passing).toBe(false);
    expect(result.vendoringErrors.length).toBeGreaterThan(0);
    expect(result.vendoringErrors.some((e) => e.includes("vendored directory vendor"))).toBe(true);
  });

  test("a package whose manifest names a non-accepted licence fails the licence check", () => {
    const dir = join(repoRoot, "apps", "gpl-two");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({ id: "gpl-two", kind: "companion", display: "gpl-two", license: "GPL-2.0" }),
    );
    const result = checkPackage(dir);
    expect(result.passing).toBe(false);
    expect(result.licenceErrors.length).toBeGreaterThan(0);
  });

  test("a package whose handler.ts contains a bare fetch( fails the banned-API scan", () => {
    const dir = join(repoRoot, "apps", "bare-fetch");
    writeManifest(dir, "bare-fetch");
    writeFileSync(join(dir, "handler.ts"), "export function h() { fetch(url); }\n");
    const result = checkPackage(dir);
    expect(result.passing).toBe(false);
    expect(result.bannedApiErrors.length).toBeGreaterThan(0);
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

  test("--only checks the requested package from two discovered packages", () => {
    writeManifest(join(repoRoot, "apps", "one"), "one");
    writeManifest(join(repoRoot, "companions", "two"), "two");
    const results = checkAll(repoRoot, ["companions/two"]);
    expect(results.map((result) => result.dir)).toEqual([join(repoRoot, "companions", "two")]);
  });

  test("--only rejects an unknown package directory", () => {
    expect(() => checkAll(repoRoot, ["apps/missing"])).toThrow("no package at apps/missing");
  });
});

describe("toJsonReport", () => {
  test("maps package results to the machine-readable shape", () => {
    const packages = [join(repoRoot, "apps", "passing"), join(repoRoot, "apps", "failing")];
    const report = toJsonReport(
      [
        { dir: packages[0]!, passing: true, lintErrors: [], scorecardMissing: [], vendoringErrors: [], licenceErrors: [], bannedApiErrors: [] },
        { dir: packages[1]!, passing: false, lintErrors: [], scorecardMissing: [], vendoringErrors: ["vendored directory vendor"], licenceErrors: [], bannedApiErrors: [] },
      ],
      repoRoot,
    );
    expect(report.total).toBe(2);
    expect(report.passing).toBe(1);
    expect(report.packages[1]!.vendoring.length).toBeGreaterThan(0);
    expect(report.packages[1]!.passing).toBe(false);
  });

  test("the CLI emits one JSON document", async () => {
    const proc = Bun.spawn(["bun", "run", "src/check.ts", "--json"], { cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    const report = JSON.parse(output) as { packages: unknown[]; passing: number; total: number };
    expect(Array.isArray(report.packages)).toBe(true);
    expect(typeof report.passing).toBe("number");
    expect(typeof report.total).toBe("number");
  });

  test("--only with --json reports one package", async () => {
    const packages = findPackages(join(import.meta.dir, "..", ".."));
    const onlyDir = packages[0]!.slice(join(import.meta.dir, "..", "..").length + 1);
    const proc = Bun.spawn(["bun", "run", "src/check.ts", "--only", onlyDir, "--json"], { cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    const report = JSON.parse(output) as { total: number };
    expect(proc.exitCode).toBe(0);
    expect(report.total).toBe(1);
  });

  test("an unknown --only directory exits 1", async () => {
    const proc = Bun.spawn(["bun", "run", "src/check.ts", "--only", "apps/not-real"], { cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
    const error = await new Response(proc.stderr).text();
    await proc.exited;
    expect(proc.exitCode).toBe(1);
    expect(error).toContain("no package at apps/not-real");
  });
});
