// The engine index the Stack reads for "installed X, available Y":
// engines/index.json (hand-maintained pins per platform) validated
// against its schema and published as a signed envelope in the same
// shape as the package index. Engine builds are not community packages
// (nothing to pack or scorecard); the index is the only artifact.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { ensureDevSigners } from "./build-index";
import { signEnvelope, writeEnvelope, type SignedEnvelope, type SignerKey } from "./index-builder";

export interface EngineArchive { url: string; sha256: string; size: number; label?: string }
export interface EngineIndexEntry extends EngineArchive {
  name: string;
  tag: string;
  platform: "darwin" | "linux" | "win32";
  arch: "arm64" | "x64";
  licence: string;
  requires?: string[];
  extra?: EngineArchive[];
  notes?: string;
}
export interface EngineIndexSource { version: string; engines: EngineIndexEntry[] }
export interface EngineIndexMetadata extends EngineIndexSource { type: "engine-index"; expires: string; published: number }

export const ALLOWED_ENGINE_HOSTS = ["github.com", "objects.githubusercontent.com", "huggingface.co"] as const;

const archive = {
  type: "object",
  required: ["url", "sha256", "size"],
  properties: {
    url: { type: "string", format: "uri" },
    sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
    size: { type: "integer", minimum: 1 },
    label: { type: "string", minLength: 1 },
  },
} as const;

export const ENGINE_INDEX_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["version", "engines"],
  properties: {
    version: { type: "string", minLength: 1 },
    engines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "tag", "platform", "arch", "url", "sha256", "size", "licence"],
        properties: {
          ...archive.properties,
          name: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
          tag: { type: "string", pattern: "^(b[0-9]+|v?[0-9]+(\\.[0-9]+)*)$" },
          platform: { type: "string", enum: ["darwin", "linux", "win32"] },
          arch: { type: "string", enum: ["arm64", "x64"] },
          licence: { type: "string", minLength: 1 },
          requires: { type: "array", items: { type: "string", enum: ["nvidia"] } },
          extra: { type: "array", items: { ...archive, additionalProperties: false } },
          notes: { type: "string" },
        },
      },
    },
  },
} as const;

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(ENGINE_INDEX_SCHEMA);

/** Validates the source: the schema, plus one entry per (name, tag,
 * platform, arch) so an edited pin can never shadow an older one. */
export function validateEngineIndex(source: unknown): { ok: true; index: EngineIndexSource } | { ok: false; errors: string[] } {
  if (!validate(source)) return { ok: false, errors: (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`) };
  const index = source as EngineIndexSource;
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const entry of index.engines) {
    for (const archive of [entry, ...(entry.extra ?? [])]) {
      const url = new URL(archive.url);
      if (url.protocol !== "https:") errors.push(`engine ${entry.name} ${entry.tag}: url must be https`);
      else if (!(ALLOWED_ENGINE_HOSTS as readonly string[]).includes(url.hostname)) {
        errors.push(`engine ${entry.name} ${entry.tag}: url host ${url.hostname} is not an allowed release host`);
      }
    }
    const key = `${entry.name}/${entry.tag}/${entry.platform}/${entry.arch}`;
    if (seen.has(key)) errors.push(`duplicate entry ${key}`);
    seen.add(key);
  }
  return errors.length ? { ok: false, errors } : { ok: true, index };
}

export function readEngineIndexSource(path: string): EngineIndexSource {
  const result = validateEngineIndex(JSON.parse(readFileSync(path, "utf-8")));
  if (!result.ok) throw new Error(`engines/index.json is invalid:\n  ${result.errors.join("\n  ")}`);
  return result.index;
}

/** The published document: the validated source under `signed` with
 * its type, a thirty-day expiry and a monotonic `published` stamp, in
 * the package index's own envelope shape. */
export function buildEngineIndex(source: EngineIndexSource, signer: SignerKey, published = Math.floor(Date.now() / 1000), expiryDays = 30): SignedEnvelope<EngineIndexMetadata> {
  const expires = new Date(published * 1000 + expiryDays * 86_400_000).toISOString();
  return signEnvelope({ type: "engine-index", version: source.version, expires, published, engines: source.engines }, signer);
}

// CLI: `bun run src/engine-index.ts -- <outFile> [keysDir]`, from tools/.
if (import.meta.main) {
  const [outFile, keysDir] = process.argv.slice(2);
  if (!outFile) {
    console.error("usage: bun run src/engine-index.ts -- <outFile> [keysDir]");
    process.exit(1);
  }
  const source = readEngineIndexSource(join(import.meta.dir, "..", "..", "engines", "index.json"));
  const signers = ensureDevSigners(keysDir ?? join(homedir(), ".config", "maipai", "catalog-dev-signing"));
  writeEnvelope(buildEngineIndex(source, signers.primary), outFile);
  console.log(`wrote the engine index (${source.engines.length} entries) to ${outFile}`);
}
