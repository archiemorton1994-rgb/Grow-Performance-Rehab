/**
 * Contract test: the injury swap cannot hand back the thing it removed.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The screen classified a movement by its NAME. Most names are honest, so this
 * mostly worked — and where it did not, it failed in the worst possible
 * direction. "AMRAP Finisher" is eight minutes of burpees and squat jumps.
 * "Dynamic Warm-Up" is jumping jacks and butt kicks. "KB Swing + Shuttle" is a
 * sprint. None of those names says jump, so all of them looked safe for every
 * complaint there is — which meant they were not merely left in the session,
 * they were eligible to be chosen as the REPLACEMENT for something taken out of
 * it. Measured: a knee-pain session served AMRAP Finisher under the caption
 * "Swapped from Reverse Lunge + Knee Drive Intervals to protect your knee".
 *
 * Two things are asserted here, and the second is the one that matters:
 *
 *   - every catalogue exercise whose own reps or cue prescribes jumping,
 *     sprinting or running is screened as impact, whatever it is called;
 *   - across every complaint, session type and equipment tier, no exercise that
 *     is unsafe for a region is ever served as the replacement for something
 *     removed because of that region.
 *
 * The second runs the REAL generator over the whole matrix rather than a
 * fixture, because there are five separate generation paths and a test against
 * one of them says nothing about the other four.
 *
 * Run:  npx tsx tests/impact-swap-safety.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { generateWorkout } from '../lib/workout-engine.ts';
import {
  restrictedTagsFor,
  restrictedTagsOn,
  stressTagsFor,
  RESTRICTED_BY_REGION,
} from '../lib/exercise-safety.ts';
import { getAllPickableExercises } from '../lib/exercise-db.ts';

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

const beginner = {
  name: 'T',
  sex: 'male',
  experienceLevel: 'beginner',
  goals: ['fitness'],
  bodyweightKg: 80,
};
// The beginner override rules out impact for ANY complaint, which would hide a
// broken classifier behind a blanket ban. Where a check is about the classifier
// itself it uses this profile, so only the complaint's own rules apply.
const advanced = { ...beginner, experienceLevel: 'advanced' };

const all = getAllPickableExercises();

// ─── 1. The measured offenders ───────────────────────────────────────────────
console.log('\n[1] The exercises that were served as "safe" are screened as impact');

const REPORTED = [
  'AMRAP Finisher',
  'Dynamic Warm-Up',
  'Shuttle Run Intervals',
  'DB Thruster + Shuttle Run',
  'KB Swing + Shuttle',
];
for (const name of REPORTED) {
  check(
    `"${name}" carries the impact tag`,
    stressTagsFor(name).includes('high_impact'),
    'its name never says jump — the jumping is in its reps and cue'
  );
}
check(
  'and a sore knee therefore rules it out',
  REPORTED.every((n) => restrictedTagsOn(n, restrictedTagsFor(['knee'], 'advanced')).length > 0),
  REPORTED.filter((n) => restrictedTagsOn(n, restrictedTagsFor(['knee'], 'advanced')).length === 0).join(', ')
);
check(
  'running counts, whatever the name calls it',
  ['Steady Walk / Light Jog', 'Shuttle Run Intervals'].every((n) =>
    stressTagsFor(n).includes('high_impact')
  ),
  'a 20 m shuttle is a hundred landings and a light jog is still a jog'
);

// ─── 2. The rule, not the list ───────────────────────────────────────────────
console.log('\n[2] Every exercise that prescribes impact is caught, not just those five');

// Deliberately written as vocabulary rather than by name: adding a new circuit
// whose reps read "10 burpees" must fail this test until the classifier sees it.
const PRESCRIBES_IMPACT =
  /burpee|jump|plyo|\bhops?\b|hopping|bound(?:s|ing)?\b|skater|butt kick|high knees|mountain climber|sprint|shuttle|\bruns?\b|running|\bjogs?\b|jogging|double-?under|pogo/i;

/**
 * Exercises whose prescription uses that vocabulary and are still allowed, each
 * for a reason stated in their own text. Anything new landing here needs the
 * same kind of reason written next to it — not a quiet addition.
 */
const IMPACT_FREE_BY_DESIGN = {
  'Assault Bike Intervals': 'sprinting a bike is still sprinting, and still nothing lands',
};

const missed = [];
for (const { template } of all) {
  const prescription = `${template.reps} ${template.cue}`;
  if (!PRESCRIBES_IMPACT.test(prescription)) continue;
  if (template.name in IMPACT_FREE_BY_DESIGN) continue;
  if (!stressTagsFor(template.name, template.movementPattern).includes('high_impact')) {
    missed.push(`${template.name} — "${prescription.trim()}"`);
  }
}
check(
  `all ${all.length} catalogue exercises agree with their own reps and cue`,
  missed.length === 0,
  missed.slice(0, 6).join(' | ')
);

for (const [name, why] of Object.entries(IMPACT_FREE_BY_DESIGN)) {
  check(
    `"${name}" is still allowed — ${why}`,
    !stressTagsFor(name).includes('high_impact'),
    'the exception list is there so the screen does not remove the gentle option too'
  );
}
check(
  'and the low-impact stand-ins are not swept up with them',
  ['Marching in Place', 'Step Touch + High Knee March', 'DB Squat + Press Intervals'].every(
    (n) => !stressTagsFor(n).includes('high_impact')
  ),
  'these exist as the version that does not land — their cues say so'
);

// ─── 3. The rules stay proportionate ─────────────────────────────────────────
console.log('\n[3] Reading the prescription does not ban the catalogue');

const overBroad = [];
for (const region of Object.keys(RESTRICTED_BY_REGION)) {
  const banned = restrictedTagsFor([region], 'beginner');
  const blocked = all.filter(
    (p) => restrictedTagsOn(p.template.name, banned, p.template.movementPattern).length > 0
  ).length;
  const pct = Math.round((blocked / all.length) * 100);
  if (pct > 35) overBroad.push(`${region}: ${pct}%`);
}
check(
  'no complaint rules out more than a third of the catalogue',
  overBroad.length === 0,
  overBroad.join(', ')
);

// ─── 4. The invariant ────────────────────────────────────────────────────────
console.log('\n[4] Nothing unsafe for a region is ever served as its replacement');

const TYPES = ['lower_body', 'upper_body', 'full_body', 'conditioning', 'squat', 'bench', 'deadlift'];
const TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
const SEVERITIES = ['mild', 'moderate', 'severe'];

let sessions = 0;
const servedAsSafe = [];
const leftBehind = [];
const behindSwapButton = [];
const reportedServed = [];

for (const profile of [beginner, advanced]) {
  for (const region of Object.keys(RESTRICTED_BY_REGION)) {
    const banned = restrictedTagsFor([region], profile.experienceLevel);
    // Read off the policy table rather than the classifier, so [5] still fails
    // when the classifier is the thing that has been broken. A sore neck does
    // not rule out jumping, and a shuttle run there is not a bug.
    const impactBanned =
      profile.experienceLevel === 'beginner' || RESTRICTED_BY_REGION[region].includes('high_impact');
    for (const type of TYPES) {
      for (const tier of TIERS) {
        for (const painSeverity of SEVERITIES) {
          const ex = generateWorkout(
            type,
            tier,
            {
              hasAches: true,
              painRegion: [region],
              painSeverity,
              energy: 'normal',
              timeAvailable: '60',
            },
            profile
          );
          sessions++;
          const where = `${region}/${type}/${tier}/${painSeverity}`;
          for (const e of ex) {
            // The rehab block is chosen FOR the sore region and is exempt on
            // purpose — see SCREEN_EXEMPT_CATEGORIES.
            if (e.category === 'prehab') continue;
            if (impactBanned && REPORTED.includes(e.name)) {
              reportedServed.push(`${where}: ${e.name} :: ${e.safetyNote ?? 'no note'}`);
            }
            const isSubstitution = e.safetyNote?.startsWith('Swapped from') === true;
            const hits = restrictedTagsOn(e.name, banned);
            if (hits.length > 0) {
              (isSubstitution ? servedAsSafe : leftBehind).push(`${where}: ${e.name} [${hits}]`);
            }
            // A substitution deliberately offers the removed exercise back as
            // its revert, labelled as one. Every other card's alternatives have
            // to be clean.
            if (isSubstitution) continue;
            for (const alt of [e.swapName, e.swap2Name]) {
              if (alt && restrictedTagsOn(alt, banned).length > 0) {
                behindSwapButton.push(`${where}: ${e.name} → ${alt}`);
              }
            }
          }
        }
      }
    }
  }
}

check(
  `no substitution is itself unsafe (${sessions} sessions across every complaint, type and tier)`,
  servedAsSafe.length === 0,
  servedAsSafe.slice(0, 6).join(' | ')
);
check(
  'and nothing unsafe is left standing in the session either',
  leftBehind.length === 0,
  leftBehind.slice(0, 6).join(' | ')
);
check(
  'and the swap button never offers it back one tap later',
  behindSwapButton.length === 0,
  behindSwapButton.slice(0, 6).join(' | ')
);

// ─── 5. The exact reproduction ───────────────────────────────────────────────
console.log('\n[5] The sessions that were reported');

check(
  'none of the five reaches a session belonging to someone impact is off-limits for',
  reportedServed.length === 0,
  reportedServed.slice(0, 6).join(' | ')
);

const kneeBodyweight = TYPES.flatMap((type) =>
  generateWorkout(
    type,
    'bodyweight',
    { hasAches: true, painRegion: ['knee'], energy: 'normal', timeAvailable: '60' },
    advanced
  )
);
check(
  'and the knee-pain week is still a week of training',
  kneeBodyweight.length > TYPES.length * 3,
  `${kneeBodyweight.length} exercises across ${TYPES.length} sessions — screening should adapt, not strip`
);

// ─── 6. The same rule for an area nothing hurts on today ─────────────────────
//
// SECTIONS 4 AND 5 ASK TODAY'S QUESTION. Every session above reports pain on
// the readiness screen, so every one of them tests the answer somebody gave
// this morning. The two areas that are NOT reported this morning - the one a
// clinician told them to stay off, and the one that was already sore when they
// signed up - are the whole reason a shoulder avoided for six months answers
// "nothing hurts" every single time.
//
// WHAT WENT WRONG, and why nothing here caught it. When Lower Body was switched
// onto the exercise library, the merge that folds those two lists into the
// screened regions was computed BELOW the library's early return. The library
// builder does the same merge for its own picking, so the session that appeared
// on screen was clean and every existing check stayed green - but the swap
// sheet is filled in the engine, and it was being filled from the raw readiness
// answer. Measured at the time: a Lower Body session for somebody with a
// standing knee problem and nothing sore today offered "Jump Lunge + Skater
// Hop Round" and "Barbell Bulgarian Split Squat" one tap behind the button.
//
// So this sweep asks section 4's question with the pain moved off the readiness
// screen and onto the profile, across both questions, every area, every session
// type - the library ones and the old-engine ones - and every tier.
console.log('\n[6] And for an area named on the profile rather than reported today');

{
  let standingSessions = 0;
  let offered = 0;
  const behindButton = [];
  const nothingOffered = [];

  for (const which of ['standingSoreRegions', 'clinicalAvoid']) {
    for (const region of Object.keys(RESTRICTED_BY_REGION)) {
      const banned = restrictedTagsFor([region], advanced.experienceLevel, 'mild');
      for (const type of TYPES) {
        for (const tier of TIERS) {
          const ex = generateWorkout(
            type,
            tier,
            // Nothing sore this morning. That is the point.
            { hasAches: false, energy: 'normal', timeAvailable: '60' },
            { ...advanced, [which]: [region] },
            undefined,
            undefined,
            3
          );
          standingSessions++;
          const where = `${which}/${region}/${type}/${tier}`;
          let here = 0;
          for (const e of ex) {
            // Chosen FOR the area, exempt on purpose — see SCREEN_EXEMPT_CATEGORIES.
            if (e.category === 'prehab') continue;
            // A safety substitution carries the exercise it replaced, as the revert.
            if (e.safetyNote?.startsWith('Swapped from')) continue;
            for (const alt of [e.swapName, e.swap2Name]) {
              if (!alt) continue;
              here++;
              offered++;
              const hits = restrictedTagsOn(alt, banned);
              if (hits.length > 0) behindButton.push(`${where}: ${e.name} → ${alt} [${hits}]`);
            }
          }
          if (here === 0) nothingOffered.push(where);
        }
      }
    }
  }

  check(
    `the swap button never offers an area a clinician ruled out (${standingSessions} sessions, ${offered} alternatives)`,
    behindButton.length === 0,
    behindButton.slice(0, 6).join(' | ')
  );
  check(
    // Without this the assertion above passes the day the swap sheet goes empty,
    // which is the other way to serve nobody an unsafe alternative.
    'and there is still something behind every session\'s button to be safe about',
    nothingOffered.length === 0 && offered > standingSessions * 3,
    `${nothingOffered.length} sessions with no alternative at all: ${nothingOffered.slice(0, 5).join(', ')}`
  );

  // The reported case named in the review, kept as its own line so a failure
  // says which session it was rather than only how many.
  const kneeLower = generateWorkout(
    'lower_body',
    'fullgym',
    { hasAches: false, energy: 'normal', timeAvailable: '60' },
    { ...advanced, standingSoreRegions: ['knee'] },
    undefined,
    undefined,
    3
  );
  const kneeBanned = restrictedTagsFor(['knee'], advanced.experienceLevel, 'mild');
  check(
    'a Lower Body session for a standing knee problem is clean behind the button too',
    kneeLower
      .filter((e) => e.category !== 'prehab' && !e.safetyNote?.startsWith('Swapped from'))
      .every(
        (e) =>
          [e.swapName, e.swap2Name].filter(Boolean).every(
            (alt) => restrictedTagsOn(alt, kneeBanned).length === 0
          )
      ),
    kneeLower
      .flatMap((e) =>
        [e.swapName, e.swap2Name]
          .filter((a) => a && restrictedTagsOn(a, kneeBanned).length > 0)
          .map((a) => `${e.name} → ${a}`)
      )
      .join(' | ')
  );
}

console.log('');
if (failures > 0) {
  console.error(`impact-swap-safety: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`impact-swap-safety: all ${total} checks passed\n`);
  process.exitCode = 0;
}
