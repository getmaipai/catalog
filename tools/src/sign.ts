// Ed25519 signing (session-d-packages-and-store.md step 6,
// docs/PACKAGES.md: "signs it with the offline Ed25519 key"). Uses
// node:crypto's own native Ed25519 support - no third-party crypto
// library needed, per the org's "prebuilt over hand-built" principle,
// and one less dependency to audit for something this security-
// sensitive. Every key is a PEM file the caller names explicitly; this
// module never reads a fixed path or an environment variable for a
// private key, since "the offline key file outside the repo" means a
// maintainer's own machine decides where it lives, never this repo.
import {
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
  createPublicKey,
  createPrivateKey,
  createHash,
  type KeyObject,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

export interface KeyPairFiles {
  privateKeyPath: string;
  publicKeyPath: string;
}

/** Generates a new Ed25519 keypair and writes it to two PEM files. Never
 * called by CI or `check` - key generation is a one-time, offline,
 * maintainer-only action (docs/PACKAGES.md's own "a second signer slot
 * from day one, a written key-loss recovery" names a real, human process
 * around this, not something this function's return value can capture). */
export function generateKeyPair(privateKeyPath: string, publicKeyPath: string): KeyPairFiles {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  writeFileSync(privateKeyPath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  writeFileSync(publicKeyPath, publicKey.export({ type: "spki", format: "pem" }));
  return { privateKeyPath, publicKeyPath };
}

/** A public key's own stable id: the sha256 of its DER-encoded SPKI form,
 * hex-encoded - TUF's own convention for a "keyid," used by root.json to
 * name which key satisfies which role's threshold without embedding the
 * whole PEM inline everywhere a key needs to be referenced. */
export function keyId(publicKeyPem: string): string {
  const key = createPublicKey(publicKeyPem);
  const der = key.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("hex");
}

/** Signs `data` with the private key at `privateKeyPath`, returning the
 * signature as a base64 string - TUF metadata's own convention, so
 * root/targets/timestamp JSON can carry a signature as a plain string
 * field. Ed25519's own algorithm is self-contained (no separate digest
 * algorithm to name, unlike RSA/ECDSA), so `sign(null, ...)` is correct
 * here, not a placeholder for "figure out the hash later." */
export function signBytes(data: Buffer, privateKeyPath: string): string {
  const privateKey: KeyObject = createPrivateKey(readFileSync(privateKeyPath, "utf-8"));
  return cryptoSign(null, data, privateKey).toString("base64");
}

export function signFile(dataPath: string, privateKeyPath: string): string {
  return signBytes(readFileSync(dataPath), privateKeyPath);
}

export function verifyBytes(data: Buffer, signatureBase64: string, publicKeyPem: string): boolean {
  try {
    return cryptoVerify(null, data, createPublicKey(publicKeyPem), Buffer.from(signatureBase64, "base64"));
  } catch {
    // A malformed signature/key is a verification FAILURE, never an
    // exception a caller has to handle specially - the tamper suite
    // (a swapped manifest, a bad hash) relies on this returning false,
    // not throwing, for every malformed-input shape it tries.
    return false;
  }
}
