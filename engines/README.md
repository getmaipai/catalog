# engines/

The engine index: every engine build MaiPai Stack may install, pinned
by exact URL, sha256 and size, per platform, with its licence. The Stack
reads the published copy (`engine-index.json` on the latest release)
through its opt-in update check and answers "installed X, available Y"
for engines from it; nothing installs without an explicit action.

`index.json` is the source, edited by hand and reviewed like a package:
an entry is `name`, `tag` (the upstream build tag, `b10797`),
`platform` (`darwin`, `linux`, `win32`), `arch` (`arm64`, `x64`), `url`,
`sha256`, `size`, `licence`, optional `requires` (`nvidia`), optional
`extra` archives (a CUDA runtime), and `notes` (where it was verified).
A tag is immutable: a newer upstream build is a new entry, never an
edit to an old one's URL or checksum.

`bun run src/engine-index.ts -- <outFile> [keysDir]` in `tools/`
validates the source against its schema and writes the signed envelope
(`{ signed: { type, version, expires, engines }, signatures }`, the
same shape as the package index) that the release attaches. The release
key is the catalog's (see `docs/dev.md`, signing); a local build uses
the dev signers.
