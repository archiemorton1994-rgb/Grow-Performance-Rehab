/**
 * Contract test: what an exercise card signals about the exercise on it.
 *
 * Four small signals, all on the session card, all of which were saying
 * something that was not true: which clock an exercise gets, which way the
 * progression arrow points, and the glyphs the two screens are written with.
 *
 * ─── 1-3. WHICH EXERCISE GETS A CLOCK ───────────────────────────────────────
 *
 * WHAT WAS WRONG FIRST
 * A session opens with a continuous cardio warm-up, and its card showed a
 * running clock instead of a rest timer. The screen decided which exercise got
 * that clock by asking "is this the FIRST preparation exercise?" — which is true
 * of the cardio warm-up in every session the generator builds, and so held by
 * luck rather than by meaning.
 *
 * The custom builder broke the luck. Build a session yourself, skip the cardio
 * step, and the first preparation exercise is a mobility drill: the clock landed
 * on a stretch, and because a stretch prescribes reps rather than minutes the
 * duration parser fell back to its default. The app told someone to hold a
 * six-rep Cossack squat for five minutes.
 *
 * That was fixed by asking what the exercise prescribed rather than where it
 * sat: `isTimedCardioWarmup`, a preparation card asking for minutes.
 *
 * WHAT WAS STILL WRONG, AND WHAT THESE SECTIONS NOW SAY
 * ────────────────────────────────────────────────────
 * That predicate was still a rule about ONE card. Measured over the same
 * sessions: 119 cards are prescribed on a clock and exactly 3 of them — the
 * cardio warm-up — had a counter. A Plank prescribed "30s" had none.
 *
 * Archie's decision was that anything prescribed on a clock gets a counter: the
 * holds, the cool-down stretches and the conditioning bouts alike. So "at most
 * one countdown per session" and "the card that gets it is a continuous warm-up"
 * are no longer true of the app, and re-asserting them would hold the screen to
 * a promise it has stopped making.
 *
 * THE CLINICAL RULE UNDERNEATH THEM IS UNCHANGED AND IS WHAT THESE SECTIONS
 * ASSERT: a clock may only ever land on a card that asked for a length of time,
 * and its length may only ever be the length that was written down. Both
 * directions are checked over every session the app builds and over a custom
 * build with and without the cardio step, which is the case where position and
 * meaning disagree. The Cossack squat is still the fault being guarded; it is
 * guarded by the absence of a fallback rather than by the absence of a clock.
 *
 * The rule itself lives in lib/hold-timer.ts now, with the countdown, the
 * each-side sequencing and the alert thresholds, and
 * tests/hold-timer.check.mjs drives all of it second by second. What THIS file
 * still owns is the session-level question: over real generated sessions, does
 * the clock land where the prescription says and nowhere else, and is the screen
 * still asking that one question rather than a second copy of it.
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
import { holdClockFor } from '../lib/hold-timer.ts';
import { doseOfPrescription } from '../lib/set-logging.ts';

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

/**
 * Does this card get a clock, and how long for?
 *
 * The screen's own answer, because it is the same function call. The predicate
 * used to be lifted out of app/session.tsx with a regular expression and
 * evaluated, which was the only way to run a rule that lived inside a React
 * Native screen. Section 1 below checks the screen still asks THIS, so the rule
 * being driven here and the rule on the card cannot be two different things.
 */
const getsClock = (exercise) => holdClockFor(exercise.reps) !== null;

// ─── 1. The screen asks one question, about the prescription ─────────────────
console.log('\n[1] Neither clock is keyed on where the exercise sits');

const memo = SESSION_SRC.match(
  /const holdClock = useMemo\(\(\) => holdClockFor\(([^)]*)\), \[([^\]]*)\]\);/
);
check(
  'the card asks lib/hold-timer.ts for the clock',
  memo !== null,
  'if the screen has its own copy of the rule, everything below is testing the wrong one'
);
check(
  'and asks it about the prescription, nothing else',
  memo !== null && memo[1].trim() === 'exercise.reps' && memo[2].trim() === 'exercise.reps',
  memo ? `it passes ${memo[1]}` : 'not found'
);

const clockStart = SESSION_SRC.indexOf("{exercise.type !== 'cardio' && !!holdClock &&");
const clockEnd = SESSION_SRC.indexOf('<RestTimer', clockStart);
const timerBlock = clockStart >= 0 && clockEnd > clockStart ? SESSION_SRC.slice(clockStart, clockEnd) : '';
check(
  'both timer branches were found on the card',
  // Anchored on the condition, and length-bounded. An anchor that misses makes
  // indexOf return -1, and a slice from -1 silently became the whole rest of the
  // file once before — which of course contains `index`, so this reported the bug
  // it exists to catch on a change that had nothing to do with it.
  timerBlock.length > 100 && timerBlock.length < 1200,
  `slice is ${timerBlock.length} characters; the anchors have moved`
);
check(
  'no `index` in either condition',
  timerBlock.length > 100 && !/index\s*===?\s*0/.test(timerBlock),
  '"whatever warm-up comes first" is the bug this file exists for'
);

// ─── 2. Every session the app builds still agrees ────────────────────────────
console.log('\n[2] Across every generated session, the clock lands on what was prescribed');

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

const wrongWay = [];
const missed = [];
const invented = [];
/** Every answer the rule gave, keyed by the sentence that produced it. */
const answerFor = new Map();
let cardsSeen = 0;
let clocksSeen = 0;

for (const type of SESSION_TYPES) {
  for (const tier of TIERS) {
    const session = generateWorkout(type, tier, READINESS, PROFILE, {}, undefined, 0, {}, {}, {}, 0);
    const where = `${type}/${tier}`;
    for (const e of session) {
      if (e.type === 'cardio') continue; // its own input block, not a card clock
      cardsSeen++;
      const clock = holdClockFor(e.reps);
      const asksForTime = doseOfPrescription(e.reps) === 'time';
      if (clock && !asksForTime) wrongWay.push(`${where}: "${e.name}" (${e.reps})`);
      if (!clock && asksForTime) missed.push(`${where}: "${e.name}" (${e.reps}) got no clock`);
      if (!clock) continue;
      clocksSeen++;
      // The length on the clock is the length in the sentence, in the unit
      // written beside it. This is the Cossack squat guard: the parser it
      // replaced answered five minutes when it could not read the sentence.
      const written = e.reps.match(/(\d+(?:\.\d+)?)\s*(s|secs?|seconds?|mins?|minutes?)\b/i);
      const expected = written
        ? Math.round(parseFloat(written[1]) * (/^m/i.test(written[2]) ? 60 : 1))
        : null;
      if (clock.seconds !== expected) {
        invented.push(`${where}: "${e.name}" (${e.reps}) -> ${clock.seconds}s, sentence says ${expected}s`);
      }
      const seen = answerFor.get(e.reps);
      const asJson = JSON.stringify(clock);
      if (seen && seen !== asJson) {
        wrongWay.push(`${where}: "${e.reps}" answered ${asJson} here and ${seen} elsewhere`);
      }
      answerFor.set(e.reps, asJson);
    }
  }
}

check(
  `the sweep reached real cards (${cardsSeen} cards, ${clocksSeen} of them clocked)`,
  cardsSeen > 60 && clocksSeen > 10,
  `${cardsSeen} cards, ${clocksSeen} clocked - too few for the rest of this section to mean anything`
);
check(
  'nothing gets a clock unless it asked for a length of time',
  wrongWay.length === 0,
  wrongWay.join(' | ')
);
check(
  'and everything that asked for one gets it',
  missed.length === 0,
  missed.join(' | ')
);
check(
  'no clock runs for a length nobody wrote down',
  invented.length === 0,
  invented.join(' | ')
);
check(
  `the same prescription always gets the same clock, wherever it appears (${answerFor.size} distinct)`,
  answerFor.size > 5,
  'position and session type cannot change the answer, because neither is asked'
);

// The shipped instance of the original bug, kept by name because it is the one a
// user could hit without ever opening the custom builder: the Flexibility
// session opens with Diaphragmatic Breathing — a prep exercise counted in
// breaths — and under the oldest rule that earned a five-minute countdown,
// because the duration parser has nothing to read in "10 deep breaths".
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
const breathing = flexibility.find((e) => /Breathing/i.test(e.name));
check(
  'the Flexibility session still opens with the breathing drill counted in breaths',
  breathing !== undefined &&
    flexibility[0] === breathing &&
    /breaths/i.test(breathing.reps) &&
    !/\d+\s*(s|min)\b/i.test(breathing.reps),
  `opener is "${flexibility[0]?.name}" (${flexibility[0]?.reps})`
);
check(
  'and it gets no countdown',
  breathing !== undefined && !getsClock(breathing),
  `"${breathing?.name}" (${breathing?.reps}) got ${JSON.stringify(holdClockFor(breathing?.reps ?? ''))}`
);
check(
  'while the stretches in the same session, which ARE on a clock, all get one',
  flexibility.filter((e) => /Stretch|Pose/i.test(e.name) && /\ds\b/.test(e.reps)).length > 2 &&
    flexibility
      .filter((e) => /Stretch|Pose/i.test(e.name) && /\ds\b/.test(e.reps))
      .every((e) => getsClock(e)),
  'the whole point of the change: a 45 second stretch is prescribed on a clock'
);

// ─── 3. The custom builder, with and without the cardio step ─────────────────
console.log('\n[3] A custom build gives a clock to exactly the cards asking for time');

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

// Asserted flat, with no escape clause for the case where the cardio pick stops
// being prescribed in minutes. An "or the premise no longer holds" arm is how an
// assertion goes quietly vacuous: the premise is the thing worth failing on, so
// it is its own line.
check(
  'the cardio pick is still prescribed as a run of minutes',
  doseOfPrescription(cardioPool[0].reps) === 'time' && /\d+\s*min/.test(cardioPool[0].reps),
  `"${cardioPool[0].name}" asks for "${cardioPool[0].reps}"`
);
const cardioMinutes = Math.round(parseFloat(cardioPool[0].reps.match(/(\d+(?:\.\d+)?)\s*min/)[1]) * 60);
check(
  `and a build that includes the cardio step gives it a clock of exactly that length (${cardioMinutes}s)`,
  withCardio.some(
    (e) => e.name === cardioPool[0].name && holdClockFor(e.reps)?.seconds === cardioMinutes
  ),
  `"${cardioPool[0].name}" (${cardioPool[0].reps}) got ${JSON.stringify(holdClockFor(cardioPool[0].reps))}`
);

for (const [name, build] of [
  ['with cardio', withCardio],
  ['without cardio', withoutCardio],
]) {
  const disagreed = build.filter((e) => getsClock(e) !== (doseOfPrescription(e.reps) === 'time'));
  check(
    `a build ${name} (${build.length} cards) agrees card for card with what was prescribed`,
    build.length > 0 && disagreed.length === 0,
    disagreed.map((e) => `"${e.name}" (${e.reps})`).join(' | ')
  );
  const overRun = build.filter((e) => {
    const clock = holdClockFor(e.reps);
    return clock !== null && clock.seconds > 5 * 60;
  });
  check(
    `and nothing in it is held longer than the app ever prescribes`,
    overRun.length === 0,
    `the original bug was a five-minute clock on a six-rep movement: ${overRun
      .map((e) => `"${e.name}" (${e.reps}) -> ${holdClockFor(e.reps).seconds}s`)
      .join(' | ')}`
  );
}
check(
  'a build that skips the cardio step still starts with a preparation exercise',
  withoutCardio.length > 0 && withoutCardio[0].category === 'prep',
  'otherwise the cases above pass for the wrong reason'
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

// ─── Every warning above the list can be put away ────────────────────────────
//
// Reported from use: "the 'Keep it pain free' yellow box that appears at the top
// of the session needs to be able to be closed. currently you cant press X to
// get rid of it, leading to a really cluttered screen".
//
// It sits above the exercise list for the whole session, and on a 4.7-inch phone
// that is a real slice of the screen given away permanently to a sentence you
// read once. The adaptation banner next to it has always had a close button, so
// a session with a sore area reported showed two yellow boxes, one of which
// could be put away and one of which could not.
//
// Dismissing it softens nothing: the instruction is repeated on every affected
// card, and Skip is on the logging bar throughout.
console.log('\n[6] The banners above the exercise list can all be dismissed');

const painFreeBanner = SESSION_SRC.slice(
  SESSION_SRC.indexOf('export function PainFreeRangeBanner'),
  SESSION_SRC.indexOf('RestoreFailedBanner')
);

check(
  'the pain-free banner was found',
  painFreeBanner.length > 200,
  'it has moved and this section is testing nothing'
);
check(
  'it takes a dismissed flag and shrinks on it',
  /dismissed\?: boolean;/.test(painFreeBanner) && /if \(dismissed\) \{/.test(painFreeBanner),
  ''
);
check(
  'it draws a close button',
  /pain-free-banner-dismiss/.test(painFreeBanner) && /name="close"/.test(painFreeBanner),
  'there was no way to put it away at all'
);
// Deliberately NOT a full dismissal. This one carries the pain limit for a
// session built around something that hurts right now, and it is the only place
// that limit is stated. tests/acute-rehab.check.mjs owns that rule.
check(
  'but it shrinks rather than vanishing, unlike the one beside it',
  /pain-free-range-banner-collapsed/.test(painFreeBanner),
  ''
);
check(
  'the screen holds its own state for it, separate from the adaptation banner',
  /const \[painFreeBannerDismissed, setPainFreeBannerDismissed\] = useState\(false\)/.test(
    SESSION_SRC
  ) && /onDismiss=\{\(\) => setPainFreeBannerDismissed\(true\)\}/.test(SESSION_SRC),
  'they carry different instructions, so one X must not take the other away'
);
check(
  'and dismissing it survives a resume',
  /painFreeBannerDismissed: painFreeBannerDismissedRef\.current,/.test(SESSION_SRC) &&
    /if \(stored\.painFreeBannerDismissed\) setPainFreeBannerDismissed\(true\);/.test(SESSION_SRC),
  'a banner that comes back every time the app is reopened has not really been dismissed'
);

console.log('');
if (failures > 0) {
  console.error(`session-card-signals: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`session-card-signals: all ${total} checks passed\n`);
  process.exitCode = 0;
}
