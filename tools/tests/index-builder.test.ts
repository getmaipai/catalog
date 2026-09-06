import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair } from "../src/sign";
import { buildRoot, buildTargets, buildTimestamp, writeEnvelope, verifyEnvelope, type TargetEntry } from "../src/index-builder";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "maipai-catalog-index-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function makeSigner(name: string) {
  const privateKeyPath = join(dir, `${name}.private.pem`);
  const publicKeyPath = join(dir, `${name}.public.pem`);
  generateKeyPair(privateKeyPath, publicKeyPath);
  return { privateKeyPath, publicKeyPath, publicKeyPem: readFileSync(publicKeyPath, "utf-8") };
}

const SAMPLE_TARGET: TargetEntry = {
  length: 1234,
  hashes: { sha256: "a".repeat(64) },
  custom: {
    source_commit: "abc123",
    signer: "primary",
    min_app: "0.1.0",
    requires: [],
    permissions: ["net:api.open-meteo.com"],
    channel: "stable",
  },
};

describe("buildRoot", () => {
  test("declares both signers with threshold 1 - a second signer slot from day one", () => {
    const primary = makeSigner("primary");
    const secondary = makeSigner("secondary");
    const root = buildRoot([primary, secondary], 365, 1);
    expect(Object.keys(root.signed.keys).length).toBe(2);
    expect(root.signed.roles.root.threshold).toBe(1);
    expect(root.signed.roles.root.keyids.length).toBe(2);
    expect(root.signatures.length).toBe(2);
  });

  test("verifies against either signer's public key alone", () => {
    const primary = makeSigner("primary");
    const secondary = makeSigner("secondary");
    const root = buildRoot([primary, secondary], 365, 1);
    expect(verifyEnvelope(root, [primary.publicKeyPem])).toBe(true);
    expect(verifyEnvelope(root, [secondary.publicKeyPem])).toBe(true);
  });

  test("does not verify against an unrelated key - the unknown-signer tamper case", () => {
    const primary = makeSigner("primary");
    const impostor = makeSigner("impostor");
    const root = buildRoot([primary], 365, 1);
    expect(verifyEnvelope(root, [impostor.publicKeyPem])).toBe(false);
  });

  test("sets a real future expiry", () => {
    const primary = makeSigner("primary");
    const root = buildRoot([primary], 365, 1);
    expect(new Date(root.signed.expires).getTime()).toBeGreaterThan(Date.now());
  });

  // TUF's rollback defense (a verifying client refuses a version lower
  // than the highest it has ever seen) only works if the version number
  // it compares is the real signed content, not something a MITM could
  // relabel - carried through into `signed`, not just an argument this
  // function drops on the floor.
  test("carries the version number into the signed content, not just as a build argument", () => {
    const primary = makeSigner("primary");
    const root = buildRoot([primary], 365, 7);
    expect(root.signed.version).toBe(7);
  });
});

describe("buildTargets", () => {
  test("carries every field a hub install needs", () => {
    const signer = makeSigner("targets-signer");
    const targets = buildTargets({ "plugins/utilities/weather/0.1.0": SAMPLE_TARGET }, signer, 365, 1);
    expect(targets.signed.targets["plugins/utilities/weather/0.1.0"]).toEqual(SAMPLE_TARGET);
    expect(verifyEnvelope(targets, [signer.publicKeyPem])).toBe(true);
  });

  test("a tampered target entry after signing fails verification - the swapped-manifest tamper case", () => {
    const signer = makeSigner("targets-signer");
    const targets = buildTargets({ "plugins/utilities/weather/0.1.0": SAMPLE_TARGET }, signer, 365, 1);
    const tampered = {
      ...targets,
      signed: { ...targets.signed, targets: { ...targets.signed.targets, "plugins/utilities/weather/0.1.0": { ...SAMPLE_TARGET, length: 999 } } },
    };
    expect(verifyEnvelope(tampered, [signer.publicKeyPem])).toBe(false);
  });
});

describe("buildTimestamp", () => {
  test("expires in 30 days by default", () => {
    const signer = makeSigner("timestamp-signer");
    const targetsPath = join(dir, "targets.json");
    writeFileSync(targetsPath, '{"some":"content"}');
    const timestamp = buildTimestamp(targetsPath, signer, 1);
    const daysUntilExpiry = (new Date(timestamp.signed.expires).getTime() - Date.now()) / 86_400_000;
    expect(daysUntilExpiry).toBeGreaterThan(29);
    expect(daysUntilExpiry).toBeLessThan(31);
  });

  test("records the real targets.json hash - a rollback to an older targets.json changes this and fails a hub's own hash check", () => {
    const signer = makeSigner("timestamp-signer");
    const targetsPath = join(dir, "targets.json");
    writeFileSync(targetsPath, '{"version":"1"}');
    const first = buildTimestamp(targetsPath, signer, 1);
    writeFileSync(targetsPath, '{"version":"2"}');
    const second = buildTimestamp(targetsPath, signer, 2);
    expect(first.signed.meta["targets.json"].hashes.sha256).not.toBe(second.signed.meta["targets.json"].hashes.sha256);
  });
});

describe("writeEnvelope", () => {
  test("writes real, re-parseable, re-verifiable JSON to disk", () => {
    const signer = makeSigner("write-signer");
    const root = buildRoot([signer], 365, 1);
    const path = join(dir, "root.json");
    writeEnvelope(root, path);
    const reparsed = JSON.parse(readFileSync(path, "utf-8"));
    expect(verifyEnvelope(reparsed, [signer.publicKeyPem])).toBe(true);
  });
});
