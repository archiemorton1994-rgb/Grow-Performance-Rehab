---
name: Metro stale file-map cache after dependency reinstall
description: "Unable to resolve module" for files that DO exist → clear Metro caches, restart.
---

# Metro "Unable to resolve module" after a reinstall = stale file-map cache

After a dependency reinstall that rewrites files inside `node_modules` (e.g. an SDK
downgrade, or any install that changes a package's on-disk files), Metro can fail a
web/native bundle with `Unable to resolve module ./X from .../Y` **even though the
target file physically exists**. A tell-tale companion error is
`Error: Got unexpected undefined ... at nullthrows ... Graph._recursivelyCommitModule`.

**Why:** Metro caches a file map (haste map) in `/tmp`. If the cache predates the
reinstall, Metro doesn't see newly-written files, so resolution lists the correct
extension (e.g. `.tsx`) yet still "can't find" it.

**Fix:** clear the Metro caches and restart the Metro/Expo workflow so it rebuilds the
map:
`rm -rf /tmp/metro-cache /tmp/metro-file-map-* /tmp/haste-* node_modules/.cache`
then restart the frontend workflow (do not run `npx expo` directly — use the workflow
tool).

**How to apply:** reach for this whenever a bundle breaks on a resolve error
immediately after a package install/downgrade, especially if the same bundle built
fine on the previous install. Don't chase it as a real missing-file/version bug first
— verify the file exists on disk, then clear the cache.
