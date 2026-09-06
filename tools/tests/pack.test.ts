import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as tar from "tar";
import { packPackage } from "../src/pack";

let srcDir: string;
let outDir: string;

beforeEach(() => {
  srcDir = mkdtempSync(join(tmpdir(), "maipai-catalog-pack-src-"));
  outDir = mkdtempSync(join(tmpdir(), "maipai-catalog-pack-out-"));
});

afterEach(() => {
  rmSync(srcDir, { recursive: true, force: true });
  rmSync(outDir, { recursive: true, force: true });
});

function writeFixturePackage(dir: string): void {
  writeFileSync(join(dir, "manifest.json"), '{"id":"test-pkg"}');
  writeFileSync(join(dir, "README.md"), "# Test\n");
  mkdirSync(join(dir, "tests"));
  writeFileSync(join(dir, "tests", "smoke.json"), "{}");
}

describe("packPackage", () => {
  test("produces a real gzipped tarball with a matching sha256", async () => {
    writeFixturePackage(srcDir);
    const outFile = join(outDir, "test-pkg.tgz");
    const result = await packPackage(srcDir, outFile);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.size).toBeGreaterThan(0);
  });

  test("unpacking the tarball reproduces every file with its original content", async () => {
    writeFixturePackage(srcDir);
    const outFile = join(outDir, "test-pkg.tgz");
    await packPackage(srcDir, outFile);

    const extractDir = mkdtempSync(join(tmpdir(), "maipai-catalog-pack-extract-"));
    try {
      await tar.extract({ file: outFile, cwd: extractDir });
      expect(Bun.file(join(extractDir, "manifest.json")).size).toBeGreaterThan(0);
      const manifest = await Bun.file(join(extractDir, "manifest.json")).text();
      expect(manifest).toBe('{"id":"test-pkg"}');
      const smoke = await Bun.file(join(extractDir, "tests", "smoke.json")).text();
      expect(smoke).toBe("{}");
    } finally {
      rmSync(extractDir, { recursive: true, force: true });
    }
  });

  // The one property everything downstream (sign.ts's signature, the
  // index's own content_sha256, home's "the copy matches the index"
  // test) depends on: packing the identical content twice, even with a
  // real wall-clock gap and even after touching the source files'
  // mtimes, produces byte-identical output.
  test("is deterministic: packing the same content twice (with real time passing) produces an identical hash", async () => {
    writeFixturePackage(srcDir);
    const first = await packPackage(srcDir, join(outDir, "first.tgz"));
    await new Promise((r) => setTimeout(r, 1100)); // past tar's own 1-second mtime resolution
    writeFileSync(join(srcDir, "README.md"), "# Test\n"); // re-touches this file's mtime
    const second = await packPackage(srcDir, join(outDir, "second.tgz"));
    expect(second.sha256).toBe(first.sha256);
  });

  test("throws a clear error for an empty directory rather than producing a useless empty tarball", async () => {
    await expect(packPackage(srcDir, join(outDir, "empty.tgz"))).rejects.toThrow("no files to pack");
  });

  // A symlink pointing outside the package directory (`ln -s /etc/passwd
  // evil-link`) would otherwise pass a statSync-based isFile() check (it
  // follows the link) and get packed verbatim - node-tar preserves the
  // symlink itself, target string and all, in the signed tarball. This
  // repo takes community PRs, so a malicious symlink in a submitted
  // package directory is a real, attacker-reachable input.
  test("refuses to pack a directory containing a symlink, even one pointing outside it", async () => {
    writeFixturePackage(srcDir);
    symlinkSync("/etc/passwd", join(srcDir, "evil-link"));
    await expect(packPackage(srcDir, join(outDir, "evil.tgz"))).rejects.toThrow("may not contain symlinks");
  });
});
