/**
 * Contract tests: demo session must not write to session history, streaks, or any
 * other persistent store.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The demo session (?demo=true) is a guided first-run experience — it must never
 * appear in session history, streak counters, 1RM records, progressive-overload
 * weights, or any server sync.  There are three save paths in session.tsx, each of
 * which must short-circuit immediately when isDemo is true:
 *
 *   handleComplete   — the session-level "Finish" handler
 *   handleExit       — the back-button / abandon handler
 *   saveSnapshot     — background save triggered by app backgrounding
 *
 * Each path must have a top-level `if (isDemo)` guard that precedes every
 * persistence call.  This file verifies those ordering invariants so a future
 * refactor can never accidentally move a persistence call above the guard.
 *
 * Persistence calls protected in the main handleComplete:
 *   addOneRepMax, updateLastLoggedWeights, completeSession,
 *   clearActiveSession, uploadUserData,
 *   scheduleMissedWorkoutNudge, cancelRestTimerNotification,
 *   cancelStreakProtectionAlert
 *
 * Persistence calls protected in handleExit:
 *   cancelRestTimerNotification, scheduleMissedWorkoutNudge,
 *   cancelStreakProtectionAlert
 *
 * Persistence calls protected in saveSnapshot:
 *   Any write to the store (setActiveSession)
 *
 * NOTE: session.tsx has three different `handleComplete` functions — two are
 * inside sub-components (ExerciseCard, BarExerciseCard) and handle individual
 * set completion; those are unrelated to demo-mode persistence.  The tests below
 * all anchor to the SESSION-LEVEL handleComplete (the one that calls
 * completeSession) by locating it via unique surrounding landmarks.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const sessionSrc = fs.readFileSync(path.join(ROOT, 'app/session.tsx'), 'utf8');
const lines = sessionSrc.split('\n');

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

/**
 * Return the 1-based line number of the FIRST line that includes `pattern`
 * at or after `afterLine` (1-based).  Returns -1 if not found.
 */
function lineOf(pattern, afterLine = 1) {
  const re = typeof pattern === 'string' ? null : pattern;
  for (let i = afterLine - 1; i < lines.length; i++) {
    const hit = re ? re.test(lines[i]) : lines[i].includes(pattern);
    if (hit) return i + 1;
  }
  return -1;
}

// ─── [1] isDemo derived from URL param ───────────────────────────────────────
console.log('\n[1] isDemo is derived from ?demo=true URL parameter');

const isDemoLine = lineOf("params.demo === 'true'");
if (isDemoLine !== -1) {
  ok(`isDemo = params.demo === 'true'  (line ${isDemoLine})`);
} else {
  fail("isDemo = params.demo === 'true'", 'Pattern not found in app/session.tsx');
}

// ─── Locate the session-level handleComplete ──────────────────────────────────
// session.tsx has THREE `const handleComplete` functions:
//   - line ~522: inside ExerciseCard sub-component (handles individual set taps)
//   - line ~844: inside BarExerciseCard sub-component (handles bar-set taps)
//   - line ~2530: the SESSION-LEVEL handler that calls completeSession()
//
// Unique anchor: `const currentPhaseLabel = phaseLabelMap` appears exactly 2 lines
// before the session-level handleComplete and nowhere else in the file.
const progressAnchorLine = lineOf('const currentPhaseLabel = phaseLabelMap');
let sessionHandleCompleteLine = -1;
if (progressAnchorLine !== -1) {
  // Search for the handleComplete declaration within 5 lines after the anchor
  for (let i = progressAnchorLine; i <= progressAnchorLine + 5 && i < lines.length; i++) {
    if (/const handleComplete\s*=\s*\(\s*\)\s*=>/.test(lines[i])) {
      sessionHandleCompleteLine = i + 1; // 1-based
      break;
    }
  }
}

// ─── [2] handleComplete — guard before every persistence call ─────────────────
console.log('\n[2] handleComplete — isDemo guard precedes all persistence calls');

if (sessionHandleCompleteLine === -1) {
  fail(
    'Session-level handleComplete with isDemo guard found',
    'Could not locate the session-level handleComplete function in app/session.tsx'
  );
} else {
  ok(`Session-level handleComplete found at line ${sessionHandleCompleteLine}`);

  // The isDemo guard must be within 5 lines of the function opening
  const guardLine = lineOf(/if\s*\(isDemo\)\s*\{/, sessionHandleCompleteLine);
  const guardDistance = guardLine !== -1 ? guardLine - sessionHandleCompleteLine : 999;
  if (guardLine !== -1 && guardDistance <= 5) {
    ok(`isDemo guard at line ${guardLine} (${guardDistance} lines into handleComplete)`);
  } else if (guardLine !== -1) {
    fail(
      `isDemo guard is the FIRST check in handleComplete (found ${guardDistance} lines in)`,
      `Guard is at line ${guardLine} but handleComplete starts at ${sessionHandleCompleteLine}. ` +
        'The guard must appear at the very top of the function before any other logic.'
    );
  } else {
    fail(
      'isDemo guard found in session-level handleComplete',
      `No if (isDemo) found after line ${sessionHandleCompleteLine}`
    );
  }

  // Every persistence call must appear AFTER the guard line
  const persistenceCalls = [
    { pattern: 'addOneRepMax(', name: 'addOneRepMax' },
    { pattern: 'updateLastLoggedWeights(', name: 'updateLastLoggedWeights' },
    { pattern: 'completeSession(', name: 'completeSession' },
    { pattern: 'clearActiveSession(', name: 'clearActiveSession' },
    { pattern: 'uploadUserData(', name: 'uploadUserData' },
    { pattern: 'scheduleMissedWorkoutNudge(', name: 'scheduleMissedWorkoutNudge' },
    { pattern: 'cancelRestTimerNotification(', name: 'cancelRestTimerNotification' },
    { pattern: 'cancelStreakProtectionAlert(', name: 'cancelStreakProtectionAlert' },
  ];

  for (const { pattern, name } of persistenceCalls) {
    // Find the call within handleComplete's scope (search after handleCompleteLine, up to ~120 lines)
    const callLine = lineOf(pattern, sessionHandleCompleteLine);
    const handleCompleteEnd = sessionHandleCompleteLine + 120; // handleComplete is ~100 lines
    if (callLine === -1 || callLine > handleCompleteEnd) {
      // Call not present in handleComplete — skip (may not apply to this session type)
      continue;
    }
    if (guardLine !== -1 && callLine > guardLine) {
      ok(`${name}( at line ${callLine} is after isDemo guard (line ${guardLine})`);
    } else if (guardLine !== -1 && callLine <= guardLine) {
      fail(
        `${name}( appears AFTER isDemo guard`,
        `${name}( is at line ${callLine}, guard is at line ${guardLine} — ` +
          `move the guard above ${name} or it will run in demo mode`
      );
    }
  }

  // Guard must have a return statement
  if (guardLine !== -1) {
    const guardBlock = lines.slice(guardLine - 1, guardLine + 10).join('\n');
    if (/\breturn\b/.test(guardBlock)) {
      ok('isDemo guard in handleComplete contains a return (early exit)');
    } else {
      fail(
        'isDemo guard in handleComplete contains a return (early exit)',
        'The if (isDemo) block must return to prevent fall-through into persistence code'
      );
    }
  }
}

// ─── [3] handleExit — guard before persistence / side-effect calls ────────────
console.log('\n[3] handleExit — isDemo guard precedes all persistence calls');

const handleExitLine = lineOf('const handleExit = () => {');
if (handleExitLine === -1) {
  fail('handleExit function found', 'const handleExit = () => { not found in app/session.tsx');
} else {
  ok(`handleExit found at line ${handleExitLine}`);

  const exitGuardLine = lineOf(/if\s*\(isDemo\)\s*\{/, handleExitLine);
  const exitGuardDist = exitGuardLine !== -1 ? exitGuardLine - handleExitLine : 999;
  if (exitGuardLine !== -1 && exitGuardDist <= 5) {
    ok(`isDemo guard at line ${exitGuardLine} (${exitGuardDist} lines into handleExit)`);
  } else if (exitGuardLine !== -1) {
    fail(
      `isDemo guard is the FIRST check in handleExit (found ${exitGuardDist} lines in)`,
      'Guard must be the first statement in handleExit'
    );
  } else {
    fail('isDemo guard found in handleExit', `No if (isDemo) after line ${handleExitLine}`);
  }

  const exitPersistenceCalls = [
    'cancelRestTimerNotification(',
    'scheduleMissedWorkoutNudge(',
    'cancelStreakProtectionAlert(',
    'saveActiveSession(',
    'addCompletedSession(',
  ];

  let allGood = true;
  for (const pattern of exitPersistenceCalls) {
    const callLine = lineOf(pattern, handleExitLine);
    const handleExitEnd = handleExitLine + 30;
    if (callLine === -1 || callLine > handleExitEnd) continue;
    if (exitGuardLine !== -1 && callLine > exitGuardLine) {
      ok(`${pattern.replace('(', '')} at line ${callLine} is after isDemo guard`);
    } else if (exitGuardLine !== -1) {
      fail(
        `${pattern.replace('(', '')} appears after isDemo guard`,
        `${pattern} at line ${callLine} is BEFORE guard at line ${exitGuardLine}`
      );
      allGood = false;
    }
  }

  if (exitGuardLine !== -1) {
    const exitGuardBlock = lines.slice(exitGuardLine - 1, exitGuardLine + 8).join('\n');
    if (/\breturn\b/.test(exitGuardBlock)) {
      ok('isDemo guard in handleExit contains a return (early exit)');
    } else {
      fail(
        'isDemo guard in handleExit contains a return (early exit)',
        'The if (isDemo) block must return'
      );
    }
  }
}

// ─── [4] saveSnapshot — isDemo guard is first meaningful check ───────────────
console.log('\n[4] saveSnapshot — isDemo guard fires before any snapshot write');

const saveSnapshotLine = lineOf('const saveSnapshot = () => {');
if (saveSnapshotLine === -1) {
  fail('saveSnapshot function found', 'const saveSnapshot = () => { not found in app/session.tsx');
} else {
  ok(`saveSnapshot found at line ${saveSnapshotLine}`);

  // The guard in saveSnapshot is `if (isDemo) return;` (single-line)
  const snapGuardLine = lineOf('if (isDemo) return;', saveSnapshotLine);
  const snapGuardDist = snapGuardLine !== -1 ? snapGuardLine - saveSnapshotLine : 999;
  if (snapGuardLine !== -1 && snapGuardDist <= 5) {
    ok(
      `if (isDemo) return; guard at line ${snapGuardLine} (${snapGuardDist} lines into saveSnapshot)`
    );
  } else if (snapGuardLine !== -1) {
    fail(
      `isDemo guard is near the top of saveSnapshot (found ${snapGuardDist} lines in)`,
      'Guard must appear before any snapshot state is read or written'
    );
  } else {
    fail(
      'saveSnapshot has if (isDemo) return; guard',
      `No if (isDemo) return; found after line ${saveSnapshotLine}`
    );
  }

  // setActiveSession must come AFTER the guard
  const setActiveSessionLine = lineOf('setActiveSession(', saveSnapshotLine);
  const saveSnapshotEnd = saveSnapshotLine + 60;
  if (setActiveSessionLine !== -1 && setActiveSessionLine <= saveSnapshotEnd) {
    if (snapGuardLine !== -1 && setActiveSessionLine > snapGuardLine) {
      ok(`setActiveSession( at line ${setActiveSessionLine} is after isDemo guard`);
    } else if (snapGuardLine !== -1) {
      fail(
        'setActiveSession appears after isDemo guard',
        `setActiveSession( at line ${setActiveSessionLine} is BEFORE guard at line ${snapGuardLine}`
      );
    }
  } else {
    // setActiveSession not found inside saveSnapshot — fine, check not applicable
    ok('setActiveSession not called inside saveSnapshot (no additional guard needed)');
  }
}

// ─── [5] Session timer — disabled in demo mode ────────────────────────────────
console.log('\n[5] Session timer — disabled in demo mode');

// The session elapsed-time timer is a setInterval defined after isDemo is set
// (after line isDemoLine ~1634). The guard is: `if (isDemo) return;` immediately
// before the setInterval call.
const sessionTimerSetInterval = lineOf(
  'const timerId = setInterval',
  isDemoLine > 0 ? isDemoLine : 1
);
if (sessionTimerSetInterval === -1) {
  ok('No session timer setInterval found after isDemo definition — guard not needed');
} else {
  // The `if (isDemo) return;` guard should be within 3 lines before the setInterval
  const precedingLines = lines
    .slice(Math.max(0, sessionTimerSetInterval - 4), sessionTimerSetInterval)
    .join('\n');
  if (/if\s*\(isDemo\)\s*return/.test(precedingLines)) {
    ok(`Session timer at line ${sessionTimerSetInterval} is guarded by if (isDemo) return`);
  } else {
    fail(
      `Session timer setInterval at line ${sessionTimerSetInterval} is guarded by if (isDemo) return`,
      `if (isDemo) return not found in the ${3} lines immediately before the setInterval — ` +
        'the elapsed-time timer should not run during the demo session'
    );
  }
}

// ─── [6] Auto-save effect (always-on) — guarded by isDemo ────────────────────
// Unlike saveSnapshot (triggered on app-background), there is a continuously
// running useEffect that calls setActiveSession whenever exerciseData changes.
// This must also be guarded so demo sessions never create a "resume" snapshot.
console.log('\n[6] Auto-save useEffect — isDemo guard present before setActiveSession');

const autoSaveEffectLine = lineOf('// Auto-save in-progress state whenever data changes');
if (autoSaveEffectLine === -1) {
  fail(
    'Auto-save useEffect block found in session.tsx',
    '"Auto-save in-progress state" comment not found — check the comment text'
  );
} else {
  ok(`Auto-save useEffect found at line ${autoSaveEffectLine}`);
  // The guard `if (isDemo) return;` must be the first statement inside the effect
  const autoSaveGuardLine = lineOf('if (isDemo) return;', autoSaveEffectLine);
  const autoSaveSetActiveLine = lineOf('setActiveSession(', autoSaveEffectLine);
  const autoSaveEffectEnd = autoSaveEffectLine + 40;

  const guardDist = autoSaveGuardLine !== -1 ? autoSaveGuardLine - autoSaveEffectLine : 999;
  if (autoSaveGuardLine !== -1 && guardDist <= 5) {
    ok(
      `if (isDemo) return guard at line ${autoSaveGuardLine} (${guardDist} lines into auto-save effect)`
    );
  } else if (autoSaveGuardLine !== -1) {
    fail(
      `if (isDemo) return is the FIRST check in auto-save effect (found ${guardDist} lines in)`,
      'Guard must be the very first statement of the auto-save useEffect'
    );
  } else {
    fail(
      'Auto-save useEffect has if (isDemo) return guard',
      `No if (isDemo) return; found after line ${autoSaveEffectLine} — ` +
        'demo sessions will create a resume snapshot and appear in session history'
    );
  }

  if (
    autoSaveSetActiveLine !== -1 &&
    autoSaveSetActiveLine <= autoSaveEffectEnd &&
    autoSaveGuardLine !== -1
  ) {
    if (autoSaveSetActiveLine > autoSaveGuardLine) {
      ok(`setActiveSession( at line ${autoSaveSetActiveLine} is after isDemo guard`);
    } else {
      fail(
        'setActiveSession appears after isDemo guard in auto-save effect',
        `setActiveSession( is at line ${autoSaveSetActiveLine}, ` +
          `before the guard at line ${autoSaveGuardLine}`
      );
    }
  }
}

// ─── [7] completeSession is only called from the session-level handleComplete ──
console.log('\n[7] completeSession( only called inside session-level handleComplete');

const completeSessionLine = lineOf('completeSession({', isDemoLine > 0 ? isDemoLine : 1);
if (completeSessionLine === -1) {
  fail(
    'completeSession({ called from session.tsx',
    'completeSession not called — store may not receive session data'
  );
} else {
  // It should be inside sessionHandleCompleteLine..sessionHandleCompleteLine+120
  if (
    sessionHandleCompleteLine !== -1 &&
    completeSessionLine >= sessionHandleCompleteLine &&
    completeSessionLine <= sessionHandleCompleteLine + 120
  ) {
    ok(`completeSession({ at line ${completeSessionLine} is inside session-level handleComplete`);
  } else if (sessionHandleCompleteLine !== -1) {
    fail(
      'completeSession({ is inside session-level handleComplete',
      `completeSession({ is at line ${completeSessionLine}, but session-level handleComplete ` +
        `spans lines ${sessionHandleCompleteLine}–${sessionHandleCompleteLine + 120}. ` +
        'If this call is outside the guarded handleComplete it will run in demo mode.'
    );
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\ndemo-session-no-persist: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
