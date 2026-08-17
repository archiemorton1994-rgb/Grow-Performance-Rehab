/**
 * Contract test: the sentence on the card is true for the whole body.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The pain screen promises "we'll automatically swap exercises away from that
 * area so you can train safely", and every card the screen changes says so
 * again in words: "Swapped from Overhead Carry + Burpee Round to protect your
 * neck". For ten regions of nineteen that sentence was false. RESTRICTED_BY_REGION
 * listed jumping for knee, ankle, hip, lower back, calf, quads, hamstrings and
 * glutes — and for wrist, elbow, front shoulder, rear shoulder, neck, upper
 * back, lat/mid back, core/ribs, bicep and tricep it listed nothing, so the
 * substitution engine was free to pick a plyometric as the REPLACEMENT.
 * Measured at severe, intermediate: 39 distinct (region, exercise) pairs, of
 * which
 *
 *     Broad Jump + Walking Lunge Round
 *     Swapped from DB Squat Clean + Push Press Round to protect your elbow
 *
 * is representative — a caption promising care while the app escalated a press
 * into a jump.
 *
 * WHY THIS TEST LOOKS THE WAY IT DOES
 * ───────────────────────────────────
 * The previous test for this could not see any of it, because it asked
 * RESTRICTED_BY_REGION whether the exercise was allowed — the same table the
 * bug lived in. A test that shares the bug's premise agrees with the bug.
 *
 * So nothing below reads a policy table or a stress tag. It judges each
 * exercise by the words in its own name and its own prescription, against a
 * vocabulary spelled out here, and it holds every region to the identical
 * standard. If jumping is ever restored to a "to protect your X" card by any
 * route — a table entry deleted, a classifier rule narrowed, a new circuit
 * added whose reps say "10 burpees" — this goes red without needing to be told
 * where the regression happened.
 *
 * Run:  npx tsx tests/pain-swap-promise.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { generateWorkout } from '../lib/workout-engine.ts';
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

/**
 * What "jumping, sprinting, burpees or plyometrics" means, in words.
 *
 * Deliberately written as vocabulary rather than as a list of exercise names:
 * a circuit added tomorrow whose reps read "10 burpees" has to fail this test
 * on the day it lands, not on the day someone remembers to add it here.
 */
const IMPACT_WORDS =
  /burpee|\bjump|jumping|plyo|\bhops?\b|hopping|bound(?:s|ing)?\b|skater|butt kick|high knees|mountain climber|sprint|shuttle|\bruns?\b|running|\bjogs?\b|jogging|double-?under|pogo/i;

/**
 * …unless the exercise's own prescription says in so many words that it is the
 * version that does not land. Several movements exist precisely as the gentle
 * alternative — "same cardio effect as jumping jacks without the impact" — and
 * a test that failed on those would be punishing the app for reaching for
 * exactly the substitute it should reach for.
 */
const DISCLAIMS_IMPACT =
  /\b(?:low|zero|no|non)[-\s]?impact|without (?:the )?(?:sprint|jump|jumping|impact|running)|without leaving the (?:floor|ground)|no jumping|instead of (?:the )?(?:sprint|jump|run)/i;

/**
 * Sprinting a bike or an erg is still sprinting and still nothing lands, so a
 * "20s sprint" in the prescription is forgiven when the NAME says which machine
 * it is on. The name itself is never forgiven: "Assault Bike + Squat Jump
 * Circuit" really does jump, and letting the machine excuse the prescription
 * would let that one through.
 */
const SEATED_MACHINE = /\bbike|cycling|\berg\b|rower|rowing|elliptical|airdyne|arc trainer|\bswim/i;

const prescriptionByName = new Map(
  getAllPickableExercises().map(({ template: t }) => [t.name.toLowerCase(), `${t.reps} ${t.cue}`])
);

/** Does this exercise ask the user to leave the ground? */
function lands(name) {
  if (IMPACT_WORDS.test(name)) return true;
  const prescription = prescriptionByName.get(name.toLowerCase()) ?? '';
  if (!IMPACT_WORDS.test(prescription)) return false;
  if (DISCLAIMS_IMPACT.test(prescription)) return false;
  return !SEATED_MACHINE.test(name);
}

/** Every region the pain screen offers, named the way the user sees them. */
const REGIONS = [
  'knee',
  'ankle_achilles',
  'hip_groin',
  'lower_back',
  'upper_back',
  'neck',
  'front_shoulder',
  'rear_shoulder',
  'elbow',
  'wrist',
  'calf_shin',
  'quads',
  'hamstrings',
  'glutes',
  'chest',
  'bicep',
  'tricep',
  'lat_mid_back',
  'core_ribs',
];
const TYPES = ['lower_body', 'upper_body', 'full_body', 'conditioning', 'squat', 'bench', 'deadlift'];
const TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
const SEVERITIES = ['mild', 'moderate', 'severe'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];

/**
 * How many sessions the user has behind them.
 *
 * Not decoration. It seeds which stand-in the screen picks out of the ranked
 * list, so a complaint that looks clean on somebody's first session can serve
 * something else entirely on their ninth. Held at 0, this test would have
 * missed the Ab Wheel Rollout being offered to protect a sore wrist outright.
 */
const HISTORIES = [0, 3, 7];

const profileFor = (experienceLevel) => ({
  name: 'T',
  sex: 'male',
  experienceLevel,
  goals: ['fitness'],
  bodyweightKg: 80,
});

const session = (type, tier, region, painSeverity, experienceLevel, sessionsDone = 0) =>
  generateWorkout(
    type,
    tier,
    { hasAches: true, painRegion: [region], painSeverity, energy: 'normal', timeAvailable: '60' },
    profileFor(experienceLevel),
    undefined,
    undefined,
    sessionsDone
  );

/**
 * Everything one complaint can put in front of the user: the cards themselves
 * and the alternatives behind each card's swap button, across every session
 * type, every equipment tier and every point in their training history.
 *
 * Both halves matter equally. Removing the thing that hurts and then offering
 * it back one tap later is the same broken promise with an extra step in it.
 */
function everythingOffered(region, painSeverity, experienceLevel = 'intermediate') {
  const out = [];
  for (const type of TYPES) {
    for (const tier of TIERS) {
      for (const sessionsDone of HISTORIES) {
        for (const ex of session(type, tier, region, painSeverity, experienceLevel, sessionsDone)) {
          // The rehab block is chosen FOR the sore region — screening the
          // treatment because it names the injury is exactly backwards.
          if (ex.category === 'prehab') continue;
          out.push({ where: `${type}/${tier}`, name: ex.name, note: ex.safetyNote, offered: false });
          if (ex.safetyNote?.startsWith('Swapped from') === true) continue;
          for (const alt of [ex.swapName, ex.swap2Name]) {
            if (alt) out.push({ where: `${type}/${tier}`, name: alt, offered: true });
          }
        }
      }
    }
  }
  return out;
}

/** "Leg Press (offered behind Back Squat) in squat/fullgym" — for failure text. */
const describe = (c) => `${c.name}${c.offered ? ' (behind the swap button)' : ''} in ${c.where}`;

// ─── 1. The promise on the card ──────────────────────────────────────────────
console.log('\n[1] Nothing the app chooses FOR you jumps, for any complaint');

const substitutionsThatLand = [];
const offeredAlternativesThatLand = [];
const impactLeftAtSevere = [];
let cards = 0;
let substitutions = 0;

for (const experienceLevel of LEVELS) {
  for (const sessionsDone of HISTORIES) {
    for (const region of REGIONS) {
      for (const type of TYPES) {
        for (const tier of TIERS) {
          for (const painSeverity of SEVERITIES) {
            const where = `${region}/${type}/${tier}/${painSeverity}/${experienceLevel}`;
            for (const ex of session(
              type,
              tier,
              region,
              painSeverity,
              experienceLevel,
              sessionsDone
            )) {
              // The rehab block is chosen FOR the sore region — screening the
              // treatment because it names the injury is exactly backwards.
              if (ex.category === 'prehab') continue;
              cards++;
              if (painSeverity === 'severe' && lands(ex.name)) {
                impactLeftAtSevere.push(`${where}: ${ex.name}`);
              }
              if (ex.safetyNote?.startsWith('Swapped from') === true) {
                substitutions++;
                if (lands(ex.name)) {
                  substitutionsThatLand.push(`${where}: ${ex.name} :: ${ex.safetyNote}`);
                }
                // A substitution offers the exercise it REPLACED as its swap,
                // on purpose and labelled as one. That is the revert, not an
                // offer.
                continue;
              }
              for (const alt of [ex.swapName, ex.swap2Name]) {
                if (alt && lands(alt)) {
                  offeredAlternativesThatLand.push(`${where}: ${ex.name} → ${alt}`);
                }
              }
            }
          }
        }
      }
    }
  }
}

check(
  `no "to protect your…" card jumps, sprints or lands (${substitutions} substitutions over ${cards} cards — all ${REGIONS.length} regions × ${SEVERITIES.length} severities × ${LEVELS.length} experience levels × ${TIERS.length} tiers × ${HISTORIES.length} points in a training history)`,
  substitutionsThatLand.length === 0,
  substitutionsThatLand.slice(0, 6).join(' | ')
);
check(
  'and the swap button behind every other card offers none either',
  offeredAlternativesThatLand.length === 0,
  offeredAlternativesThatLand.slice(0, 6).join(' | ')
);

// ─── 2. Severity is a three-way question ─────────────────────────────────────
console.log('\n[2] All three answers to "how bad is it?" do something');

const sameAsPrevious = { moderate: [], severe: [] };
const notGentler = [];
let combos = 0;
const shapeOf = (ex) => ex.map((e) => `${e.name}×${e.sets}`).join(' | ');
const workingSets = (ex) =>
  ex
    .filter((e) => e.category === 'main' || e.category === 'accessory' || e.category === 'mechanical')
    .reduce((sum, e) => sum + e.sets, 0);

for (const region of REGIONS) {
  for (const type of TYPES) {
    for (const tier of TIERS) {
      const at = Object.fromEntries(
        SEVERITIES.map((s) => [s, session(type, tier, region, s, 'intermediate')])
      );
      combos++;
      const where = `${region}/${type}/${tier}`;
      if (shapeOf(at.mild) === shapeOf(at.moderate)) sameAsPrevious.moderate.push(where);
      if (shapeOf(at.moderate) === shapeOf(at.severe)) sameAsPrevious.severe.push(where);
      if (workingSets(at.severe) >= workingSets(at.moderate)) {
        notGentler.push(`${where}: ${workingSets(at.moderate)} → ${workingSets(at.severe)} sets`);
      }
    }
  }
}

check(
  `Moderate is not Mild (${combos} region × session type × tier combinations)`,
  sameAsPrevious.moderate.length === 0,
  sameAsPrevious.moderate.slice(0, 6).join(', ')
);
check(
  'and Severe is not Moderate — the two used to be byte-identical in all of them',
  sameAsPrevious.severe.length === 0,
  `${sameAsPrevious.severe.length}/${combos} identical: ${sameAsPrevious.severe.slice(0, 6).join(', ')}`
);
check(
  'Severe prescribes strictly less work than Moderate, not merely different work',
  notGentler.length === 0,
  notGentler.slice(0, 6).join(' | ')
);
check(
  'and at Severe nothing in the session lands, whichever region hurts',
  impactLeftAtSevere.length === 0,
  impactLeftAtSevere.slice(0, 6).join(' | ')
);

// ─── 3. The reported sessions ────────────────────────────────────────────────
console.log('\n[3] The exact complaints that were reproduced');

// A knee that hurts badly enough to call severe should not be under a loaded
// barbell squat or driving a sled of plates back through the same range. Both
// were being served with no note on them at all.
const kneeOffenders = everythingOffered('knee', 'severe')
  .filter((c) => /\bback squat\b|\bleg press\b|hack squat|bulgarian/i.test(c.name))
  .map(describe);
check(
  'severe knee pain is not handed a Back Squat or a Leg Press',
  kneeOffenders.length === 0,
  [...new Set(kneeOffenders)].slice(0, 6).join(' | ')
);

// An ab wheel is bodyweight through a straight arm on a rolling handle, and a
// swing is a bell held at the end of a long lever. Neither is something to put
// a sore wrist through, and both were reachable — the wheel as an outright
// substitution captioned "to protect your wrist".
const wristOffenders = SEVERITIES.flatMap((s) => everythingOffered('wrist', s))
  .filter((c) => /ab wheel|roll-?out|\bswings?\b/i.test(c.name))
  // An ARM swing is a mobility drill with nothing in the hands — see [4].
  .filter((c) => !/\b(?:arm|leg|shoulder)\s+swings?\b/i.test(c.name))
  .map(describe);
check(
  'a sore wrist is not handed an Ab Wheel Rollout or a kettlebell swing',
  wristOffenders.length === 0,
  [...new Set(wristOffenders)].slice(0, 6).join(' | ')
);

// A slam starts above the head, whatever the name of the circuit around it.
const slamOffenders = ['neck', 'upper_back', 'tricep', 'front_shoulder']
  .flatMap((r) => everythingOffered(r, 'severe').map((c) => `${r}: ${describe(c)}`))
  .filter((s) => /\bslams?\b/i.test(s));
check(
  'and a sore neck, upper back, shoulder or tricep is not handed a slam',
  slamOffenders.length === 0,
  [...new Set(slamOffenders)].slice(0, 6).join(' | ')
);

// ─── 4. …without taking away things that were never the problem ──────────────
console.log('\n[4] The screen removes what hurts, not everything that rhymes with it');

// A LEG curl is not elbow work and an ARM swing is not a loaded hinge. Both
// were being read as the movement they are named after, so a sore bicep took
// away every hamstring curl in the catalogue and a sore lower back took away
// the mobility warm-ups. Measured before this: "Swapped from Nordic Hamstring
// Curl to protect your bicep / front arm".
const curlsTakenAway = ['bicep', 'tricep', 'elbow']
  .flatMap((r) => everythingOffered(r, 'mild').map((c) => `${r}: ${c.note ?? ''}`))
  .filter((s) => /\bswapped from .*(?:hamstring|leg|nordic) curl/i.test(s));
check(
  'a sore arm does not take away your hamstring curls',
  curlsTakenAway.length === 0,
  [...new Set(curlsTakenAway)].slice(0, 4).join(' | ')
);

const warmupsTakenAway = ['lower_back', 'hip_groin', 'glutes', 'hamstrings']
  .flatMap((r) => everythingOffered(r, 'mild').map((c) => `${r}: ${c.note ?? ''}`))
  .filter((s) => /\bswapped from .*\b(?:arm|leg|shoulder) swings?\b/i.test(s));
check(
  'and a sore back does not take away a leg-swing warm-up',
  warmupsTakenAway.length === 0,
  [...new Set(warmupsTakenAway)].slice(0, 4).join(' | ')
);

// ─── 5. The promise is not kept by giving up ─────────────────────────────────
console.log('\n[5] Reporting one sore spot adapts the session, it does not rewrite it');

// The cheap way to pass everything above is to ban more. Ban enough and no card
// can be wrong because no card is the user's own any more — you have stopped
// adapting their session and started generating a different one, and the person
// who reports honestly gets the least of what they came for. Measured, banning
// every stress for every complaint rewrites 43-49% of the lifting; the rules as
// they stand rewrite at most 24%, and the worst case is a hip complaint on leg
// day, which is exactly where you would expect the most change.
const MOST_OF_THE_SESSION_THAT_MAY_CHANGE = 1 / 3;

const rewritten = [];
const mainless = [];
for (const region of REGIONS) {
  let changed = 0;
  let lifts = 0;
  for (const type of TYPES) {
    for (const tier of TIERS) {
      const ex = session(type, tier, region, 'severe', 'intermediate');
      if (type !== 'conditioning' && !ex.some((e) => e.category === 'main')) {
        mainless.push(`${region}/${type}/${tier}`);
      }
      for (const e of ex) {
        if (e.category !== 'main' && e.category !== 'accessory') continue;
        lifts++;
        if (e.safetyNote) changed++;
      }
    }
  }
  if (changed / lifts > MOST_OF_THE_SESSION_THAT_MAY_CHANGE) {
    rewritten.push(`${region}: ${changed}/${lifts} = ${Math.round((changed / lifts) * 100)}%`);
  }
}
check(
  'no complaint changes more than a third of the lifting you came to do',
  rewritten.length === 0,
  rewritten.slice(0, 6).join(' | ')
);
check(
  'and every strength session still has a main lift to progress',
  mainless.length === 0,
  mainless.slice(0, 6).join(' | ')
);

console.log('');
if (failures > 0) {
  console.error(`pain-swap-promise: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`pain-swap-promise: all ${total} checks passed\n`);
  process.exitCode = 0;
}
