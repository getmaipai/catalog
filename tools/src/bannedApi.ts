import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The package handler sandbox rule (CONTRIBUTING.md line 19,
// .github/docs/PACKAGES.md line 72): a handler runs with no network, no
// process spawn, no environment and no writes; anything it needs comes
// through the host. These patterns catch the calls that would only work
// outside that sandbox.
export const BANNED_APIS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "eval", pattern: /\beval\s*\(/ },
  { name: "Function constructor", pattern: /\bnew\s+Function\s*\(/ },
  { name: "direct fetch", pattern: /(?<![\w.$])fetch\s*\(/ },
  { name: "WebSocket", pattern: /\bnew\s+WebSocket\s*\(/ },
  { name: "Deno.Command", pattern: /\bDeno\.Command\b/ },
  { name: "Deno.run", pattern: /\bDeno\.run\b/ },
  { name: "Deno.env", pattern: /\bDeno\.env\b/ },
  { name: "Deno.connect", pattern: /\bDeno\.(connect|listen|connectTls)\b/ },
  { name: "Deno file write", pattern: /\bDeno\.(writeFile|writeTextFile|remove|mkdir|rename|copyFile)\b/ },
  { name: "child_process", pattern: /["']node:child_process["']|["']child_process["']/ },
  { name: "process.env", pattern: /\bprocess\.env\b/ },
  { name: "Bun runtime", pattern: /\bBun\./ },
  { name: "remote import", pattern: /\bimport\s*\(\s*["']https?:\/\// },
];

const SCANNED_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs"];
const TEST_SUFFIXES = [".test.ts", "_test.ts", ".test.js", "_test.js"];
// Directories the vendoring scan already refuses; do not descend into
// them (vendoring.ts's VENDORED_DIR_NAMES).
const VENDORED_DIR_NAMES = ["node_modules", "vendor", "vendored", "third_party", "third-party", "external"];
// A line ending with this marker documents a deliberate exception and is
// skipped, so a package can name the rule it is allowing.
const ALLOW_MARKER = "// banned-api: allow";

function scanFile(path: string, rel: string): string[] {
  let lines: string[];
  try {
    lines = readFileSync(path, "utf-8").split("\n");
  } catch {
    return [];
  }
  const errors: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw: string = lines[i] ?? "";
    if (raw.trim().endsWith(ALLOW_MARKER)) continue;
    // Strip a trailing // comment first; a // inside a string is out of
    // scope for this scan, so a // directly after a ':' (a URL scheme) is
    // left in place and only a bare comment-start // is cut.
    const hash = raw.indexOf("//");
    const line =
      hash === -1 || raw[hash - 1] === ":"
        ? raw
        : raw.slice(0, hash);
    for (const { name, pattern } of BANNED_APIS) {
      if (pattern.test(line)) {
        errors.push(`banned API ${name} in ${rel}:${i + 1}`);
      }
    }
  }
  return errors;
}

export function bannedApiScan(dir: string): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  function walk(current: string): void {
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry);
      const rel = full.slice(dir.length + 1);
      let isDir: boolean;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        if (VENDORED_DIR_NAMES.includes(entry)) continue;
        walk(full);
        continue;
      }
      const lower = entry.toLowerCase();
      if (SCANNED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        if (TEST_SUFFIXES.some((suffix) => lower.endsWith(suffix))) continue;
        errors.push(...scanFile(full, rel));
      }
    }
  }

  walk(dir);
  return { ok: errors.length === 0, errors };
}
