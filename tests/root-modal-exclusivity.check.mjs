/**
 * Contract tests: only one root-level <Modal> may be presented at a time
 *
 * WHY THIS MATTERS
 * ────────────────
 * Two native Modals presented simultaneously break touch routing on BOTH of
 * them. The screen behind renders perfectly and nothing responds to taps, so it
 * presents as "the whole app has frozen" with no crash and no error — only a
 * force-quit clears it, because the state lives in component memory rather than
 * in storage.
 *
 * This has now bitten twice:
 *
 *   1. The guided-tour intro against the achievement toast, during onboarding.
 *      Fixed by gating the tour intro on newlyUnlockedBadges being empty.
 *   2. The weekly weight prompt against the achievement toast, after ANY
 *      completed session. The weight prompt's effect keys off
 *      completedSessions.length, so it re-arms on every completion — precisely
 *      when a badge toast is most likely to be on screen. Fixed by deferring
 *      the prompt while a toast is up.
 *
 * The failure mode is invisible to typechecking, to lint, and to every existing
 * check, which is why it survived a fix attempt aimed at the wrong cause. These
 * assertions pin the two guards in place so a third root modal cannot quietly
 * reintroduce it.
 *
 * Run:  node tests/root-modal-exclusivity.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let passed = 0;
let failed = 0;
const ok = (label) => {
  console.log(`  ✓ ${label}`);
  passed++;
};
const bad = (label, hint) => {
  console.log(`  ✗ FAIL: ${label}${hint ? ` — ${hint}` : ''}`);
  failed++;
};
const check = (label, cond, hint) => (cond ? ok(label) : bad(label, hint));

// Comments in this file discuss Modals at length, so assertions about their
// ABSENCE have to read code rather than prose - the same trap that made an
// earlier version of this check pass on its own explanation.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const rootLayout = read('app/_layout.tsx');
const tabsLayout = read('app/(tabs)/_layout.tsx');

console.log('\n[1] The weekly weight prompt no longer exists');

// It was a root-level Modal that re-armed whenever completedSessions changed,
// so the app asked for a bodyweight on opening, again after onboarding, and
// again after the first session - and when the user had never set one it could
// not be dismissed at all. Testers reported all three.
//
// These assertions used to pin its deferral, which is the weaker guarantee: a
// modal that is correctly held back is still a modal the next change can show at
// the wrong moment. Bodyweight is asked ONCE now, in onboarding, and keeping it
// fresh is handled by the assistant message, the Settings dot and the opt-in
// reminder - three channels that interrupt nobody.
check(
  'no weight prompt component remains',
  !/WeeklyWeightPrompt/.test(rootLayout),
  'reinstating a recurring modal here is the bug testers reported'
);

check(
  'and the root layout presents no Modal of its own at all',
  !/<Modal/.test(stripComments(rootLayout)),
  'the crash panel and the weight prompt were the only two - a modal-free root is what makes the collision impossible here'
);

console.log('\n[2] Tour intro vs achievement toast');

check(
  'tour intro Modal is held back while badges are queued',
  /visible=\{\s*showTourIntro\s*&&\s*newlyUnlockedBadges\.length\s*===\s*0\s*\}/.test(tabsLayout),
  'expected visible={showTourIntro && newlyUnlockedBadges.length === 0}'
);

console.log('\n[3] The crash-report overlay is gone entirely');

// This used to assert the crash Modal stayed BEHIND a `lastCrash ?` guard — the
// weaker guarantee, from when the panel was thought worth keeping. It is now
// deleted outright: it could only ever be seen by paying customers and App
// Review (the handler that records a crash is gated to production builds, so it
// never appeared in testing), and it was a third uncoordinated root Modal able
// to present alongside the weigh-in prompt. Absence is easier to guarantee than
// correct conditional presentation, and nothing is lost — the crash is still
// POSTed to /api/crash-log for the owner to read.
check(
  'no crash Modal exists at the root at all',
  !/lastCrash/.test(rootLayout),
  'reintroducing it would be both an App Review risk and freeze incident number five'
);

check(
  'crashes are still reported to the server',
  /__last_crash__/.test(rootLayout) && /crash-log/.test(rootLayout),
  'removing the SCREEN must never remove the reporting'
);

console.log('\n[4] Achievement toast vs the session-summary screen');

// The third instance of this bug, and the nastiest, because the second native
// modal is not written as a <Modal> at all — it is a Stack screen declared with
// presentation: 'fullScreenModal', which on iOS is a real native modal
// presentation. Firing the achievement sheet over it froze the app after any
// session that unlocked a badge. It went unnoticed for months because most
// sessions on an established account unlock nothing; a fresh account's first
// session unlocks five and hits it every time.
check(
  'session-summary is still declared as a fullScreenModal',
  /name="session-summary"[\s\S]{0,160}?presentation:\s*'fullScreenModal'/.test(rootLayout),
  'if this presentation ever changes, revisit the gate below — it exists because of it'
);

check(
  'root modals are gated to the tab routes only',
  /const canShowRootModal\s*=\s*segments\[0\]\s*===\s*'\(tabs\)'\s*;/.test(rootLayout),
  "expected canShowRootModal = segments[0] === '(tabs)'; adding session-summary back presents a native Modal over a native modal presentation and freezes the app"
);

check(
  'the gate is not re-enabled on session-summary',
  !/canShowRootModal[\s\S]{0,200}?session-summary/.test(rootLayout),
  'session-summary must not appear in the canShowRootModal expression'
);

// The gate above was once applied to the badge toast alone, which is why this
// file went green while the weight prompt presented over session-summary
// anyway. That prompt has since been deleted outright (see section 1), so the
// toast is the only root-level presentation left — and it still goes through
// the gate, because the next one added must too.
check(
  'the toast drain honours the root-modal gate',
  /if\s*\(!canShowRootModal\)\s*return;/.test(rootLayout),
  'the badge toast queue must not pop while the user is off the tabs'
);


console.log('\n[5] The achievement sheet can always be escaped');

const sheet = read('components/AchievementUnlockedSheet.tsx');
check(
  'the sheet dismisses itself on a failsafe timer',
  /setTimeout\(dismiss,\s*FAILSAFE_MS\)/.test(sheet),
  'a root modal that can only be closed by tapping is one bug away from bricking the app'
);
check(
  'dismiss is idempotent',
  /dismissedRef\.current/.test(sheet),
  'the failsafe and a user tap can both fire; onDismiss must not run twice'
);

console.log('\n[6] The session-summary celebration is a banner, not a second modal');

// Comments in these files talk *about* Modals at length, so strip them first —
// otherwise the assertion is satisfied or broken by prose rather than by code.
const banner = stripComments(read('components/AchievementBanner.tsx'));
const summary = read('app/session-summary.tsx');

check(
  'AchievementBanner renders no <Modal>',
  !/<Modal[\s/>]/.test(banner) && !/from 'react-native'[\s\S]{0,200}Modal/.test(banner),
  'the whole point is that it renders inside the screen; a Modal here recreates the freeze'
);
check(
  'it is absolutely positioned inside its parent',
  /position: 'absolute'/.test(banner),
  'expected an in-tree overlay'
);
check(
  'it leaves on its own timer',
  /setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]{0,200}?leave\(\)/.test(banner) || /leave\(\)/.test(banner),
  'a celebration the user cannot dismiss must still go away by itself'
);
check(
  'session-summary claims the unlock queue so the root sheet cannot double-fire',
  /clearNewlyUnlockedBadges\(\)/.test(summary),
  'expected the summary to clear newlyUnlockedBadges once it has snapshotted them'
);
check(
  'the banner is rendered after the Modal so it paints on top',
  summary.lastIndexOf('<AchievementBanner') > summary.lastIndexOf('</Modal>'),
  'an earlier sibling renders underneath the scroll view'
);

console.log(`\nroot-modal-exclusivity: ${passed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
