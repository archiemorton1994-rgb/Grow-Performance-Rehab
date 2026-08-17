/**
 * Contract tests: "Replay Guided Tour" Settings row in profile.tsx
 *
 * WHY THIS MATTERS
 * ────────────────
 * The replay-tour feature lets users who dismissed the coach-mark tour early
 * (or who just want a refresher) restart it from the Profile > Settings sheet.
 * Four invariants must hold simultaneously for the feature to work end-to-end:
 *
 *   1. VISIBILITY GUARD — the replay row is only rendered when `tourComplete`
 *      is true.  Showing it before the tour has run once is confusing (the
 *      tour is already in progress); hiding it unconditionally would break the
 *      feature entirely.
 *
 *   2. STORE RESET — the onPress handler calls `setTourComplete(false)`.  The
 *      tab-layout useEffect watches this value and restarts the tour at tab 0
 *      (Home) when it flips true → false, by setting the shared tourActiveTab
 *      store field. Any other action would be a no-op because each tab screen
 *      drives its own in-page tutorial from that store value.
 *
 *   3. SHEET DISMISSAL — `setActiveModal(null)` must be called alongside the
 *      store reset so the Settings sheet closes before the first coach-mark
 *      spotlight appears.  Without it the tour backdrop would appear behind
 *      the open modal.
 *
 *   4. TESTID — `testID="replay-tour"` must be on the Pressable so Playwright
 *      and accessibility tooling can target it.
 *
 *   5. LAYOUT WATCHER — `app/(tabs)/_layout.tsx` must have the
 *      `prevTourComplete` ref + useEffect that reacts to a true→false flip by
 *      calling `setTourActiveTab(0)`.  If this watcher is removed the replay
 *      button resets the store but nothing restarts the tour.
 *
 * Silent failure modes this catches:
 *  - `{tourComplete && (...)}` guard removed (tour row shows before first run)
 *  - `setTourComplete(false)` swapped for a different action (tour never replays)
 *  - `setActiveModal(null)` removed (tour fires behind the open Settings sheet)
 *  - testID removed (Playwright and a11y can no longer target the button)
 *  - `prevTourComplete` watcher removed from _layout.tsx (button is silent)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`    ${detail}`);
  failed++;
}

const profileSrc = readFile('app/(tabs)/profile.tsx');
const layoutSrc = readFile('app/(tabs)/_layout.tsx');

// ─── 1. Visibility guard ──────────────────────────────────────────────────────
// The replay row must be wrapped in {tourComplete && (...)}
// A simple check: setTourComplete(false) must live inside a {tourComplete && ...} conditional.
// We verify the conditional is present and setTourComplete(false) is nested inside it.
const tourCompleteGuardIdx = profileSrc.indexOf('{tourComplete && (');
const setTourCompleteFalseIdx = profileSrc.indexOf('setTourComplete(false)');

/**
 * The guard block, found by matching braces rather than by taking a fixed
 * number of characters.
 *
 * This used to slice 500 characters from the opening `{tourComplete && (` and
 * look for the call inside them. That is a measure of DISTANCE, not of
 * structure: adding a few lines anywhere in the block pushed the call past the
 * window and failed a test about something that had not changed. It happened —
 * an onLayout handler added to the section heading did exactly that. Worse,
 * the reverse is also possible: a call could sit outside the guard and still
 * land inside a 500-character window, passing a check it should fail.
 */
function guardBlockFrom(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return src.slice(openIdx);
}

if (tourCompleteGuardIdx !== -1 && setTourCompleteFalseIdx !== -1) {
  const guardedBlock = guardBlockFrom(profileSrc, tourCompleteGuardIdx);
  if (guardedBlock.includes('setTourComplete(false)')) {
    ok('replay row is wrapped in {tourComplete && (...)} visibility guard');
  } else {
    fail(
      'replay row is wrapped in {tourComplete && (...)} visibility guard',
      'setTourComplete(false) is not inside the tourComplete guard block — ' +
        'the row will be visible before the tour has run once'
    );
  }
} else if (tourCompleteGuardIdx === -1) {
  fail(
    'replay row is wrapped in {tourComplete && (...)} visibility guard',
    '{tourComplete && ( not found in profile.tsx — add the conditional wrapper'
  );
} else {
  fail(
    'replay row is wrapped in {tourComplete && (...)} visibility guard',
    'setTourComplete(false) not found in profile.tsx — onPress must call setTourComplete(false)'
  );
}

// ─── 2. Store reset — setTourComplete(false) ─────────────────────────────────
if (profileSrc.includes('setTourComplete(false)')) {
  ok('onPress calls setTourComplete(false) to reset the tour');
} else {
  fail(
    'onPress calls setTourComplete(false) to reset the tour',
    'setTourComplete(false) not found in profile.tsx — ' +
      'the tab-layout watcher needs this exact call to restart the tour'
  );
}

// ─── 3. Sheet dismissal — setActiveModal(null) co-located with the reset ─────
// Both calls must be in the same onPress block.  Find the replay Pressable's
// onPress and check that setActiveModal(null) also appears nearby.
const replayPressableIdx = profileSrc.indexOf('testID="replay-tour"');
if (replayPressableIdx === -1) {
  fail(
    'setActiveModal(null) called alongside setTourComplete(false) in replay onPress',
    'testID="replay-tour" not found — cannot locate the onPress block; add testID first'
  );
} else {
  // The Pressable with testID="replay-tour" — look backward ~400 chars for its onPress open
  const pressableContext = profileSrc.slice(
    Math.max(0, replayPressableIdx - 400),
    replayPressableIdx + 200
  );
  if (
    pressableContext.includes('setActiveModal(null)') &&
    pressableContext.includes('setTourComplete(false)')
  ) {
    ok('setActiveModal(null) called alongside setTourComplete(false) in replay onPress');
  } else if (!pressableContext.includes('setActiveModal(null)')) {
    fail(
      'setActiveModal(null) called alongside setTourComplete(false) in replay onPress',
      'setActiveModal(null) not found near the replay Pressable — ' +
        'the Settings sheet must close before the first coach-mark fires'
    );
  } else {
    fail(
      'setActiveModal(null) called alongside setTourComplete(false) in replay onPress',
      'setTourComplete(false) not found near the replay Pressable — ' +
        'check that the store reset is inside the replay onPress handler'
    );
  }
}

// ─── 4. testID on the replay Pressable ───────────────────────────────────────
if (profileSrc.includes('testID="replay-tour"')) {
  ok('replay Pressable has testID="replay-tour"');
} else {
  fail(
    'replay Pressable has testID="replay-tour"',
    'testID not found — add testID="replay-tour" to the Pressable for Playwright/a11y access'
  );
}

// ─── 5. Layout watcher — prevTourComplete + setTourActiveTab(0) ──────────────
// _layout.tsx must have the ref + useEffect that fires setTourActiveTab(0)
// when tourComplete flips from true to false, restarting the tour at Home.
const hasPrevTourCompleteRef = layoutSrc.includes('prevTourComplete');
const hasSetTourActiveTab0 = layoutSrc.includes('setTourActiveTab(0)');
const hasFlipGuard =
  layoutSrc.includes('prevTourComplete.current === true') &&
  layoutSrc.includes('tourComplete === false');

if (hasPrevTourCompleteRef && hasSetTourActiveTab0 && hasFlipGuard) {
  ok('_layout.tsx has prevTourComplete watcher that calls setTourActiveTab(0) on true→false flip');
} else if (!hasPrevTourCompleteRef) {
  fail(
    '_layout.tsx has prevTourComplete watcher that calls setTourActiveTab(0) on true→false flip',
    'prevTourComplete ref not found in _layout.tsx — the watcher that restarts ' +
      'the tour on store flip is missing'
  );
} else if (!hasSetTourActiveTab0) {
  fail(
    '_layout.tsx has prevTourComplete watcher that calls setTourActiveTab(0) on true→false flip',
    'setTourActiveTab(0) not found in _layout.tsx — the watcher must call ' +
      'setTourActiveTab(0) to restart the tour at Home'
  );
} else {
  fail(
    '_layout.tsx has prevTourComplete watcher that calls setTourActiveTab(0) on true→false flip',
    'flip guard (prevTourComplete.current === true && tourComplete === false) ' +
      'not found in _layout.tsx — the watcher must only fire on a true→false flip, ' +
      'not on every tourComplete change'
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\nreplay-tour: ${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
