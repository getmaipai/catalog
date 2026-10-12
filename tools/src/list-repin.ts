// The monthly re-pin for a blocked-site list (MINOR-SEARCH-01e-2). Maintainer-run, by hand; no scheduled workflow.
// It reads the upstream file at an immutable commit, records sha256, bytes and entry count, and refuses the pin when
// a guard fails. The entry count is spec's `parseHostList`, the same reader the hub uses, so the two counts agree.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDomain } from "tldts";
import { parseHostList, type HostListFormat } from "@maipai/spec/interpreters/ts/hostList.js";
import { ACCEPTED_LICENCES } from "./licence";
import {
  LIST_MAX_BYTES,
  LIST_MAX_ENTRIES,
  PINNED_SOURCE_URL,
  readListIndexSource,
  type ListIndexEntry,
  type ListIndexSource,
} from "./list-index";

export const MAX_ENTRY_DELTA = 0.2;
/** Entries that are themselves public suffixes are inert (the hub matcher never matches at or above a public suffix),
 * so a handful is a warning. More than this share of the list is a sign of a broken file and refuses the pin. */
export const MAX_SUFFIX_SHARE = 0.0001;

export interface RepinInput {
  id: string;
  source_url: string;
  bytes: Uint8Array;
  format: HostListFormat;
  licence: string;
  upstream: string;
  previous?: ListIndexEntry;
  canaryHosts: readonly string[];
  today: string;
}

/** True when `entry` is `canary` itself or a parent domain of it (blocking it would block the canary). */
function coversCanary(entry: string, canary: string): boolean {
  return canary === entry || canary.endsWith(`.${entry}`);
}

export function evaluateRepin(input: RepinInput): { ok: true; pin: ListIndexEntry } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!ACCEPTED_LICENCES.has(input.licence)) errors.push(`licence ${input.licence} is not accepted; refuse the pin`);
  if (!PINNED_SOURCE_URL.test(input.source_url)) errors.push("source_url is not an https raw.githubusercontent.com URL at a 40-hex commit");
  if (input.bytes.length > LIST_MAX_BYTES) errors.push(`file is ${input.bytes.length} bytes, over the ${LIST_MAX_BYTES} limit`);
  const parsed = parseHostList(new TextDecoder().decode(input.bytes), input.format);
  if (parsed.entries > LIST_MAX_ENTRIES) errors.push(`${parsed.entries} entries, over the ${LIST_MAX_ENTRIES} limit`);
  if (parsed.entries === 0) errors.push("no valid entries found; check the format");
  if (input.previous && input.previous.entries > 0) {
    const delta = Math.abs(parsed.entries - input.previous.entries) / input.previous.entries;
    if (delta > MAX_ENTRY_DELTA)
      errors.push(`entries moved ${(delta * 100).toFixed(1)}% from the last pin (${input.previous.entries} to ${parsed.entries}), over ${MAX_ENTRY_DELTA * 100}%`);
  }
  const suffixes: string[] = [];
  const canaries: string[] = [];
  for (const host of parsed.hosts) {
    if (getDomain(host, { allowPrivateDomains: true }) === null) suffixes.push(host);
    for (const canary of input.canaryHosts) if (coversCanary(host, canary)) canaries.push(host);
  }
  if (suffixes.length > Math.max(1, parsed.entries * MAX_SUFFIX_SHARE))
    errors.push(`${suffixes.length} entries are public suffixes, such as ${suffixes.slice(0, 3).join(", ")}`);
  if (canaries.length) errors.push(`${canaries.length} entries would block a host that must never be blocked, such as ${canaries.slice(0, 3).join(", ")}`);
  if (errors.length) return { ok: false, errors };
  if (suffixes.length) console.warn(`note: ${suffixes.length} entries are public suffixes and stay inert: ${suffixes.join(", ")}`);
  return {
    ok: true,
    pin: {
      id: input.id,
      source_url: input.source_url,
      sha256: createHash("sha256").update(input.bytes).digest("hex"),
      bytes: input.bytes.length,
      entries: parsed.entries,
      format: input.format,
      licence: input.licence,
      upstream: input.upstream,
      pinned_at: input.today,
    },
  };
}

export function applyPin(source: ListIndexSource, pin: ListIndexEntry, today: string): ListIndexSource {
  const lists = source.lists.filter((l) => l.id !== pin.id).concat(pin).sort((a, b) => a.id.localeCompare(b.id));
  return { version: today, lists };
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`could not fetch ${url}: HTTP ${res.status}. Check the commit and path, then run again.`);
    process.exit(1);
  }
  return new Uint8Array(await res.arrayBuffer());
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

if (import.meta.main) {
  const need = (name: string): string => {
    const v = arg(name);
    if (!v) {
      console.error(`missing --${name}. usage: bun run src/list-repin.ts -- --id <id> --repo <owner/repo> --commit <40-hex> --path <file> --format hosts|domains --licence <SPDX> --upstream <name> [--file <local copy>]`);
      process.exit(1);
    }
    return v;
  };
  const id = need("id");
  const url = `https://raw.githubusercontent.com/${need("repo")}/${need("commit")}/${need("path")}`;
  const file = arg("file");
  const bytes = file ? new Uint8Array(readFileSync(file)) : await fetchBytes(url);
  const indexPath = join(import.meta.dir, "..", "..", "lists", "index.json");
  const source = readListIndexSource(indexPath);
  const canaryHosts = (JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "lists", "canary.json"), "utf-8")) as { hosts: string[] }).hosts;
  const today = new Date().toISOString().slice(0, 10);
  const result = evaluateRepin({
    id,
    source_url: url,
    bytes,
    format: need("format") as HostListFormat,
    licence: need("licence"),
    upstream: need("upstream"),
    previous: source.lists.find((l) => l.id === id),
    canaryHosts,
    today,
  });
  if (!result.ok) {
    console.error(`pin refused for ${id}:\n  ${result.errors.join("\n  ")}`);
    process.exit(2);
  }
  writeFileSync(indexPath, `${JSON.stringify(applyPin(source, result.pin, today), null, 2)}\n`);
  console.log(`pinned ${id}: ${result.pin.entries} entries, ${result.pin.bytes} bytes, sha256 ${result.pin.sha256}`);
}
