/**
 * Contract test: what an exercise card signals about the exercise on it.
 *
 * Four small signals, all on the session card, all of which were saying
 * something that was not true: which timer an exercise gets, which way the
 * progression arrow points, and the glyphs the two screens are written with.
 *
 * ─── 1-3. THE WARM-UP COUNTDOWN ─────────────────────────────────────────────
 *
 * WHAT WAS WRONG
 * A session opens with a continuous cardio warm-up, and its card shows a
 * running clock instead of a rest timer. The screen decided which exercise got
 * that clock by asking "is this the FIRST preparation exercise?" — which is true
 * of the cardio warm-up in every session the generator builds, and so held by
 * luck rather than by meaning.
 *
 * The custom builder broke the luck. Build a session yourself, skip the cardio
 * step, and the first preparation exercise is a mobility drill: the clock landed
 * on a stretch, and because a stretch prescribes reps rather than minutes the
 * duration parser fell back to its default. The app told someone to hold a
 * six-rep Cossack squat for five minutes. It was patched by making the cardio
 * step compulsory, which is a fence around the hole rather than the fix.
 *
 * WHAT THIS PROTECTS
 * ──────────────────
 * The rule is now about the movement, not its position: a preparation exercise
 * gets the countdown when it prescribes a run of minutes. Three things have to
 * stay true for that to keep working.
 *
 *  1. POSITION IS NOT THE TEST. The screen must not go back to keying either
 *     timer on the exercise's index.
 *  2. EVERY REAL SESSION STILL AGREES. Across the sessions the app actually
 *     builds — every session type at every equipment tier — the exercise that
 *     gets the clock is the cardio warm-up, and nothing else does.
 *  3. A CUSTOM BUILD WITHOUT CARDIO GIVES IT TO NOBODY. This is the original
 *     bug, and it is the one case position and meaning disagree about.
 *
 * The predicate is read out of app/session.tsx and run for real, so this cannot
 * pass against a copy of the rule that the screen no longer uses.
 *
 * ─── 4. THE PROGRESSION ARROW ───────────────────────────────────────────────
 *
 * A weight eased back after time away is filed by the engine as a hold, because
 * the two directions it can express are "up" and "hold" and an upward arrow
 * beside a reduced weight would be worse than a flat one. The card read that
 * flat and drew a dash, so "Eased back to 78%" arrived with an icon beside it
 * saying nothing had moved.
 *
 * ─── 5. THE GLYPHS ──────────────────────────────────────────────────────────
 *
 * No emoji in user-facing copy, and no label that repeats the arrow already
 * drawn beside it.
 *
 * Run:  npx tsx tests/session-card-signals.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateWorkout } from '../lib/workout-engine.ts';
import { assembleSession, exercisesInCategory } from '../lib/session-builder.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const SESSION_SRC = readFileSync(join(__dir, '../app/session.tsx'), 'utf8');

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

// ─── The screen's own predicate, lifted out and made callable ────────────────
//
// Anchored to the signature rather than to the body, so rewording the rule is
// free and moving away from it is not.

const bodyMatch = SESSION_SRC.match(
  /function isTimedCardioWarmup\(exercise: Exercise\): boolean \{\r?\n([\s\S]*?)\r?\n\}/
);

let getsCountdown = null;
if (bodyMatch) {
  try {
    getsCountdown = new Function('exercise', bodyMatch[1]);
  } catch (e) {
    console.error(`  (could not evaluate the predicate: ${e.message})`);
  }
}

check(
  'app/session.tsx exposes isTimedCardioWarmup(exercise)',
  typeof getsCountdown === 'function',
  'the rest of this file tests that function; without it there is nothing to test'
);

if (typeof getsCountdown !== 'function') {
  console.error('\nsession-card-signals: FAILED (predicate not found)\n');
  process.exit(1);
}

// ─── 1. Position is not the test ─────────────────────────────────────────────
console.log('\n[1] Neither timer is keyed on where the exercise sits');

const timerBlock = SESSION_SRC.slice(
  SESSION_SRC.indexOf('{exercise.type !== \'cardio\' && isTimedCardioWarmup'),
  SESSION_SRC.indexOf('<RestTimer category=')
);

check(
  'the countdown and the rest timer are chosen by the same predicate',
  timerBlock.length > 0 &&
    (SESSION_SRC.match(/isTimedCardioWarmup\(exercise\)/g) ?? []).length === 2,
  'one branch renders CardioWarmupTimer and the other RestTimer; they must not drift apart'
);
check(
  'no `index` in either condition',
  !/index\s*===?\s*0/.test(timerBlock),
  '"whatever warm-up comes first" is the bug this file exists for'
);
check(
  'the predicate asks what the exercise prescribes, not what it is called',
  /category/.test(bodyMatch[1]) && /min/.test(bodyMatch[1]),
  'an id list would go stale the moment a warm-up is added to the catalogue'
);

// ─── 2. Every session the app builds still agrees ────────────────────────────
console.log('\n[2] Across every generated session, the clock lands on the cardio warm-up');

const PROFILE = {
  name: 'Test',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['strength'],
  bodyweightKg: 85,
};
const READINESS = { hasAches: false, energy: 'normal', timeAvailable: '60' };
const SESSION_TYPES = [
  'squat',
  'bench',
  'deadlift',
  'upper_body',
  'lower_body',
  'full_body',
  'conditioning',
  'prehab',
  'flexibility',
];
const TIERS = ['bodyweight', 'dumbbells', 'fullgym'];

/** Reads like a warm-up you keep moving through, by name or by prescription. */
const CONTINUOUS = /cardio|warm-?up|jog|skip|rope|bike|row|march|leg swing|walk/i;

const tooMany = [];
const notAWarmup = [];
const misplaced = [];
const missed = [];

for (const type of SESSION_TYPES) {
  for (const tier of TIERS) {
    const session = generateWorkout(type, tier, READINESS, PROFILE, {}, undefined, 0, {}, {}, {}, 0);
    const timed = session.filter((e) => e.type !== 'cardio' && getsCountdown(e));
    const where = `${type}/${tier}`;

    if (timed.length > 1) tooMany.push(`${where}: ${timed.map((e) => e.name).join(', ')}`);
    for (const e of timed) {
      if (!CONTINUOUS.test(e.name)) notAWarmup.push(`${where}: "${e.name}" (${e.reps})`);
      // The cardio warm-up is the thing you do before anything else, so a clock
      // anywhere but the front means it landed on something that is not one.
      if (session.indexOf(e) !== 0) {
        misplaced.push(`${where}: clock on #${session.indexOf(e) + 1} "${e.name}"`);
      }
    }
    // The other direction: a session that DOES open with continuous cardio must
    // still get its clock, or every warm-up in the app is now a rest timer.
    const opener = session[0];
    if (opener && CONTINUOUS.test(opener.name) && /\d+\s*min/.test(opener.reps) && !timed.includes(opener)) {
      missed.push(`${where}: "${opener.name}" (${opener.reps}) got no clock`);
    }
  }
}

check(
  `at most one exercise per session gets the countdown (${SESSION_TYPES.length * TIERS.length} sessions)`,
  tooMany.length === 0,
  tooMany.join(' | ')
);
check(
  'the exercise that gets it is a continuous warm-up',
  notAWarmup.length === 0,
  notAWarmup.join(' | ')
);
check('and it is the exercise the session opens with', misplaced.length === 0, misplaced.join(' | '));
check(
  'a session that opens with continuous cardio always gets it',
  missed.length === 0,
  missed.join(' | ')
);

// The shipped instance of the same bug, kept by name because it is the one a
// user could hit without ever opening the custom builder: the Flexibility
// session opens with Diaphragmatic Breathing — a prep exercise counted in
// breaths — and under the old rule that earned a five-minute countdown, because
// the duration parser has nothing to read in "10 deep breaths" and defaults.
const flexibility = generateWorkout(
  'flexibility',
  'fullgym',
  READINESS,
  PROFILE,
  {},
  undefined,
  0,
  {},
  {},
  {},
  0
);
check(
  'the Flexibility session does not put a countdown on its breathing drill',
  flexibility.filter((e) => getsCountdown(e)).length === 0,
  `opener is "${flexibility[0]?.name}" (${flexibility[0]?.reps})`
);

// ─── 3. The custom builder, with and without the cardio step ─────────────────
console.log('\n[3] A custom build gets the clock only when it contains cardio');

const cardioPool = exercisesInCategory('cardio');
const stretchPool = exercisesInCategory('active_stretch');
const kpiPool = exercisesInCategory('kpi');

const pick = (t) => ({ template: t, sets: t.sets, reps: t.reps });

const withCardio = assembleSession(
  'athletic',
  {
    cardio: [pick(cardioPool[0])],
    mobility: [pick(stretchPool[0]), pick(stretchPool[1])],
    kpi: [pick(kpiPool[0])],
  },
  3
);
const withoutCardio = assembleSession(
  'athletic',
  {
    mobility: [pick(stretchPool[0]), pick(stretchPool[1])],
    kpi: [pick(kpiPool[0])],
  },
  3
);

const timedWith = withCardio.filter((e) => getsCountdown(e));
const timedWithout = withoutCardio.filter((e) => getsCountdown(e));

check(
  'a build that includes the cardio step gets exactly one countdown',
  timedWith.length === 1,
  `got ${timedWith.length}: ${timedWith.map((e) => e.name).join(', ')}`
);
check(
  'and it is the cardio pick, not merely the first exercise',
  timedWith.length === 1 && timedWith[0].name === cardioPool[0].name,
  `got "${timedWith[0]?.name}", expected "${cardioPool[0].name}"`
);
check(
  'a build that skips the cardio step gets NO countdown',
  timedWithout.length === 0,
  `the original bug: a five-minute clock on "${timedWithout[0]?.name}" (${timedWithout[0]?.reps})`
);
check(
  'that build still starts with a preparation exercise',
  withoutCardio.length > 0 && withoutCardio[0].category === 'prep',
  'otherwise the case above passes for the wrong reason'
);

// ─── 4. The eased-back note points down ──────────────────────────────────────
console.log('\n[4] A reduced weight gets a downward arrow, not a dash');

const iconFn = SESSION_SRC.slice(
  SESSION_SRC.indexOf('function progressionIconFor'),
  SESSION_SRC.indexOf('function RestTimer')
);

check(
  'the icon logic has a down case',
  /trending-down/.test(iconFn),
  'time away eases the weight down; "up" and "hold" cannot say that'
);
check(
  'it is reached by the eased-back note the engine writes',
  /Eased back/.test(iconFn),
  'lib/workout-engine.ts files an eased-back load under `hold`, so the sentence is the only signal'
);
check(
  'the engine still writes that sentence',
  /`Eased back to \$\{/.test(readFileSync(join(__dir, '../lib/workout-engine.ts'), 'utf8')),
  'if the copy is reworded, the arrow silently goes back to a dash'
);
check(
  'a "starting fresh" note is left as a dash',
  !/Starting fresh/.test(iconFn),
  'a re-estimate can land either side of the old weight, so an arrow would be a guess'
);

// ─── 5. The glyphs the two screens are written with ──────────────────────────
console.log('\n[5] No emoji, and no label that repeats its own icon');

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const SCREENS = ['app/session.tsx', 'app/readiness.tsx'];

for (const rel of SCREENS) {
  const lines = readFileSync(join(__dir, '..', rel), 'utf8').split(/\r?\n/);
  const hits = lines
    .map((l, i) => ({ n: i + 1, l }))
    .filter(({ l }) => EMOJI.test(l))
    .map(({ n, l }) => `line ${n}: ${l.trim().slice(0, 70)}`);
  check(`${rel} contains no emoji`, hits.length === 0, hits.join(' | '));
}

// "→ Next: pick area →" — an arrow drawn by the icon and another typed into the
// label. Only the label directly under an arrow icon is checked, because an
// arrow at the end of a plain text link is the app's own idiom and correct.
const doubled = [];
for (const rel of SCREENS) {
  const lines = readFileSync(join(__dir, '..', rel), 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!/<Ionicons name="arrow-(forward|back)"/.test(line)) return;
    const next = lines.slice(i + 1, i + 3).find((l) => l.includes('<Text'));
    if (next && /[→←]\s*<\/Text>/.test(next)) {
      doubled.push(`${rel}:${i + 2} ${next.trim().slice(0, 70)}`);
    }
  });
}
check(
  'no button draws an arrow icon and types one into its label as well',
  doubled.length === 0,
  doubled.join(' | ')
);

console.log('');
if (failures > 0) {
  console.error(`session-card-signals: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`session-card-signals: all ${total} checks passed\n`);
  process.exit(0);
}
