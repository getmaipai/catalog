import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureDevSigners } from "../src/build-index";
import { verifyEnvelope } from "../src/index-builder";
import { buildEngineIndex, readEngineIndexSource, validateEngineIndex, type EngineIndexSource } from "../src/engine-index";

const SOURCE = join(import.meta.dir, "..", "..", "engines", "index.json");
let workDir: string;
beforeEach(() => { workDir = mkdtempSync(join(tmpdir(), "maipai-catalog-engine-index-test-")); });
afterEach(() => { rmSync(workDir, { recursive: true, force: true }); });

const valid: EngineIndexSource = { version: "2026-09-20", engines: [{ name: "llama-server", tag: "b10797", platform: "darwin", arch: "arm64", url: "https://github.com/ggml-org/llama.cpp/releases/download/b10797/x.tar.gz", sha256: "a".repeat(64), size: 10, licence: "MIT" }] };

describe("validateEngineIndex", () => {
  test("accepts the repo's own engines/index.json", () => {
    const source = readEngineIndexSource(SOURCE);
    expect(source.engines.length).toBeGreaterThan(0);
    expect(source.engines.every((entry) => /^b\d+$/.test(entry.tag))).toBe(true);
  });

  test("refuses a tag that is not an upstream build tag, an http url, a short checksum, and a duplicate pin", () => {
    const bad = (patch: Partial<EngineIndexSource["engines"][number]>) => validateEngineIndex({ version: "v", engines: [{ ...valid.engines[0]!, ...patch }] });
    expect(bad({ tag: "b10797-macos-arm64" })).toMatchObject({ ok: false });
    expect(bad({ url: "http://example.com/x.tar.gz" })).toMatchObject({ ok: false });
    expect(bad({ sha256: "abc" })).toMatchObject({ ok: false });
    expect(validateEngineIndex({ version: "v", engines: [valid.engines[0]!, valid.engines[0]!] })).toMatchObject({ ok: false, errors: ["duplicate entry llama-server/b10797/darwin/arm64"] });
    expect(validateEngineIndex({ version: "v", engines: [{ ...valid.engines[0]!, extra_field: 1 }] })).toMatchObject({ ok: false });
  });
});

describe("buildEngineIndex", () => {
  test("publishes the validated source as a signed envelope with an expiry, verifiable with the signer's public key", () => {
    const signers = ensureDevSigners(join(workDir, "keys"));
    const envelope = buildEngineIndex(valid, signers.primary, 1_800_000_000);
    expect(envelope.signed).toMatchObject({ type: "engine-index", version: "2026-09-20", published: 1_800_000_000, engines: valid.engines });
    expect(new Date(envelope.signed.expires).getTime()).toBe((1_800_000_000 + 30 * 86_400) * 1000);
    expect(verifyEnvelope(envelope, [readFileSync(signers.primary.publicKeyPath, "utf-8")])).toBe(true);
    expect(verifyEnvelope(envelope, [readFileSync(signers.secondary.publicKeyPath, "utf-8")])).toBe(false);
  });
});
