---
name: Expo dev preview stuck loading (slow bundle via Express proxy)
description: Why the Replit Expo preview / Expo Go / iOS simulator hang on "loading", and the fix that routes the bundle around the slow double-proxy.
---

# Expo dev preview / Expo Go / iOS simulator stuck on "loading"

When this app's dev server has a custom Express proxy sitting in front of Metro
(bare dev domain → external port 80 → Express on 8081 → http-proxy-middleware →
Metro on 8082), the ~12 MB native/web JS bundle streams through that Express hop
in **~38 s**. Expo Go and the Replit iOS simulator time out long before that, so
they hang on "Your app is starting…" / loading **every time**. The app itself is
healthy — only the delivery path is slow.

**Why:** Replit only streams large responses efficiently on ports flagged
`exposeLocalhost = true` (here port 8082 is exposed as external **3000**). Fetching
the exact same bundle from `https://<domain>:3000/...` takes **~0.6 s** vs ~38 s
through the Express proxy. The Express/http-proxy-middleware hop is the bottleneck,
not the app and not Metro.

**How to apply / the fix (two parts, both needed):**
1. Native (Expo Go + simulator): set `EXPO_PACKAGER_PROXY_URL=https://$REPLIT_DEV_DOMAIN:3000`
   in the Start Frontend workflow command. Metro then advertises the manifest
   `launchAsset` bundle URL on `:3000`, so native downloads straight from Metro.
2. Web preview (port 5000): in the Express `app.get("/")` handler, rewrite the
   relative `<script src="/...entry.bundle?...">` to absolute
   `https://<REPLIT_DEV_DOMAIN>:3000/...` so the browser pulls the web bundle from
   `:3000` too. (Metro sends no CORS header on `:3000`, so do NOT add
   `crossorigin` — that would break loading; the only downside is uncaught web
   errors show as "Script error.", acceptable trade for 60× speed.)

**Verify:** `curl -s -o /dev/null -w "%{time_total}"` the bundle URL on a *warm*
cache (first request includes Metro compile time and is slow regardless). Warm
should be <2 s. Check both `platform=ios` and `platform=web`.

**Note:** first-ever fetch of a given platform bundle is slow (~20-38 s) because
Metro compiles it on demand — that is build time, not the proxy. Only the warm
number reflects the fix.
