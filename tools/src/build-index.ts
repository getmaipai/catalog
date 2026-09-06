// Ties pack.ts, sign.ts, and index-builder.ts into the one real artifact
// a store install actually needs: a directory of signed tarballs plus a
// signed root/targets/timestamp index (session-d-packages-and-store.md
// step 6, docs/PACKAGES.md's "Release and signing"). Two real callers:
// the public CI workflow (a tag-triggered publish, an online timestamp
// key per docs/PACKAGES.md) and `home`'s own `scripts/refresh-bundled-
// packages.sh` (a local dev key, building the exact same shape so the
// bundled default set is installed through the identical verify/unpack
// path a real store install uses, never a shortcut copy).
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { generateKeyPair, type KeyPairFiles } from "./sign";
import { packPackage } from "./pack";
import { buildRoot, buildTargets, buildTimestamp, writeEnvelope, type TargetEntry, type SignerKey } from "./index-builder";
import { findPackages } from "./check";

export interface PackageToIndex {
  /** The package's own directory on disk. */
  dir: string;
  /** Its target path inside the index, e.g. "plugins/utilities/weather/0.1.0". */
  targetPath: string;
}

export interface BuiltIndex {
  outDir: string;
  rootPath: string;
  targetsPath: string;
  timestampPath: string;
  /** targetPath -> the tarball actually written for it, under outDir. */
  tarballs: Record<string, string>;
}

interface Manifest {
  version: string;
  min_app: string;
  requires?: string[];
  permissions?: string[];
  channel?: "stable" | "beta";
}

// `git rev-parse HEAD` alone succeeds even with uncommitted local edits
// to the package (it just names the last commit, not the working tree) -
// a real gap found by code review: source_commit would then name a
// commit whose content doesn't match the tarball actually signed. A
// "-dirty" suffix (git's own long-standing convention, e.g. `git
// describe --dirty`) makes that mismatch visible in the provenance field
// itself instead of silently claiming false precision.
function gitCommit(dir: string): string {
  try {
    const head = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    // `-- .`: scoped to this package's own directory, not the whole
    // repo - an unrelated dirty file elsewhere in the catalog checkout
    // (another package mid-edit) must never mark THIS package "-dirty".
    const isDirty =
      execFileSync("git", ["-C", dir, "status", "--porcelain", "--", "."], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim().length > 0;
    return isDirty ? `${head}-dirty` : head;
  } catch {
    // Not a git repo at all - a provenance field this loose is still
    // useful for a local dev build, just never trustworthy as "the exact
    // reviewed commit" the way a real tagged CI build's own git
    // rev-parse is.
    return "unknown";
  }
}

/** Ensures a local signing keypair exists at `keysDir` (generating one on
 * first use), and returns both signer slots - "a second signer slot from
 * day one" (index-builder.ts) needs two real keys, not one key used
 * twice. This is a LOCAL DEV convenience for building the bundled
 * default set and running the tools' own tests, never the real
 * maintainer release key: that one is offline, human-held, and outside
 * every repo by the org's own hard rule (getmaipai/.github/CLAUDE.md >
 * Credentials and secrets), the same reason this function writes under
 * `keysDir` (the caller's choice - `home`'s refresh script points it at
 * `~/.config/maipai/catalog-dev-signing/`, never into either repo). */
export function ensureDevSigners(keysDir: string): { primary: SignerKey; secondary: SignerKey } {
  mkdirSync(keysDir, { recursive: true });
  const make = (name: string): SignerKey => {
    const privateKeyPath = join(keysDir, `${name}.private.pem`);
    const publicKeyPath = join(keysDir, `${name}.public.pem`);
    if (!existsSync(privateKeyPath) || !existsSync(publicKeyPath)) {
      generateKeyPair(privateKeyPath, publicKeyPath) satisfies KeyPairFiles;
    }
    return { privateKeyPath, publicKeyPath };
  };
  return { primary: make("primary"), secondary: make("secondary") };
}

/** Packs, signs, and indexes `packages`, writing every artifact
 * (tarballs, root.json, targets.json, timestamp.json) fresh under
 * `outDir` (cleared first - this always produces a complete, self-
 * consistent set, never a stale mix of an old build and a new one). */
export async function buildIndex(
  packages: PackageToIndex[],
  outDir: string,
  signers: { primary: SignerKey; secondary: SignerKey },
  // Defaults to the current Unix time in seconds: monotonic across real
  // builds (the only property index-builder.ts's rollback defense
  // needs), with no counter file for this function to own reading/
  // writing. A caller with a real release counter (the public CI
  // workflow, eventually) passes its own instead.
  version: number = Math.floor(Date.now() / 1000),
): Promise<BuiltIndex> {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // A duplicate targetPath is a caller bug (two source directories
  // claiming the same id/category/version slot) - refused up front,
  // rather than silently packing both and letting the second overwrite
  // the first's targets.json entry (and orphan its already-written
  // tarball on disk with nothing in the index pointing to it).
  const seen = new Set<string>();
  for (const pkg of packages) {
    if (seen.has(pkg.targetPath)) {
      throw new Error(`duplicate target path ${pkg.targetPath} (from ${pkg.dir})`);
    }
    seen.add(pkg.targetPath);
  }

  const targets: Record<string, TargetEntry> = {};
  const tarballs: Record<string, string> = {};

  // Each package's own pack (a tar+gzip+sha256 over its own directory) is
  // independent I/O - run them concurrently rather than one at a time,
  // real wall-clock time on a catalog with many packages.
  await Promise.all(
    packages.map(async (pkg) => {
      const manifest = JSON.parse(readFileSync(join(pkg.dir, "manifest.json"), "utf-8")) as Manifest;
      const tarballName = pkg.targetPath.replace(/\//g, "_") + ".tgz";
      const outFile = join(outDir, tarballName);
      const packed = await packPackage(pkg.dir, outFile);
      targets[pkg.targetPath] = {
        length: packed.size,
        hashes: { sha256: packed.sha256 },
        custom: {
          source_commit: gitCommit(pkg.dir),
          signer: "primary",
          min_app: manifest.min_app,
          requires: manifest.requires ?? [],
          permissions: manifest.permissions ?? [],
          channel: manifest.channel ?? "stable",
        },
      };
      tarballs[pkg.targetPath] = outFile;
    }),
  );

  const root = buildRoot([signers.primary, signers.secondary], 365, version);
  const targetsEnvelope = buildTargets(targets, signers.primary, 365, version);
  const rootPath = join(outDir, "root.json");
  const targetsPath = join(outDir, "targets.json");
  writeEnvelope(root, rootPath);
  writeEnvelope(targetsEnvelope, targetsPath);
  const timestamp = buildTimestamp(targetsPath, signers.primary, version);
  const timestampPath = join(outDir, "timestamp.json");
  writeEnvelope(timestamp, timestampPath);

  return { outDir, rootPath, targetsPath, timestampPath, tarballs };
}

/** Discovers every package under `repoRoot`'s kind directories (the same
 * walk check.ts's own `findPackages` uses) and derives each one's own
 * target path (its repo-relative directory plus its manifest version -
 * e.g. "plugins/utilities/weather/0.1.0") so a caller never hand-
 * maintains the id/category/version -> path mapping in two places. */
export function packagesToIndex(repoRoot: string): PackageToIndex[] {
  return findPackages(repoRoot).map((dir) => {
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf-8")) as Manifest;
    return { dir, targetPath: `${relative(repoRoot, dir)}/${manifest.version}` };
  });
}

// CLI: `bun run build-index -- <outDir> [keysDir]`. Indexes every package
// in this repo (the same set `bun run check` just cleared) - a caller
// building only a subset (home's own refresh script, D-owned ids only)
// calls buildIndex()/packagesToIndex() directly instead.
if (import.meta.main) {
  const [outDir, keysDir] = process.argv.slice(2);
  if (!outDir) {
    console.error("usage: bun run build-index -- <outDir> [keysDir]");
    process.exit(1);
  }
  const repoRoot = join(import.meta.dir, "..", "..");
  const signers = ensureDevSigners(keysDir ?? join(homedir(), ".config", "maipai", "catalog-dev-signing"));
  const built = await buildIndex(packagesToIndex(repoRoot), outDir, signers);
  console.log(`built index at ${built.outDir}: ${Object.keys(built.tarballs).length} package(s)`);
}
