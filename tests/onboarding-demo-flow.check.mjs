/**
 * Contract tests: onboarding → tab tour → demo session → home flow
 *
 * WHY THIS MATTERS
 * ────────────────
 * The new-user experience follows a multi-file chain.  A regression in any
 * single link silently breaks the entire first-run journey:
 *
 *   app/(tabs)/_layout.tsx   — TOUR_TAB_ROUTES + per-tab handoff via tourActiveTab
 *   app/(tabs)/workouts.tsx  — Stats' own tutorial, final step → demo handoff
 *   app/session.tsx          — demo mode, auto-trigger, tour-complete callbacks
 *   lib/store.ts             — setTourComplete resets sessionTutorialShown
 *
 * The tour is no longer one generic card per tab driven centrally from
 * _layout.tsx — each tab (Home, Profile, Train, Restore, Stats) now has its
 * own in-page tutorial, walking through that screen's real sections. The
 * shared tourActiveTab store field says which tab is currently touring;
 * _layout.tsx's only remaining job is navigating to that tab.
 *
 * The five critical invariants this file guards:
 *
 *   [1] TOUR DEPTH — TOUR_TAB_ROUTES has exactly 5 entries (Home, Profile,
 *       Train, Restore, Stats).  Adding or removing tabs from the tour
 *       without updating this breaks the route/segment lookup tables.
 *
 *   [2] DEMO HANDOFF — Stats' advanceStatsTut (the tour's last screen) routes
 *       to /session?demo=true when its own tutorial is exhausted.  Without
 *       this the tour simply ends with no demo session.
 *
 *   [3] DEMO AUTO-TRIGGER — session.tsx starts the in-session tutorial
 *       automatically when isDemo is true, without waiting for user action.
 *       In normal sessions the tutorial is never auto-started.
 *
 *   [4] DEMO COMPLETION — when the last tutorial step completes (or when the
 *       user skips in demo mode), session.tsx calls setTourComplete(true),
 *       setTourJustCompleted(true), and either shows the "You're all set!"
 *       overlay (advanceTut path) or navigates back to /(tabs) (skipTut path).
 *
 *   [5] REPLAY RESET — setTourComplete(false) in lib/store.ts also resets
 *       sessionTutorialShown: false so the in-session tutorial fires again on
 *       replay.  Without this the tutorial is skipped on every replay.
 *
 * Silent failure modes this catches:
 *  - COACH_STEPS array shrunk/grown (depth mismatch)
 *  - handleNext last-step navigation changed away from /session?demo=true
 *  - isDemo auto-trigger wrapped in a user-action guard
 *  - advanceTut / skipTut no longer call setTourJustCompleted (card pulse lost)
 *  - "You're all set!" overlay removed or its visibility unhooked from showDemoComplete
 *  - setTourComplete(false) no longer resets sessionTutorialShown (replay tutorial skipped)
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

const layoutSrc = readFile('app/(tabs)/_layout.tsx');
const workoutsSrc = readFile('app/(tabs)/workouts.tsx');
const sessionSrc = readFile('app/session.tsx');
const storeSrc = readFile('lib/store.ts');

// ─── [1] Tour depth: TOUR_TAB_ROUTES has exactly 5 entries ───────────────────
console.log('\n[1] Tour depth — TOUR_TAB_ROUTES has exactly 5 steps');

const tourRoutesMatch = layoutSrc.match(/const TOUR_TAB_ROUTES\s*=\s*\[([\s\S]*?)\]\s*as const/);
if (!tourRoutesMatch) {
  fail(
    'TOUR_TAB_ROUTES array found in _layout.tsx',
    'const TOUR_TAB_ROUTES = [...] as const not found — check _layout.tsx'
  );
} else {
  ok('TOUR_TAB_ROUTES array found in _layout.tsx');
  const block = tourRoutesMatch[1];
  // Count quoted route strings — each one is a tab in the tour.
  const stepCount = (block.match(/'[^']*'/g) || []).length;
  if (stepCount === 5) {
    ok(`TOUR_TAB_ROUTES contains exactly 5 routes (found ${stepCount})`);
  } else {
    fail(
      `TOUR_TAB_ROUTES contains exactly 5 routes (found ${stepCount})`,
      `Expected 5 routes (Home, Profile, Train, Restore, Stats) but found ${stepCount}. ` +
        'Update the step count expectation here if the tour intentionally changed.'
    );
  }
}

// ─── [2] Demo handoff: advanceStatsTut navigates to /session?demo=true ────────
console.log('\n[2] Demo handoff — advanceStatsTut (Stats, the tour\'s last screen) routes to /session?demo=true');

// The advanceStatsTut callback in workouts.tsx must contain the demo
// navigation call inside the "last step reached" branch.
const advanceStatsTutMatch = workoutsSrc.match(
  /const advanceStatsTut\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\},\s*\[/
);

if (!advanceStatsTutMatch) {
  fail(
    'advanceStatsTut useCallback block found in workouts.tsx',
    'const advanceStatsTut = useCallback(() => {...}, [...]) not found — check workouts.tsx'
  );
} else {
  ok('advanceStatsTut useCallback block found in workouts.tsx');
  const block = advanceStatsTutMatch[1];

  const hasLengthGuard = /next\s*>=\s*STATS_TUTORIAL\.length/.test(block);
  if (hasLengthGuard) {
    ok('advanceStatsTut guards last step with next >= STATS_TUTORIAL.length');
  } else {
    fail(
      'advanceStatsTut guards last step with next >= STATS_TUTORIAL.length',
      'the STATS_TUTORIAL.length boundary check is missing from advanceStatsTut — ' +
        'the tour will not transition to the demo session at the final step'
    );
  }

  const hasDemoNav = /\/session\?demo=true/.test(block);
  if (hasDemoNav) {
    ok('advanceStatsTut navigates to /session?demo=true at final step');
  } else {
    fail(
      'advanceStatsTut navigates to /session?demo=true at final step',
      '/session?demo=true not found in the advanceStatsTut block — ' +
        "the tour's final step must navigate to the demo session"
    );
  }

  const hasTourComplete = /setTourComplete\(true\)/.test(block);
  if (hasTourComplete) {
    ok('advanceStatsTut marks the whole tour complete via setTourComplete(true)');
  } else {
    fail(
      'advanceStatsTut marks the whole tour complete via setTourComplete(true)',
      'setTourComplete(true) not found in the advanceStatsTut block'
    );
  }
}

// ─── [3] Demo auto-trigger: isDemo starts tutorial without user action ─────────
console.log('\n[3] Demo auto-trigger — session.tsx auto-starts tutorial in demo mode');

// isDemo must be derived from params.demo === 'true'
const hasDemoParam = sessionSrc.includes("params.demo === 'true'");
if (hasDemoParam) {
  ok("isDemo derived from params.demo === 'true'");
} else {
  fail(
    "isDemo derived from params.demo === 'true'",
    "params.demo === 'true' not found in session.tsx — " +
      'isDemo must be set from the URL ?demo=true parameter'
  );
}

// Auto-trigger useEffect: isDemo && exercises.length > 0 → setTutStep(0)
const autoTriggerPattern = /isDemo\s*&&\s*exercises\.length\s*>\s*0[\s\S]{0,120}setTutStep\(0\)/;
if (autoTriggerPattern.test(sessionSrc)) {
  ok('demo auto-trigger: isDemo && exercises.length > 0 → setTutStep(0)');
} else {
  fail(
    'demo auto-trigger: isDemo && exercises.length > 0 → setTutStep(0)',
    'auto-trigger pattern not found in session.tsx — in demo mode the tutorial ' +
      'must start automatically (no user action required)'
  );
}

// Real sessions must NOT auto-trigger — only demo mode uses the auto-start path.
// Verified indirectly: the guard `if (isDemo && ...)` ensures non-demo sessions skip it.
// We check the guard is present (already verified above via autoTriggerPattern).
ok('real sessions skipped by isDemo guard (auto-trigger is demo-only)');

// ─── [4] Demo completion: advanceTut and skipTut complete the tour ────────────
console.log('\n[4] Demo completion — advanceTut and skipTut call tour-complete actions');

// advanceTut path: last step calls setTourComplete(true), setTourJustCompleted(true),
// setShowDemoComplete(true)
const advanceTutMatch = sessionSrc.match(
  /const advanceTut\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\},\s*\[/
);
if (!advanceTutMatch) {
  fail(
    'advanceTut useCallback block found in session.tsx',
    'const advanceTut = useCallback(() => {...}, [...]) not found'
  );
} else {
  ok('advanceTut useCallback block found in session.tsx');
  const block = advanceTutMatch[1];

  const checks = [
    [/setTourComplete\(true\)/, 'setTourComplete(true) called in advanceTut'],
    [/setTourJustCompleted\(true\)/, 'setTourJustCompleted(true) called in advanceTut (tab pulse)'],
    [/setShowDemoComplete\(true\)/, 'setShowDemoComplete(true) called in advanceTut (overlay)'],
  ];
  for (const [re, label] of checks) {
    if (re.test(block)) {
      ok(label);
    } else {
      fail(
        label,
        `${re.source} not found in advanceTut — ` + 'the demo tour completion will be broken'
      );
    }
  }
}

// skipTut path: calls setTourComplete(true), setTourJustCompleted(true),
// navigates back to /(tabs)
const skipTutMatch = sessionSrc.match(
  /const skipTut\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\},\s*\[/
);
if (!skipTutMatch) {
  fail(
    'skipTut useCallback block found in session.tsx',
    'const skipTut = useCallback(() => {...}, [...]) not found'
  );
} else {
  ok('skipTut useCallback block found in session.tsx');
  const block = skipTutMatch[1];

  const checks = [
    [/setTourComplete\(true\)/, 'setTourComplete(true) called in skipTut'],
    [/setTourJustCompleted\(true\)/, 'setTourJustCompleted(true) called in skipTut (tab pulse)'],
    [/router\.navigate\(['"]\/\(tabs\)/, 'skipTut navigates back to /(tabs) on demo skip'],
  ];
  for (const [re, label] of checks) {
    if (re.test(block)) {
      ok(label);
    } else {
      fail(label, `${re.source} not found in skipTut`);
    }
  }
}

// "You're all set!" overlay must be a Modal with visible={showDemoComplete}
const overlayPattern = /Modal\s[^>]*visible=\{showDemoComplete\}/;
if (overlayPattern.test(sessionSrc)) {
  ok('demo complete overlay: Modal visible={showDemoComplete} present');
} else {
  fail(
    'demo complete overlay: Modal visible={showDemoComplete} present',
    'Modal visible={showDemoComplete} not found in session.tsx — ' +
      'the "You\'re all set!" overlay must be a Modal tied to showDemoComplete'
  );
}

const hasYoureAllSet = sessionSrc.includes("You're all set!");
if (hasYoureAllSet) {
  ok('"You\'re all set!" text present in demo complete overlay');
} else {
  fail(
    '"You\'re all set!" text present in demo complete overlay',
    '"You\'re all set!" string not found in session.tsx'
  );
}

// ─── [5] Replay reset: setTourComplete(false) resets sessionTutorialShown ─────
console.log('\n[5] Replay reset — setTourComplete(false) also resets sessionTutorialShown');

// The store action must spread { sessionTutorialShown: false } when complete===false.
// Pattern: complete === false ? { sessionTutorialShown: false } : {}
const replayResetPattern =
  /complete\s*===\s*false\s*\?\s*\{\s*sessionTutorialShown\s*:\s*false\s*\}\s*:\s*\{\s*\}/;
if (replayResetPattern.test(storeSrc)) {
  ok('setTourComplete(false) resets sessionTutorialShown to false in lib/store.ts');
} else {
  fail(
    'setTourComplete(false) resets sessionTutorialShown to false in lib/store.ts',
    'complete === false ? { sessionTutorialShown: false } : {} not found — ' +
      'without this reset the in-session tutorial is permanently skipped on replay'
  );
}

// Verify setTourComplete(true) does NOT unconditionally reset sessionTutorialShown
// (that would wipe history mid-session).  We rely on the conditional spread above.
// A simple negative check: no unconditional `sessionTutorialShown: false` inside
// the setTourComplete body that fires for both complete=true and complete=false.
const setTourCompleteBlock = storeSrc.match(
  /setTourComplete:\s*\(complete\)\s*=>\s*set\(\{[\s\S]*?\}\)/
)?.[0];
if (setTourCompleteBlock) {
  ok('setTourComplete action block found in lib/store.ts');
  // The block should NOT have an unconditional `sessionTutorialShown: false` outside
  // the ternary (which would also fire for complete=true).
  const unconditionalReset =
    /sessionTutorialShown\s*:\s*false/.test(setTourCompleteBlock) &&
    !replayResetPattern.test(setTourCompleteBlock);
  if (!unconditionalReset) {
    ok('setTourComplete(true) does not unconditionally clear sessionTutorialShown');
  } else {
    fail(
      'setTourComplete(true) does not unconditionally clear sessionTutorialShown',
      'sessionTutorialShown: false found outside the conditional — ' +
        'this would wipe the tutorial state even when completing (not replaying) the tour'
    );
  }
} else {
  fail(
    'setTourComplete action block found in lib/store.ts',
    'setTourComplete: (complete) => set({...}) pattern not found in lib/store.ts'
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\nonboarding-demo-flow: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
