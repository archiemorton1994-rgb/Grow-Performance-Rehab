/**
 * Somewhere for the persisted store to write to, under Node.
 *
 * WHY THIS EXISTS
 * ───────────────
 * A handful of check scripts drive the real zustand store. It is wrapped in
 * `persist`, which writes through AsyncStorage, and AsyncStorage on web is
 * `window.localStorage` — which does not exist in Node. The write is
 * asynchronous, so for as long as those scripts ended with `process.exit(0)`
 * the process was gone before it could throw and nobody ever knew.
 *
 * Switching them to `process.exitCode` (so a pipe-buffered stdout is not torn
 * down mid-write on Windows) let Node live long enough to run the write, and
 * the crash it had been hiding surfaced: a full set of passing checks followed
 * by a ReferenceError and a non-zero exit.
 *
 * A Map is enough. Nothing reads persisted state back — these scripts seed the
 * store directly with setState — this only has to exist so the write lands
 * somewhere instead of throwing.
 *
 * Import it BEFORE the store:
 *     import './_persist-shim.mjs';
 *     import { useAppStore } from '../lib/store.ts';
 */
if (typeof globalThis.window === 'undefined') {
  const mem = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => void mem.set(k, String(v)),
      removeItem: (k) => void mem.delete(k),
      clear: () => mem.clear(),
    },
  };
}
