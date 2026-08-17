/**
 * Contract test: tapping Skip must not delete the sets you already did.
 *
 * WHAT WENT WRONG
 * ───────────────
 * `handleSkipExercise` rewrote EVERY set on the exercise to 0 kg x 0 reps:
 *
 *     const skippedSets = ex.sets.map((s) => ({
 *       ...s, weight: 0, reps: 0, completed: true, skipped: true,
 *     }));
 *
 * So someone who benched 80 kg for two sets, felt a shoulder twinge, and tapped
 * "Skip - couldn't do this exercise" lost both. The summary showed zero sets,
 * zero reps and zero volume; the lift never reached the progress chart; and
 * next session's suggestion had not moved, because as far as the app was
 * concerned no weight was ever lifted.
 *
 * The reason this matters more than an ordinary data bug: the in-session pain
 * banner instructs the user to do exactly this - "stop that exercise straight
 * away and tap Skip". The button the clinical advice points at was destroying
 * the user's work. The safety copy and the button behaviour have to agree.
 *
 * WHAT THIS ASSERTS
 * ─────────────────
 * Completed sets survive a Skip; the remainder are recorded as skipped; and an
 * abandoned exercise holds its load rather than earning more — including when
 * an "easy" rating was given on an earlier set, because the abort is the more
 * recent and more serious signal.
 */
import { readFileSync } from 'fs';
import { performanceForLog } from '../lib/set-performance.ts';

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

const done = (n, w, r) => ({ setNumber: n, weight: w, reps: r, completed: true });
const skipped = (n) => ({ setNumber: n, weight: 0, reps: 0, completed: true, skipped: true });
const unfinished = (n) => ({ setNumber: n, weight: 0, reps: 0, completed: false });

console.log('\n[1] The Skip handler spares the sets already logged');

const session = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');

check(
  'skipped sets are mapped conditionally on s.completed',
  /const skippedSets = ex\.sets\.map\(\s*\(s\)\s*=>\s*[\r\n\s]*s\.completed \? s :/.test(session),
  'expected `ex.sets.map((s) => s.completed ? s : {...})` - an unconditional map zeroes work the user actually did'
);

check(
  'nothing else in the session screen marks sets skipped',
  (session.match(/skipped:\s*true/g) ?? []).length === 1,
  'a second writer of skipped:true would need the same guard; there should be exactly one'
);

check(
  'the pain banner still points the user at Skip',
  /stop that exercise straight away and tap Skip/.test(session),
  'if this copy goes, revisit whether Skip still has to be lossless'
);

console.log('\n[2] A part-finished exercise is judged honestly');

check(
  'two real sets then a skip is not a completed exercise',
  performanceForLog([done(1, 80, 5), done(2, 80, 5), skipped(3)]) === 'failed',
  'an abandoned exercise must hold its load, not earn a rise'
);

check(
  'an exercise done in full is normal',
  performanceForLog([done(1, 80, 5), done(2, 80, 5), done(3, 80, 5)]) === 'normal',
  'the ordinary case must be untouched'
);

check(
  'an exercise skipped outright is not judged at all',
  performanceForLog([skipped(1), skipped(2), skipped(3)]) === null,
  'null means "no opinion" - it must not advance a streak or a stall counter'
);

check(
  'an unfinished set is still a failure',
  performanceForLog([done(1, 80, 5), unfinished(2)]) === 'failed',
  'the pre-existing failure rule must survive the refactor'
);

console.log('\n[3] The rating cannot outrank the abort');

check(
  '"easy" given before tapping Skip does not add weight',
  performanceForLog([done(1, 80, 5), skipped(2)], 'easy') === 'failed',
  'a rating from set one must not survive an abort on set two'
);

check(
  '"very_easy" given before tapping Skip does not add weight',
  performanceForLog([done(1, 80, 5), skipped(2)], 'very_easy') === 'failed',
  'same rule, bigger jump - this is the one that would hurt most'
);

check(
  '"easy" on a fully completed exercise still counts',
  performanceForLog([done(1, 80, 5), done(2, 80, 5)], 'easy') === 'easy',
  'the override must keep working where the exercise was actually finished'
);

check(
  '"hard" holds the load',
  performanceForLog([done(1, 80, 5), done(2, 80, 5)], 'hard') === 'failed',
  'unchanged behaviour'
);

console.log(`\nskip-preserves-logged-sets: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
