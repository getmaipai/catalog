import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair, keyId, signBytes, verifyBytes } from "../src/sign";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "maipai-catalog-sign-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// A unique filename per call, not a fixed "test.private.pem" - two
// keypairs generated in the same test (the impostor-signer case below)
// would otherwise land at the identical path and the second call would
// silently overwrite the first's key files on disk, signing with the
// wrong key later even though the captured `publicKeyPem` string still
// looks distinct (found writing this exact test).
let keyCounter = 0;

function freshKeyPair() {
  const n = keyCounter++;
  const privateKeyPath = join(dir, `test-${n}.private.pem`);
  const publicKeyPath = join(dir, `test-${n}.public.pem`);
  generateKeyPair(privateKeyPath, publicKeyPath);
  return { privateKeyPath, publicKeyPath, publicKeyPem: readFileSync(publicKeyPath, "utf-8") };
}

describe("generateKeyPair", () => {
  test("writes a real Ed25519 private and public key pair", () => {
    const { privateKeyPath, publicKeyPath } = freshKeyPair();
    const privatePem = readFileSync(privateKeyPath, "utf-8");
    const publicPem = readFileSync(publicKeyPath, "utf-8");
    expect(privatePem).toContain("BEGIN PRIVATE KEY");
    expect(publicPem).toContain("BEGIN PUBLIC KEY");
  });

  test("two calls produce two genuinely different keypairs", () => {
    const first = freshKeyPair();
    const second = freshKeyPair();
    expect(keyId(first.publicKeyPem)).not.toBe(keyId(second.publicKeyPem));
  });
});

describe("keyId", () => {
  test("is stable for the same public key", () => {
    const { publicKeyPem } = freshKeyPair();
    expect(keyId(publicKeyPem)).toBe(keyId(publicKeyPem));
  });

  test("is a 64-character lowercase hex sha256", () => {
    const { publicKeyPem } = freshKeyPair();
    expect(keyId(publicKeyPem)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("signBytes / verifyBytes", () => {
  test("a signature from the real private key verifies against its own public key", () => {
    const { privateKeyPath, publicKeyPem } = freshKeyPair();
    const data = Buffer.from("the exact bytes of a real target file");
    const signature = signBytes(data, privateKeyPath);
    expect(verifyBytes(data, signature, publicKeyPem)).toBe(true);
  });

  test("a signature does not verify against a DIFFERENT key's public key - the unknown-signer case of the tamper suite", () => {
    const signer = freshKeyPair();
    const impostor = freshKeyPair();
    const data = Buffer.from("some real content");
    const signature = signBytes(data, signer.privateKeyPath);
    expect(verifyBytes(data, signature, impostor.publicKeyPem)).toBe(false);
  });

  test("a signature does not verify against TAMPERED data - the bad-hash/swapped-manifest case of the tamper suite", () => {
    const { privateKeyPath, publicKeyPem } = freshKeyPair();
    const original = Buffer.from("the original, reviewed content");
    const signature = signBytes(original, privateKeyPath);
    const tampered = Buffer.from("a swapped-in, malicious payload");
    expect(verifyBytes(tampered, signature, publicKeyPem)).toBe(false);
  });

  test("a malformed signature string is a clean false, never a thrown exception", () => {
    const { publicKeyPem } = freshKeyPair();
    expect(verifyBytes(Buffer.from("data"), "not-valid-base64-signature!!!", publicKeyPem)).toBe(false);
  });

  test("a malformed public key PEM is a clean false, never a thrown exception", () => {
    const { privateKeyPath } = freshKeyPair();
    const data = Buffer.from("data");
    const signature = signBytes(data, privateKeyPath);
    expect(verifyBytes(data, signature, "not a real PEM")).toBe(false);
  });
});
