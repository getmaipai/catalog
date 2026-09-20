// The model index the Stack reads for installed and available models.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { ensureDevSigners } from "./build-index";
import { signEnvelope, writeEnvelope, type SignedEnvelope, type SignerKey } from "./index-builder";

export interface ModelIndexEntry { id: string; role: string; profile: "p16" | "p32" | "p64" | "p128"; quality: number; repo?: string; license?: string; revision: string; engine?: string; download: { url: string; sha256: string; approx_bytes: number; archive?: boolean; hub_file?: string; component?: string; directory?: string; files?: { path: string; sha256: string; bytes: number }[] } }
export interface ModelIndexSource { version: string; models: ModelIndexEntry[] }
export interface ModelIndexMetadata extends ModelIndexSource { type: "model-index"; expires: string; published: number }

const text = { type: "string", minLength: 1 } as const;
const download = { type: "object", additionalProperties: false, required: ["url", "sha256", "approx_bytes"], properties: { url: { type: "string", format: "uri" }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" }, approx_bytes: { type: "integer", minimum: 0 }, archive: { type: "boolean" }, hub_file: text, component: text, directory: text, files: { type: "array", items: { type: "object", additionalProperties: false, required: ["path", "sha256", "bytes"], properties: { path: text, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" }, bytes: { type: "integer", minimum: 0 } } } } } } as const;
export const MODEL_INDEX_SCHEMA = { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", additionalProperties: false, required: ["version", "models"], properties: { version: text, models: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "role", "profile", "quality", "revision", "download"], properties: { id: { type: "string", pattern: "^[a-z0-9][a-z0-9.-]*$" }, role: text, profile: { type: "string", enum: ["p16", "p32", "p64", "p128"] }, quality: { type: "integer", minimum: 0 }, repo: text, license: text, engine: text, revision: text, download } } } } } as const;

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(MODEL_INDEX_SCHEMA);
export function validateModelIndex(source: unknown): { ok: true; index: ModelIndexSource } | { ok: false; errors: string[] } { if (!validate(source)) return { ok: false, errors: (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`) }; const index = source as ModelIndexSource; const ids = new Set<string>(); const errors: string[] = []; for (const model of index.models) { if (ids.has(model.id)) errors.push(`duplicate model ${model.id}`); ids.add(model.id); if (new URL(model.download.url).protocol !== "https:") errors.push(`model ${model.id}: url must be https`); } return errors.length ? { ok: false, errors } : { ok: true, index }; }
export function readModelIndexSource(path: string): ModelIndexSource { const result = validateModelIndex(JSON.parse(readFileSync(path, "utf-8"))); if (!result.ok) throw new Error(`models/index.json is invalid:\n  ${result.errors.join("\n  ")}`); return result.index; }
export function buildModelIndex(source: ModelIndexSource, signer: SignerKey, published = Math.floor(Date.now() / 1000), expiryDays = 30): SignedEnvelope<ModelIndexMetadata> { const expires = new Date(published * 1000 + expiryDays * 86_400_000).toISOString(); return signEnvelope({ type: "model-index", version: source.version, expires, published, models: source.models }, signer); }
if (import.meta.main) { const [outFile, keysDir] = process.argv.slice(2); if (!outFile) { console.error("usage: bun run src/model-index.ts -- <outFile> [keysDir]"); process.exit(1); } const source = readModelIndexSource(join(import.meta.dir, "..", "..", "models", "index.json")); const signers = ensureDevSigners(keysDir ?? join(homedir(), ".config", "maipai", "catalog-dev-signing")); writeEnvelope(buildModelIndex(source, signers.primary), outFile); console.log(`wrote the model index (${source.models.length} entries) to ${outFile}`); }
