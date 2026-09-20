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
  let text = line.trim();
  if (text.startsWith("<!--")) {
    text = text.slice(4).trim();
  } else {
    for (const prefix of ["//", "#", "/*", "*"]) {
      if (text.startsWith(prefix)) {
        text = text.slice(prefix.length).trim();
        break;
      }
    }
  }
  let marker = "";
  const lower = text.toLowerCase();
  for (const candidate of ["copyright", "(c)", "©"]) {
    if (lower.startsWith(candidate)) {
      marker = candidate;
      break;
    }
  }
  if (!marker) return null;
  let rest = text.slice(marker.length).trim();
  if (rest.toLowerCase().startsWith("(c)")) rest = rest.slice(3).trim();
  if (rest.toLowerCase().startsWith("©")) rest = rest.slice(1).trim();
  rest = rest
    .replace(/^\d{4}(?:\s*[-,]\s*\d{4})*[,(]?/, "")
    .replace(/^[\s,(]+/, "")
    .trim();
  return rest === "" ? null : rest;
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
    if (author) {
      const trimmed = author.toLowerCase().replace(/^[,.\s]+|[,.\s]+$/g, "");
      if (trimmed) allowedOwners.push(trimmed);
    }

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
        if (VENDORED_DIR_NAMES.includes(entry.toLowerCase())) {
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
      if (lower === "package.json") {
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
          const trimmed = holder.toLowerCase().replace(/^[,.\s]+|[,.\s]+$/g, "");
          const commaParts = trimmed
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p !== "");
          if (!commaParts.every((part) => allowedOwners.includes(part))) {
            errors.push(`foreign copyright header in ${rel}: ${line.trim()}`);
          }
        }
      }
    }
  }

  walk(dir);
  return { ok: errors.length === 0, errors };
}
