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

const rootLayout = read('app/_layout.tsx');
const tabsLayout = read('app/(tabs)/_layout.tsx');

console.log('\n[1] Weekly weight prompt vs achievement toast');

check(
  'WeeklyWeightPrompt accepts a `deferred` prop',
  /function WeeklyWeightPrompt\(\s*\{[^}]*deferred/.test(rootLayout),
  'the prompt must be suppressible while another root Modal is showing'
);

check(
  'its Modal visibility is gated on `deferred`',
  /visible=\{\s*showPrompt\s*&&\s*!deferred\s*\}/.test(rootLayout),
  'expected visible={showPrompt && !deferred} on the weight prompt Modal'
);

check(
  'it is rendered with deferred bound to the toast state',
  /<WeeklyWeightPrompt\s+deferred=\{\s*currentToast\s*!==\s*null\s*\|\|/.test(rootLayout),
  'expected deferred to start with currentToast !== null'
);

console.log('\n[2] Tour intro vs achievement toast');

check(
  'tour intro Modal is held back while badges are queued',
  /visible=\{\s*showTourIntro\s*&&\s*newlyUnlockedBadges\.length\s*===\s*0\s*\}/.test(tabsLayout),
  'expected visible={showTourIntro && newlyUnlockedBadges.length === 0}'
);

console.log('\n[3] Crash-report overlay stays conditional');

check(
  'the previous-launch crash Modal only renders when there is a crash to show',
  /\{lastCrash\s*\?[\s\S]{0,80}?<Modal/.test(rootLayout),
  'it must stay behind the lastCrash check — an always-mounted Modal at the root would collide with everything below it'
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

// The gate above was applied to the badge toast alone, which is why this file
// went green while the weight prompt presented over session-summary anyway.
// Its trigger is "sessions completed > 0 and no prompt recorded yet", which
// first becomes true the instant a user finishes their FIRST session — so
// unlike the badge case it fired on every new account, not just the ones that
// unlocked something. Every root Modal goes through the same gate now.
check(
  'the toast drain honours the root-modal gate',
  /if\s*\(!canShowRootModal\)\s*return;/.test(rootLayout),
  'the badge toast queue must not pop while the user is off the tabs'
);

check(
  'the weight prompt honours the root-modal gate too',
  /<WeeklyWeightPrompt\s+deferred=\{\s*currentToast\s*!==\s*null\s*\|\|\s*!canShowRootModal\s*\}/.test(
    rootLayout
  ),
  'expected <WeeklyWeightPrompt deferred={currentToast !== null || !canShowRootModal} /> - deferring only against the toast lets it present over the session-summary fullScreenModal and freeze the app'
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
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
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
