import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Manifest, PrivacyRow } from "../src/permission-diff";
import { permissionDiff, renderPermissionDiff, toJsonReport } from "../src/permission-diff";

function manifest(fields: Partial<Manifest> = {}): Manifest {
  return { id: "example", version: "0.1.0", ...fields };
}

function rows(dest: string, extra: Partial<PrivacyRow> = {}): PrivacyRow[] {
  return [{ id: dest, destination: dest, when: "on request", what: "the place", who: "the service", opt_in: true, retention: "1 day", ...extra }];
}

describe("permissionDiff", () => {
  test("an added and a removed permission", () => {
    const diff = permissionDiff(
      manifest({ permissions: ["net:a", "net:b"] }),
      manifest({ permissions: ["net:b", "net:c"] }),
    );
    expect(diff.addedPermissions).toEqual(["net:c"]);
    expect(diff.removedPermissions).toEqual(["net:a"]);
    expect(diff.empty).toBe(false);
  });

  test("a new package marks everything added", () => {
    const diff = permissionDiff(null, manifest({ permissions: ["net:a"], min_role: "child", platforms: ["home"] }));
    expect(diff.addedPermissions).toEqual(["net:a"]);
    expect(diff.minRole).toEqual({ from: "(none)", to: "child" });
    expect(diff.empty).toBe(false);
  });

  test("a removed package marks everything removed", () => {
    const diff = permissionDiff(manifest({ permissions: ["net:a"], platforms: ["home"] }), null);
    expect(diff.removedPermissions).toEqual(["net:a"]);
    expect(diff.removedPlatforms).toEqual(["home"]);
    expect(diff.empty).toBe(false);
  });

  test("min_role adult to child is flagged, child to adult is not", () => {
    const young = permissionDiff(manifest({ min_role: "adult" }), manifest({ min_role: "child" }));
    expect(young.minRole).toEqual({ from: "adult", to: "child" });
    expect(renderPermissionDiff([{ dir: "p", diff: young }])).toContain("(review closely)");

    const older = permissionDiff(manifest({ min_role: "child" }), manifest({ min_role: "adult" }));
    expect(older.minRole).toEqual({ from: "child", to: "adult" });
    expect(renderPermissionDiff([{ dir: "p", diff: older }])).not.toContain("(review closely)");
  });

  test("a removed consequential flag is flagged", () => {
    const diff = permissionDiff(manifest({ consequential: true }), manifest({ consequential: false }));
    expect(diff.consequential).toEqual({ from: true, to: false });
    expect(renderPermissionDiff([{ dir: "p", diff }])).toContain("(review closely)");
  });

  test("a changed data-source row is keyed by destination", () => {
    const before = manifest({ data_sources: rows("api.example.com", { when: "on request" }) });
    const after = manifest({ data_sources: rows("api.example.com", { when: "once a day" }) });
    const diff = permissionDiff(before, after);
    expect(diff.changedDataSources).toHaveLength(1);
    expect(diff.changedDataSources[0]?.destination).toBe("api.example.com");
    expect(diff.addedDataSources).toEqual([]);
    expect(diff.removedDataSources).toEqual([]);
  });

  test("an unchanged package renders nothing", () => {
    const a = manifest({ permissions: ["net:a"], min_role: "child", platforms: ["home"] });
    const diff = permissionDiff(a, a);
    expect(diff.empty).toBe(true);
    expect(renderPermissionDiff([{ dir: "p", diff }])).toBe("No permission changes.\n");
  });

  test("JSON reports changed and unchanged packages", () => {
    const changed = permissionDiff(manifest({ permissions: ["net:a"] }), manifest({ permissions: ["net:b"] }));
    const unchanged = permissionDiff(manifest({ permissions: ["net:a"] }), manifest({ permissions: ["net:a"] }));
    const report = toJsonReport([
      { dir: "changed", diff: changed },
      { dir: "unchanged", diff: unchanged },
    ]);
    expect(report.changed).toBe(1);
    expect(report.packages[1]).toMatchObject({ dir: "unchanged", empty: true });
  });

  test("the 'No permission changes.' line when nothing changed", () => {
    expect(renderPermissionDiff([{ dir: "p", diff: permissionDiff(manifest(), manifest()) }])).toBe(
      "No permission changes.\n",
    );
  });

  test("the CLI renders the diff over two roots", async () => {
    const beforeRoot = mkdtempSync(join(tmpdir(), "maipai-catalog-permission-diff-before-"));
    const afterRoot = mkdtempSync(join(tmpdir(), "maipai-catalog-permission-diff-after-"));
    try {
      const pdir = join(beforeRoot, "plugins", "utilities", "example");
      mkdirSync(pdir, { recursive: true });
      writeFileSync(join(pdir, "manifest.json"), JSON.stringify(manifest({ permissions: ["net:a"], min_role: "adult" })));
      const adir = join(afterRoot, "plugins", "utilities", "example");
      mkdirSync(adir, { recursive: true });
      writeFileSync(join(adir, "manifest.json"), JSON.stringify(manifest({ permissions: ["net:b"], min_role: "child" })));

      const proc = Bun.spawn(["bun", "run", "src/permission-diff.ts", "--", beforeRoot, afterRoot], {
        cwd: join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      const code = await proc.exited;
      expect(code).toBe(0);
      expect(stdout).toContain("## Permission changes");
      expect(stdout).toContain("adds permission `net:b` (review closely)");
      expect(stdout).toContain("removes permission `net:a`");
      expect(stdout).toContain("min_role goes from `adult` to `child` (review closely)");
    } finally {
      rmSync(beforeRoot, { recursive: true, force: true });
      rmSync(afterRoot, { recursive: true, force: true });
    }
  });

  test("the CLI emits JSON with --json", async () => {
    const beforeRoot = mkdtempSync(join(tmpdir(), "maipai-catalog-permission-diff-before-"));
    const afterRoot = mkdtempSync(join(tmpdir(), "maipai-catalog-permission-diff-after-"));
    try {
      for (const root of [beforeRoot, afterRoot]) {
        const pdir = join(root, "plugins", "utilities", "example");
        mkdirSync(pdir, { recursive: true });
        writeFileSync(join(pdir, "manifest.json"), JSON.stringify(manifest({ permissions: ["net:a"] })));
      }
      const changedDir = join(afterRoot, "plugins", "utilities", "changed");
      mkdirSync(changedDir, { recursive: true });
      writeFileSync(join(changedDir, "manifest.json"), JSON.stringify(manifest({ permissions: ["net:b"] })));
      const proc = Bun.spawn(["bun", "run", "src/permission-diff.ts", "--json", "--", beforeRoot, afterRoot], {
        cwd: join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      const code = await proc.exited;
      const report = JSON.parse(stdout) as { packages: Array<{ dir: string; empty: boolean }>; changed: number };
      expect(code).toBe(0);
      expect(report.changed).toBe(1);
      expect(report.packages.find((pkg) => pkg.dir.endsWith("example"))?.empty).toBe(true);
      expect(report.packages.find((pkg) => pkg.dir.endsWith("changed"))?.empty).toBe(false);
    } finally {
      rmSync(beforeRoot, { recursive: true, force: true });
      rmSync(afterRoot, { recursive: true, force: true });
    }
  });
});
