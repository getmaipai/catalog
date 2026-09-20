// A signer entry is { login, signed, version }, added by a maintainer in the
// same commit that records the signed assignment. This file records data only;
// ASSIGNMENT.md remains the owner's legal text.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Signer = { login: string; signed: string; version: string };
export type Signers = { assignment_version: string; maintainers: string[]; signers: Signer[] };

export function loadSigners(path: string): Signers {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof value !== "object" || value === null) throw new Error("signers.json must be an object");
  const record = value as Record<string, unknown>;
  const version = record.assignment_version;
  const maintainers = record.maintainers;
  const signers = record.signers;
  if (typeof version !== "string" || !Array.isArray(maintainers) || !maintainers.every((login) => typeof login === "string") || !Array.isArray(signers)) {
    throw new Error("signers.json has an invalid shape");
  }
  const parsed: Signer[] = [];
  for (const signer of signers) {
    if (typeof signer !== "object" || signer === null) throw new Error("signers.json has an invalid signer");
    const entry = signer as Record<string, unknown>;
    if (typeof entry.login !== "string" || typeof entry.signed !== "string" || typeof entry.version !== "string") {
      throw new Error("signers.json has an invalid signer");
    }
    if (entry.version !== version) throw new Error(`signer ${entry.login} has an unsupported assignment version`);
    parsed.push({ login: entry.login, signed: entry.signed, version: entry.version });
  }
  const logins = [...maintainers, ...parsed.map(({ login }) => login)].map((login) => login.toLocaleLowerCase());
  if (new Set(logins).size !== logins.length) throw new Error("signers.json contains duplicate logins");
  return { assignment_version: version, maintainers, signers: parsed };
}

export function hasSigned(signers: Signers, login: string): boolean {
  const wanted = login.toLocaleLowerCase();
  return signers.maintainers.some((entry) => entry.toLocaleLowerCase() === wanted)
    || signers.signers.some((entry) => entry.version === signers.assignment_version && entry.login.toLocaleLowerCase() === wanted);
}

if (import.meta.main) {
  const login = Bun.argv[2];
  if (!login) process.exit(1);
  const signers = loadSigners(join(import.meta.dir, "../../signers.json"));
  if (hasSigned(signers, login)) {
    console.log("signed");
    process.exit(0);
  }
  console.error(`not signed: ${login} must sign ASSIGNMENT.md`);
  process.exit(1);
}
