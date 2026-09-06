import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scorecard } from "../src/scorecard";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "maipai-catalog-scorecard-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("scorecard", () => {
  test("no quality_scale.yaml at all fails, clearly", () => {
    const result = scorecard(dir);
    expect(result.passing).toBe(false);
    expect(result.missing).toContain("quality_scale.yaml is missing");
  });

  test("every bronze line met passes", () => {
    writeFileSync(
      join(dir, "quality_scale.yaml"),
      `package: test-pkg
scale: bronze
bronze:
  tests_green:
    met: true
  routing_examples:
    met: true
silver:
  diagnostics_and_reauth:
    met: false
`,
    );
    const result = scorecard(dir);
    expect(result.passing).toBe(true);
    expect(result.bronze).toEqual({ met: 2, total: 2, passing: true });
    expect(result.silver).toEqual({ met: 0, total: 1 });
  });

  test("one bronze line unmet fails, and names which one", () => {
    writeFileSync(
      join(dir, "quality_scale.yaml"),
      `package: test-pkg
scale: bronze
bronze:
  tests_green:
    met: true
  smoke_test:
    met: false
`,
    );
    const result = scorecard(dir);
    expect(result.passing).toBe(false);
    expect(result.missing).toEqual(["bronze.smoke_test"]);
  });

  test("an empty bronze block (no criteria at all) never passes by vacuous truth", () => {
    writeFileSync(join(dir, "quality_scale.yaml"), "package: test-pkg\nscale: bronze\nbronze: {}\n");
    const result = scorecard(dir);
    expect(result.passing).toBe(false);
  });
});
