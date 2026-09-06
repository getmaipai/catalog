// The TUF-shaped signed index (session-d-packages-and-store.md step 6,
// docs/PACKAGES.md: "a signed root..., signed targets per version...,
// and a signed timestamp with a thirty-day expiry"). Deliberately
// TUF-SHAPED, not a full implementation of every TUF role/delegation
// (root/targets/timestamp only, no snapshot role, no per-kind delegated
// signing keys yet) - the plan's own wording, matched to what a single-
// maintainer catalog actually needs today: a signed trust anchor, signed
// per-version metadata, and a signed freshness check with real expiry,
// refusable when stale or rolled back. Growing toward fuller TUF
// (delegated roles per kind, a snapshot role) is a real, deferred option
// if the catalog ever has multiple independent publishers; nothing here
// forecloses it.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { signBytes, verifyBytes, keyId } from "./sign";

export interface SignedEnvelope<T> {
  signed: T;
  signatures: { keyid: string; sig: string }[];
}

export interface RootMetadata {
  type: "root";
  // TUF's own rollback defense: a verifying client remembers the highest
  // `version` it has ever seen for each role and refuses anything lower,
  // even a validly-signed, not-yet-expired file - the "rolled-back
  // index" tamper case (docs/PACKAGES.md) an expiry check ALONE can't
  // catch, since a withdrawn-but-still-valid older file is still
  // unexpired. Monotonic across builds (see build-index.ts).
  version: number;
  expires: string;
  keys: Record<string, { keytype: "ed25519"; public: string }>;
  roles: {
    root: { keyids: string[]; threshold: number };
    targets: { keyids: string[]; threshold: number };
    timestamp: { keyids: string[]; threshold: number };
  };
}

export interface TargetEntry {
  length: number;
  hashes: { sha256: string };
  custom: {
    source_commit: string;
    signer: string;
    min_app: string;
    requires: string[];
    permissions: string[];
    channel: "stable" | "beta";
    changelog_url?: string;
  };
}

export interface TargetsMetadata {
  type: "targets";
  version: number;
  expires: string;
  targets: Record<string, TargetEntry>;
}

export interface TimestampMetadata {
  type: "timestamp";
  version: number;
  expires: string;
  meta: { "targets.json": { length: number; hashes: { sha256: string } } };
}

// Recursively sorts every object's own keys (arrays keep their real
// order - a target's own `requires`/`permissions` lists are meaningful
// sequences, not sets). `JSON.stringify(obj, arrayOfKeys)` only
// whitelists/orders the TOP level; root.json's own nested `keys`/`roles`
// objects (and targets.json's own per-version `targets` map) need every
// level sorted, or two builds of the identical logical metadata with
// keys inserted in a different order would sign different bytes - found
// before this ever shipped, by tracing through what the hub's own
// verify step would need to reproduce byte-for-byte against whatever it
// parses off the wire.
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function canonicalize<T>(obj: T): Buffer {
  return Buffer.from(JSON.stringify(sortKeysDeep(obj)));
}

function sign<T>(signed: T, privateKeyPaths: { keyid: string; path: string }[]): SignedEnvelope<T> {
  const bytes = canonicalize(signed);
  return {
    signed,
    signatures: privateKeyPaths.map(({ keyid, path }) => ({ keyid, sig: signBytes(bytes, path) })),
  };
}

export interface SignerKey {
  publicKeyPath: string;
  privateKeyPath: string;
}

/** Builds and signs root.json. "A second signer slot from day one"
 * (docs/PACKAGES.md): every role's own `keyids` lists every signer
 * passed in, `threshold` fixed at 1 - either key alone can satisfy a
 * role today, the simplest real form of "a second slot exists" without
 * requiring a 2-of-2 ceremony for every future release before a real
 * key-loss recovery procedure is written (that procedure, and whether
 * to raise the threshold once it exists, is Jesse's own call, not this
 * function's). */
export function buildRoot(signers: SignerKey[], expiresInDays: number, version: number): SignedEnvelope<RootMetadata> {
  const keys: RootMetadata["keys"] = {};
  const keyids: string[] = [];
  for (const signer of signers) {
    const publicKeyPem = readFileSync(signer.publicKeyPath, "utf-8");
    const id = keyId(publicKeyPem);
    keys[id] = { keytype: "ed25519", public: publicKeyPem };
    keyids.push(id);
  }
  const root: RootMetadata = {
    type: "root",
    version,
    expires: new Date(Date.now() + expiresInDays * 86_400_000).toISOString(),
    keys,
    roles: {
      root: { keyids, threshold: 1 },
      targets: { keyids, threshold: 1 },
      timestamp: { keyids, threshold: 1 },
    },
  };
  return sign(
    root,
    signers.map((s) => ({ keyid: keyId(readFileSync(s.publicKeyPath, "utf-8")), path: s.privateKeyPath })),
  );
}

export function buildTargets(
  targets: Record<string, TargetEntry>,
  signer: SignerKey,
  expiresInDays: number,
  version: number,
): SignedEnvelope<TargetsMetadata> {
  const publicKeyPem = readFileSync(signer.publicKeyPath, "utf-8");
  const metadata: TargetsMetadata = {
    type: "targets",
    version,
    expires: new Date(Date.now() + expiresInDays * 86_400_000).toISOString(),
    targets,
  };
  return sign(metadata, [{ keyid: keyId(publicKeyPem), path: signer.privateKeyPath }]);
}

/** 30-day expiry per docs/PACKAGES.md: the one metadata file a household
 * hub is expected to re-fetch often (the daily `catalog.check` core job,
 * step 6's own plan text) - a short expiry is what makes a rolled-back
 * or withheld index detectable at all, the entire point of a timestamp
 * role in TUF's own design. */
export function buildTimestamp(
  targetsPath: string,
  signer: SignerKey,
  version: number,
  expiresInDays = 30,
): SignedEnvelope<TimestampMetadata> {
  const targetsBytes = readFileSync(targetsPath);
  const publicKeyPem = readFileSync(signer.publicKeyPath, "utf-8");
  const metadata: TimestampMetadata = {
    type: "timestamp",
    version,
    expires: new Date(Date.now() + expiresInDays * 86_400_000).toISOString(),
    meta: {
      "targets.json": {
        length: targetsBytes.length,
        hashes: { sha256: createHash("sha256").update(targetsBytes).digest("hex") },
      },
    },
  };
  return sign(metadata, [{ keyid: keyId(publicKeyPem), path: signer.privateKeyPath }]);
}

export function writeEnvelope<T>(envelope: SignedEnvelope<T>, path: string): void {
  writeFileSync(path, JSON.stringify(envelope, null, 2) + "\n");
}

/** Verifies every signature on an envelope against the given trusted
 * public keys (root.json's own `keys` map, or an out-of-band pinned key
 * for verifying root.json itself) - real enough to prove this file's own
 * signing round-trips correctly (tests/index-builder.test.ts) and for
 * `check.ts`'s CLI to self-verify what it just built. Not a substitute
 * for home's own hub-side `lib/storeIndex.ts`, which verifies against
 * ITS OWN pinned root key and adds the rest of the tamper suite (expiry,
 * rollback, hash-per-target) this function alone doesn't attempt -
 * different runtime, different trust boundary, the same reason MCP
 * itself has independent client and server implementations agreeing on
 * one wire contract rather than one shared verification module. Passes
 * (never throws) whenever `signed` was re-serialized identically to how
 * it was signed - true for anything this file's own canonicalize()
 * produced, since key order and value shape are both deterministic. */
export function verifyEnvelope<T>(envelope: SignedEnvelope<T>, trustedPublicKeysPem: string[]): boolean {
  const bytes = canonicalize(envelope.signed);
  return envelope.signatures.some((sig) => trustedPublicKeysPem.some((pem) => verifyBytes(bytes, sig.sig, pem)));
}
