import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vendoringScan } from "../src/vendoring";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "maipai-catalog-vendoring-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(name: string, content: string): void {
  const path = join(dir, name);
  mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  writeFileSync(path, content);
}

const MANIFEST = {
  id: "vendoring-test",
  version: "0.1.0",
  kind: "plugin",
  category: "Info",
  display: "Vendoring Test",
  description: "A test package for the vendoring suite.",
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

function writeMinimalManifest(overrides: Record<string, unknown> = {}): void {
  write("manifest.json", JSON.stringify({ ...MANIFEST, ...overrides }));
}

describe("vendoringScan", () => {
  test("a nested node_modules directory is flagged without descending into it", () => {
    writeMinimalManifest();
    write("node_modules/x/index.js", "module.exports = 1;");
    const result = vendoringScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "vendored directory node_modules/x/index.js" || e.includes("vendored directory node_modules"))).toBe(true);
  });

  test("a minified file is flagged", () => {
    writeMinimalManifest();
    write("lib.min.js", "var a=1;");
    const result = vendoringScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "minified or bundled file lib.min.js")).toBe(true);
  });

  test("a foreign copyright header in a source file is flagged", () => {
    writeMinimalManifest();
    write("helper.ts", "// Copyright (c) 2021 Someone Else\nexport const x = 1;\n");
    const result = vendoringScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.startsWith("foreign copyright header in helper.ts"))).toBe(true);
  });

  test("a package.json with bundledDependencies is flagged", () => {
    writeMinimalManifest();
    write("package.json", JSON.stringify({ name: "vendoring-test", version: "1.0.0", bundledDependencies: ["dep"] }));
    const result = vendoringScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "bundled dependencies in package.json")).toBe(true);
  });

  test("a copyright header naming the manifest's author passes", () => {
    writeMinimalManifest({ author: "Jesse Torres" });
    write("helper.ts", "// Copyright (c) 2021 Jesse Torres\nexport const x = 1;\n");
    const result = vendoringScan(dir);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("a clean package (the real plugins/info/knowledge tree) passes", () => {
    const src = join(import.meta.dir, "..", "..", "plugins", "info", "knowledge");
    const entries = readdirSync(src);
    for (const entry of entries) {
      copyFileSync(join(src, entry), join(dir, entry));
    }
    const result = vendoringScan(dir);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

