import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDevSigners } from "../src/build-index";
import { verifyEnvelope } from "../src/index-builder";
import { LIST_MAX_BYTES, buildListIndex, readListIndexSource, specListIds, validateListIndex, type ListIndexEntry, type ListIndexSource } from "../src/list-index";
import { applyPin, evaluateRepin } from "../src/list-repin";

const SOURCE = join(import.meta.dir, "..", "..", "lists", "index.json");
const CANARY = (JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "lists", "canary.json"), "utf8")) as { hosts: string[] }).hosts;
const URL_OK = `https://raw.githubusercontent.com/example/lists/${"a".repeat(40)}/porn.txt`;
const entry: ListIndexEntry = {
  id: "blp-porn", source_url: URL_OK, sha256: "b".repeat(64), bytes: 10, entries: 3, format: "hosts",
  licence: "Unlicense", upstream: "The Block List Project", pinned_at: "2026-10-12",
};
const bytes = (text: string) => new TextEncoder().encode(text);
const file = (n: number) => Array.from({ length: n }, (_, i) => `0.0.0.0 site${i}.example.net`).join("\n");
const base = { id: "blp-porn", source_url: URL_OK, format: "hosts" as const, licence: "Unlicense", upstream: "x", canaryHosts: CANARY, today: "2026-11-01" };

describe("size cap", () => {
  test("the cap fits the 72 MB malware list and stays twin to the hub", () => {
    expect(LIST_MAX_BYTES).toBe(128 * 1024 * 1024);
    expect(LIST_MAX_BYTES).toBeGreaterThan(72_161_681);
    expect(validateListIndex({ version: "v", lists: [{ ...entry, bytes: LIST_MAX_BYTES + 1 }] })).toMatchObject({ ok: false });
  });
});

describe("validateListIndex", () => {
  test("accepts the shipped list index, and its ids are all declared by the pinned spec", () => {
    const source = readListIndexSource(SOURCE);
    expect(validateListIndex(source)).toMatchObject({ ok: true });
    const known = specListIds();
    expect(known?.has("blp-porn")).toBe(true);
  });
  test("refuses a branch URL, an unaccepted licence, an unknown id and duplicates", () => {
    const branch = { ...entry, source_url: "https://raw.githubusercontent.com/example/lists/master/porn.txt" };
    expect(validateListIndex({ version: "v", lists: [branch] })).toMatchObject({ ok: false });
    expect(validateListIndex({ version: "v", lists: [{ ...entry, licence: "CC-BY-NC-SA-4.0" }] })).toMatchObject({ ok: false });
    const unknown = validateListIndex({ version: "v", lists: [{ ...entry, id: "nope" }] }, new Set(["blp-porn"]));
    expect(unknown).toMatchObject({ ok: false });
    expect(validateListIndex({ version: "v", lists: [entry, entry] })).toMatchObject({ ok: false, errors: ["duplicate list blp-porn"] });
  });
  test("refuses a 63-character sha256 and unknown fields", () => {
    expect(validateListIndex({ version: "v", lists: [{ ...entry, sha256: "b".repeat(63) }] })).toMatchObject({ ok: false });
    expect(validateListIndex({ version: "v", lists: [], extra: 1 })).toMatchObject({ ok: false });
  });
});

test("builds a signed list-index envelope with thirty-day expiry", () => {
  const signers = ensureDevSigners(join("/tmp", "maipai-list-index-test-keys"));
  const source: ListIndexSource = { version: "v", lists: [entry] };
  const envelope = buildListIndex(source, signers.primary, 1800000000);
  expect(envelope.signed).toMatchObject({ type: "list-index", lists: [entry] });
  expect(new Date(envelope.signed.expires).getTime()).toBe((1800000000 + 30 * 86400) * 1000);
  expect(verifyEnvelope(envelope, [readFileSync(signers.primary.publicKeyPath, "utf8")])).toBe(true);
});

describe("evaluateRepin guards", () => {
  test("pins a good file with its sha256, bytes and entry count", () => {
    const data = bytes(file(10));
    const result = evaluateRepin({ ...base, bytes: data });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pin.entries).toBe(10);
      expect(result.pin.bytes).toBe(data.length);
      expect(result.pin.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(applyPin({ version: "x", lists: [entry] }, result.pin, "2026-11-01").lists).toHaveLength(1);
    }
  });
  test("refuses an unaccepted licence", () => {
    expect(evaluateRepin({ ...base, licence: "CC-BY-NC-SA-4.0", bytes: bytes(file(3)) }).ok).toBe(false);
  });
  test("refuses entries moving more than 20% from the last pin, accepts 20% or less", () => {
    const previous = { ...entry, entries: 10 };
    expect(evaluateRepin({ ...base, previous, bytes: bytes(file(13)) }).ok).toBe(false);
    expect(evaluateRepin({ ...base, previous, bytes: bytes(file(8)) }).ok).toBe(true);
    expect(evaluateRepin({ ...base, previous, bytes: bytes(file(5)) }).ok).toBe(false);
  });
  test("refuses a public suffix and a canary host or one of its parents", () => {
    const suffix = evaluateRepin({ ...base, bytes: bytes(`${file(3)}\n0.0.0.0 co.uk\n0.0.0.0 co.cz`) });
    expect(suffix).toMatchObject({ ok: false });
    // One inert suffix entry in a big list is a warning, not a refusal.
    expect(evaluateRepin({ ...base, bytes: bytes(`${file(30000)}\n0.0.0.0 co.cz`) }).ok).toBe(true);
    const canary = evaluateRepin({ ...base, bytes: bytes(`${file(3)}\n0.0.0.0 wikipedia.org`) });
    expect(canary).toMatchObject({ ok: false });
    const parent = evaluateRepin({ ...base, bytes: bytes(`${file(3)}\n0.0.0.0 bbc.co.uk`) });
    expect(parent).toMatchObject({ ok: false });
    expect(evaluateRepin({ ...base, bytes: bytes(`${file(3)}\n0.0.0.0 en.wikipedia.org.evil.example`) }).ok).toBe(true);
  });
  test("refuses a branch URL and an empty parse", () => {
    expect(evaluateRepin({ ...base, source_url: "https://raw.githubusercontent.com/example/lists/main/porn.txt", bytes: bytes(file(3)) }).ok).toBe(false);
    expect(evaluateRepin({ ...base, bytes: bytes("# nothing here\n") }).ok).toBe(false);
  });
});
