/**
 * Contract test: Athlete is a real level everywhere, not a gap with a fallback
 * behind it.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Adding a fourth training level is mostly a typing job, and the dangerous part
 * is the part the compiler cannot see. Four of the tables the engine keys on
 * experience were typed `Record<string, number>` with a `??` beside them, so a
 * level with no row of its own did not fail the build: it quietly picked up
 * whatever the fallback said. Measured before this change, with the value
 * forced through by hand, an athlete was given
 *
 *   - an INTERMEDIATE's starting weights, 30% lighter than an advanced lifter's
 *   - an INTERMEDIATE's rate of climb, which is FASTER than an advanced one
 *   - a movement ceiling of 1, below a beginner's 2, because the ceiling loop
 *     counted up to `undefined` and so never ran
 *   - an undefined difficulty label and a NaN score, which every screen that
 *     calls `.toUpperCase()` on that label then crashes on
 *   - one set fewer in the conditioning finisher
 *
 * Four different wrong answers from one missing row, and not one of them would
 * have announced itself. So the tables are now typed on the level union, and
 * this file asserts the behaviour rather than the typing: it runs the real
 * functions for every level in EXPERIENCE_LEVELS and holds the promises that
 * were made about what Athlete is.
 *
 * WHAT ATHLETE IS PROMISED TO BE
 * ──────────────────────────────
 * The top of the list, and the same prescription as Advanced. It opens on the
 * same weights, climbs no faster, reads the same difficulty label, is offered
 * the same movements and gets the same finisher. What it is NOT is a way to
 * unlock harder movements by picking a bigger word: the ladders stop at level 5
 * and Advanced already reaches it, which is the earn-the-barbell rule in
 * PROGRESSION-LADDERS.md. Athlete has its own rows so that it CAN be given its
 * own numbers the day there is a clinical reason to, without a silent fallback
 * deciding first.
 *
 * NOTHING HERE READS THE SOURCE. Every assertion runs the shipped function. The
 * list of levels is imported from the store rather than copied into this file,
 * so a fifth level is walked by all of it the moment it is added.
 *
 * Run:  npx tsx tests/athlete-level.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

// The session generators seed their rotation with today's date, so two sessions
// built either side of midnight would differ for a reason that has nothing to
// do with the level they were built for.
const RealDate = Date;
const FIXED_NOW = RealDate.UTC(2026, 0, 15, 12, 0, 0);
globalThis.Date = class FixedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(FIXED_NOW);
    else super(...args);
  }
  static now() {
    return FIXED_NOW;
  }
};

import './_persist-shim.mjs';
import { EXPERIENCE_LEVELS, isExperienceLevel } from '../lib/store.ts';
import { generateWorkout, progressedLoad } from '../lib/workout-engine.ts';
import {
  DIFFICULTY_LABELS,
  MAX_EXERCISE_LEVEL,
  PROGRAMME_IDS,
  levelBandForExperience,
  levelCeilingFor,
  programmeDifficulty,
} from '../lib/programme.ts';
import { getGoalConditioningBlock } from '../lib/exercise-db.ts';
import { restrictedTagsFor, RESTRICTED_BY_REGION } from '../lib/exercise-safety.ts';

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

const TOP = EXPERIENCE_LEVELS[EXPERIENCE_LEVELS.length - 1];
const BELOW_TOP = EXPERIENCE_LEVELS[EXPERIENCE_LEVELS.length - 2];
const DAYS = [2, 3, 4, 5];

// ─── 1. The list everything else reads ──────────────────────────────────────
console.log('\n[1] There is one list of levels, and it has a top');

check(
  `the store exports them in order: ${EXPERIENCE_LEVELS.join(', ')}`,
  EXPERIENCE_LEVELS.length >= 4 &&
    EXPERIENCE_LEVELS[0] === 'beginner' &&
    EXPERIENCE_LEVELS.includes('advanced') &&
    TOP === 'athlete',
  'this file walks that list, so a list it cannot recognise makes everything below it meaningless'
);
check(
  'no level is listed twice',
  new Set(EXPERIENCE_LEVELS).size === EXPERIENCE_LEVELS.length,
  EXPERIENCE_LEVELS.join(', ')
);
check(
  'every level in the list is recognised as one',
  EXPERIENCE_LEVELS.every((l) => isExperienceLevel(l)),
  'the guard and the list disagree, so a stored value would be rejected as unknown'
);
check(
  'and a value that is not a level is not waved through',
  !isExperienceLevel('garbage') &&
    !isExperienceLevel('Athlete') &&
    !isExperienceLevel('') &&
    !isExperienceLevel(undefined) &&
    !isExperienceLevel(null) &&
    !isExperienceLevel(3),
  'a guard that says yes to anything is the silent fallback with a new name'
);

// ─── 2. The first session ───────────────────────────────────────────────────
// Nothing has been logged, so the whole weight is a guess made from bodyweight
// and the level. This is where a missing row cost an athlete 30%.
console.log('\n[2] An athlete opens on the same weights as an advanced lifter');

const profileFor = (experienceLevel, goals = ['strength']) => ({
  name: 'T',
  sex: 'male',
  experienceLevel,
  goals,
  bodyweightKg: 80,
});

const TYPES = ['squat', 'bench', 'deadlift', 'upper_body', 'lower_body', 'full_body'];
const TIERS = ['dumbbells', 'fullgym'];

/** Every card of a first session, with what it prescribes on it. */
function firstSession(level, type, tier, goals) {
  const list = generateWorkout(
    type,
    tier,
    { hasAches: false, energy: 'normal', timeAvailable: '60' },
    profileFor(level, goals),
    undefined,
    undefined,
    0,
    undefined,
    undefined,
    undefined,
    0
  );
  return list
    .map(
      (e) =>
        `${e.name}|${e.sets}|${e.reps}|${e.suggestedLoad ?? ''}|${(e.loadKg ?? []).join('/')}`
    )
    .join('\n');
}

function allFirstSessions(level) {
  const out = [];
  for (const goals of [['strength'], ['muscle']])
    for (const type of TYPES) for (const tier of TIERS) out.push(firstSession(level, type, tier, goals));
  return out.join('\n--\n');
}

const sessionsByLevel = new Map(EXPERIENCE_LEVELS.map((l) => [l, allFirstSessions(l)]));

check(
  `${TYPES.length * TIERS.length * 2} first sessions are card for card the same at ${TOP} as at ${BELOW_TOP}`,
  sessionsByLevel.get(TOP) === sessionsByLevel.get(BELOW_TOP),
  'an athlete is being prescribed something different from an advanced lifter, which nothing has decided'
);
check(
  // Without this, the check above would pass just as happily on a function that
  // ignored the level completely.
  'and this comparison can see a level change at all',
  sessionsByLevel.get('beginner') !== sessionsByLevel.get(BELOW_TOP) &&
    sessionsByLevel.get('intermediate') !== sessionsByLevel.get(BELOW_TOP),
  'every level builds an identical session, so this section proves nothing'
);
check(
  'every level builds a session with something in it',
  EXPERIENCE_LEVELS.every((l) => sessionsByLevel.get(l).length > 200),
  EXPERIENCE_LEVELS.map((l) => `${l}:${sessionsByLevel.get(l).length}`).join(' ')
);

// ─── 3. How fast the bar climbs ─────────────────────────────────────────────
// Deliberately run on an identity grid and from 220 kg. On a real 2.5 kg grid
// below about 208 kg the rates collapse onto the same number, so a check
// written at 100 kg would pass with an athlete climbing at an intermediate's
// rate - which is exactly the bug this guards.
console.log('\n[3] An athlete climbs no faster than an advanced lifter');

const identityGrid = (v) => v;
function climb(level, from = 220) {
  let w = from;
  for (let i = 0; i < 12; i++) w = progressedLoad(w, undefined, i, identityGrid, level);
  return w;
}
const climbed = new Map(EXPERIENCE_LEVELS.map((l) => [l, climb(l)]));

check(
  `after twelve quiet sessions from 220 kg: ${EXPERIENCE_LEVELS.map((l) => `${l} ${climbed.get(l).toFixed(1)}`).join(', ')}`,
  EXPERIENCE_LEVELS.every(
    (l, i) => i === 0 || climbed.get(l) <= climbed.get(EXPERIENCE_LEVELS[i - 1]) + 1e-9
  ),
  'a level further up the list is being given a faster climb than the one below it'
);
check(
  `${TOP} climbs no faster than ${BELOW_TOP}`,
  climbed.get(TOP) <= climbed.get(BELOW_TOP) + 1e-9,
  `${climbed.get(TOP)} vs ${climbed.get(BELOW_TOP)}`
);
check(
  // The measurement has to be able to separate the tiers, or the check above is
  // just three numbers that happen to be equal.
  'and the measurement can tell the tiers apart',
  climbed.get(TOP) < climbed.get('intermediate') && climbed.get('beginner') > climbed.get('intermediate'),
  `${EXPERIENCE_LEVELS.map((l) => `${l} ${climbed.get(l)}`).join(', ')}`
);
check(
  'a level this build has never heard of is treated as intermediate, not as the fastest',
  climb('something-new') === climbed.get('intermediate'),
  `${climb('something-new')} vs ${climbed.get('intermediate')}`
);

// ─── 4. The movement ceiling ────────────────────────────────────────────────
console.log('\n[4] The ceiling rises with the list and stops at the top of the ladder');

const ceilings = EXPERIENCE_LEVELS.map((l) => levelCeilingFor(l));
check(
  `it never goes down across the list: ${EXPERIENCE_LEVELS.map((l, i) => `${l} ${ceilings[i]}`).join(', ')}`,
  ceilings.every((c, i) => i === 0 || c >= ceilings[i - 1]),
  'a level further up the list is allowed fewer movements than the one below it'
);
check(
  'and no level is held below the bottom of the ladder',
  ceilings.every((c) => c >= 2),
  `${ceilings.join(', ')} - a ceiling of 1 is below a beginner, which is what a missing table row produced`
);
check(
  `${TOP} reaches the top rung, and no further`,
  levelCeilingFor(TOP) === MAX_EXERCISE_LEVEL && levelCeilingFor(TOP, 99) === MAX_EXERCISE_LEVEL,
  `${levelCeilingFor(TOP)} / ${levelCeilingFor(TOP, 99)}`
);
check(
  // Earn the barbell: picking the top word must not hand anybody a movement
  // that the word below it could not already reach.
  `${TOP} unlocks no movement ${BELOW_TOP} does not already have`,
  levelCeilingFor(TOP) === levelCeilingFor(BELOW_TOP) &&
    JSON.stringify(levelBandForExperience(TOP, 0)) ===
      JSON.stringify(levelBandForExperience(BELOW_TOP, 0)),
  `${JSON.stringify(levelBandForExperience(TOP, 0))} vs ${JSON.stringify(levelBandForExperience(BELOW_TOP, 0))}`
);
check(
  'the band the generator builds on leaves a rung in front of every level',
  EXPERIENCE_LEVELS.every((l) => {
    const band = levelBandForExperience(l, 0);
    return band.prefer >= 1 && band.prefer <= band.max && band.max <= MAX_EXERCISE_LEVEL;
  }),
  EXPERIENCE_LEVELS.map((l) => `${l} ${JSON.stringify(levelBandForExperience(l, 0))}`).join(' ')
);

// ─── 5. The word on the programme ───────────────────────────────────────────
// This is the one that crashed screens: an undefined label reaches
// difficulty.label.toUpperCase() on the hub, the stats card, the chooser and
// the certificate.
console.log('\n[5] Every programme has a real label at every level');

const bad = [];
for (const id of PROGRAMME_IDS) {
  for (const level of EXPERIENCE_LEVELS) {
    for (const days of DAYS) {
      const d = programmeDifficulty(id, level, days);
      if (
        !DIFFICULTY_LABELS.includes(d.label) ||
        !Number.isFinite(d.score) ||
        d.score < 0 ||
        d.score >= DIFFICULTY_LABELS.length ||
        d.because.trim().length < 12 ||
        /undefined|NaN/.test(d.because)
      ) {
        bad.push(`${id}/${level}/${days} -> ${d.label} (${d.score}) ${d.because}`);
      }
    }
  }
}
check(
  `all ${PROGRAMME_IDS.length * EXPERIENCE_LEVELS.length * DAYS.length} programme and level combinations name a real difficulty`,
  bad.length === 0,
  bad.slice(0, 4).join(' | ')
);

const notMonotonic = [];
for (const id of PROGRAMME_IDS) {
  for (const days of DAYS) {
    for (let i = 1; i < EXPERIENCE_LEVELS.length; i++) {
      const lower = programmeDifficulty(id, EXPERIENCE_LEVELS[i - 1], days).score;
      const upper = programmeDifficulty(id, EXPERIENCE_LEVELS[i], days).score;
      if (upper < lower) notMonotonic.push(`${id}/${days}: ${EXPERIENCE_LEVELS[i]} ${upper} < ${EXPERIENCE_LEVELS[i - 1]} ${lower}`);
    }
  }
}
check(
  'the score never drops as the level goes up',
  notMonotonic.length === 0,
  notMonotonic.slice(0, 4).join(' | ')
);
check(
  `${TOP} reads exactly as ${BELOW_TOP} does, because the sessions are the same`,
  PROGRAMME_IDS.every((id) =>
    DAYS.every((days) => {
      const top = programmeDifficulty(id, TOP, days);
      const below = programmeDifficulty(id, BELOW_TOP, days);
      return top.label === below.label && top.score === below.score && top.because === below.because;
    })
  ),
  'the label claims a difference the prescription does not have'
);

// ─── 6. The finisher ────────────────────────────────────────────────────────
console.log('\n[6] The conditioning finisher is the same size for both');

const CONDITIONING_TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
const ENERGIES = ['easy', 'normal', 'hard'];
const blockOf = (tier, energy, level) =>
  JSON.stringify(getGoalConditioningBlock(tier, energy, level).map((e) => [e.name, e.sets]));

const condMismatch = [];
let condBeginnerDiffers = false;
for (const tier of CONDITIONING_TIERS) {
  for (const energy of ENERGIES) {
    const top = blockOf(tier, energy, TOP);
    const below = blockOf(tier, energy, BELOW_TOP);
    if (top !== below) condMismatch.push(`${tier}/${energy}: ${top} vs ${below}`);
    if (blockOf(tier, energy, 'beginner') !== below) condBeginnerDiffers = true;
  }
}
check(
  `${TOP} gets the same finisher as ${BELOW_TOP} at every tier and energy`,
  condMismatch.length === 0,
  condMismatch.slice(0, 3).join(' | ')
);
check(
  'and the level still changes the finisher for somebody, so this can see a change',
  condBeginnerDiffers,
  'the set count ignores the level entirely'
);

// ─── 7. Not a beginner, anywhere that asks ──────────────────────────────────
console.log('\n[7] Athlete is read as experienced, not as a beginner');

const REGIONS = Object.keys(RESTRICTED_BY_REGION);
const tagsOf = (region, level) => [...restrictedTagsFor([region], level)].sort().join(',');

check(
  `what is withheld for a complaint is the same at ${TOP} as at ${BELOW_TOP}, across all ${REGIONS.length} regions`,
  REGIONS.every((r) => tagsOf(r, TOP) === tagsOf(r, BELOW_TOP)),
  REGIONS.filter((r) => tagsOf(r, TOP) !== tagsOf(r, BELOW_TOP)).slice(0, 3).join(' | ')
);
check(
  // The beginner rule is "no landing on anything while something hurts". It has
  // to still be a rule, or the check above passes because nothing is withheld.
  'and a beginner with the same complaint is still held off impact work',
  REGIONS.some((r) => !tagsOf(r, TOP).includes('high_impact') && tagsOf(r, 'beginner').includes('high_impact')),
  'the beginner impact rule has gone, which is a clinical change and not this one'
);

// TWO ASSERTIONS USED TO CLOSE THIS SECTION, walking selectProgramme over every
// focus and day count to prove that an athlete was handed the same template as
// an advanced lifter and a beginner a different one. Both read templateIdFor
// through a finished builder tree, and all three went when the builder did:
// a programme is chosen by name now, so there is no answer left to route.
//
// What they were guarding is still guarded, by the difficulty ceiling rather
// than by the routing. programmeDifficulty is keyed on the same four levels and
// tests/programme.check.mjs section 11 asserts that a beginner is never handed
// anything past Novice on any of the seven, at any frequency, while the label
// climbs with the level and every level has a row to climb from.

console.log(`\n${passed}/${passed + failed} passed`);
process.exitCode = failed === 0 ? 0 : 1;
