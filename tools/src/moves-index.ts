// The recorded emotions and dances pack (PKG-MOVES-01): an optional, model-like data package. Reviewed source in
// moves/index.json, signed into the `moves-index.json` release asset. Same envelope as model-index.ts and list-index.ts.
// The clip files are never hosted or vendored here: Home fetches each one from the pinned Hugging Face revision through
// its one downloader, checks the sha256, and serves it to the robot. The pins live here and nowhere in the spec's
// robot-assets.json (OWNER-ANSWERS 7).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { ensureDevSigners } from "./build-index";
import { signEnvelope, writeEnvelope, type SignedEnvelope, type SignerKey } from "./index-builder";
import { ACCEPTED_LICENCES } from "./licence";

/** https://huggingface.co/datasets/<owner>/<repo>/resolve/<40-hex commit>/ : a commit, never a branch. */
export const PINNED_BASE_URL = /^https:\/\/huggingface\.co\/datasets\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/resolve\/([0-9a-f]{40})\/$/;

export interface MovesClip {
  id: string;
  file: string;
  sha256: string;
  bytes: number;
  description: string;
}
export interface MovesExcluded {
  id: string;
  reason: string;
}
export interface MovesLibrary {
  id: string;
  upstream: string;
  repo: string;
  revision: string;
  licence: string;
  tag: string;
  base_url: string;
  clips: MovesClip[];
  excluded: MovesExcluded[];
}
export interface MovesIndexSource {
  version: string;
  libraries: MovesLibrary[];
}
export interface MovesIndexMetadata extends MovesIndexSource {
  type: "moves-index";
  expires: string;
  published: number;
}

const text = { type: "string", minLength: 1 } as const;
const hex40 = { type: "string", pattern: "^[0-9a-f]{40}$" } as const;
const slug = { type: "string", pattern: "^[a-z0-9][a-z0-9_-]{0,63}$" } as const;
export const MOVES_INDEX_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["version", "libraries"],
  properties: {
    version: text,
    libraries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "upstream", "repo", "revision", "licence", "tag", "base_url", "clips", "excluded"],
        properties: {
          id: slug,
          upstream: text,
          repo: text,
          revision: hex40,
          licence: text,
          tag: text,
          base_url: text,
          clips: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "file", "sha256", "bytes", "description"],
              properties: {
                id: slug,
                file: { type: "string", pattern: "^[^/\\\\]+\\.json$" },
                sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
                bytes: { type: "integer", minimum: 1 },
                description: { type: "string" },
              },
            },
          },
          excluded: {
            type: "array",
            items: { type: "object", additionalProperties: false, required: ["id", "reason"], properties: { id: slug, reason: text } },
          },
        },
      },
    },
  },
} as const;

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(MOVES_INDEX_SCHEMA);

export function validateMovesIndex(source: unknown): { ok: true; index: MovesIndexSource } | { ok: false; errors: string[] } {
  if (!validate(source))
    return { ok: false, errors: (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`) };
  const index = source as MovesIndexSource;
  const errors: string[] = [];
  const libraryIds = new Set<string>();
  for (const lib of index.libraries) {
    if (libraryIds.has(lib.id)) errors.push(`duplicate library ${lib.id}`);
    libraryIds.add(lib.id);
    const match = PINNED_BASE_URL.exec(lib.base_url);
    if (!match) errors.push(`library ${lib.id}: base_url must be https://huggingface.co/datasets/<owner>/<repo>/resolve/<40-hex commit>/, never a branch`);
    else {
      if (match[1] !== lib.repo) errors.push(`library ${lib.id}: base_url names ${match[1]} but repo is ${lib.repo}`);
      if (match[2] !== lib.revision) errors.push(`library ${lib.id}: base_url revision ${match[2]} differs from revision ${lib.revision}`);
    }
    if (!ACCEPTED_LICENCES.has(lib.licence)) errors.push(`library ${lib.id}: licence ${lib.licence} is not accepted`);
    const clipIds = new Set<string>();
    for (const clip of lib.clips) {
      if (clipIds.has(clip.id)) errors.push(`library ${lib.id}: duplicate clip ${clip.id}`);
      clipIds.add(clip.id);
      if (clip.file !== `${clip.id}.json`) errors.push(`library ${lib.id}: clip ${clip.id} file must be ${clip.id}.json, not ${clip.file}`);
    }
    for (const out of lib.excluded) {
      if (clipIds.has(out.id)) errors.push(`library ${lib.id}: ${out.id} is both a clip and excluded`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, index };
}

export function readMovesIndexSource(path: string): MovesIndexSource {
  const result = validateMovesIndex(JSON.parse(readFileSync(path, "utf-8")));
  if (!result.ok) throw new Error(`moves/index.json is invalid:\n  ${result.errors.join("\n  ")}`);
  return result.index;
}

export function buildMovesIndex(
  source: MovesIndexSource,
  signer: SignerKey,
  published = Math.floor(Date.now() / 1000),
  expiryDays = 30,
): SignedEnvelope<MovesIndexMetadata> {
  const expires = new Date(published * 1000 + expiryDays * 86_400_000).toISOString();
  return signEnvelope({ type: "moves-index", version: source.version, expires, published, libraries: source.libraries }, signer);
}

if (import.meta.main) {
  const [outFile, keysDir] = process.argv.slice(2);
  if (!outFile) {
    console.error("usage: bun run src/moves-index.ts -- <outFile> [keysDir]");
    process.exit(1);
  }
  const source = readMovesIndexSource(join(import.meta.dir, "..", "..", "moves", "index.json"));
  const signers = ensureDevSigners(keysDir ?? join(homedir(), ".config", "maipai", "catalog-dev-signing"));
  writeEnvelope(buildMovesIndex(source, signers.primary), outFile);
  console.log(`wrote the moves index (${source.libraries.length} libraries) to ${outFile}`);
}
