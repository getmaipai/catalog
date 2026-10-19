# models/

The model index: every model the MaiPai Stack may install, pinned by exact
URL, sha256 and byte count, with its role, engine, license, revision and
hardware profile. The Stack reads the published `model-index.json` release
asset during its opt-in update check; nothing installs without an explicit
action.

`index.json` is the reviewed source. `model-index.json` is its signed,
published form. Every entry currently has quality seed `1`; the Studio bench
will measure and replace that seed when the model-quality protocol lands.

## Coding model package gap (CODE-STACK-01 C2)

There are no model package directories to mirror yet; the chat models are
entries in `index.json`. The pinned `@maipai/spec` manifest schema permits
`kind: "model"`, but has no model declaration for the download URL, file,
revision, sha256, byte count, quantization, sampling or coding role. It also
has no model machine-tier eligibility, admin removal policy or first-run
model recommendation fields. `min_role` is an invocation floor, `tier` is
an execution tier, and `source` describes a package source repo, not model
weights. The open `setup` object does not define model recommendations.

C2 is paused at that schema boundary. No package or model-index entry was
added for `qwen3.8-27b-ud-q4-k-m`. The shared spec needs those fields before
a package can declare the requested p64 and p128 support and install rules.
The existing `data_sources` field can carry the install-time download
privacy row once the model package contract exists.
