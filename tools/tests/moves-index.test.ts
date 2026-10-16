import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDevSigners } from "../src/build-index";
import { verifyEnvelope } from "../src/index-builder";
import { buildMovesIndex, readMovesIndexSource, validateMovesIndex, type MovesIndexSource } from "../src/moves-index";

const SOURCE = join(import.meta.dir, "..", "..", "moves", "index.json");
const REV = "a".repeat(40);
const library = {
  id: "pollen-emotions",
  upstream: "Pollen Robotics",
  repo: "pollen-robotics/reachy-mini-emotions-library",
  revision: REV,
  licence: "Apache-2.0",
  tag: "reachy_mini_community_moves",
  base_url: `https://huggingface.co/datasets/pollen-robotics/reachy-mini-emotions-library/resolve/${REV}/`,
  clips: [{ id: "amazed1", file: "amazed1.json", sha256: "b".repeat(64), bytes: 100, description: "Wow." }],
  excluded: [{ id: "sad2", reason: "antenna_right is past the limit" }],
};
const source = (over: Record<string, unknown> = {}): unknown => ({ version: "v", libraries: [{ ...library, ...over }] });

describe("the shipped moves index (PKG-MOVES-01)", () => {
  const index = readMovesIndexSource(SOURCE);
  const find = (id: string) => index.libraries.find((l) => l.id === id)!;
  test("pins 80 emotions and 19 dances, each with a checksum and a size", () => {
    expect(find("pollen-emotions").clips).toHaveLength(80);
    expect(find("pollen-dances").clips).toHaveLength(19);
    for (const l of index.libraries) for (const c of l.clips) {
      expect(c.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(c.bytes).toBeGreaterThan(0);
    }
  });
  test("sad2 is excluded as over the envelope and is not a clip", () => {
    const emotions = find("pollen-emotions");
    expect(emotions.excluded.map((e) => e.id)).toContain("sad2");
    expect(emotions.clips.map((c) => c.id)).not.toContain("sad2");
  });
  test("every library is Apache-2.0 at a full commit revision", () => {
    for (const l of index.libraries) {
      expect(l.licence).toBe("Apache-2.0");
      expect(l.revision).toMatch(/^[0-9a-f]{40}$/);
    }
  });
});

describe("validateMovesIndex", () => {
  test("accepts a well-formed library", () => {
    expect(validateMovesIndex(source())).toMatchObject({ ok: true });
  });
  test("refuses a branch in the base URL or a revision that differs from it", () => {
    expect(validateMovesIndex(source({ base_url: "https://huggingface.co/datasets/pollen-robotics/reachy-mini-emotions-library/resolve/main/" }))).toMatchObject({ ok: false });
    expect(validateMovesIndex(source({ revision: "c".repeat(40) }))).toMatchObject({ ok: false });
  });
  test("refuses a host other than huggingface.co and a repo that does not match the URL", () => {
    expect(validateMovesIndex(source({ base_url: `https://example.com/datasets/pollen-robotics/reachy-mini-emotions-library/resolve/${REV}/` }))).toMatchObject({ ok: false });
    expect(validateMovesIndex(source({ repo: "pollen-robotics/other" }))).toMatchObject({ ok: false });
  });
  test("refuses an unaccepted licence", () => {
    expect(validateMovesIndex(source({ licence: "CC-BY-NC-SA-4.0" }))).toMatchObject({ ok: false });
  });
  test("refuses a bad sha256, a zero size, a file that is not the id, and a clip that is also excluded", () => {
    const clip = library.clips[0]!;
    expect(validateMovesIndex(source({ clips: [{ ...clip, sha256: "b".repeat(63) }] }))).toMatchObject({ ok: false });
    expect(validateMovesIndex(source({ clips: [{ ...clip, bytes: 0 }] }))).toMatchObject({ ok: false });
    expect(validateMovesIndex(source({ clips: [{ ...clip, file: "other.json" }] }))).toMatchObject({ ok: false });
    expect(validateMovesIndex(source({ excluded: [{ id: "amazed1", reason: "x" }] }))).toMatchObject({ ok: false });
  });
  test("refuses duplicate clips, duplicate libraries and unknown fields", () => {
    const clip = library.clips[0]!;
    expect(validateMovesIndex(source({ clips: [clip, clip] }))).toMatchObject({ ok: false });
    expect(validateMovesIndex({ version: "v", libraries: [library, library] })).toMatchObject({ ok: false });
    expect(validateMovesIndex({ version: "v", libraries: [], extra: 1 })).toMatchObject({ ok: false });
  });
});

test("builds a signed moves-index envelope with thirty-day expiry", () => {
  const signers = ensureDevSigners(join("/tmp", "maipai-moves-index-test-keys"));
  const src = source() as MovesIndexSource;
  const envelope = buildMovesIndex(src, signers.primary, 1800000000);
  expect(envelope.signed).toMatchObject({ type: "moves-index", libraries: src.libraries });
  expect(new Date(envelope.signed.expires).getTime()).toBe((1800000000 + 30 * 86400) * 1000);
  expect(verifyEnvelope(envelope, [readFileSync(signers.primary.publicKeyPath, "utf8")])).toBe(true);
});
