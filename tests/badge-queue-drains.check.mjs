/**
 * Contract test: the badge queue always drains, even when it has nothing to show.
 *
 * WHAT WENT WRONG
 * ───────────────
 * `newlyUnlockedBadges` is a queue of pop-ups still to present. It is
 * deliberately NOT persisted (see the partialize block in lib/store.ts) so that
 * a pop-up which fails to present cannot brick the app past a reboot.
 *
 * The enqueue effect consumed ids into `enqueuedBadgeIds` and then queued a
 * toast — but only INSIDE each branch:
 *
 *     newIds.forEach((id) => enqueuedBadgeIds.current.add(id));   // consumed
 *     ...
 *     const badge = BADGE_MAP.get(newIds[0]);
 *     if (badge) { setToastQueue(...); setHasQueuedWork(true); }  // only if found
 *
 * An id BADGE_MAP could not resolve — a badge renamed or retired while a queue
 * referencing it was still in flight — was therefore marked as consumed while
 * queueing nothing. The cleanup effect is gated on `hasQueuedWork`, so it never
 * ran, and `newlyUnlockedBadges` stayed non-empty for the life of the process.
 *
 * WHY THAT IS A FROZEN APP AND NOT A MISSING BADGE
 * ────────────────────────────────────────────────
 * The guided-tour intro is gated on `newlyUnlockedBadges.length === 0`. That
 * guard is correct and load-bearing — it is what stops the tour Modal and the
 * achievement Modal presenting together, which breaks touch routing on both
 * (see tests/root-modal-exclusivity.check.mjs). But it means a queue that
 * cannot drain silently suppresses the tour forever.
 *
 * Reported as: onboarding finishes, the app lands on Home, no pop-up appears,
 * nothing happens, and the only way to proceed is a restart — which works
 * precisely because the queue is not persisted.
 *
 * Run:  node tests/badge-queue-drains.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';

let failures = 0;
let total = 0;
function check(label, condition, detail) {
  total++;
  if (condition) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

const src = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');

// Isolate the enqueue effect: from where ids are consumed to the end of it.
const start = src.indexOf('newIds.forEach((id) => enqueuedBadgeIds.current.add(id));');
const end = src.indexOf('}, [newlyUnlockedBadges]);', start);
check('the badge enqueue effect was found', start !== -1 && end !== -1);
const effect = start === -1 ? '' : src.slice(start, end);

// ── 1. Consuming ids and queueing work cannot come apart ─────────────────────
check(
  'ids are marked consumed exactly once',
  (effect.match(/enqueuedBadgeIds\.current\.add/g) ?? []).length === 1,
  'more than one consume path means more than one way to leak'
);
check(
  'the work flag is set unconditionally, not inside a branch',
  (effect.match(/setHasQueuedWork\(true\)/g) ?? []).length === 1 &&
    /\n\s{4}setHasQueuedWork\(true\);\s*$/.test(effect.replace(/\s+$/, '') + '\n'),
  'a lookup that misses would consume the id and queue nothing, wedging the queue'
);

// ── 2. The cleanup can actually be reached ───────────────────────────────────
const cleanupStart = src.indexOf('if (currentToast !== null || toastQueue.length > 0) return;');
const cleanup = cleanupStart === -1 ? '' : src.slice(cleanupStart, cleanupStart + 400);
check('the drain effect was found', cleanupStart !== -1);
check(
  'the drain clears the store queue',
  /clearNewlyUnlockedBadges\(\)/.test(cleanup),
  'nothing clears newlyUnlockedBadges'
);
check(
  'and resets the consumed-id set with it',
  /enqueuedBadgeIds\.current\.clear\(\)/.test(cleanup),
  'ids would stay consumed and a genuine re-unlock would be swallowed'
);

// ── 3. The guard that makes this fatal is still in place ─────────────────────
// Not a suggestion to remove it — it is what stops two native Modals presenting
// at once. This asserts it exists so the comment above stays true.
const tabs = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
check(
  'the tour intro is still gated on the badge queue being empty',
  /showTourIntro && newlyUnlockedBadges\.length === 0/.test(tabs),
  'if this guard has gone, two root Modals can present together instead'
);

// ── 4. The queue must stay unpersisted ───────────────────────────────────────
// It is the only reason a restart is a way out at all.
const store = readFileSync(new URL('../lib/store.ts', import.meta.url), 'utf8');
const partialize = store.slice(store.indexOf('partialize:'), store.indexOf('partialize:') + 1400);
check(
  'newlyUnlockedBadges is excluded from persistence',
  /newlyUnlockedBadges: _/.test(partialize),
  'persisting the queue makes any presentation failure survive a reboot'
);

console.log('');
if (failures > 0) {
  console.error(`badge-queue-drains: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`badge-queue-drains: all ${total} checks passed\n`);
  process.exitCode = 0;
}
