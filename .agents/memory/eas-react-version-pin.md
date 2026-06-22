---
name: EAS build React version pin
description: react and react-native-renderer must be exactly the same version in EAS production builds
---

The rule: pin `react` to an exact version in package.json — no caret, no range.

**Why:** The EAS cloud build resolves `"react": "^19.2.3"` to the latest patch (e.g. 19.2.7) while `react-native-renderer` stays pinned by `react-native` at the version it was published with (e.g. 19.2.3). React enforces exact parity and throws a fatal JS exception at ~700ms on launch if they differ. This killed 11 consecutive builds before being caught via the crash logger.

**How to apply:** Whenever `react` version is changed (or a new Expo SDK is adopted), run `bun add react@X.Y.Z` or `npm install react@X.Y.Z` with an exact version — no `^` or `~`. Check that `react-native-renderer` in the lockfile matches.
