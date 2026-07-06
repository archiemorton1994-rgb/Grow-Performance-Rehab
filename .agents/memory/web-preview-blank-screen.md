---
name: Web preview blank screen fix
description: Root cause and fix for the Replit web preview showing blank white indefinitely
---

## The Problem

Replit web preview (port 5000 webview) showed blank white. React never mounted (`#root` had 0 children). No error visible because `window.onerror` was suppressed.

## Root Causes Found (two separate issues)

### 1. Cross-origin bundle URL hid the real error

`server/index.ts` was rewriting the bundle `src` attribute to point at port 3000 (Metro's external port). The page itself loads from port 5000. Cross-origin scripts report `"Script error."` to `window.onerror` with no detail, completely hiding the real crash.

**Fix**: Remove the port-3000 URL rewrite. The Metro HTML uses relative paths (`/node_modules/expo-router/entry.bundle?...`). The existing `devProxy` middleware in Express already forwards those to Metro on port 8082. Keep bundle same-origin → full error details visible.

### 2. react vs react-dom version mismatch

`react` was at `19.2.3` but `react-dom` was at `19.1.0`. React throws at module-init time: `"Incompatible React versions: react must match react-dom"`. Metro's `guardedLoadModule` catches this and swallows it (no window.onerror). React never mounts.

**Fix**: `npm install react-dom@19.2.3 --save-exact`

## Diagnostic Technique Used

Added `POST /api/web-diag` endpoint to Express and injected a diagnostic `<script>` into the served HTML that POSTed `window.onerror`, `ErrorUtils.reportError`, and `console.error` events to the server. Server logs then revealed the full error message once the bundle was same-origin.

**Why:** Metro's `guardedLoadModule` catches module-init errors via `ErrorUtils.reportError()` (not `window.onerror`), silently swallowing them. Cross-origin scripts compound this by reducing `window.onerror` to `"Script error."`. Server-side logging via fetch() is the only reliable way to surface these errors.

## How to apply

- Whenever the web preview is blank and there's no visible error: check if the bundle script src is cross-origin. If so, make it same-origin first.
- After fixing origin: check server logs for `[WEB-DIAG]` entries to see the actual crash.
- Always keep `react` and `react-dom` at the exact same version. A caret range on either one allows semver drift.
