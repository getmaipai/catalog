import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyEnvelope } from "./../src/index-builder";
import { buildIndex, ensureDevSigners, packagesToIndex, type PackageToIndex } from "../src/build-index";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "maipai-catalog-build-index-test-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function writeFixturePackage(dir: string, overrides: Record<string, unknown> = {}): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ id: "fixture", version: "0.1.0", min_app: "0.1.0", permissions: [], requires: [], ...overrides }),
  );
  writeFileSync(join(dir, "README.md"), "# Fixture\n");
}

describe("ensureDevSigners", () => {
  test("generates two distinct keypairs on first use", () => {
    const keysDir = join(workDir, "keys");
    const signers = ensureDevSigners(keysDir);
    expect(existsSync(signers.primary.privateKeyPath)).toBe(true);
    expect(existsSync(signers.secondary.privateKeyPath)).toBe(true);
    expect(readFileSync(signers.primary.publicKeyPath, "utf-8")).not.toBe(readFileSync(signers.secondary.publicKeyPath, "utf-8"));
  });

  test("reuses the same keypair on a second call rather than regenerating it", () => {
    const keysDir = join(workDir, "keys");
    const first = ensureDevSigners(keysDir);
    const firstPem = readFileSync(first.primary.publicKeyPath, "utf-8");
    const second = ensureDevSigners(keysDir);
    expect(readFileSync(second.primary.publicKeyPath, "utf-8")).toBe(firstPem);
  });
});

describe("buildIndex", () => {
  test("packs and signs a real package, producing a targets entry a hub install could verify against", async () => {
    const pkgDir = join(workDir, "src", "fixture");
    writeFixturePackage(pkgDir, { permissions: ["net:example.com"], channel: "beta" });
    const packages: PackageToIndex[] = [{ dir: pkgDir, targetPath: "plugins/utilities/fixture/0.1.0" }];
    const signers = ensureDevSigners(join(workDir, "keys"));

    const built = await buildIndex(packages, join(workDir, "out"), signers);

    const targets = JSON.parse(readFileSync(built.targetsPath, "utf-8"));
    const entry = targets.signed.targets["plugins/utilities/fixture/0.1.0"];
    expect(entry.hashes.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.custom.channel).toBe("beta");
    expect(entry.custom.permissions).toEqual(["net:example.com"]);
    const tarball = built.tarballs["plugins/utilities/fixture/0.1.0"];
    expect(tarball).toBeDefined();
    expect(existsSync(tarball as string)).toBe(true);

    const root = JSON.parse(readFileSync(built.rootPath, "utf-8"));
    const timestamp = JSON.parse(readFileSync(built.timestampPath, "utf-8"));
    const primaryPem = readFileSync(signers.primary.publicKeyPath, "utf-8");
    expect(verifyEnvelope(root, [primaryPem])).toBe(true);
    expect(verifyEnvelope(targets, [primaryPem])).toBe(true);
    expect(verifyEnvelope(timestamp, [primaryPem])).toBe(true);
  });

  test("a rebuild with no content change reproduces the same target hash", async () => {
    const pkgDir = join(workDir, "src", "fixture");
    writeFixturePackage(pkgDir);
    const packages: PackageToIndex[] = [{ dir: pkgDir, targetPath: "plugins/utilities/fixture/0.1.0" }];
    const signers = ensureDevSigners(join(workDir, "keys"));

    const first = await buildIndex(packages, join(workDir, "out1"), signers);
    const second = await buildIndex(packages, join(workDir, "out2"), signers);

    const hashOf = (built: typeof first) =>
      JSON.parse(readFileSync(built.targetsPath, "utf-8")).signed.targets["plugins/utilities/fixture/0.1.0"].hashes.sha256;
    expect(hashOf(second)).toBe(hashOf(first));
  });

  test("clears a stale outDir rather than mixing an old build's leftover files into the new one", async () => {
    const outDir = join(workDir, "out");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "stale-leftover.tgz"), "old content");

    const pkgDir = join(workDir, "src", "fixture");
    writeFixturePackage(pkgDir);
    const signers = ensureDevSigners(join(workDir, "keys"));
    await buildIndex([{ dir: pkgDir, targetPath: "plugins/utilities/fixture/0.1.0" }], outDir, signers);

    expect(existsSync(join(outDir, "stale-leftover.tgz"))).toBe(false);
  });

  // Without this check, the second package's pack silently overwrites
  // the first's targets.json entry (same key) while the first's tarball
  // stays on disk, orphaned - nothing in the index points to it. A
  // caller assembling PackageToIndex[] by hand (home's refresh script)
  // is exactly the case that can make this mistake.
  test("refuses two packages that claim the same target path", async () => {
    const first = join(workDir, "src", "first");
    const second = join(workDir, "src", "second");
    writeFixturePackage(first);
    writeFixturePackage(second);
    const packages: PackageToIndex[] = [
      { dir: first, targetPath: "plugins/utilities/fixture/0.1.0" },
      { dir: second, targetPath: "plugins/utilities/fixture/0.1.0" },
    ];
    const signers = ensureDevSigners(join(workDir, "keys"));
    await expect(buildIndex(packages, join(workDir, "out"), signers)).rejects.toThrow("duplicate target path");
  });

  test("marks source_commit dirty when the package directory has uncommitted changes", async () => {
    const repoDir = join(workDir, "repo");
    const pkgDir = join(repoDir, "plugins", "utilities", "fixture");
    writeFixturePackage(pkgDir);
    execFileSync("git", ["-C", repoDir, "init", "-q"]);
    execFileSync("git", ["-C", repoDir, "add", "-A"]);
    execFileSync("git", ["-C", repoDir, "-c", "user.email=t@t.com", "-c", "user.name=t", "commit", "-q", "-m", "init"]);
    const signers = ensureDevSigners(join(workDir, "keys"));

    const clean = await buildIndex([{ dir: pkgDir, targetPath: "plugins/utilities/fixture/0.1.0" }], join(workDir, "out1"), signers);
    const cleanCommit = JSON.parse(readFileSync(clean.targetsPath, "utf-8")).signed.targets["plugins/utilities/fixture/0.1.0"].custom
      .source_commit;
    expect(cleanCommit).not.toContain("-dirty");

    writeFileSync(join(pkgDir, "README.md"), "# Fixture, edited\n");
    const dirty = await buildIndex([{ dir: pkgDir, targetPath: "plugins/utilities/fixture/0.1.0" }], join(workDir, "out2"), signers);
    const dirtyCommit = JSON.parse(readFileSync(dirty.targetsPath, "utf-8")).signed.targets["plugins/utilities/fixture/0.1.0"].custom
      .source_commit;
    expect(dirtyCommit).toBe(`${cleanCommit}-dirty`);
  });
});

describe("packagesToIndex", () => {
  test("derives each package's target path from its own directory and manifest version", () => {
    const repoRoot = workDir;
    writeFixturePackage(join(repoRoot, "plugins", "utilities", "weather"), { id: "weather", version: "0.2.0" });
    const found = packagesToIndex(repoRoot);
    expect(found).toEqual([{ dir: join(repoRoot, "plugins", "utilities", "weather"), targetPath: "plugins/utilities/weather/0.2.0" }]);
  });
});
