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
  /<WeeklyWeightPrompt\s+deferred=\{\s*currentToast\s*!==\s*null\s*\}/.test(rootLayout),
  'expected <WeeklyWeightPrompt deferred={currentToast !== null} />'
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

console.log(`\nroot-modal-exclusivity: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
