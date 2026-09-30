/**
 * ARCHIE'S THREE CONTENT CORRECTIONS FROM EXPO, PINNED BY RUNNING THE APP.
 *
 * WHAT HE SAID
 * ────────────
 *   "Sled pull should be sled push and pull (they pull it then push it back to
 *    starting point)."                                       (25 September 2026)
 *   "Looks like confused with banded vs band resisted, they should be different
 *    exercises."                                             (25 September 2026)
 *   Diaphragmatic Breathing at the end should read "10 reps (10 breaths)" rather
 *   than 3 minutes.                                          (25 September 2026)
 *
 * And the answer he gave when the clinical consequence of the first was put to
 * him (26 September 2026): a sore ankle, Achilles, calf and shin used to keep
 * the backwards drag because walking backwards has no toe drive. Pushing the
 * sled home IS toe drive, so all four lose it, and no pull-only version is kept.
 *
 * HOW EVERY ASSERTION IS WRITTEN
 * ──────────────────────────────
 * By building real sessions with the real generators and reading the cards a
 * person is handed, and by asking the real parsers what a card asks for. Nothing
 * here greps a source file for a spelling: this repo's commonest defect is a
 * check that pins a word and stays green while the behaviour behind it breaks.
 * Where a claim IS about wording - a cue that has to describe both halves of the
 * sled - it is made against the card the generator serves rather than the source
 * it came from, and it is only ever one line among behavioural ones.
 *
 * THE SLED SECTION PROVES THE WITHHOLDING IS DONE BY A TAG AND NOT BY A NAME.
 * A rule keyed on "Sled Pull" would keep working today and fail silently the
 * next time somebody renames the exercise, so the record is asked for its stress
 * tags with its name replaced by a meaningless one. `ankle_load` has to survive
 * that, because it is written on the record.
 *
 * Every section carries a counterweight. The cheap way to pass "the sled is
 * withheld from a sore calf" is to serve the sled to nobody, and the cheap way
 * to pass "the closer is ten breaths" is to stop closing sessions at all.
 *
 * Run:  npx tsx tests/content-corrections.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { EXPERIENCE_LEVELS } from '../lib/store.ts';
import { generateLibrarySession } from '../lib/library-session.ts';
import { generateLibraryConditioningSession } from '../lib/library-conditioning.ts';
import { LIBRARY_EXERCISES, CONDITIONING_EXERCISES } from '../lib/exercise-library.ts';
import {
  RESTRICTED_BY_REGION,
  restrictedTagsOnRecord,
  stressTagsForRecord,
} from '../lib/exercise-safety.ts';
import { doseOfPrescription, prescribesAWeight, setInputShapeFor, targetCountForPrefill } from '../lib/set-logging.ts';
import { holdClockFor } from '../lib/hold-timer.ts';
import { levelOf } from '../lib/exercise-levels.ts';
import { isEquipmentVariant, kitOf, swapReasonFor } from '../lib/exercise-swaps.ts';
import { canonicalExerciseName } from '../lib/exercise-aliases.ts';
import { ID_MERGE, carryProgressForward } from '../lib/exercise-id-merge.ts';

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
const sample = (list, n = 4) =>
  list.slice(0, n).join(' | ') + (list.length > n ? ` (+${list.length - n} more)` : '');

// ─── The sweep, shared by every section ──────────────────────────────────────

const KITS = [
  [],
  ['bodyweight'],
  ['bodyweight', 'bands', 'dumbbells'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
  ['fullgym', 'bench'],
];
const STRENGTH_TYPES = ['lower_body', 'upper_body', 'full_body'];
const COUNTS = [0, 1, 2, 3, 4, 5, 6, 7];

function profileFor(level) {
  return {
    name: 'Sweep',
    sex: 'female',
    experienceLevel: level,
    goals: ['muscle'],
    bodyweightKg: 72,
    ageYears: 34,
    standingSoreRegions: [],
    clinicalAvoid: [],
  };
}

function readinessFor(regions, severity, timeAvailable = '60') {
  return {
    hasAches: regions.length > 0,
    painRegion: regions.length > 0 ? regions : undefined,
    painSeverity: severity,
    acute: false,
    energy: 'normal',
    timeAvailable,
  };
}

/** Every card a person with these answers is offered, strength and conditioning. */
function everythingOffered(regions, { severity = 'mild' } = {}) {
  const cards = [];
  for (const level of EXPERIENCE_LEVELS) {
    for (const equipment of KITS) {
      for (const n of COUNTS) {
        for (const sessionType of STRENGTH_TYPES) {
          const s = generateLibrarySession({
            sessionType,
            equipment,
            readiness: readinessFor(regions, severity),
            profile: profileFor(level),
            sessionTypeCount: n,
            strengthSessionCount: n,
            daysSinceLastSession: null,
          });
          for (const e of s.exercises) cards.push({ ...e, where: `${sessionType}/${level}` });
        }
        for (const timeAvailable of ['30', '45', '60']) {
          const c = generateLibraryConditioningSession({
            equipment,
            readiness: readinessFor(regions, severity, timeAvailable),
            profile: profileFor(level),
            sessionCount: n,
          });
          for (const e of c.exercises) cards.push({ ...e, where: `conditioning/${level}` });
        }
      }
    }
  }
  return cards;
}

const namesIn = (cards) => new Set(cards.map((c) => c.name));

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n[1] "Sled pull should be sled push and pull"');

/**
 * ARCHIE RENAMED IT AGAIN ON 30 SEPTEMBER 2026, AND MERGED THE OTHER ONE IN.
 *
 * "Remove the conditioning exercises sled push and sled pull and push from the
 * database and swap for sled push and pull instead." So there is one sled drag
 * left, it is called Sled Push and Pull, and it is this same record - the id has
 * not moved, which is the whole point of the section. Everything below is the
 * same rule read against the name it is served under now.
 */
const SLED = 'Sled Push and Pull';
const OLD_SLED_NAMES = ['Sled Push', 'Sled Pull', 'Sled Pull and Push'];
const sled = CONDITIONING_EXERCISES.find((e) => e.id === 'lib-cond-sled-pull');

check(
  'the sled drag is still one record, found by the id everybody logged it against',
  Boolean(sled),
  'the id is what carries somebody sled weight forward; a new one restarts it'
);
check(
  `it is served under a name that says both halves ("${sled?.name}")`,
  sled?.name === SLED && sled?.libraryName === SLED,
  `name "${sled?.name}", libraryName "${sled?.libraryName}"`
);
check(
  'and a set logged under any of the three old names still counts towards it',
  OLD_SLED_NAMES.every((n) => canonicalExerciseName(n) === SLED),
  OLD_SLED_NAMES.map((n) => `"${n}" charts as "${canonicalExerciseName(n)}"`).join(' | ')
);
check(
  'and the record that was merged away hands its sled weight over',
  ID_MERGE['lib-cond-sled-push'] === sled?.id &&
    carryProgressForward({ 'lib-cond-sled-push': 70 })[sled?.id ?? ''] === 70,
  `ID_MERGE says ${ID_MERGE['lib-cond-sled-push']} - without it a push-only history meets the beginner estimate`
);
check(
  'but a weight already logged against the survivor is never overwritten by it',
  carryProgressForward({ 'lib-cond-sled-push': 70, [sled?.id ?? '']: 40 })[sled?.id ?? ''] === 40,
  'the survivor is the lighter prescription of the two, so it has to win'
);
check(
  'the cue describes the drag out AND the push back',
  /backward/i.test(sled?.cue ?? '') && /\bpush\b/i.test(sled?.cue ?? ''),
  sled?.cue
);
check(
  'the distance says it is a round trip rather than one length',
  /out/i.test(sled?.reps ?? '') && /back/i.test(sled?.reps ?? ''),
  `reps "${sled?.reps}" — a bare "20 m" hides half the work now`
);
check(
  'and it is still read as a distance, counting the whole trip',
  doseOfPrescription(sled?.reps ?? '') === 'distance' && targetCountForPrefill(sled?.reps ?? '') === '20',
  `dose ${doseOfPrescription(sled?.reps ?? '')}, box starts on ${targetCountForPrefill(sled?.reps ?? '')}`
);

/**
 * THE CLINICAL HALF, AND IT IS THE TAG THAT DOES IT.
 *
 * Archie's four complaints are two regions in the app: an ankle and an Achilles
 * are `ankle_achilles`, a calf and a shin are `calf_shin`. Both restrict
 * `ankle_load`, which is the tag Sled Push already carried and the drag now
 * carries too.
 */
const FOUR_COMPLAINTS = [
  ['a sore ankle', 'ankle_achilles'],
  ['a sore Achilles', 'ankle_achilles'],
  ['a sore calf', 'calf_shin'],
  ['a sore shin', 'calf_shin'],
];

check(
  'the record itself carries ankle_load, which is how Sled Push was already withheld',
  (sled?.stress ?? []).includes('ankle_load') && (sled?.stress ?? []).includes('loaded_ground_drive'),
  `stress ${JSON.stringify(sled?.stress ?? [])}`
);
check(
  'and it keeps it when the name is taken away, so nothing is reading the name',
  stressTagsForRecord({ ...sled, name: 'Machine Thing', libraryName: 'Machine Thing', cue: 'Move it' }).includes(
    'ankle_load'
  ),
  'a rule keyed on the words "Sled Push" would pass today and break on the next rename'
);
for (const [complaint, region] of FOUR_COMPLAINTS) {
  check(
    `${complaint} (${region}) restricts ankle_load, so the tag reaches this exercise`,
    RESTRICTED_BY_REGION[region].includes('ankle_load') &&
      restrictedTagsOnRecord(sled, new Set(RESTRICTED_BY_REGION[region])).includes('ankle_load'),
    `restricted: ${RESTRICTED_BY_REGION[region].join(', ')}`
  );
}

for (const region of ['ankle_achilles', 'calf_shin']) {
  for (const severity of ['mild', 'moderate', 'severe']) {
    const cards = everythingOffered([region], { severity });
    const served = cards.filter((c) => c.name === SLED);
    check(
      `${region}, ${severity}: the card is absent from all ${cards.length} cards a person is offered`,
      served.length === 0,
      `${served.length} served, e.g. ${sample(served.map((c) => `${c.name} as ${c.category} in ${c.where}`))}`
    );
  }
}

// The counterweights: it reaches people, and the rest of the sled work stays.
const healthy = namesIn(everythingOffered([]));
check(
  'somebody with nothing sore is still offered it, so the absences above mean something',
  healthy.has(SLED),
  `otherwise "withheld from a sore calf" would be true of everybody`
);
for (const region of ['ankle_achilles', 'calf_shin']) {
  const names = namesIn(everythingOffered([region]));
  const kept = ['Sled Rows', 'Assault Bike', 'Rowing Machine', 'Incline Treadmill Walk'].filter((n) =>
    names.has(n)
  );
  check(
    `${region} still gets real conditioning, not an empty session`,
    kept.length >= 3,
    `kept: ${kept.join(', ')}`
  );
}
for (const region of ['quads', 'glutes', 'lower_back']) {
  check(
    `a sore ${region} still keeps it, because only two regions restrict that tag`,
    namesIn(everythingOffered([region])).has(SLED),
    'the other half of his answer was "keep the rest"'
  );
}
check(
  'and nothing anywhere is still served under any of the three old names',
  OLD_SLED_NAMES.every((n) => !healthy.has(n)),
  'two spellings of one exercise split somebody progress chart in half'
);

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n[2] "Banded vs band resisted - they should be different exercises"');

/**
 * THE SPLIT, IN HIS WORDS: banded work uses a light band AS the resistance, and
 * band resisted work adds a band to something already heavy. So each family has
 * to be honest about what it demands, and the two must never share an id -
 * sharing one would pour somebody logged kilograms into a light-band drill.
 */
const ALL_RECORDS = [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES];
const banded = ALL_RECORDS.filter((e) => /\bbanded\b/i.test(e.name));
const bandResisted = ALL_RECORDS.filter((e) => /\bband resisted\b/i.test(e.name));
/** Anything in the kit list that is heavier than a band. */
const HEAVIER_THAN_A_BAND = new Set([
  'barbell',
  'plates',
  'dumbbells',
  'kettlebell',
  'machine',
  'cable',
  'sled',
  'sandbag',
  'medball',
  'slamball',
  'abwheel',
]);
const kitKeysOf = (e) => (e.kit ?? []).flat();
const demands = (e, key) => (e.kit ?? []).some((group) => group.length === 1 && group[0] === key);

check(
  `both families exist to be compared (${banded.length} banded, ${bandResisted.length} band resisted)`,
  banded.length >= 5 && bandResisted.length >= 4,
  `${banded.map((e) => e.name).join(', ')} // ${bandResisted.map((e) => e.name).join(', ')}`
);
check(
  'no record is named as both, so every record is on one side of the split',
  banded.every((e) => !bandResisted.includes(e)),
  banded.filter((e) => bandResisted.includes(e)).map((e) => e.name).join(', ')
);

const bandedWrong = banded.filter((e) => {
  const keys = kitKeysOf(e);
  return (
    !demands(e, 'band') ||
    keys.some((k) => HEAVIER_THAN_A_BAND.has(k)) ||
    prescribesAWeight(e.suggestedLoad ?? '') ||
    !/band/i.test(e.suggestedLoad ?? '')
  );
});
check(
  `every "Banded" record asks for a band and nothing heavier (${banded.length} records)`,
  bandedWrong.length === 0,
  sample(bandedWrong.map((e) => `${e.name} needs ${JSON.stringify(e.kit)} at "${e.suggestedLoad}"`))
);
/**
 * AND A BAND CANNOT BE THE RESISTANCE IN A JUMP, which is the rule that stops
 * the broad jump drifting back. A light band is something you pull against at
 * the speed you choose; a jump is your whole bodyweight accelerating, and a band
 * hung off it is adding to that, not supplying it. So a record named as banded
 * work may not be power work and may not land - if it does, the band is not what
 * is making it hard and the name is on the wrong side of the split.
 */
const bandedButExplosive = banded.filter(
  (e) => e.role === 'power' || stressTagsForRecord(e).includes('high_impact')
);
check(
  'no "Banded" record is a jump or a landing, because a band cannot be what makes one hard',
  bandedButExplosive.length === 0,
  sample(
    bandedButExplosive.map((e) => `${e.name} is ${e.role} work, tags ${stressTagsForRecord(e).join('+')}`)
  ) + ' — that is band RESISTED work by his split'
);

/**
 * A BAND RESISTED RECORD HAS TO NAME WHAT THE BAND IS ADDED TO, and there are
 * two honest answers. Four of them are a loaded barbell, which is what the
 * phrase means in Archie's library, and they demand a bar and a band and are
 * prescribed in kilograms. The fifth is Band Resisted Broad Jumps, where the
 * band is added to your own bodyweight - you cannot hold a bar and jump - so its
 * load names bodyweight instead. What neither may do is look like a light-band
 * drill, which is what "Banded Broad Jumps" looked like before he split them.
 */
const bandResistedWrong = bandResisted.filter((e) => {
  if (!demands(e, 'band')) return true;
  const load = e.suggestedLoad ?? '';
  const onABar = demands(e, 'barbell') && prescribesAWeight(load);
  const onYourOwnBodyweight = /bodyweight/i.test(load) && !prescribesAWeight(load);
  return !(onABar || onYourOwnBodyweight);
});
check(
  `every "Band Resisted" record says what the band is added to (${bandResisted.length} records)`,
  bandResistedWrong.length === 0,
  sample(bandResistedWrong.map((e) => `${e.name} needs ${JSON.stringify(e.kit)} at "${e.suggestedLoad}"`))
);

const barbellFamily = bandResisted.filter((e) => demands(e, 'barbell'));
check(
  `and the barbell ones demand a barbell AND a band, in kilograms (${barbellFamily.length} records)`,
  barbellFamily.length >= 4 &&
    barbellFamily.every((e) => demands(e, 'band') && prescribesAWeight(e.suggestedLoad ?? '')),
  barbellFamily.map((e) => `${e.name} "${e.suggestedLoad}"`).join(' | ')
);

const sharedIds = bandResisted.filter((e) => banded.some((b) => b.id === e.id));
check(
  'no id is shared across the two families',
  sharedIds.length === 0,
  sharedIds.map((e) => `${e.id} is in both`).join(', ') +
    ' — one id means one set of logged weights, and these are not the same movement'
);
const idOwners = new Map();
for (const e of [...banded, ...bandResisted]) {
  idOwners.set(e.id, [...(idOwners.get(e.id) ?? []), e.name]);
}
check(
  'and no two band records of any kind claim one id',
  [...idOwners.values()].every((names) => names.length === 1),
  [...idOwners.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([id, names]) => `${id}: ${names.join(' + ')}`)
    .join(' | ')
);

/**
 * AND THE SPLIT IS NOT ONLY IN THE NAMES: the two families reach the screen
 * differently. This is what Archie actually hit - a 50-70 kg barbell squat
 * printing the word "Bodyweight" where its weight box belongs, because the load
 * sentence contained the word band.
 */
const shapeOf = (e) => setInputShapeFor({ ...e, movementPattern: e.movementPattern });
const barResistedNoBox = barbellFamily.filter((e) => {
  const shape = shapeOf(e);
  return !shape.weight || !shape.weightRequired;
});
check(
  'a band resisted barbell lift asks for the weight on the bar',
  barResistedNoBox.length === 0,
  sample(barResistedNoBox.map((e) => `${e.name} -> ${JSON.stringify(shapeOf(e))}`))
);
const bandedWithBox = banded.filter((e) => shapeOf(e).weight);
check(
  'and a banded drill asks for no weight at all',
  bandedWithBox.length === 0,
  sample(bandedWithBox.map((e) => `${e.name} -> ${JSON.stringify(shapeOf(e))}`))
);

/**
 * THE SWAP SHEET NO LONGER CALLS A LOADED BAR A BAND. Measured before the fix:
 * somebody doing Bodyweight Squats was offered a Band Resisted Back Squat, at
 * 50-70 kg, under the line "Same movement, resistance band instead."
 */
const candidateOf = (e) => ({
  name: e.name,
  equipmentRequired: e.equipmentRequired,
  movementPattern: Array.isArray(e.movementPattern) ? e.movementPattern[0] : e.movementPattern,
  primaryMuscle: e.primaryMuscle,
});
const miscalledBand = [];
for (const source of LIBRARY_EXERCISES) {
  for (const candidate of barbellFamily) {
    if (!isEquipmentVariant(candidateOf(source), candidateOf(candidate))) continue;
    const line = swapReasonFor('equipment', kitOf(candidate.name, candidate.equipmentRequired), null);
    if (/band/i.test(line)) miscalledBand.push(`${source.name} -> ${candidate.name}: "${line}"`);
  }
}
check(
  'no alternative offers a band resisted barbell lift as a band exercise',
  miscalledBand.length === 0,
  sample(miscalledBand)
);
check(
  'because the swap sheet reads those three unnamed bars as barbells',
  ['Band Resisted Back Squats', 'Band Resisted Front Squats', 'Band Resisted Deadlifts'].every(
    (n) => kitOf(n, 'fullgym') === 'barbell'
  ),
  ['Band Resisted Back Squats', 'Band Resisted Front Squats', 'Band Resisted Deadlifts']
    .map((n) => `${n} -> ${kitOf(n, 'fullgym')}`)
    .join(' | ')
);
check(
  'while a genuinely banded movement is still read as a band exercise',
  ['Banded Good Mornings', 'Banded Face Pulls', 'Banded Pallof Press'].every(
    (n) => kitOf(n, 'fullgym') === 'resistance band'
  ),
  'narrowing the band rule must not take the band off the light-band drills'
);

/**
 * AND THE DIFFICULTY LADDER STOPS READING "band" AS "light". A band that ADDS
 * load cannot make a movement easier, and while it did, the band resisted broad
 * jump - Athlete work on Archie list - read as a level 1 beginner exercise.
 */
const patternOf = (e) => (Array.isArray(e.pattern) ? e.pattern[0] : e.pattern);
const ratedEasy = bandResisted.filter((e) => {
  const rung = levelOf(e.name, patternOf(e));
  return rung !== null && rung < 2;
});
check(
  'no band resisted movement reads as a level 1 beginner exercise',
  ratedEasy.length === 0,
  ratedEasy.map((e) => `${e.name} reads ${levelOf(e.name, patternOf(e))}, his list says ${e.level}`).join(' | ')
);
check(
  'and a band resisted jump is never read as easier than the same jump without the band',
  (levelOf('Band Resisted Broad Jumps', 'hinge') ?? 0) >= (levelOf('Broad Jumps', 'hinge') ?? 0),
  `band resisted ${levelOf('Band Resisted Broad Jumps', 'hinge')} vs plain ${levelOf('Broad Jumps', 'hinge')}`
);
check(
  'while light band work is still rated as the easy end it is',
  levelOf('Banded Good Mornings', 'hinge') === 1 && levelOf('Band Pull Aparts', 'pull') === 1,
  `good mornings ${levelOf('Banded Good Mornings', 'hinge')}, pull aparts ${levelOf('Band Pull Aparts', 'pull')}`
);

// The jump itself, which is the one record that changed sides.
const jump = LIBRARY_EXERCISES.find((e) => e.id === 'lib-hinge-banded-broad-jumps');
check(
  'the broad jump has moved to the band resisted family, keeping its id',
  jump?.name === 'Band Resisted Broad Jumps' && jump?.libraryName === 'Band Resisted Broad Jumps',
  `"${jump?.name}" under ${jump?.id}`
);
check(
  'and a jump logged under the old name still counts towards it',
  canonicalExerciseName('Banded Broad Jumps') === 'Band Resisted Broad Jumps',
  `charts as "${canonicalExerciseName('Banded Broad Jumps')}"`
);
check(
  'its cue says the band is added to your own bodyweight',
  /band/i.test(jump?.cue ?? '') && /(adds? resistance|against it)/i.test(jump?.cue ?? ''),
  jump?.cue
);

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n[3] The session closes on ten breaths, not three minutes');

const closers = [];
for (const level of EXPERIENCE_LEVELS) {
  for (const n of COUNTS) {
    for (const sessionType of STRENGTH_TYPES) {
      const s = generateLibrarySession({
        sessionType,
        equipment: ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
        readiness: readinessFor([], 'mild'),
        profile: profileFor(level),
        sessionTypeCount: n,
        strengthSessionCount: n,
        daysSinceLastSession: null,
      });
      closers.push(...s.exercises.filter((e) => e.category === 'cooldown'));
    }
    const c = generateLibraryConditioningSession({
      equipment: ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
      readiness: readinessFor([], 'mild'),
      profile: profileFor(level),
      sessionCount: n,
    });
    closers.push(...c.exercises.filter((e) => e.category === 'cooldown'));
  }
}

check(
  `sessions still close on a cool-down card (${closers.length} of them swept)`,
  closers.length > 100,
  'if this collapses the rest of this section is testing an empty set'
);
const stillInMinutes = closers.filter((c) => /min/i.test(c.reps ?? ''));
check(
  'no closing card is prescribed in minutes any more',
  stillInMinutes.length === 0,
  sample([...new Set(stillInMinutes.map((c) => `${c.name} "${c.reps}"`))])
);
const breathing = closers.filter((c) => c.name === 'Diaphragmatic Breathing');
check(
  'the breathing card asks for ten breaths, counted as reps',
  breathing.length > 0 &&
    breathing.every(
      (c) => /10 breaths/i.test(c.reps) && doseOfPrescription(c.reps) === 'reps' && targetCountForPrefill(c.reps) === '10'
    ),
  sample([...new Set(breathing.map((c) => `"${c.reps}" reads ${doseOfPrescription(c.reps)}`))])
);
check(
  'so the card counts breaths instead of running a clock',
  breathing.every((c) => holdClockFor(c.reps) === null && setInputShapeFor(c).count === 'reps'),
  sample([...new Set(breathing.map((c) => `"${c.reps}" -> ${JSON.stringify(setInputShapeFor(c))}`))])
);
check(
  'and there is still nothing to put on the bar',
  breathing.every((c) => setInputShapeFor(c).weight === false),
  'ten breaths is not a loaded set'
);

// ─── Result ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`content-corrections: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
}
console.log(`content-corrections: all ${total} checks passed\n`);
