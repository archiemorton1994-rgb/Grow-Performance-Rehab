---
name: Production crash — EXPO_PUBLIC_DOMAIN not in EAS build
description: Workflow env vars are never passed to EAS/Expo Launch builds; throwing on missing EXPO_PUBLIC vars causes instant fatal crash in production
---

## Rule
`EXPO_PUBLIC_*` variables set in Replit workflow commands (e.g. `EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN`) are NOT baked into EAS/Expo Launch builds. Any code that throws on a missing `EXPO_PUBLIC_*` var will cause an instant SIGABRT crash in production (`__DEV__=false` means unhandled JS errors go to `RCTFatal`).

**Why:** EAS Build runs in an isolated Expo-managed environment that only receives env vars declared in `eas.json`'s `env` section or set as EAS secrets. Replit workflow env vars only exist for the local dev server process.

**How to apply:**
- Never `throw` on a missing `EXPO_PUBLIC_*` — always provide a hardcoded production fallback.
- Add all required `EXPO_PUBLIC_*` vars (that aren't secrets) to `eas.json` `build.production.env`.
- `EXPO_PUBLIC_*` Replit secrets ARE passed automatically by Expo Launch — only non-secret public vars need eas.json.
- Crash signature: EXC_CRASH (SIGABRT), `RCTFatal` ← `RCTExceptionsManager.reportFatalException`, crash within ~500ms of launch.
