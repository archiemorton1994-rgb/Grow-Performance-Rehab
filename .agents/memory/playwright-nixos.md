---
name: Playwright Chromium in NixOS
description: Pre-built Playwright Chromium binary can't find libglib-2.0.so.0 in Replit's NixOS environment; Metro also crashes if Playwright writes test-results inside the project root.
---

## Rule

Do not rely on Playwright's bundled Chromium for CI validation commands in this Replit NixOS environment.

**Why:**

- Playwright's `chromium_headless_shell` binary is compiled against standard `/usr/lib` paths which don't exist in NixOS.
- `installSystemDependencies(['glib', ...])` puts libs in the Nix store (e.g. `/nix/store/*/lib`), but the binary can't find them because `LD_LIBRARY_PATH` isn't set and `find /nix/store` times out before a path can be discovered.
- `ldconfig -p` returns nothing; `/run/current-system/sw/lib`, `/usr/lib`, and nix profile lib dirs all lack `libglib-2.0.so.0`.
- Playwright's default `outputDir` (`./test-results/`) writes trace artefacts into the project root, which Metro's `FallbackWatcher` watches. When Playwright cleans up a trace directory at test end, Metro throws `ENOENT: watch '…/traces/resources'` and crashes the entire frontend workflow.

**How to apply:**

- For behavioral contract tests that need to run in CI: write them as `node tests/*.check.mjs` scripts (Node 22 ESM, no browser dependency).
- Keep `playwright.config.ts` with `outputDir: '/tmp/playwright-results'` so stray Playwright runs don't crash Metro.
- Keep `tests/*.spec.ts` Playwright specs for documentation and for use in environments with a real browser (e.g. GitHub Actions with ubuntu-latest).
- Jest (`jest-expo` preset) also hangs in this environment due to ESM/CJS conflicts — do not use it. Node ESM scripts (`.mjs`) work fine.
- `runTest()` via the testing skill DOES work (separate infrastructure with its own browser).
