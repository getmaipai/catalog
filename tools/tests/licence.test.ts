import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ACCEPTED_LICENCES, licenceCheck } from "../src/licence";

function withPackage(license: string, files: Record<string, string> = {}, manifest = true): string {
  const dir = mkdtempSync(join(tmpdir(), "maipai-catalog-licence-test-"));
  if (manifest) writeFileSync(join(dir, "manifest.json"), JSON.stringify({ license }));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

function check(license: string, files: Record<string, string> = {}, manifest = true): ReturnType<typeof licenceCheck> {
  const dir = withPackage(license, files, manifest);
  try {
    return licenceCheck(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("licenceCheck", () => {
  test("AGPL-3.0 passes without a LICENSE file", () => {
    expect(check("AGPL-3.0")).toEqual({ ok: true, errors: [] });
  });

  test("MIT passes with a LICENSE file", () => {
    expect(check("MIT", { LICENSE: "MIT" })).toEqual({ ok: true, errors: [] });
  });

  test("MIT without a LICENSE file fails", () => {
    expect(check("MIT")).toEqual({ ok: false, errors: ["MIT package needs its LICENSE file beside manifest.json"] });
  });

  test("GPL-2.0 fails the accepted SPDX rule", () => {
    expect(check("GPL-2.0")).toEqual({ ok: false, errors: ["licence GPL-2.0 is not an accepted AGPL-3.0-compatible SPDX id"] });
  });

  test("lowercase agpl-3.0 fails the accepted SPDX rule", () => {
    expect(check("agpl-3.0")).toEqual({ ok: false, errors: ["licence agpl-3.0 is not an accepted AGPL-3.0-compatible SPDX id"] });
  });

  test("a missing manifest fails the readable manifest rule", () => {
    expect(check("AGPL-3.0", {}, false)).toEqual({ ok: false, errors: ["no readable manifest.json"] });
  });

  test("the accepted licence set has exactly 20 entries", () => {
    expect(ACCEPTED_LICENCES.size).toBe(20);
  });
});
