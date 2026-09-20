import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasSigned, loadSigners } from "../src/cla";

function fixture(signers: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "maipai-catalog-cla-test-"));
  const path = join(dir, "signers.json");
  writeFileSync(path, JSON.stringify({ assignment_version: "1", maintainers: ["JesseWebDotCom"], signers }));
  return path;
}

describe("CLA", () => {
  test("maintainer and current signer pass", () => {
    const path = fixture([{ login: "Alice", signed: "2026-09-20", version: "1" }]);
    try { const data = loadSigners(path); expect(hasSigned(data, "jessewebdotcom")).toBe(true); expect(hasSigned(data, "ALICE")).toBe(true); } finally { rmSync(path, { force: true }); }
  });
  test("old version and unknown login fail", () => {
    const path = fixture([{ login: "Old", signed: "2026-09-20", version: "0" }]);
    expect(() => loadSigners(path)).toThrow("unsupported assignment version");
    const valid = fixture([]); try { const data = loadSigners(valid); expect(hasSigned(data, "nobody")).toBe(false); } finally { rmSync(valid, { force: true }); }
  });
  test("duplicate login refuses to load", () => {
    const path = fixture([{ login: "jessewebdotcom", signed: "2026-09-20", version: "1" }]);
    try { expect(() => loadSigners(path)).toThrow("duplicate logins"); } finally { rmSync(path, { force: true }); }
  });
  test("CLI returns signed and not-signed exit codes", () => {
    const signed = Bun.spawnSync(["bun", "run", "src/cla.ts", "--", "JesseWebDotCom"], { cwd: join(import.meta.dir, "..") });
    expect(signed.exitCode).toBe(0);
    expect(signed.stdout.toString().trim()).toBe("signed");
    const unknown = Bun.spawnSync(["bun", "run", "src/cla.ts", "--", "stranger"], { cwd: join(import.meta.dir, "..") });
    expect(unknown.exitCode).toBe(1);
    expect(unknown.stderr.toString().trim()).toBe("not signed: stranger must sign ASSIGNMENT.md");
  });
});
