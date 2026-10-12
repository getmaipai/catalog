# lists/

The blocked-site list index: one pin per list the MaiPai Home hub may sync, each at an immutable upstream commit with its
sha256, byte size, entry count, format and licence. Which lists exist, which age bands start with them and which cannot
turn them off is decided in `getmaipai/commons` (`spec/search/blocklists.json`); this file can refresh a pin and can
never unlock a list or add one a minor gets. An id the spec does not know is refused here and ignored by the hub.

`index.json` is the reviewed source. `list-index.json` is its signed, published release asset. The file itself is never
hosted here: each home fetches it from the upstream project, and the pin proves it is the reviewed bytes.

Re-pin (maintainer, monthly):

    cd tools
    bun run src/list-repin.ts -- --id blp-porn --repo blocklistproject/Lists --commit <40-hex> \
      --path porn.txt --format hosts --licence Unlicense --upstream "The Block List Project"

The script fetches the file, counts entries with the spec's `parseHostList`, and refuses the pin when the licence is not
accepted, entries move more than 20% from the last pin, any entry is a public suffix or a canary host (or a parent of
one, see `canary.json`), or the file is over 128 MiB or 3 million entries.
