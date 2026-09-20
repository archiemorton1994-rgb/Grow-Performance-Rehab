/**
 * Contract test: a set rating lands on the exercise it was given for.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Completing the last set of an exercise advances the session immediately, so
 * the logging bar is already showing the NEXT exercise by the time the user
 * taps Easy / Challenging / Too Hard. The prompt used to read the exercise id
 * live off the bar's props at the moment the answer was tapped, which meant
 * every final-set rating was filed against the following exercise. Measured: an
 * "Easy" tapped for a Back Squat's last set was saved against the accessory
 * after it.
 *
 * That is the single rating that matters most. The warm-up sets no longer count
 * toward the "easy" tally (see lib/auto-regulation.ts), so for a ramped main
 * lift the working set — the last one — is the only set that can produce the
 * rating at all. Misfiling it both robs the right exercise of its answer and
 * hands a load change to an exercise nobody rated.
 *
 * A second, related hole: the bar returned the "Complete Session" button as
 * soon as every set was done, checked BEFORE the prompt. On the final set of
 * the session the prompt was therefore never drawn, so the last exercise of
 * every session went unrated no matter what the user did.
 *
 * Run:  node tests/set-feedback-attribution.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateWorkout } from '../lib/workout-engine.ts';
import { loggedExerciseFor, swapSlotFor } from '../lib/exercise-swaps.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dir, '../app/session.tsx'), 'utf8');

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

/** Body of the arrow function assigned to `name`, up to the closing `};`. */
function fnBody(name) {
  const start = src.indexOf(`const ${name} = (`);
  if (start === -1) return '';
  const end = src.indexOf('\n  };', start);
  return end === -1 ? src.slice(start) : src.slice(start, end);
}

console.log('\n[1] The answered set carries its own exercise id');

check(
  'showFeedback state holds an exerciseId',
  /const \[showFeedback, setShowFeedback\] = useState<\{[\s\S]{0,200}?exerciseId: string;/.test(src),
  'the id must be captured when the prompt is raised, not read when it is answered'
);

const complete = fnBody('handleComplete');
check(
  'raising the prompt captures exercise.id alongside the set index',
  /setShowFeedback\(\{[\s\S]{0,160}?exerciseId: exercise\.id/.test(complete),
  'handleComplete must stamp the prompt with the exercise the set belonged to'
);

const feedback = fnBody('handleFeedback');
check(
  'answering reports showFeedback.exerciseId',
  feedback.includes('showFeedback.exerciseId'),
  'handleFeedback must use the captured id'
);

check(
  'answering never reads the live exercise.id',
  !/onFeedback\(\s*exercise\.id/.test(feedback) && !/onFeedback\(\s*exercise\?\.id/.test(feedback),
  'reading exercise.id at answer time files the rating against the next exercise'
);

console.log('\n[2] The last set of the session still gets asked');

check(
  'the finish button yields to an open prompt',
  /if \(sessionAllDone && !showFeedback\)/.test(src),
  'sessionAllDone must not short-circuit the prompt, or the final exercise is never rated'
);

check(
  'the no-current-set guard yields to an open prompt',
  /if \(!showFeedback && \(!exercise \|\| !currentSet \|\| activeSetIndex >= totalSets\)\) return null;/.test(
    src
  ),
  'after the last set there is no "current set" left for the guard to find, so the prompt must be exempt'
);

console.log('\n[3] A rating given on a swapped card belongs to the swap');

/**
 * THE SECOND WAY A RATING CAN BE FILED AGAINST THE WRONG EXERCISE.
 *
 * Section [1] is about time - the answer arriving after the session has moved
 * on. This one is about identity. A swapped card shows, and now logs, the
 * SWAP: the prompt is raised under the name on screen, so the id it carries is
 * the swap's. If the session were then filed by reading the answers under the
 * original's id, every rating given on a swapped card would be dropped on the
 * floor - the exercise would be recorded as unrated, and the one signal that
 * moves its weight next time would be lost without anything to show for it.
 *
 * So the two have to agree, and that is measured here on real cards rather
 * than read: what the card shows is what the session files.
 */
const profile = {
  name: 'T',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['muscle'],
  bodyweightKg: 80,
};
const swappableCards = ['lower_body', 'upper_body', 'full_body', 'conditioning']
  .flatMap((type) =>
    generateWorkout(
      type,
      'fullgym',
      { hasAches: false, energy: 'normal', timeAvailable: '60' },
      profile,
      undefined,
      undefined,
      0
    )
  )
  .filter((card) => !!card.swapName);

check(
  'there are real swapped cards to measure',
  swappableCards.length > 5,
  `only ${swappableCards.length}`
);

const orphaned = swappableCards.filter((card) => {
  for (const choice of [1, 2]) {
    const shown = swapSlotFor(card, choice);
    if (!shown) continue;
    const ownId = choice === 1 ? card.swapId : card.swap2Id;
    // The rating is raised under what is on screen and filed under what is
    // logged. Both have to be the alternative's own record, not the card's.
    if (shown.id !== ownId || shown.id === card.id) return true;
    if (loggedExerciseFor(card, choice).id !== shown.id) return true;
  }
  return false;
});
check(
  'the id the card raises a rating under is the id the session files',
  orphaned.length === 0,
  `${orphaned.length} cards would lose every rating given after a swap, e.g. ${orphaned
    .slice(0, 3)
    .map((c) => c.name)
    .join('; ')}`
);

check(
  'and with nothing swapped it is still the exercise the session prescribed',
  swappableCards.every((card) => loggedExerciseFor(card, 0).id === card.id),
  'an unswapped card must file its answers where it raised them too'
);

// The wiring, which cannot be run: the screen has to read the answers under
// the id it logs, and work out the prescription behind a rating from the card
// rather than by looking the id up in a list that does not contain it.
check(
  'the session reads its answers under the id it logs',
  /const answers = setAnswers\[logged\.id\];/.test(src) &&
    /inSessionFeedback\[logged\.id\]/.test(src),
  'reading setAnswers[ex.id] while the card answers under the swap drops the rating'
);
check(
  'the live rating finds its card by position, not by id',
  /const rated = exercises\[exerciseIndex\];/.test(src),
  'no card carries the swap id, so a lookup by id finds nothing and silently treats a ramped main lift as unramped'
);

console.log('');
if (failures > 0) {
  console.error(`set-feedback-attribution: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`set-feedback-attribution: all ${total} checks passed\n`);
  process.exitCode = 0;
}
