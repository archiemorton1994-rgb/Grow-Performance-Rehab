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

console.log('');
if (failures > 0) {
  console.error(`impact-swap-safety: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`impact-swap-safety: all ${total} checks passed\n`);
  process.exitCode = 0;
}
