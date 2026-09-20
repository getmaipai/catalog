import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findPackages } from "./check";

/** The parsed manifest.json object, typed minimally to the fields the diff covers. */
export interface Manifest {
  id: string;
  version: string;
  permissions?: string[];
  data_sources?: Array<PrivacyRow>;
  min_role?: string;
  consequential?: boolean;
  offline?: string;
  platforms?: string[];
}

/** A privacy-row schema row (destination keys the row in the diff). */
export interface PrivacyRow {
  id: string;
  destination: string;
  when?: string;
  what?: string;
  who?: string;
  opt_in?: boolean;
  retention?: string;
}

export interface PermissionDiff {
  empty: boolean;
  addedPermissions: string[];
  removedPermissions: string[];
  addedDataSources: PrivacyRow[];
  removedDataSources: PrivacyRow[];
  changedDataSources: Array<{ destination: string; before: PrivacyRow; after: PrivacyRow }>;
  minRole?: { from: string; to: string };
  consequential?: { from: boolean; to: boolean };
  offline?: { from: string; to: string };
  addedPlatforms: string[];
  removedPlatforms: string[];
}

const ROLE_ORDER = ["guest", "child", "teen", "adult", "admin", "owner"];

function roleIndex(role: string): number {
  const i = ROLE_ORDER.indexOf(role);
  return i === -1 ? ROLE_ORDER.length : i;
}

function sorted(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function rowKey(row: PrivacyRow): string {
  return row.destination;
}

export function permissionDiff(before: Manifest | null, after: Manifest | null): PermissionDiff {
  const diff: PermissionDiff = {
    empty: false,
    addedPermissions: [],
    removedPermissions: [],
    addedDataSources: [],
    removedDataSources: [],
    changedDataSources: [],
    addedPlatforms: [],
    removedPlatforms: [],
  };

  const beforePermissions = new Set(before?.permissions ?? []);
  const afterPermissions = new Set(after?.permissions ?? []);
  for (const p of afterPermissions) if (!beforePermissions.has(p)) diff.addedPermissions.push(p);
  for (const p of beforePermissions) if (!afterPermissions.has(p)) diff.removedPermissions.push(p);
  diff.addedPermissions = sorted(diff.addedPermissions);
  diff.removedPermissions = sorted(diff.removedPermissions);

  const beforeRows = new Map<string, PrivacyRow>();
  for (const row of before?.data_sources ?? []) beforeRows.set(rowKey(row), row);
  const afterRows = new Map<string, PrivacyRow>();
  for (const row of after?.data_sources ?? []) afterRows.set(rowKey(row), row);
  for (const [key, row] of afterRows) {
    const prev = beforeRows.get(key);
    if (prev === undefined) {
      diff.addedDataSources.push(row);
    } else if (JSON.stringify(prev) !== JSON.stringify(row)) {
      diff.changedDataSources.push({ destination: key, before: prev, after: row });
    }
  }
  for (const [key, row] of beforeRows) {
    if (!afterRows.has(key)) diff.removedDataSources.push(row);
  }
  diff.addedDataSources.sort((a, b) => a.destination.localeCompare(b.destination));
  diff.removedDataSources.sort((a, b) => a.destination.localeCompare(b.destination));
  diff.changedDataSources.sort((a, b) => a.destination.localeCompare(b.destination));

  if (before?.min_role !== undefined && after?.min_role !== undefined) {
    if (before.min_role !== after.min_role) {
      diff.minRole = { from: before.min_role, to: after.min_role };
    }
  } else if (before?.min_role !== undefined) {
    diff.minRole = { from: before.min_role, to: "(none)" };
  } else if (after?.min_role !== undefined) {
    diff.minRole = { from: "(none)", to: after.min_role };
  }
  if (before?.consequential !== undefined && after?.consequential !== undefined) {
    if (before.consequential !== after.consequential) {
      diff.consequential = { from: before.consequential, to: after.consequential };
    }
  } else if (before?.consequential !== undefined) {
    diff.consequential = { from: before.consequential, to: false };
  } else if (after?.consequential !== undefined) {
    diff.consequential = { from: false, to: after.consequential };
  }
  if (before?.offline !== undefined && after?.offline !== undefined) {
    if (before.offline !== after.offline) {
      diff.offline = { from: before.offline, to: after.offline };
    }
  } else if (before?.offline !== undefined) {
    diff.offline = { from: before.offline, to: "(none)" };
  } else if (after?.offline !== undefined) {
    diff.offline = { from: "(none)", to: after.offline };
  }

  const beforePlatforms = new Set(before?.platforms ?? []);
  const afterPlatforms = new Set(after?.platforms ?? []);
  for (const p of afterPlatforms) if (!beforePlatforms.has(p)) diff.addedPlatforms.push(p);
  for (const p of beforePlatforms) if (!afterPlatforms.has(p)) diff.removedPlatforms.push(p);
  diff.addedPlatforms = sorted(diff.addedPlatforms);
  diff.removedPlatforms = sorted(diff.removedPlatforms);

  diff.empty =
    diff.addedPermissions.length === 0 &&
    diff.removedPermissions.length === 0 &&
    diff.addedDataSources.length === 0 &&
    diff.removedDataSources.length === 0 &&
    diff.changedDataSources.length === 0 &&
    diff.minRole === undefined &&
    diff.consequential === undefined &&
    diff.offline === undefined &&
    diff.addedPlatforms.length === 0 &&
    diff.removedPlatforms.length === 0;

  return diff;
}

function review(): string {
  return " (review closely)";
}

function minRoleChangeFlagged(from: string, to: string): boolean {
  // Moving toward a younger role: the floor drops, so more people can invoke it.
  return roleIndex(to) < roleIndex(from);
}

export function renderPermissionDiff(diffs: Array<{ dir: string; diff: PermissionDiff }>): string {
  const lines: string[] = ["## Permission changes", ""];
  let any = false;

  for (const { dir, diff } of diffs) {
    if (diff.empty) continue;
    any = true;
    lines.push(`### ${dir}`, "");
    for (const p of diff.addedPermissions) lines.push(`- adds permission \`${p}\`${review()}`);
    for (const p of diff.removedPermissions) lines.push(`- removes permission \`${p}\``);
    for (const row of diff.addedDataSources) lines.push(`- adds data source \`${row.destination}\``);
    for (const row of diff.removedDataSources) lines.push(`- removes data source \`${row.destination}\``);
    for (const change of diff.changedDataSources) {
      lines.push(`- changes data source \`${change.destination}\``);
      for (const field of ["when", "what", "who", "opt_in", "retention"] as const) {
        const b = change.before[field];
        const a = change.after[field];
        if (b !== a) lines.push(`  - ${field}: \`${JSON.stringify(b)}\` to \`${JSON.stringify(a)}\``);
      }
    }
    if (diff.minRole !== undefined) {
      const flag = minRoleChangeFlagged(diff.minRole.from, diff.minRole.to) ? review() : "";
      lines.push(`- min_role goes from \`${diff.minRole.from}\` to \`${diff.minRole.to}\`${flag}`);
    }
    if (diff.consequential !== undefined) {
      const flag = diff.consequential.from && !diff.consequential.to ? review() : "";
      if (diff.consequential.from && !diff.consequential.to) {
        lines.push(`- is no longer consequential${flag}`);
      } else if (!diff.consequential.from && diff.consequential.to) {
        lines.push(`- becomes consequential`);
      } else {
        lines.push(`- consequential goes from \`${diff.consequential.from}\` to \`${diff.consequential.to}\`${flag}`);
      }
    }
    if (diff.offline !== undefined) {
      lines.push(`- offline goes from \`${diff.offline.from}\` to \`${diff.offline.to}\``);
    }
    for (const p of diff.addedPlatforms) lines.push(`- adds platform \`${p}\``);
    for (const p of diff.removedPlatforms) lines.push(`- removes platform \`${p}\``);
    lines.push("");
  }

  if (!any) {
    lines.length = 0;
    lines.push("No permission changes.");
  }
  return lines.join("\n").replace(/\n+$/, "") + "\n";
}

function readManifest(dir: string): Manifest | null {
  const path = join(dir, "manifest.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Manifest;
  } catch {
    return null;
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const [beforeRoot, afterRoot] = args;
  if (!beforeRoot || !afterRoot) {
    console.error("usage: bun run src/permission-diff.ts -- <beforeRoot> <afterRoot>");
    process.exit(2);
  }

  const beforeByDir = new Map(findPackages(beforeRoot).map((d) => [d.slice(beforeRoot.length + 1), readManifest(d)]));
  const afterByDir = new Map(findPackages(afterRoot).map((d) => [d.slice(afterRoot.length + 1), readManifest(d)]));
  const dirs = new Set<string>([...beforeByDir.keys(), ...afterByDir.keys()]);

  const entries: Array<{ dir: string; diff: PermissionDiff }> = [];
  for (const dir of [...dirs].sort((a, b) => a.localeCompare(b))) {
    const diff = permissionDiff(beforeByDir.get(dir) ?? null, afterByDir.get(dir) ?? null);
    entries.push({ dir, diff });
  }

  console.log(renderPermissionDiff(entries));
}

if (import.meta.main) {
  main();
}
