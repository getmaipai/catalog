# moves/

The optional recorded emotions and dances pack (PKG-MOVES-01): 82 emotion clips and 19 dance clips from Pollen
Robotics' two Hugging Face datasets, each pinned by full commit revision, file name, sha256 and byte size. Home
installs the pack on request; the robot never fetches it, Home serves each clip to the robot after checking its
sha256. Without the pack, the expression map plays only the built-in primitives.

`index.json` is the reviewed source. `moves-index.json` is its signed, published release asset (same envelope as
`model-index.json` and `list-index.json`, thirty-day expiry). The clip files are never hosted or copied here: a clip's
address is the library's `base_url` plus the clip's `file`. The pins live in this index and nowhere in the spec's
`robot-assets.json`.

| Field | Meaning |
|---|---|
| `libraries[].id` | `pollen-emotions` or `pollen-dances` |
| `libraries[].base_url` | `https://huggingface.co/datasets/<repo>/resolve/<40-hex commit>/`, never a branch; must name the same repo and revision |
| `libraries[].clips[]` | `id`, `file` (`<id>.json`), `sha256`, `bytes`, `description` (the dataset's clip index) |
| `libraries[].excluded[]` | clips that were pinned and failed the envelope or format check, with the reason; never installed, never clipped |

Excluded today, all for the antenna limit and never clipped: `sad2` (right antenna 3.1469 rad), `mini-deep-sleep`
(left antenna -3.1493 rad) and `wake-mini-up` (right antenna 3.1416 rad, over the limit by a rounding margin). The
robot player accepts equal neighbouring timestamps, so `toc-toc-toc` and `waiting` are pinned.

The age allow-list (no `rage, furious, dying, contempt, disgusted, go_away, reprimand` for a child, a teen or an
unstated age band) is enforced on the robot in `bot` (`moves/allowlist.py`) and by the spec's emotion map; this index
lists every playable clip and decides nothing about who may see it. Motion only: the datasets' Opus audio sidecars
are not part of v1.

The index validator (`tools/src/moves-index.ts`) refuses a branch URL, a revision that differs from the URL, a licence
the catalog does not accept, a bad sha256, a zero size, a file name that is not `<id>.json`, and a clip that is also
excluded. Attribution is in `NOTICE` beside this file.

Re-pin: run `scripts/pin_moves_library.py` in `getmaipai/bot` on the dev Mac (it downloads the clips, checks each
against the robot's envelope and writes `moves/pins.json`), then regenerate `index.json` from that file plus the
dataset tree for the byte sizes.
