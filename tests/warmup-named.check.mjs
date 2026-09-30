/**
 * Contract test: two minutes of cardio, then the drills Archie named.
 *
 * WHAT HE ASKED FOR, 29 SEPTEMBER 2026
 * ────────────────────────────────────
 *   "the warm up exercises should be a cardio option for 2 minutes (incline
 *    walk, assault bike etc.)"
 *   Full Body: Banded Face Pulls AND Hip Circles. Upper Body: Banded Face
 *   Pulls. Lower Body: Hip Circles.
 *   "These exercises should be the go to exercises but should still have swap
 *    options if the client wants to do a different exercise."
 *
 * And his answers to the four questions that raised:
 *   - the named drills LEAD and stage 7's family order stays underneath, to
 *     fill whatever else the session needs and to handle a sore area or missing
 *     kit. It is demoted, not deleted.
 *   - at home with no machine the opener is skipping or walking, and his own
 *     decision 7 keeps skipping away from beginners, so a beginner at home
 *     walks.
 *   - with no band, Banded Face Pulls falls back to Door Frame Rows.
 *   - the hip drill is plain Hip Circles and needs nothing, so everybody gets
 *     it whatever their kit.
 *
 * WHAT THIS FILE ASSERTS, AND WHY EACH ONE IS HERE
 * ───────────────────────────────────────────────
 * Every rule is asked of real generated sessions, across every session type,
 * kit, level, length, age and sore area, rather than of the tables the builder
 * reads. The two questions that cannot be asked that way - what the tiers do
 * when a pool is empty, and what a table full of typos would do - are asked of
 * the exported functions directly, which is the only way to reach them.
 *
 * THE COUNTERWEIGHTS ARE THE POINT. Half of these assertions exist to stop the
 * other half passing for the wrong reason: that skipping still opens somebody's
 * session, that a band day really does get the face pulls, that the drills
 * behind the swap button are not the same card again.
 *
 * Run:  npx tsx tests/warmup-named.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { EXPERIENCE_LEVELS } from '../lib/store.ts';
import {
  CONDITIONING_EXERCISES,
  LIBRARY_EXERCISES,
  WARMUP_CARDIO_EXERCISES,
  isCardioOpener,
} from '../lib/exercise-library.ts';
import { canPerformWith } from '../lib/kit.ts';
import { getStandalonePrehabWorkout } from '../lib/exercise-db.ts';
import { generateLibraryConditioningSession } from '../lib/library-conditioning.ts';
import { doseOfPrescription } from '../lib/set-logging.ts';
import { holdClockFor } from '../lib/hold-timer.ts';
import {
  CARDIO_OPENER_REPS,
  NAMED_WARMUP_DRILLS,
  generateLibrarySession,
  mobilityCountFor,
  slotPool,
  warmupCardioTiers,
  warmupFamilyOf,
} from '../lib/library-session.ts';

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

/** One key per movement, so two spellings of the same exercise are one thing. */
const key = (name) => String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const drillPool = getStandalonePrehabWorkout().filter((t) => t.category === 'prehab');
const recordById = new Map(
  [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES, ...WARMUP_CARDIO_EXERCISES, ...drillPool].map(
    (r) => [r.id, r]
  )
);
const namedIds = [...new Set(Object.values(NAMED_WARMUP_DRILLS).flat(2))];
const nameOfId = (id) => recordById.get(id)?.name ?? null;
const FACE_PULLS = 'Banded Face Pulls';
const DOOR_FRAME_ROWS = 'Door Frame Rows';
const HIP_CIRCLES = 'Hip Circles';
const WALK = 'Brisk Walk';
const SKIPPING = 'Skipping';

// ── [0] The tables name real records, and the right ones ─────────────────────
console.log('\n[0] What the tables say, before any session is built');
{
  const missing = namedIds.filter((id) => !recordById.get(id));
  check(
    `every id Archie's drill table names is a real record (${namedIds.length} ids)`,
    namedIds.length > 0 && missing.length === 0,
    `${missing.join(', ')} match nothing, so a row would quietly do nothing`
  );
  check(
    'and they are the three movements he named',
    [FACE_PULLS, DOOR_FRAME_ROWS, HIP_CIRCLES].every((name) =>
      namedIds.some((id) => nameOfId(id) === name)
    ),
    namedIds.map(nameOfId).join(', ')
  );
  check(
    `a full body day names two drills, an upper and a lower day one each`,
    NAMED_WARMUP_DRILLS.full_body.length === 2 &&
      NAMED_WARMUP_DRILLS.upper_body.length === 1 &&
      NAMED_WARMUP_DRILLS.lower_body.length === 1,
    Object.entries(NAMED_WARMUP_DRILLS)
      .map(([t, rows]) => `${t} ${rows.length}`)
      .join(', ')
  );
  const rowOf = (type, slot) => (NAMED_WARMUP_DRILLS[type][slot] ?? []).map(nameOfId).join(' then ');
  check(
    'the face pull row carries the no-band answer behind it, and the hip row needs none',
    rowOf('upper_body', 0) === `${FACE_PULLS} then ${DOOR_FRAME_ROWS}` &&
      rowOf('lower_body', 0) === HIP_CIRCLES,
    `upper: ${rowOf('upper_body', 0) || '(nothing)'}`
  );
  const hipCircles = drillPool.find((t) => t.name === HIP_CIRCLES);
  check(
    'Hip Circles is a Restore drill that needs nothing, so every kit answer reaches it',
    !!hipCircles && hipCircles.equipmentRequired === 'bodyweight',
    hipCircles ? hipCircles.equipmentRequired : 'no such drill in the pool'
  );
  check(
    'and its own record files it at the hip, which is what the family rule reads',
    !!hipCircles && warmupFamilyOf(hipCircles) === 'glute_hip',
    hipCircles ? warmupFamilyOf(hipCircles) : 'missing'
  );

  /**
   * WHAT COUNTS AS A CARDIO OPTION, ASKED BY NAME RATHER THAN BY MUSCLE.
   *
   * `isCardioOpener` reads the record's own muscles, which is the right rule
   * and is the code under test. So this asks the question the other way round:
   * these are the records Archie would point at, written out. If the two ever
   * disagree, one of them has changed and somebody has to look.
   */
  const shouldBeCardio = new Set([
    'Assault Bike',
    'Incline Treadmill Walk',
    'Rowing Machine',
    SKIPPING,
    WALK,
  ]);
  const everyRecord = [...CONDITIONING_EXERCISES, ...WARMUP_CARDIO_EXERCISES];
  const wrong = everyRecord.filter((e) => isCardioOpener(e) !== shouldBeCardio.has(e.name));
  check(
    `the cardio options are exactly the five a warm-up should offer (${everyRecord.filter(isCardioOpener).length})`,
    wrong.length === 0,
    wrong.map((e) => `${e.name} reads as ${isCardioOpener(e) ? 'cardio' : 'not cardio'}`).join(', ')
  );
  check(
    'so the crawls, the sled work and the loaded carry are not offered as one',
    ['Bear Crawl', 'Duck Walks', 'Sled Push and Pull', 'Sled Rows', 'Farmers Carry'].every(
      (name) => !everyRecord.some((e) => e.name === name && isCardioOpener(e))
    ),
    'a twenty metre crawl is not two minutes of cardio, and neither is a loaded walk'
  );
  check(
    `the walk is a record of its own and is NOT on Archie's nine (${WARMUP_CARDIO_EXERCISES.length})`,
    WARMUP_CARDIO_EXERCISES.length > 0 &&
      CONDITIONING_EXERCISES.length === 9 &&
      !CONDITIONING_EXERCISES.some((e) => e.name === WALK),
    'a two minute walk is a warm-up, not a finisher and not a conditioning block'
  );
  check(
    'and it needs nothing and carries no stress tag, so nothing can take it away',
    WARMUP_CARDIO_EXERCISES.every(
      (e) => e.kit.length === 0 && (e.stress ?? []).length === 0 && canPerformWith(e, [])
    ),
    'it is the floor under the warm-up: if it can be withheld, somebody gets no opener'
  );
}

// ── [1] The tiers, asked directly, including the tail no sweep can reach ─────
console.log('\n[1] What may open a session, in tiers, asked of the function itself');
{
  const byName = new Map(
    [...CONDITIONING_EXERCISES, ...WARMUP_CARDIO_EXERCISES].map((e) => [e.name, e])
  );
  const take = (...names) => names.map((n) => byName.get(n)).filter(Boolean);

  const gym = warmupCardioTiers(
    take('Assault Bike', 'Bear Crawl', SKIPPING, WALK, 'Sled Push and Pull')
  );
  check(
    'a machine leads, then the cardio that needs nothing, then everything else',
    gym.map((tier) => tier.map((e) => e.name).join('+')).join(' > ') ===
      `Assault Bike > ${SKIPPING}+${WALK} > Bear Crawl+Sled Push and Pull`,
    gym.map((tier) => tier.map((e) => e.name).join('+')).join(' > ')
  );
  const home = warmupCardioTiers(take('Bear Crawl', 'Duck Walks', SKIPPING, WALK));
  check(
    'with no machine the cardio still leads and the crawls fall in behind it',
    home.length === 2 &&
      home[0].every(isCardioOpener) &&
      home[1].every((e) => !isCardioOpener(e)),
    home.map((tier) => tier.map((e) => e.name).join('+')).join(' > ')
  );
  /**
   * THE TAIL, WHICH IS STAGE 7'S RULE KEPT UNDERNEATH RATHER THAN DELETED.
   *
   * No session the sweep below can build reaches it, because the walk needs
   * nothing and carries no stress tag, so there is always cardio to give. It
   * has to be there all the same: retire the walk and the last tier is what
   * stops somebody's session opening on nothing. A generated session cannot
   * show that, and this can.
   */
  const nothingButCrawls = warmupCardioTiers(take('Bear Crawl', 'Duck Walks'));
  check(
    'and with no cardio at all there is still a tier, so nobody is left without an opener',
    nothingButCrawls.length === 1 && nothingButCrawls[0].length === 2,
    JSON.stringify(nothingButCrawls.map((t) => t.map((e) => e.name)))
  );
  check(
    'an empty list gives no tiers at all rather than a row of empty ones',
    warmupCardioTiers([]).length === 0,
    `${warmupCardioTiers([]).length} tiers`
  );
}

// ── The sweep ────────────────────────────────────────────────────────────────
const SESSION_TYPES = ['lower_body', 'upper_body', 'full_body'];
const KITS = [
  [],
  ['bodyweight'],
  ['bodyweight', 'bench'],
  ['bodyweight', 'dumbbells'],
  ['bodyweight', 'bands', 'dumbbells'],
  ['bodyweight', 'kettlebells'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
  ['fullgym', 'bench'],
];
const DURATIONS = ['30', '45', '60'];
/** Two ages, because past fifty the 45 minute session keeps a third drill. */
const AGES = [34, 55];
const SITUATIONS = [
  { label: 'nothing sore', regions: [], severity: 'mild' },
  { label: 'knee today, moderate', regions: ['knee'], severity: 'moderate' },
  { label: 'rear shoulder today, severe', regions: ['rear_shoulder'], severity: 'severe' },
  { label: 'hip and groin today, moderate', regions: ['hip_groin'], severity: 'moderate' },
  { label: 'ankle today, moderate', regions: ['ankle_achilles'], severity: 'moderate' },
  { label: 'ankle and wrist today, moderate', regions: ['ankle_achilles', 'wrist'], severity: 'moderate' },
];
/** Rotation positions three apart, which walks the whole of the longest pool. */
const SEEDS = [0, 3, 6, 9, 12, 15, 18];

const rows = [];
for (const equipment of KITS) {
  for (const level of EXPERIENCE_LEVELS) {
    for (const duration of DURATIONS) {
      for (const age of AGES) {
        for (const situation of SITUATIONS) {
          for (const seed of SEEDS) {
            for (const sessionType of SESSION_TYPES) {
              const session = generateLibrarySession({
                sessionType,
                equipment,
                readiness: {
                  hasAches: situation.regions.length > 0,
                  painRegion: situation.regions.length > 0 ? situation.regions : undefined,
                  painSeverity: situation.severity,
                  energy: 'normal',
                  timeAvailable: duration,
                },
                profile: {
                  name: 'Sweep',
                  sex: 'female',
                  experienceLevel: level,
                  goals: ['muscle'],
                  bodyweightKg: 72,
                  ageYears: age,
                },
                sessionTypeCount: seed,
                strengthSessionCount: seed,
                daysSinceLastSession: null,
              });
              const prep = session.exercises.filter((e) => e.category === 'prep');
              rows.push({
                sessionType,
                equipment,
                kit: equipment.join('+') || 'nothing',
                level,
                duration,
                age,
                situation,
                seed,
                where: `${sessionType} / ${equipment.join('+') || 'nothing'} / ${level} / ${duration} / ${age} / ${situation.label} / ${seed}`,
                exercises: session.exercises,
                gaps: session.gaps,
                prep,
                opener: prep[0],
                drills: prep.slice(1),
              });
            }
          }
        }
      }
    }
  }
}
const hasBand = (r) => r.equipment.includes('bands') || r.equipment.includes('fullgym');
const named = (r) => r.drills.map((e) => e.name);

// ── [2] Two minutes of cardio, at every kit level ────────────────────────────
console.log(`\n[2] Every session opens on two minutes of cardio (${rows.length} sessions)`);
{
  const cardioNames = new Set(
    [...CONDITIONING_EXERCISES, ...WARMUP_CARDIO_EXERCISES]
      .filter(isCardioOpener)
      .map((e) => key(e.name))
  );
  const notCardio = rows.filter((r) => !r.opener || !cardioNames.has(key(r.opener.name)));
  check(
    'every one of them opens on a cardio option',
    notCardio.length === 0,
    notCardio
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.opener && r.opener.name}`)
      .join(' | ')
  );
  /**
   * TWO MINUTES READ OFF THE CARD THE WAY THE SCREEN READS IT.
   *
   * Not `reps === CARDIO_OPENER_REPS`, which is the constant checking itself:
   * change the constant to three minutes and an assertion written that way
   * moves with it and stays green. The card is asked for its length in seconds
   * through the same parser the session screen's countdown uses, so the number
   * Archie asked for is the thing being held.
   */
  const wrongLength = rows.filter((r) => {
    const clock = holdClockFor(r.opener.reps);
    return !clock || clock.seconds !== 120 || clock.runs !== 1 || r.opener.sets !== 1;
  });
  check(
    'and asks for one go of two minutes, whatever the record itself is written at',
    wrongLength.length === 0,
    wrongLength
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.opener.name} ${r.opener.sets}x${r.opener.reps}`)
      .join(' | ')
  );
  const notEasy = rows.filter((r) => !/easy/i.test(r.opener.suggestedLoad ?? ''));
  check(
    'at an easy pace, because it is a warm-up and not the work',
    notEasy.length === 0,
    notEasy.slice(0, 3).map((r) => `${r.where}: ${r.opener.suggestedLoad}`).join(' | ')
  );
  /**
   * AND THE CARD GETS A CLOCK RATHER THAN A REP COUNTER.
   *
   * Two minutes is only two minutes if the screen reads it that way. The rower
   * is written at five hundred metres and the treadmill at five minutes, so the
   * opener writes over both, and this asks the same question the session screen
   * asks of the same sentence.
   */
  const clock = holdClockFor(CARDIO_OPENER_REPS);
  check(
    `and what the opener is written at is a two minute countdown ("${CARDIO_OPENER_REPS}")`,
    doseOfPrescription(CARDIO_OPENER_REPS) === 'time' && clock && clock.seconds === 120,
    `${doseOfPrescription(CARDIO_OPENER_REPS)}, ${clock ? `${clock.seconds}s` : 'no clock'}`
  );
  /** Per kit, so a hole in one corner cannot hide in an average. */
  for (const equipment of KITS) {
    const kit = equipment.join('+') || 'nothing';
    const rs = rows.filter((r) => r.kit === kit);
    const ok = rs.filter((r) => cardioNames.has(key(r.opener.name))).length;
    check(
      `  ...with ${kit} (${ok}/${rs.length})`,
      rs.length > 0 && ok === rs.length,
      rs
        .filter((r) => !cardioNames.has(key(r.opener.name)))
        .slice(0, 2)
        .map((r) => `${r.where}: ${r.opener.name}`)
        .join(' | ')
    );
  }
  console.log('      what opens a session, by kit:');
  for (const equipment of KITS) {
    const kit = equipment.join('+') || 'nothing';
    const counts = new Map();
    for (const r of rows.filter((x) => x.kit === kit)) {
      counts.set(r.opener.name, (counts.get(r.opener.name) ?? 0) + 1);
    }
    console.log(
      `        ${kit}: ${[...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([n, c]) => `${n} ${c}`)
        .join(', ')}`
    );
  }
}

// ── [3] A beginner at home is never given skipping ───────────────────────────
console.log('\n[3] Decision 7 is not overruled by any of this');
{
  const atHome = rows.filter((r) => !r.equipment.includes('fullgym'));
  const beginnersAtHome = atHome.filter((r) => r.level === 'beginner');
  check(
    `the sweep really contains beginners training at home (${beginnersAtHome.length})`,
    beginnersAtHome.length > 0,
    'without these the rule below is proved by nobody being there'
  );
  const skippingCard = (r) => r.prep.some((e) => key(e.name) === key(SKIPPING));
  const skippingBehindTheButton = (r) =>
    r.prep.some(
      (e) => key(e.swapName) === key(SKIPPING) || key(e.swap2Name) === key(SKIPPING)
    );
  const given = beginnersAtHome.filter((r) => skippingCard(r) || skippingBehindTheButton(r));
  check(
    'and not one of them is given skipping, on a card or behind a swap button',
    given.length === 0,
    given.slice(0, 3).map((r) => r.where).join(' | ')
  );
  const walkOpeners = beginnersAtHome.filter((r) => key(r.opener.name) === key(WALK));
  check(
    `they open on the walk instead, every time (${walkOpeners.length} of ${beginnersAtHome.length})`,
    walkOpeners.length === beginnersAtHome.length,
    beginnersAtHome
      .filter((r) => key(r.opener.name) !== key(WALK))
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.opener.name}`)
      .join(' | ')
  );
  /** The counterweight: skipping has not simply left the app. */
  const others = rows.filter(
    (r) => r.level !== 'beginner' && r.prep.some((e) => key(e.name) === key(SKIPPING))
  );
  check(
    `and everybody else at home still gets it (${others.length} sessions)`,
    others.length > 0,
    'the rule above must not be passing because skipping left the warm-up'
  );
}

// ── [4] The drills he named lead their own day ───────────────────────────────
console.log('\n[4] The named drills lead, wherever kit and injury allow');
{
  const lower = rows.filter((r) => r.sessionType === 'lower_body');
  const upperAndFull = rows.filter((r) => r.sessionType !== 'lower_body');
  const noHip = lower.filter((r) => key(r.drills[0]?.name) !== key(HIP_CIRCLES));
  check(
    `a lower body day opens its drills on Hip Circles, at every kit and level (${lower.length})`,
    noHip.length === 0,
    noHip.slice(0, 3).map((r) => `${r.where}: ${named(r).join(' > ')}`).join(' | ')
  );
  const full = rows.filter((r) => r.sessionType === 'full_body');
  const fullNoHip = full.filter((r) => !named(r).some((n) => key(n) === key(HIP_CIRCLES)));
  check(
    `and a full body day contains it too, wherever it stands (${full.length})`,
    fullNoHip.length === 0,
    fullNoHip.slice(0, 3).map((r) => `${r.where}: ${named(r).join(' > ')}`).join(' | ')
  );
  const withBand = upperAndFull.filter(hasBand);
  const missingFacePulls = withBand.filter(
    (r) => !named(r).some((n) => key(n) === key(FACE_PULLS))
  );
  check(
    `an upper or full body day with a band leads on Banded Face Pulls (${withBand.length})`,
    withBand.length > 0 && missingFacePulls.length === 0,
    missingFacePulls.slice(0, 3).map((r) => `${r.where}: ${named(r).join(' > ')}`).join(' | ')
  );
  const upperWithBand = withBand.filter((r) => r.sessionType === 'upper_body');
  const notFirst = upperWithBand.filter((r) => key(r.drills[0]?.name) !== key(FACE_PULLS));
  check(
    `and on an upper body day it is the first drill (${upperWithBand.length})`,
    notFirst.length === 0,
    notFirst.slice(0, 3).map((r) => `${r.where}: ${named(r).join(' > ')}`).join(' | ')
  );
  /**
   * AND NOT ON A DAY HE DID NOT NAME IT FOR.
   *
   * A lower body warm-up leading on a shoulder drill is the fault stage 7
   * existed to fix, and a named drill that leaked onto the wrong day would put
   * it straight back.
   */
  const facePullsOnALegDay = lower.filter((r) =>
    named(r).some((n) => key(n) === key(FACE_PULLS))
  );
  check(
    'a leg day is never given the face pulls',
    facePullsOnALegDay.length === 0,
    facePullsOnALegDay.slice(0, 3).map((r) => `${r.where}: ${named(r).join(' > ')}`).join(' | ')
  );
}

// ── [5] The family rule underneath fills what he did not name ────────────────
console.log('\n[5] The family order is demoted, not deleted');
{
  const expected = (r) =>
    Math.max(mobilityCountFor(r.duration, r.age), NAMED_WARMUP_DRILLS[r.sessionType].length);
  const short = rows.filter((r) => r.drills.length !== expected(r));
  check(
    'every session gets the drills its length and its day ask for, and no fewer',
    short.length === 0,
    short
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.drills.length} of ${expected(r)}`)
      .join(' | ')
  );
  /**
   * THE GAP HIS ANSWER CANNOT FILL, FILLED BY THE RULE UNDERNEATH.
   *
   * No band means no face pulls, and the no-band answer he gave - Door Frame
   * Rows - is refused wherever it is the session's only pull (see [7]). So on
   * those days the second named slot has nothing in it, and the family order
   * has to put something there rather than the warm-up coming up a card short.
   */
  const noBandFull = rows.filter((r) => r.sessionType === 'full_body' && !hasBand(r));
  const filled = noBandFull.filter(
    (r) => r.drills.length === expected(r) && !named(r).some((n) => key(n) === key(FACE_PULLS))
  );
  check(
    `a full body day with no band still gets two drills, the second from the family order (${filled.length} of ${noBandFull.length})`,
    noBandFull.length > 0 && filled.length === noBandFull.length,
    noBandFull
      .filter((r) => r.drills.length !== expected(r))
      .slice(0, 3)
      .map((r) => `${r.where}: ${named(r).join(' > ')}`)
      .join(' | ')
  );
  const upperNoBand = rows.filter((r) => r.sessionType === 'upper_body' && !hasBand(r));
  const upperLeads = upperNoBand.filter((r) => {
    const record = drillPool.find((t) => key(t.name) === key(r.drills[0]?.name));
    return record && warmupFamilyOf(record) === 'upper';
  });
  check(
    `and an upper body day with no band still leads on shoulder and upper back work (${upperLeads.length} of ${upperNoBand.length})`,
    upperNoBand.length > 0 && upperLeads.length === upperNoBand.length,
    upperNoBand
      .filter((r) => !upperLeads.includes(r))
      .slice(0, 3)
      .map((r) => `${r.where}: ${named(r).join(' > ')}`)
      .join(' | ')
  );
  console.log('      every warm-up the sweep can build, by day:');
  for (const sessionType of SESSION_TYPES) {
    const shapes = new Map();
    for (const r of rows.filter((x) => x.sessionType === sessionType)) {
      const shape = named(r).join(' > ') || '(none)';
      shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
    }
    console.log(`        ${sessionType}`);
    for (const [shape, n] of [...shapes].sort((a, b) => b[1] - a[1])) {
      console.log(`          ${shape}: ${n}`);
    }
  }
}

// ── [6] The swap button, which he asked for by name ──────────────────────────
console.log('\n[6] Every warm-up card has somewhere else to go');
{
  const naked = rows.flatMap((r) =>
    r.prep.filter((e) => !e.swapName).map((e) => `${r.where}: ${e.name}`)
  );
  const cards = rows.reduce((n, r) => n + r.prep.length, 0);
  check(
    `not one warm-up card in the sweep has an empty button (${cards} cards)`,
    naked.length === 0,
    naked.slice(0, 5).join(' | ')
  );
  const sameAgain = rows.flatMap((r) =>
    r.prep
      .filter((e) => key(e.swapName) === key(e.name) || key(e.swap2Name) === key(e.name))
      .map((e) => `${r.where}: ${e.name} -> ${e.swapName} / ${e.swap2Name}`)
  );
  check(
    'and none of them offers the card that is already on the screen',
    sameAgain.length === 0,
    sameAgain.slice(0, 3).join(' | ')
  );
  const alreadyInTheSession = rows.flatMap((r) => {
    const inSession = new Set(r.exercises.map((e) => key(e.name)));
    return r.prep
      .filter(
        (e) =>
          (e.swapName && inSession.has(key(e.swapName))) ||
          (e.swap2Name && inSession.has(key(e.swap2Name)))
      )
      .map((e) => `${r.where}: ${e.name} -> ${e.swapName} / ${e.swap2Name}`);
  });
  check(
    'nor anything the session already contains, which would log two cards on one id',
    alreadyInTheSession.length === 0,
    alreadyInTheSession.slice(0, 3).join(' | ')
  );
  /**
   * THE CARDIO CARD LEADS WITH CARDIO, which is the same rule as the drill
   * button one line down: what is behind the button is the rest of the pool,
   * in the order the slot itself was filled from.
   */
  const cardioNames = new Set(
    [...CONDITIONING_EXERCISES, ...WARMUP_CARDIO_EXERCISES]
      .filter(isCardioOpener)
      .map((e) => key(e.name))
  );
  const withSpareCardio = rows.filter((r) => {
    // Asked where nothing is sore, so the only thing that can withhold a cardio
    // option is the beginner rule, which is spelled out below. With an area
    // flagged the screen is doing the deciding and "another one was free" would
    // be this file guessing at the answer rather than asking it.
    if (r.situation.regions.length > 0) return false;
    const inSession = new Set(r.exercises.map((e) => key(e.name)));
    return [...cardioNames].some((k) => {
      if (inSession.has(k)) return false;
      const record = [...CONDITIONING_EXERCISES, ...WARMUP_CARDIO_EXERCISES].find(
        (e) => key(e.name) === k
      );
      return (
        canPerformWith(record, r.equipment.length > 0 ? r.equipment : ['bodyweight']) &&
        !(r.level === 'beginner' && (record.stress ?? []).includes('high_impact'))
      );
    });
  });
  const ledElsewhere = withSpareCardio.filter((r) => !cardioNames.has(key(r.opener.swapName)));
  check(
    `where another cardio option is free, the opener offers it first (${withSpareCardio.length} sessions)`,
    withSpareCardio.length > 0 && ledElsewhere.length === 0,
    ledElsewhere
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.opener.name} -> ${r.opener.swapName}`)
      .join(' | ')
  );
  /** And the drill button reaches the rest of the pool rather than one card. */
  const behindTheDrills = new Set(
    rows.flatMap((r) => r.drills.flatMap((e) => [e.swapName, e.swap2Name])).filter(Boolean)
  );
  check(
    `the drill button reaches ${behindTheDrills.size} different drills across the sweep`,
    behindTheDrills.size >= 6,
    [...behindTheDrills].join(', ')
  );
}

// ── [7] The warm-up never takes the work's last exercise ─────────────────────
console.log('\n[7] A named drill is never taken out of the session that needs it');
{
  /**
   * THE FAULT THIS CAUGHT, WHICH WAS REAL AND WAS SHIPPING IN A FIRST DRAFT.
   *
   * Door Frame Rows is the no-band answer Archie gave, and it is also the only
   * pulling exercise in the library that needs no equipment. With the guard
   * asked at the person's own ceiling instead of at level 1, an Athlete with
   * dumbbells had it taken into the warm-up and came back with an Upper Body
   * session containing no pulling at all.
   */
  /**
   * ASKED OF THE DRILLS ARCHIE NAMED, which are the ones this rule is about.
   *
   * A Restore drill that shares a name with a library record - the Glute Bridge
   * is both a warm-up drill and a beginner's hinge - has been in warm-ups since
   * stage 7 and is a separate question from this one.
   */
  const namedKeys = new Set(namedIds.map((id) => key(nameOfId(id))));
  const strippedItsOwnWork = rows.filter((r) => {
    const drillPatterns = r.drills
      .filter((e) => namedKeys.has(key(e.name)))
      .map((e) => LIBRARY_EXERCISES.find((x) => key(x.name) === key(e.name)))
      .filter(Boolean)
      .map((x) => x.pattern);
    return drillPatterns.some((p) => r.gaps.some((g) => g.pattern === p));
  });
  check(
    'no session loses a movement it asked for because the warm-up took the last one',
    strippedItsOwnWork.length === 0,
    strippedItsOwnWork
      .slice(0, 3)
      .map((r) => `${r.where}: warmed up on ${named(r).join(' > ')}, gaps ${r.gaps.map((g) => g.pattern).join(', ')}`)
      .join(' | ')
  );
  const upperNoPull = rows.filter(
    (r) =>
      r.sessionType === 'upper_body' &&
      !r.exercises.some(
        (e) =>
          e.category !== 'prep' &&
          LIBRARY_EXERCISES.find((x) => key(x.name) === key(e.name))?.pattern === 'pull'
      ) &&
      !r.gaps.some((g) => g.pattern === 'pull')
  );
  check(
    'and every upper body session still pulls, or says plainly why it cannot',
    upperNoPull.length === 0,
    upperNoPull.slice(0, 3).map((r) => r.where).join(' | ')
  );
  /**
   * WHERE THE NO-BAND ANSWER ACTUALLY LANDS TODAY, printed rather than
   * asserted, because it is a fact about the library rather than about the
   * rule. Archie asked for Door Frame Rows when there is no band; at every kit
   * answer that has no band it is also the only pull the person owns, so the
   * work keeps it and the warm-up uses the family order. The row stays in the
   * table because the moment the library gains a second no-kit pull - which
   * Archie is writing - his answer starts being given.
   */
  const withDoorFrame = rows.filter((r) => named(r).some((n) => key(n) === key(DOOR_FRAME_ROWS)));
  console.log(
    `      Door Frame Rows opens the drills on ${withDoorFrame.length} of ${rows.length} sessions today`
  );
  const noBandPull = KITS.filter(
    (equipment) => !equipment.includes('bands') && !equipment.includes('fullgym')
  ).map((equipment) => ({
    kit: equipment.join('+') || 'nothing',
    pulls: slotPool('pull', 1, equipment).map((e) => e.name),
  }));
  for (const { kit, pulls } of noBandPull) {
    console.log(`        ${kit}: level 1 pulls = ${pulls.join(', ') || 'none'}`);
  }
  check(
    'and the reason is the library, not the rule: every band-free kit has exactly one pull',
    noBandPull.every((p) => p.pulls.length === 1 && p.pulls[0] === DOOR_FRAME_ROWS),
    noBandPull.map((p) => `${p.kit}: ${p.pulls.join(', ')}`).join(' | ')
  );
}

// ── [8] The Conditioning session opens the same way ──────────────────────────
console.log('\n[8] A Conditioning session warms up on cardio too');
{
  /**
   * WHY THIS SECTION IS SHORTER THAN THE REST.
   *
   * Archie said a cardio option opens every session, and a Conditioning session
   * is one. What changed there is the ORDER: its opener is drawn from the same
   * tiers, so the bike leads and the crawls fall in behind, and a cardio opener
   * is written at two minutes like every other.
   *
   * WHAT DELIBERATELY DID NOT CHANGE is whether that session has an opener at
   * all. It only spends one of the nine on a warm-up when the list can spare
   * one, because a home beginner has two exercises and spending one would leave
   * a single block of work - so at home it can still open on a mobility drill
   * and say so. The Brisk Walk would close that, at no cost to the blocks, and
   * that is a question for Archie rather than a side effect of this change.
   */
  const condRows = [];
  for (const equipment of KITS) {
    for (const level of EXPERIENCE_LEVELS) {
      for (const duration of DURATIONS) {
        for (const situation of SITUATIONS) {
          for (const seed of SEEDS) {
            const session = generateLibraryConditioningSession({
              equipment,
              readiness: {
                hasAches: situation.regions.length > 0,
                painRegion: situation.regions.length > 0 ? situation.regions : undefined,
                painSeverity: situation.severity,
                energy: 'normal',
                timeAvailable: duration,
              },
              profile: {
                name: 'Sweep',
                sex: 'male',
                experienceLevel: level,
                goals: ['fitness'],
                bodyweightKg: 80,
              },
              sessionCount: seed,
            });
            if (session.exercises.length === 0) continue;
            const opener = session.exercises.find((e) => e.category === 'prep');
            if (!opener) continue;
            condRows.push({
              where: `${equipment.join('+') || 'nothing'} / ${level} / ${duration} / ${situation.label} / ${seed}`,
              equipment,
              level,
              situation,
              opener,
            });
          }
        }
      }
    }
  }
  const nineByName = new Map(CONDITIONING_EXERCISES.map((e) => [key(e.name), e]));
  check(
    `the conditioning sweep built real sessions with a warm-up (${condRows.length})`,
    condRows.length > 0,
    'nothing was generated, so nothing below is being tested'
  );
  const fromTheNine = condRows.filter((r) => nineByName.has(key(r.opener.name)));
  const notTwoMinutes = fromTheNine.filter(
    (r) =>
      isCardioOpener(nineByName.get(key(r.opener.name))) &&
      (holdClockFor(r.opener.reps)?.seconds !== 120 || r.opener.sets !== 1)
  );
  check(
    `a cardio opener there is two minutes as well (${fromTheNine.length} openers off the list)`,
    fromTheNine.length > 0 && notTwoMinutes.length === 0,
    notTwoMinutes
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.opener.name} ${r.opener.sets}x${r.opener.reps}`)
      .join(' | ')
  );
  /**
   * AND THE ORDER: where this person owns a cardio option, that is what opens
   * the session. Asked where nothing is sore, so the only thing that can
   * withhold one is the beginner rule, which is spelled into the pool below.
   */
  const ownsCardio = (r) =>
    CONDITIONING_EXERCISES.filter(isCardioOpener).some(
      (e) =>
        canPerformWith(e, r.equipment.length > 0 ? r.equipment : ['bodyweight']) &&
        !(r.level === 'beginner' && (e.stress ?? []).includes('high_impact'))
    );
  const couldHaveCardio = fromTheNine.filter(
    (r) => r.situation.regions.length === 0 && ownsCardio(r)
  );
  const openedOnSomethingElse = couldHaveCardio.filter(
    (r) => !isCardioOpener(nineByName.get(key(r.opener.name)))
  );
  check(
    `and where they own a cardio option it is the one that opens (${couldHaveCardio.length} sessions)`,
    couldHaveCardio.length > 0 && openedOnSomethingElse.length === 0,
    openedOnSomethingElse
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.opener.name}`)
      .join(' | ')
  );
}

console.log(
  `\nwarmup-named: ${failed === 0 ? `all ${passed} checks passed` : `${failed}/${passed + failed} check(s) FAILED`}`
);
process.exitCode = failed === 0 ? 0 : 1;
