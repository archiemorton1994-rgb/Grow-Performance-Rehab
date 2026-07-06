---
name: EAS build env vars on Replit
description: EXPO_PUBLIC_* vars must be set as Replit env vars, not just in eas.json, to be baked into EAS builds
---

# EAS build env vars on Replit

## The rule

`EXPO_PUBLIC_*` variables must be set as **Replit environment variables** (via `setEnvVars`) to be baked into the JS bundle by Metro during an EAS build. Putting them only in the `eas.json` `env` block is not sufficient with Replit's Expo Launch build pipeline.

**Why:** Replit's build system injects its own env vars into the EAS build process. The `eas.json` `env` block is read by the EAS CLI directly, but Replit's Expo Launch pipeline picks up Replit env vars, not necessarily the eas.json ones. If a var is only in eas.json, it resolves to empty string in the built bundle.

**How to apply:** For any `EXPO_PUBLIC_*` var needed in production builds:

1. Add it to `eas.json` `production.env` (belt)
2. Also set it as a Replit production env var via `setEnvVars({ values: {...}, environment: "production" })` (suspenders)

The proof: `EXPO_PUBLIC_DOMAIN` worked because it was a Replit env var. `EXPO_PUBLIC_REVENUECAT_API_KEY` was only in eas.json and resolved to `''` in every build, silently breaking RevenueCat.
