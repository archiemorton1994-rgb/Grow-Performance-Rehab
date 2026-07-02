#!/usr/bin/env bash
# Run Playwright with LD_LIBRARY_PATH derived from the Replit NixOS HOST_PATH.
#
# Playwright's bundled Chromium is a precompiled Linux binary that looks for
# system libraries in standard paths (/usr/lib, /lib, etc.), which don't exist
# in Replit's NixOS. All required libraries (glib, dbus, eudev, X11, etc.) ARE
# installed via replit.nix but sit under /nix/store/<hash>/lib/. Replit exposes
# every installed package's /bin/ in HOST_PATH; converting those /bin entries to
# /lib entries gives us the full set of library paths Chromium needs.
#
# Usage:  bash scripts/run-playwright.sh [playwright args...]
# Example: bash scripts/run-playwright.sh tests/body-diagram.spec.ts --reporter=line

set -e

if [ -n "$HOST_PATH" ]; then
  DERIVED_LIB=$(echo "$HOST_PATH" | tr ':' '\n' | sed 's|/bin$|/lib|' | paste -sd ':' -)
  export LD_LIBRARY_PATH="${DERIVED_LIB}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

exec npx playwright test "$@"
