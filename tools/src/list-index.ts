// The blocked-site list index the MaiPai Home hub reads (MINOR-SEARCH-01e-2). A field-for-field twin of
// model-index.ts: reviewed source in lists/index.json, signed into the `list-index.json` release asset.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { ensureDevSigners } from "./build-index";
import { signEnvelope, writeEnvelope, type SignedEnvelope, type SignerKey } from "./index-builder";
import { ACCEPTED_LICENCES } from "./licence";

export const LIST_MAX_BYTES = 64 * 1024 * 1024;
export const LIST_MAX_ENTRIES = 2_000_000;
/** An https raw.githubusercontent.com URL at a 40-character commit sha, never a branch. */
export const PINNED_SOURCE_URL = /^https:\/\/raw\.githubusercontent\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[0-9a-f]{40}\/[^?#\s]+$/;

export interface ListIndexEntry {
  id: string;
  source_url: string;
  sha256: string;
  bytes: number;
  entries: number;
  format: "hosts" | "domains";
  licence: string;
  upstream: string;
  pinned_at: string;
}
export interface ListIndexSource {
  version: string;
  lists: ListIndexEntry[];
}
export interface ListIndexMetadata extends ListIndexSource {
  type: "list-index";
  expires: string;
  published: number;
}

const text = { type: "string", minLength: 1 } as const;
export const LIST_INDEX_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["version", "lists"],
  properties: {
    version: text,
    lists: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "source_url", "sha256", "bytes", "entries", "format", "licence", "upstream", "pinned_at"],
        properties: {
          id: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
          source_url: { type: "string" },
          sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
          bytes: { type: "integer", minimum: 1, maximum: LIST_MAX_BYTES },
          entries: { type: "integer", minimum: 1, maximum: LIST_MAX_ENTRIES },
          format: { type: "string", enum: ["hosts", "domains"] },
          licence: text,
          upstream: text,
          pinned_at: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        },
      },
    },
  },
} as const;

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(LIST_INDEX_SCHEMA);

/** `knownIds`: the ids the pinned spec declares (spec/search/blocklists.json). When given, any other id is refused. */
export function validateListIndex(
  source: unknown,
  knownIds?: ReadonlySet<string>,
): { ok: true; index: ListIndexSource } | { ok: false; errors: string[] } {
  if (!validate(source))
    return { ok: false, errors: (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`) };
  const index = source as ListIndexSource;
  const ids = new Set<string>();
  const errors: string[] = [];
  for (const list of index.lists) {
    if (ids.has(list.id)) errors.push(`duplicate list ${list.id}`);
    ids.add(list.id);
    if (knownIds && !knownIds.has(list.id)) errors.push(`list ${list.id}: the spec declares no such list`);
    if (!PINNED_SOURCE_URL.test(list.source_url))
      errors.push(`list ${list.id}: source_url must be https://raw.githubusercontent.com/<owner>/<repo>/<40-hex commit>/<path>, never a branch`);
    if (!ACCEPTED_LICENCES.has(list.licence)) errors.push(`list ${list.id}: licence ${list.licence} is not accepted`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, index };
}

/** The ids declared in the pinned spec. Throws when the spec file is missing, so a moved file cannot skip the check. */
export function specListIds(): ReadonlySet<string> {
  const path = join(import.meta.dir, "..", "node_modules", "@maipai", "spec", "search", "blocklists.json");
  if (!existsSync(path))
    throw new Error(`the pinned @maipai/spec has no search/blocklists.json at ${path}. Run bun install in tools/, or bump the spec pin to spec-v0.1.121 or later.`);
  const policy = JSON.parse(readFileSync(path, "utf-8")) as { lists: { id: string }[] };
  return new Set(policy.lists.map((l) => l.id));
}

export function readListIndexSource(path: string): ListIndexSource {
  const result = validateListIndex(JSON.parse(readFileSync(path, "utf-8")), specListIds());
  if (!result.ok) throw new Error(`lists/index.json is invalid:\n  ${result.errors.join("\n  ")}`);
  return result.index;
}

export function buildListIndex(
  source: ListIndexSource,
  signer: SignerKey,
  published = Math.floor(Date.now() / 1000),
  expiryDays = 30,
): SignedEnvelope<ListIndexMetadata> {
  const expires = new Date(published * 1000 + expiryDays * 86_400_000).toISOString();
  return signEnvelope({ type: "list-index", version: source.version, expires, published, lists: source.lists }, signer);
}

if (import.meta.main) {
  const [outFile, keysDir] = process.argv.slice(2);
  if (!outFile) {
    console.error("usage: bun run src/list-index.ts -- <outFile> [keysDir]");
    process.exit(1);
  }
  const source = readListIndexSource(join(import.meta.dir, "..", "..", "lists", "index.json"));
  const signers = ensureDevSigners(keysDir ?? join(homedir(), ".config", "maipai", "catalog-dev-signing"));
  writeEnvelope(buildListIndex(source, signers.primary), outFile);
  console.log(`wrote the list index (${source.lists.length} entries) to ${outFile}`);
}
