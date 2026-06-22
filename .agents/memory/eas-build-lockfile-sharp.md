---
name: EAS build lockfile and sharp pitfalls
description: Two EAS build failure patterns: bun lockfile version mismatch, and sharp native build blocking npm ci
---

## Bun lockfile mismatch

The Replit environment runs bun 1.3.6; EAS build servers run bun 1.3.13. The `bun.lock` generated locally is rejected by `--frozen-lockfile` on the build server.

**Fix:** Delete `bun.lock` and switch to npm (`npm install` generates `package-lock.json`). EAS detects package manager from which lockfile is present.

**Warning:** Replit's `installLanguagePackages` tool routes through `package-firewall.replit.local`. Any package installed via the tool gets a proxy URL baked into `package-lock.json`. That URL is unreachable on the EAS build server → ENOTFOUND.

**Fix for proxy URLs:** `sed -i 's|http://package-firewall.replit.local/npm/<pkg>/-/|https://registry.npmjs.org/<pkg>/-/|g' package-lock.json`. Check count first with `grep -c "package-firewall.replit.local" package-lock.json`.

## sharp native build blocking npm ci

`sharp` is a direct dependency (used by expo-image-utils). The EAS build environment cannot download the prebuilt `@img/sharp-darwin-arm64` binary. Sharp falls back to building from source and demands `node-addon-api` then `node-gyp` in sequence.

**Fix:** Move `sharp` to `optionalDependencies` in both `package.json` and `package-lock.json` (add `"optional": true` to the `node_modules/sharp` entry). npm will attempt the install but not fail the build if it can't compile. Expo falls back to jimp for image processing.
