# models/

The model index: every model the MaiPai Stack may install, pinned by exact
URL, sha256 and byte count, with its role, engine, license, revision and
hardware profile. The Stack reads the published `model-index.json` release
asset during its opt-in update check; nothing installs without an explicit
action.

`index.json` is the reviewed source. `model-index.json` is its signed,
published form. Every entry currently has quality seed `1`; the Studio bench
will measure and replace that seed when the model-quality protocol lands.
