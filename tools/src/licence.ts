import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ACCEPTED_LICENCES: ReadonlySet<string> = new Set([
  "AGPL-3.0",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
  "GPL-3.0",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "LGPL-3.0",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MPL-2.0",
  "0BSD",
  "Unlicense",
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
]);

export function licenceCheck(dir: string): { ok: boolean; errors: string[] } {
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) return { ok: false, errors: ["no readable manifest.json"] };

  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch {
    return { ok: false, errors: ["no readable manifest.json"] };
  }

  const license = typeof manifest === "object" && manifest !== null
    ? (manifest as { license?: unknown }).license
    : undefined;
  const value = String(license);
  const errors: string[] = [];
  if (!ACCEPTED_LICENCES.has(value)) {
    errors.push(`licence ${value} is not an accepted AGPL-3.0-compatible SPDX id`);
  } else if (!value.startsWith("AGPL-3.0") && !existsSync(join(dir, "LICENSE")) && !existsSync(join(dir, "LICENSE.md"))) {
    errors.push(`${value} package needs its LICENSE file beside manifest.json`);
  }
  return { ok: errors.length === 0, errors };
}
