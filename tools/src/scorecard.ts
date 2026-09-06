// The scorecard (session-d-packages-and-store.md step 6,
// CONTRIBUTING.md's own "the scorecard is the first gate before a human
// reads anything"): reads a package's own quality_scale.yaml (the shape
// home/backend/packages/*/quality_scale.yaml already established) and
// reports how many bronze/silver/gold criteria are actually met, not
// just claimed by the manifest's own `quality_scale` string.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface Criterion {
  met: boolean;
  note?: string;
  date?: string;
}

interface QualityScale {
  package: string;
  scale: string;
  bronze?: Record<string, Criterion>;
  silver?: Record<string, Criterion>;
  gold?: Record<string, Criterion>;
}

export interface Scorecard {
  package: string;
  bronze: { met: number; total: number; passing: boolean };
  silver: { met: number; total: number };
  gold: { met: number; total: number };
  /** Bronze is the publish gate (docs/PACKAGES.md) - every bronze line
   * must read met: true, or nothing else here matters yet. */
  passing: boolean;
  missing: string[];
}

function tally(tier: Record<string, Criterion> | undefined): { met: number; total: number; missing: string[] } {
  const entries = Object.entries(tier ?? {});
  const missing = entries.filter(([, c]) => !c.met).map(([name]) => name);
  return { met: entries.length - missing.length, total: entries.length, missing };
}

export function scorecard(dir: string): Scorecard {
  const path = join(dir, "quality_scale.yaml");
  if (!existsSync(path)) {
    return { package: dir, bronze: { met: 0, total: 0, passing: false }, silver: { met: 0, total: 0 }, gold: { met: 0, total: 0 }, passing: false, missing: ["quality_scale.yaml is missing"] };
  }
  const scale = Bun.YAML.parse(readFileSync(path, "utf-8")) as QualityScale;
  const bronze = tally(scale.bronze);
  const silver = tally(scale.silver);
  const gold = tally(scale.gold);
  const bronzePassing = bronze.total > 0 && bronze.missing.length === 0;
  return {
    package: scale.package ?? dir,
    bronze: { met: bronze.met, total: bronze.total, passing: bronzePassing },
    silver: { met: silver.met, total: silver.total },
    gold: { met: gold.met, total: gold.total },
    passing: bronzePassing,
    missing: bronze.missing.map((name) => `bronze.${name}`),
  };
}
