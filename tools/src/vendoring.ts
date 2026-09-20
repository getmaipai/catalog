import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const VENDORED_DIR_NAMES = ["node_modules", "vendor", "vendored", "third_party", "third-party", "external"];
const MINIFIED_SUFFIXES = [".min.js", ".min.css", ".bundle.js"];
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".css", ".sh"];
const OWNERSHIP_MARKERS = ["maipai", "jesse torres"];

function readFirstLines(path: string, count: number): string[] {
  try {
    const lines = readFileSync(path, "utf-8").split("\n");
    return lines.slice(0, count);
  } catch {
    return [];
  }
}

function findOwnershipHolder(line: string): string | null {
  const match = line.match(/(?:copyright|©|\(c\))\s+(.*)$/i);
  if (!match || !match[1]) return null;
  return match[1].trim();
}

function readPackageAuthor(dir: string): string | null {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf-8"));
    if (typeof manifest === "object" && manifest !== null && typeof manifest.author === "string") {
      return manifest.author;
    }
  } catch {
    return null;
  }
  return null;
}

export function vendoringScan(dir: string): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const author = readPackageAuthor(dir);
  const allowedOwners = [...OWNERSHIP_MARKERS];
  if (author) allowedOwners.push(author.toLowerCase());

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
        if (VENDORED_DIR_NAMES.includes(entry)) {
          errors.push(`vendored directory ${rel}`);
          continue;
        }
        walk(full);
        continue;
      }
      const lower = entry.toLowerCase();
      if (MINIFIED_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
        errors.push(`minified or bundled file ${rel}`);
        continue;
      }
      if (lower.endsWith("package.json")) {
        try {
          const pkg = JSON.parse(readFileSync(full, "utf-8"));
          if (
            typeof pkg === "object" &&
            pkg !== null &&
            ("bundledDependencies" in pkg || "bundleDependencies" in pkg)
          ) {
            errors.push(`bundled dependencies in ${rel}`);
          }
        } catch {
          // unparsable package.json is not this scan's concern
        }
        continue;
      }
      if (SOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        for (const line of readFirstLines(full, 40)) {
          const holder = findOwnershipHolder(line);
          if (!holder) continue;
          const trimmed = holder.toLowerCase();
          if (!allowedOwners.some((allowed) => trimmed.includes(allowed))) {
            errors.push(`foreign copyright header in ${rel}: ${line.trim()}`);
          }
        }
      }
    }
  }

  walk(dir);
  return { ok: errors.length === 0, errors };
}
