---
name: Expo dev preview / Expo Go stuck loading (cold-build vs port tunnels)
description: Why the Replit Expo preview / Expo Go / iOS simulator hang on "loading", and the real fix — pre-warm bundles + serve over the standard dev domain (NOT :3000).
---

# Expo dev preview / Expo Go / iOS simulator stuck on "loading"

The app is healthy — only bundle _delivery on a cold cache_ fails. The big dev
bundle (~13 MB) is compiled lazily by Metro on first request. Cold-build time is
large and platform-dependent: iOS ~2-12 s, **Android up to ~43 s**, web ~2 s.

**Why it hangs:** Replit's external port tunnels behave differently while Metro
is mid-cold-build (no bytes yet):

- The `exposeLocalhost` tunnel (here Metro 8082 → external **:3000**) **drops the
  connection during a cold build** — a cold request returns _nothing_ even past
  40 s, so the device is stuck. This is the trap: `:3000` is fast **only when
  warm** (~0.6 s); cold it fails outright.
- The bare dev domain path (external 80 → Express on 8081 →
  http-proxy-middleware → Metro 8082) **tolerates** cold builds because the proxy
  is configured `proxyTimeout: 0, timeout: 0` (waits indefinitely). Cold is slow
  (~38 s) but completes; warm is ~0.6 s.

So routing the device to `:3000` (via `EXPO_PACKAGER_PROXY_URL=...:3000`) makes it
_worse_: every fresh load is cold → `:3000` drops → "stuck loading every time".

**The fix (two parts):**

1. **Pre-warm every platform bundle on server startup** (dev only). After Metro's
   `/status` returns `packager-status:running`, fetch the ios + android + web
   `entry.bundle` once (use the exact `launchAsset` query params from the
   manifest; for web, scrape the `<script src=...bundle>` from Metro's `/` HTML).
   This moves the slow cold compile into the background so every _device_ request
   hits a warm cache (<1 s). See `prewarmMetroBundles()` in `server/index.ts`.
2. **Serve everything over the standard dev domain, not `:3000`.** Set
   `EXPO_PACKAGER_PROXY_URL=https://$REPLIT_DEV_DOMAIN` (no port) so the manifest
   `launchAsset`, `hostUri`, and `debuggerHost` all use the bare domain, where the
   no-timeout Express proxy is robust. Do NOT rewrite the web `<script>` bundle
   URL to `:3000` either — leave Metro's relative path so it resolves to the same
   robust origin.

**Why this is robust:** the bare-domain proxy never drops on cold (worst case
slow), and pre-warming removes the cold case for real users entirely. `:3000`
offered no speed advantage warm (both ~0.6 s) and was fragile cold.

**Verify:** after restart, `curl -H "expo-platform: ios" https://<domain>/` — the
manifest `launchAsset`/`hostUri`/`debuggerHost` must be the bare domain (no
`:3000`). Then `curl -w "%{time_total}"` the bundle on the bare domain — warm
should be <1 s. Check backend logs for `[prewarm] ios/android/web bundle ready`.

**Note:** EAS / Expo Launch (production) builds are unaffected — this is all dev
server delivery, gated by `NODE_ENV === "development"`.
