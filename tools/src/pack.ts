// Deterministic packing (session-d-packages-and-store.md step 6,
// docs/PACKAGES.md's "release and signing": "the maintainer's machine
// rebuilds from the reviewed commit, packs it, computes the sha256,
// signs it"). The same package directory packed twice, even on two
// different machines, must produce byte-identical output - otherwise
// sign.ts's own signature (over this tarball's bytes) would depend on
// filesystem timestamps and directory-listing order, not just the
// package's actual content, and a maintainer re-running pack on a
// clean checkout could produce a hash that doesn't match what CI
// already verified.
import { createHash } from "node:crypto";
import { readFileSync, lstatSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import * as tar from "tar";

// lstatSync, never statSync: statSync follows a symlink to decide
// isFile(), so a symlink whose target happens to be a file (anywhere on
// disk, including outside the package directory - `ln -s /etc/passwd
// evil-link`) would pass the check and get included, and node-tar's own
// default (it does not resolve symlink targets when packing) then writes
// that symlink into the tarball VERBATIM, target string and all. The
// result is a signed artifact carrying an attacker-controlled symlink a
// downstream installer could later read or write through. This repo
// takes community PRs (the org's one PR carve-out), so a package
// directory is untrusted input until lint/pack have run over it - a
// symlink is refused outright rather than silently followed or dropped.
async function listFilesSorted(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) {
      throw new Error(`${dir} contains a symlink at ${relative(dir, full)} - packages may not contain symlinks`);
    }
    if (stat.isFile()) files.push(relative(dir, full));
  }
  // Sorted so the tarball's own entry order never depends on the host
  // filesystem's own readdir order (which is not guaranteed stable
  // across platforms or even across runs on the same one).
  return files.sort((a, b) => a.localeCompare(b));
}

export interface PackResult {
  outFile: string;
  sha256: string;
  size: number;
}

/** Packs `dir`'s own files (not `dir` itself - unpacking `outFile` drops
 * files directly into a target directory, never one level too deep) into
 * a gzipped tarball at `outFile`, deterministically: sorted file order,
 * `portable`/`noMtime` (node-tar's own reproducibility flags - no uid/
 * gid, no per-file mtime) so the only thing that can change the output
 * bytes is the package's own content. */
export async function packPackage(dir: string, outFile: string): Promise<PackResult> {
  const files = await listFilesSorted(dir);
  if (files.length === 0) throw new Error(`${dir} has no files to pack`);
  await tar.create({ file: outFile, cwd: dir, gzip: true, portable: true, noMtime: true }, files);
  const bytes = readFileSync(outFile);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { outFile, sha256, size: bytes.length };
}
