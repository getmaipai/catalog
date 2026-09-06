import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lintPackage } from "../src/lint";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "maipai-catalog-lint-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(name: string, content: string): void {
  writeFileSync(join(dir, name), content);
}

const VALID_TIER0_MANIFEST = {
  id: "test-pkg",
  version: "0.1.0",
  kind: "plugin",
  category: "Info",
  display: "Test",
  description: "A test package for the lint suite.",
  author: "MaiPai",
  license: "AGPL-3.0",
  routing: {
    examples: ["one", "two", "three", "four", "five"],
  },
  platforms: ["home"],
  min_role: "child",
  consequential: false,
  offline: "full",
  permissions: [],
  smoke: { kind: "static" },
  min_app: "0.1.0",
  tier: 0,
};

const VALID_RECIPE = {
  id: "test-pkg",
  steps: [{ op: "format", as: "reply", text: "hi" }],
};

function writeValidBronzePackage(overrides: Record<string, unknown> = {}): void {
  write("manifest.json", JSON.stringify({ ...VALID_TIER0_MANIFEST, ...overrides }));
  write("recipe.json", JSON.stringify(VALID_RECIPE));
  write("README.md", "# Test\n");
  write("CHANGELOG.md", "# Changelog\n");
  write("quality_scale.yaml", "package: test-pkg\nscale: bronze\n");
}

describe("lintPackage", () => {
  test("a fully valid bronze package passes clean", () => {
    writeValidBronzePackage();
    const result = lintPackage(dir);
    expect(result).toEqual({ ok: true, errors: [] });
  });

  test("no manifest.json at all fails with a clear message", () => {
    const result = lintPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("no manifest.json");
  });

  test("invalid JSON in manifest.json fails with a clear message, not a crash", () => {
    write("manifest.json", "{ not json");
    const result = lintPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("not valid JSON");
  });

  test("a manifest missing a required field fails schema validation", () => {
    const { author: _author, ...withoutAuthor } = VALID_TIER0_MANIFEST;
    write("manifest.json", JSON.stringify(withoutAuthor));
    const result = lintPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("author"))).toBe(true);
  });

  test("fewer than 5 routing examples fails bronze completeness", () => {
    writeValidBronzePackage({ routing: { examples: ["one", "two"] } });
    const result = lintPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("5 or more"))).toBe(true);
  });

  test("a net: permission with no data_sources row fails", () => {
    writeValidBronzePackage({ permissions: ["net:api.example.com"], data_sources: [] });
    const result = lintPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("data_sources"))).toBe(true);
  });

  test("a net: permission WITH a matching data_sources row passes that check", () => {
    writeValidBronzePackage({
      permissions: ["net:api.example.com"],
      data_sources: [{ id: "example", destination: "example.com", when: "always", what: "nothing", who: "them", opt_in: true, retention: "unknown" }],
    });
    const result = lintPackage(dir);
    expect(result.ok).toBe(true);
  });

  test("a platform name in the package id is refused", () => {
    writeValidBronzePackage({ id: "youtube-lookup" });
    const result = lintPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("youtube"))).toBe(true);
  });

  test("a platform name mentioned descriptively in the description is fine", () => {
    writeValidBronzePackage({ description: "Connects to YouTube to look up video metadata." });
    const result = lintPackage(dir);
    expect(result.ok).toBe(true);
  });

  test("banned trademark phrasing in the description is refused", () => {
    writeValidBronzePackage({ description: "Bypass ads and watch free platform content without limits." });
    const result = lintPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("trademark phrasing"))).toBe(true);
  });

  test("missing README.md, CHANGELOG.md, and quality_scale.yaml are each reported", () => {
    write("manifest.json", JSON.stringify(VALID_TIER0_MANIFEST));
    write("recipe.json", JSON.stringify(VALID_RECIPE));
    const result = lintPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("README.md"))).toBe(true);
    expect(result.errors.some((e) => e.includes("CHANGELOG.md"))).toBe(true);
    expect(result.errors.some((e) => e.includes("quality_scale.yaml"))).toBe(true);
  });

  test("tier 0 with no recipe.json fails", () => {
    write("manifest.json", JSON.stringify(VALID_TIER0_MANIFEST));
    write("README.md", "# Test\n");
    write("CHANGELOG.md", "# Changelog\n");
    write("quality_scale.yaml", "package: test-pkg\n");
    const result = lintPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("no recipe.json"))).toBe(true);
  });

  test("an invalid recipe.json (unknown step op) fails schema validation", () => {
    writeValidBronzePackage();
    write("recipe.json", JSON.stringify({ id: "test-pkg", steps: [{ op: "not-a-real-step" }] }));
    const result = lintPackage(dir);
    expect(result.ok).toBe(false);
  });

  test("tier 1 with no handler.ts fails", () => {
    writeValidBronzePackage({ tier: 1, timeout_ms: 8000, fallback_reply: { text: "sorry" } });
    // A tier 1 package has no recipe.json requirement, but this fixture
    // still writes one from writeValidBronzePackage() - harmless, the
    // linter only requires handler.ts for tier 1, never forbids an
    // unused recipe.json.
    const result = lintPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("handler.ts"))).toBe(true);
  });

  test("a valid tier 1 package (with handler.ts, no recipe.json needed) passes", () => {
    write(
      "manifest.json",
      JSON.stringify({
        ...VALID_TIER0_MANIFEST,
        tier: 1,
        timeout_ms: 8000,
        fallback_reply: { text: "Sorry, that did not work." },
      }),
    );
    write("handler.ts", "// a real Tier 1 package would implement handle() here\n");
    write("README.md", "# Test\n");
    write("CHANGELOG.md", "# Changelog\n");
    write("quality_scale.yaml", "package: test-pkg\n");
    const result = lintPackage(dir);
    expect(result).toEqual({ ok: true, errors: [] });
  });

  test("a kind: skill package needs SKILL.md, not recipe.json - found live linting storytime-style", () => {
    writeValidBronzePackage({ kind: "skill" });
    // writeValidBronzePackage() writes a recipe.json this fixture doesn't
    // need; harmless - a skill having one unused is not itself an error,
    // the same "no unused-file check" posture the rest of this linter has.
    const result = lintPackage(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("SKILL.md"))).toBe(true);
  });

  test("a kind: skill package with SKILL.md passes with no recipe.json at all", () => {
    write("manifest.json", JSON.stringify({ ...VALID_TIER0_MANIFEST, kind: "skill" }));
    write("SKILL.md", "# Test skill\n\nSome instructions.\n");
    write("README.md", "# Test\n");
    write("CHANGELOG.md", "# Changelog\n");
    write("quality_scale.yaml", "package: test-pkg\n");
    const result = lintPackage(dir);
    expect(result).toEqual({ ok: true, errors: [] });
  });
});
