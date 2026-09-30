/**
 * Contract test: what opens a session, and who the warm-up is FOR.
 *
 * TWO RULES, BOTH ARCHIE'S, GIVEN ON 25 SEPTEMBER 2026 AFTER TESTING ON EXPO
 * ─────────────────────────────────────────────────────────────────────────
 *   "Sled push and pull is a conditioning exercise not a warm up exercise."
 *   "During lower body sessions glute exercises should be a priority in the
 *    warm up instead of Deadbug or other core exercises."
 *
 * WHAT HE WAS LOOKING AT, MEASURED OVER THE SESSIONS THIS FILE SWEEPS
 * ───────────────────────────────────────────────────────────────────
 * 39,312 strength sessions and 6,552 conditioning ones, generated twice: once
 * at 9121f24 and once here.
 *                                                      before    after
 *   full-gym sessions opening on a sled                  47.8%     0.0%
 *   conditioning sessions opening on a sled              11.1%     0.0%
 *   cells where lower, upper and full share a warm-up   100.0%     0.0%
 *   lower body warm-ups leading on glute or hip work     28.9%   100.0%
 *   lower body warm-ups containing core work             41.0%     0.0%
 *   leg-day warm-up cards whose swap button offers       86.7%     0.0%
 *     core work first
 *
 * The second rule turned out to sit on top of a bigger fault, which is why it
 * is not a reordering. A lower body day and an upper body day were getting the
 * IDENTICAL warm-up, in every one of the 13,104 combinations of kit, level,
 * length, age, sore area and rotation below, because nothing about the warm-up
 * knew which session it was standing in front of. Section [4] is that fault.
 *
 * HOW IT IS BUILT, AND WHY THAT MATTERS TO THIS FILE
 * ──────────────────────────────────────────────────
 * Not a list of drills per session type. Each drill is filed into one of four
 * families by the regions its own record says it targets, and each session type
 * has an ORDER over those families, one entry per warm-up slot. So a drill
 * written into Restore next year is placed by what it is written to do rather
 * than by somebody remembering to add it to a list, and section [1] proves that
 * by asking the classifier about records whose NAMES point the other way.
 *
 * Most of what follows reads a drill's family through that same classifier,
 * which is production code: a fault inside it would move the sessions and the
 * assertions together. So [5] and [6] each carry an assertion that reads the
 * drills' own targetRegions instead and never calls it, and one of those is
 * what caught the mutation that filed the Glute Bridge as core work.
 *
 * WHAT MUST NOT MOVE, WHICH IS WHY HALF THIS FILE IS COUNTERWEIGHTS
 * ────────────────────────────────────────────────────────────────
 * A preference order is a very easy way to quietly overrule a safety rule. The
 * injury screen withholds particular drills from particular sore areas and the
 * beginner rule keeps impact away from a beginner, and neither may be bent by
 * the fact that glute work now leads a lower body day. Section [7] proves both,
 * each with a counterweight showing the withheld drill is otherwise reachable,
 * so "it never appears" cannot pass by the drill having quietly disappeared.
 *
 * Nothing here greps the source. Every assertion runs the real generators over
 * real answers and reads what comes back.
 *
 * Run:  npx tsx tests/warmup-shape.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { EXPERIENCE_LEVELS } from '../lib/store.ts';
import {
  CONDITIONING_EXERCISES,
  LIBRARY_EXERCISES,
  WARMUP_CARDIO_EXERCISES,
  isPulseRaiser,
} from '../lib/exercise-library.ts';
import { canPerformWith } from '../lib/kit.ts';
import { getStandalonePrehabWorkout } from '../lib/exercise-db.ts';
import {
  restrictedTagsFor,
  restrictedTagsOn,
  restrictedTagsOnRecord,
} from '../lib/exercise-safety.ts';
import {
  NAMED_WARMUP_DRILLS,
  WARMUP_FAMILIES,
  WARMUP_ORDER,
  generateLibrarySession,
  mobilityCountFor,
  warmupFamilyOf,
  warmupFamilyOrder,
} from '../lib/library-session.ts';
import { generateLibraryConditioningSession } from '../lib/library-conditioning.ts';
import { generateWorkout } from '../lib/workout-engine.ts';

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
const key = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const nineByKey = new Map(CONDITIONING_EXERCISES.map((e) => [key(e.name), e]));
const drillPool = getStandalonePrehabWorkout().filter((t) => t.category === 'prehab');

/**
 * WHAT STAGE 8 ADDED TO THE TWO LISTS ABOVE, AND WHY THIS FILE HAS TO KNOW.
 *
 * Archie, 29 September 2026, named the drills that lead each day - Banded Face
 * Pulls, its no-band answer Door Frame Rows, and Hip Circles - and asked for
 * two minutes of cardio in front of them, which for somebody at home with no
 * machine is a walk.
 *
 * Two of the drills he named are records from his exercise library rather than
 * from Restore, and the walk is on neither the nine nor Restore. Read off the
 * real tables rather than spelled out here: every rule below is about what a
 * warm-up DOES, and a card it could not identify would silently stop being
 * judged. That is exactly what happened when this file was first run against
 * stage 8 - an upper body day led with Banded Face Pulls and the family rule in
 * section [5] saw no drill at all.
 */
const namedDrillRecords = [
  ...new Set(
    Object.values(NAMED_WARMUP_DRILLS)
      .flat(2)
      .map((id) => LIBRARY_EXERCISES.find((e) => e.id === id))
      .filter(Boolean)
  ),
];
const drillByKey = new Map(
  [...drillPool, ...namedDrillRecords].map((t) => [key(t.name), t])
);
/** What may open a session: the nine, plus the walk that is on none of the lists. */
const openerByKey = new Map([
  ...nineByKey,
  ...WARMUP_CARDIO_EXERCISES.map((e) => [key(e.name), e]),
]);

/**
 * SLED WORK, IDENTIFIED FROM THE RECORD'S OWN KIT LIST AND NOT FROM ITS NAME.
 *
 * Deliberately a different expression from the one `isPulseRaiser` uses, so
 * this file is asking a question rather than repeating an answer: here, "does
 * the sled appear anywhere in what this exercise needs". Section [0] shows the
 * two agree on the real records, and every behavioural sweep below uses this
 * one to decide whether a generated card is a sled.
 */
const needsSled = (record) => record.kit.some((requirement) => requirement.includes('sled'));
/** The same question asked of a card, which carries a name rather than a record. */
const cardNeedsSled = (name) => {
  const record = name && nineByKey.get(key(name));
  return !!record && needsSled(record);
};

/**
 * HIP WORK AND TRUNK WORK, ASKED OF THE RECORD AND NOT OF THE CLASSIFIER.
 *
 * Most of this file reads a drill's family through `warmupFamilyOf`, which is
 * the production classifier - so a fault INSIDE that function would move the
 * sessions and the assertions together and nothing would go red. These two ask
 * the record its own regions instead, and the assertions built on them in [5]
 * and [6] are the ones that would survive the classifier being rewritten.
 */
const HIP_REGIONS = ['glutes', 'hip_groin'];
const TRUNK_REGIONS = ['core_ribs', 'lower_back'];
const worksTheHip = (drill) => drill.targetRegions.some((r) => HIP_REGIONS.includes(r));
const trunkOnly = (drill) =>
  drill.targetRegions.some((r) => TRUNK_REGIONS.includes(r)) && !worksTheHip(drill);

// ── [0] The two lists a warm-up may draw on ──────────────────────────────────
console.log('\n[0] The lists, and that they are big enough for the rest to mean anything');
check(
  `the nine conditioning records are all there (${CONDITIONING_EXERCISES.length})`,
  CONDITIONING_EXERCISES.length === 9,
  `${CONDITIONING_EXERCISES.length} records`
);
{
  const refused = CONDITIONING_EXERCISES.filter((e) => !isPulseRaiser(e));
  const allowed = CONDITIONING_EXERCISES.filter((e) => isPulseRaiser(e));
  /**
   * TWO REASONS A WARM-UP REFUSES SOMETHING, AND THERE ARE ONLY TWO.
   *
   * Sled work, because Archie said so on 25 September 2026 ("Sled push and pull
   * is a conditioning exercise not a warm up exercise"). And, since 30 September
   * 2026, anything prescribed at a weight in kilograms: he added a Farmers Carry
   * to the conditioning list that day, and picking up twenty-five kilograms in
   * each hand is not two minutes of easy cardio either. Both are read off the
   * record - the kit for the first, the load line for the second - so a
   * conditioning record written next year is placed by what it says it asks for
   * rather than by somebody remembering to add it here.
   */
  const namesAWeight = (e) => /\d+(?:\.\d+)?\s*(?:kg|lbs?)\b/i.test(e.suggestedLoad ?? '');
  check(
    `every record the warm-up refuses is sled work or a loaded movement (${refused.length})`,
    refused.length > 0 && refused.every((e) => needsSled(e) || namesAWeight(e)),
    refused
      .filter((e) => !needsSled(e) && !namesAWeight(e))
      .map((e) => e.name)
      .join(', ')
  );
  check(
    `and nothing it allows is either (${allowed.length})`,
    allowed.length > 0 && !allowed.some((e) => needsSled(e) || namesAWeight(e)),
    allowed
      .filter((e) => needsSled(e) || namesAWeight(e))
      .map((e) => e.name)
      .join(', ')
  );
  check(
    'and both reasons are really in use, so neither half is decoration',
    refused.some(needsSled) && refused.some((e) => namesAWeight(e) && !needsSled(e)),
    refused.map((e) => `${e.name} (${e.suggestedLoad})`).join(', ')
  );
  check(
    'so the whole list is accounted for, with work left on both sides of the line',
    refused.length + allowed.length === CONDITIONING_EXERCISES.length &&
      allowed.length >= 3 &&
      refused.length >= 2,
    `${refused.length} refused, ${allowed.length} allowed`
  );
}
check(
  `Restore has drills for the warm-up to place (${drillPool.length})`,
  drillPool.length >= 10,
  `${drillPool.length} drills`
);

// ── [1] A drill is placed by its own tags, not by its name ───────────────────
console.log('\n[1] A drill is filed by what its record says it targets');
{
  const byFamily = new Map(WARMUP_FAMILIES.map((f) => [f, []]));
  for (const drill of drillPool) byFamily.get(warmupFamilyOf(drill)).push(drill.name);
  check(
    'every drill in the pool lands in exactly one of the four families',
    [...byFamily.values()].reduce((n, list) => n + list.length, 0) === drillPool.length,
    [...byFamily].map(([f, l]) => `${f} ${l.length}`).join(', ')
  );
  check(
    'and none of the four families is empty, so no session type has an empty first choice',
    WARMUP_FAMILIES.every((f) => byFamily.get(f).length > 0),
    [...byFamily].map(([f, l]) => `${f}: ${l.join(' / ') || 'EMPTY'}`).join(' | ')
  );
  for (const [family, names] of byFamily) {
    console.log(`      ${family}: ${names.join(', ')}`);
  }
  /**
   * THE PROOF THAT THE NAME IS NOT BEING READ.
   *
   * Two records that a name test would get backwards: one called a dead bug
   * that targets the glutes, and one called a glute bridge that targets the
   * ribs. A classifier reading the name files them the wrong way round. One
   * reading the record files them correctly, which is what makes "a drill added
   * later is placed by its own tags" a true sentence rather than a hope.
   */
  const asGlute = warmupFamilyOf({ name: 'Dead Bug', targetRegions: ['glutes'] });
  const asCore = warmupFamilyOf({ name: 'Glute Bridge', targetRegions: ['core_ribs'] });
  check(
    'a record named like core work but written at the glutes is filed as glute and hip work',
    asGlute === 'glute_hip',
    `filed as ${asGlute}`
  );
  check(
    'and one named like glute work but written at the ribs is filed as core',
    asCore === 'core',
    `filed as ${asCore}`
  );
  /**
   * AND WHAT A SLOT DOES WHEN ITS FIRST CHOICE HAS NOTHING LEFT.
   *
   * Asked of the order directly, because with today's thirteen drills the
   * fall-through never fires: every family still has something in it in all
   * 39,312 sessions below, so watching generated sessions cannot tell whether
   * the tail is there at all. It has to be there. A drill retired from Restore,
   * a kit answer that empties a family, or a sore area that withholds the last
   * of one, would otherwise leave a warm-up slot silently blank.
   */
  for (const sessionType of ['lower_body', 'upper_body', 'full_body']) {
    const order = WARMUP_ORDER[sessionType];
    let firstIsOwn = true;
    let reachesAll = true;
    let noRepeats = true;
    for (let slot = 0; slot < order.length + 2; slot++) {
      const tried = warmupFamilyOrder(sessionType, slot);
      if (tried[0] !== order[slot % order.length]) firstIsOwn = false;
      if (!WARMUP_FAMILIES.every((f) => tried.includes(f))) reachesAll = false;
      if (new Set(tried).size !== tried.length) noRepeats = false;
    }
    check(
      `a ${sessionType} slot tries its own family first (${warmupFamilyOrder(sessionType, 0).join(' > ')})`,
      firstIsOwn,
      order.join(' > ')
    );
    check(
      `  ...and can still reach every other family if it comes up empty`,
      reachesAll && noRepeats,
      `${warmupFamilyOrder(sessionType, 0).join(' > ')} against ${WARMUP_FAMILIES.join(', ')}`
    );
  }
}

// ── The sweep ────────────────────────────────────────────────────────────────
const SESSION_TYPES = ['lower_body', 'upper_body', 'full_body'];
const KITS = [
  [],
  ['bodyweight'],
  ['bodyweight', 'bench'],
  ['bodyweight', 'bands', 'dumbbells'],
  ['bodyweight', 'bands', 'dumbbells', 'bench'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
  ['fullgym', 'bench'],
];
const DURATIONS = ['30', '45', '60'];
/** Two ages, because past fifty the 45 minute session keeps a third drill. */
const AGES = [34, 55];
const SITUATIONS = [
  { label: 'nothing sore', regions: [], severity: 'mild' },
  { label: 'knee today, mild', regions: ['knee'], severity: 'mild' },
  { label: 'glutes today, moderate', regions: ['glutes'], severity: 'moderate' },
  { label: 'front shoulder today, moderate', regions: ['front_shoulder'], severity: 'moderate' },
  { label: 'lower back today, severe', regions: ['lower_back'], severity: 'severe' },
  { label: 'hip and groin today, moderate', regions: ['hip_groin'], severity: 'moderate' },
];
/**
 * Thirteen rotation positions, which is every one there is.
 *
 * The pick rotates on the session count divided by three, so a sweep of 0 to 3
 * only ever sees the first four records in a pool and would have declared the
 * treadmill and the rower unreachable. Thirteen positions three apart walk the
 * whole of the longest pool.
 */
const SEEDS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];

function profileFor(level, age) {
  return {
    name: 'Sweep',
    sex: 'female',
    experienceLevel: level,
    goals: ['muscle'],
    bodyweightKg: 72,
    ageYears: age,
    standingSoreRegions: [],
    clinicalAvoid: [],
  };
}
function readinessFor(situation, duration) {
  return {
    hasAches: situation.regions.length > 0,
    painRegion: situation.regions.length > 0 ? situation.regions : undefined,
    painSeverity: situation.severity,
    acute: situation.regions.length > 0,
    energy: 'normal',
    timeAvailable: duration,
  };
}

/** One row per generated session, keeping only what this file asks about. */
const rows = [];
/** The same rows again, indexed by everything EXCEPT the session type. */
const cells = new Map();
for (const equipment of KITS) {
  for (const level of EXPERIENCE_LEVELS) {
    for (const duration of DURATIONS) {
      for (const age of AGES) {
        for (const situation of SITUATIONS) {
          for (const seed of SEEDS) {
            const profile = profileFor(level, age);
            const readiness = readinessFor(situation, duration);
            const banned = restrictedTagsFor(situation.regions, level, situation.severity);
            const cellKey = [
              equipment.join('+') || 'nothing',
              level,
              duration,
              age,
              situation.label,
              seed,
            ].join(' / ');
            for (const sessionType of SESSION_TYPES) {
              const session = generateLibrarySession({
                sessionType,
                equipment,
                readiness,
                profile,
                sessionTypeCount: seed,
                strengthSessionCount: seed,
                daysSinceLastSession: null,
              });
              const prep = session.exercises.filter((e) => e.category === 'prep');
              const row = {
                sessionType,
                equipment,
                kit: equipment.join('+') || 'nothing',
                level,
                duration,
                age,
                situation,
                banned,
                seed,
                where: `${sessionType} / ${cellKey}`,
                prep,
                opener: prep[0],
                drills: prep.filter((e) => drillByKey.has(key(e.name))),
                finisher: session.exercises.filter((e) => e.category === 'finisher'),
              };
              rows.push(row);
              if (!cells.has(cellKey)) cells.set(cellKey, {});
              cells.get(cellKey)[sessionType] = row;
            }
          }
        }
      }
    }
  }
}
const lower = rows.filter((r) => r.sessionType === 'lower_body');
const upper = rows.filter((r) => r.sessionType === 'upper_body');
const full = rows.filter((r) => r.sessionType === 'full_body');

// ── [2] The sled never opens a session ───────────────────────────────────────
console.log(`\n[2] The sled is conditioning, not a warm-up (${rows.length} strength sessions)`);
{
  const gymRows = rows.filter((r) => r.equipment.includes('fullgym'));
  check(
    `the sweep really does contain sessions where a sled is available (${gymRows.length})`,
    gymRows.length > 0 &&
      CONDITIONING_EXERCISES.some((e) => needsSled(e) && canPerformWith(e, ['fullgym'])),
    'without this the rule below would be proved by nobody owning a sled'
  );
  const sledOpeners = rows.filter((r) => r.opener && cardNeedsSled(r.opener.name));
  check(
    'not one warm-up card anywhere is a movement that needs a sled',
    sledOpeners.length === 0,
    sledOpeners
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.opener.name}`)
      .join(' | ')
  );
  const sledFinishers = rows.filter((r) => r.finisher.some((e) => cardNeedsSled(e.name)));
  check(
    `and the sled is still being prescribed, at the end of the session (${sledFinishers.length} finishers)`,
    sledFinishers.length > 0,
    'the rule above must not be passing because the sled left the app'
  );
}

// ── [3] And nothing is left with a hole ──────────────────────────────────────
console.log('\n[3] Every session still opens on something, at every kit and level');
{
  const empty = rows.filter((r) => r.prep.length === 0);
  check(
    'every session in the sweep has a warm-up',
    empty.length === 0,
    empty
      .slice(0, 3)
      .map((r) => r.where)
      .join(' | ')
  );
  const offList = rows.filter(
    (r) => !openerByKey.has(key(r.opener.name)) && !drillByKey.has(key(r.opener.name))
  );
  check(
    'and what it opens on is one of the nine, the warm-up walk or a drill, never anything else',
    offList.length === 0,
    offList
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.opener.name}`)
      .join(' | ')
  );
  /**
   * AND AT A GYM IT IS ALWAYS ONE OF THE NINE.
   *
   * The Restore stand-in is the honest answer when today's areas and this
   * person's kit leave nothing on the nine. At a full gym that can never be
   * true, so a stand-in there would mean the pulse raiser had quietly lost its
   * pool rather than found a better card.
   */
  const gymStandIn = rows.filter(
    (r) => r.equipment.includes('fullgym') && !nineByKey.has(key(r.opener.name))
  );
  check(
    'a full-gym session never has to stand in with a mobility drill',
    gymStandIn.length === 0,
    gymStandIn
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.opener.name}`)
      .join(' | ')
  );
  console.log('      what opens a session, by kit:');
  for (const equipment of KITS) {
    const kit = equipment.join('+') || 'nothing';
    const counts = new Map();
    for (const r of rows.filter((x) => x.kit === kit)) {
      counts.set(r.opener.name, (counts.get(r.opener.name) ?? 0) + 1);
    }
    const line = [...counts]
      .sort((a, b) => b[1] - a[1])
      .map(([name, n]) => `${name} ${n}`)
      .join(', ');
    console.log(`        ${kit}: ${line}`);
  }
  console.log('      and by level, at a full gym:');
  for (const level of EXPERIENCE_LEVELS) {
    const counts = new Map();
    for (const r of rows.filter((x) => x.level === level && x.equipment.includes('fullgym'))) {
      counts.set(r.opener.name, (counts.get(r.opener.name) ?? 0) + 1);
    }
    const line = [...counts]
      .sort((a, b) => b[1] - a[1])
      .map(([name, n]) => `${name} ${n}`)
      .join(', ');
    console.log(`        ${level}: ${line}`);
  }
}

// ── [4] The three days no longer get the same warm-up ────────────────────────
console.log(`\n[4] A warm-up knows which day it is in front of (${cells.size} cells)`);
{
  /**
   * The DRILLS, not the whole warm-up.
   *
   * The pulse raiser in front of them comes off the same conditioning list
   * whatever the day is, and is meant to: an easy-pace bike is an easy-pace
   * bike before any session. What Archie asked to be chosen for the day is the
   * drills behind it, so that is what is compared.
   */
  const listOf = (row) => row.drills.map((e) => e.name).join(' > ');
  let sameLowerUpper = 0;
  let sameUpperFull = 0;
  let sameLowerFullMulti = 0;
  let multiDrillCells = 0;
  let allThreeSame = 0;
  for (const [, byType] of cells) {
    const l = listOf(byType.lower_body);
    const u = listOf(byType.upper_body);
    const f = listOf(byType.full_body);
    if (l === u) sameLowerUpper++;
    if (u === f) sameUpperFull++;
    if (l === u && u === f) allThreeSame++;
    if (byType.lower_body.drills.length > 1) {
      multiDrillCells++;
      if (l === f) sameLowerFullMulti++;
    }
  }
  check(
    'a lower body day and an upper body day never get the same warm-up any more',
    sameLowerUpper === 0,
    `${sameLowerUpper} of ${cells.size} cells still match`
  );
  check(
    'nor do an upper body day and a full body day',
    sameUpperFull === 0,
    `${sameUpperFull} of ${cells.size} cells still match`
  );
  check(
    `and once there is room for more than one drill, nor do a lower and a full body day (${multiDrillCells} cells)`,
    multiDrillCells > 0 && sameLowerFullMulti === 0,
    `${sameLowerFullMulti} of ${multiDrillCells} cells still match`
  );
  check(
    'so no cell anywhere serves all three days the same warm-up',
    allThreeSame === 0,
    `${allThreeSame} of ${cells.size}`
  );
  /**
   * THE OVERLAP THAT USED TO BE LEFT, AND WHY IT IS GONE (Archie, 29 September).
   *
   * Stage 7 asserted the opposite of what is asserted here, and said so in as
   * many words: at thirty minutes there was one drill slot, and a full body day
   * opened on the same hip drill a lower body day did, because they both squat
   * and one slot was all there was. It was written down so that if it ever
   * stopped being true somebody would have decided to change it.
   *
   * Somebody did. Archie named two drills for a Full Body day - Banded Face
   * Pulls AND Hip Circles - and one for a Lower Body day, so the floor on a
   * full body warm-up is two drills at every length, and the half-hour session
   * gets both of them rather than half of his answer. The lower body day still
   * gets his one, which is still a hip drill, so the two still start alike and
   * no longer finish alike.
   */
  const shortLowerCells = [...cells.values()].filter((b) => b.lower_body.drills.length === 1);
  const fullHasBoth = shortLowerCells.filter((b) => b.full_body.drills.length >= 2).length;
  check(
    `where a lower body day has one drill, a full body day still gets two (${fullHasBoth} of ${shortLowerCells.length})`,
    shortLowerCells.length > 0 && fullHasBoth === shortLowerCells.length,
    'Archie named two drills for a full body day, and the clock does not get to drop one'
  );
  const bothLeadTheHip = shortLowerCells.filter(
    (b) =>
      worksTheHip(drillByKey.get(key(b.lower_body.drills[0].name))) &&
      b.full_body.drills.some((e) => worksTheHip(drillByKey.get(key(e.name))))
  ).length;
  check(
    `and both days are still warming the hip up before they squat (${bothLeadTheHip} of ${shortLowerCells.length})`,
    shortLowerCells.length > 0 && bothLeadTheHip === shortLowerCells.length,
    'the named drills lead, and the family rule underneath still knows what day it is'
  );
  /**
   * AND THE SAME THING WRITTEN OUT, so the difference can be read rather than
   * counted. One cell of the sweep, the three days side by side, at each
   * rotation position in turn.
   */
  console.log('      the same person, three days, at a full gym for an hour:');
  let shown = 0;
  for (const [cellKey, byType] of cells) {
    if (!cellKey.startsWith('fullgym+bench / intermediate / 60 / 34 / nothing sore')) continue;
    if (shown++ >= 4) break;
    const seat = cellKey.split(' / ').pop();
    console.log(`        rotation ${seat}`);
    for (const sessionType of SESSION_TYPES) {
      const row = byType[sessionType];
      console.log(
        `          ${sessionType.padEnd(11)} ${row.opener.name} > ${listOf(row) || '(no drills)'}`
      );
    }
  }
  /** And every shape the whole sweep produced, which is a short list. */
  console.log('      every warm-up shape in the sweep, by day:');
  for (const sessionType of SESSION_TYPES) {
    const shapes = new Map();
    for (const row of rows.filter((r) => r.sessionType === sessionType)) {
      const shape = row.drills
        .map((e) => warmupFamilyOf(drillByKey.get(key(e.name))))
        .join(' > ');
      shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
    }
    console.log(`        ${sessionType}`);
    for (const [shape, n] of [...shapes].sort((a, b) => b[1] - a[1])) {
      console.log(`          ${shape || '(none)'}: ${n}`);
    }
  }
}

// ── [5] A lower body day leads with glute and hip work ───────────────────────
console.log('\n[5] Glutes first on a lower body day, at every kit and every level');
{
  const leadFamily = (row) =>
    row.drills[0] ? warmupFamilyOf(drillByKey.get(key(row.drills[0].name))) : null;
  const noDrill = lower.filter((r) => r.drills.length === 0);
  check(
    'every lower body session in the sweep actually has a drill to lead with',
    noDrill.length === 0,
    `${noDrill.length} without one`
  );
  const wrongLead = lower.filter((r) => leadFamily(r) !== 'glute_hip');
  check(
    `a lower body warm-up leads on glute and hip work, every time (${lower.length} sessions)`,
    wrongLead.length === 0,
    wrongLead
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.drills[0] && r.drills[0].name}`)
      .join(' | ')
  );
  /** Per kit and per level, so a hole in one corner cannot hide in an average. */
  for (const equipment of KITS) {
    const kit = equipment.join('+') || 'nothing';
    const rs = lower.filter((r) => r.kit === kit);
    const led = rs.filter((r) => leadFamily(r) === 'glute_hip').length;
    check(
      `  ...with ${kit} (${led}/${rs.length})`,
      rs.length > 0 && led === rs.length,
      rs
        .filter((r) => leadFamily(r) !== 'glute_hip')
        .slice(0, 2)
        .map((r) => `${r.where}: ${r.drills[0] && r.drills[0].name}`)
        .join(' | ')
    );
  }
  for (const level of EXPERIENCE_LEVELS) {
    const rs = lower.filter((r) => r.level === level);
    const led = rs.filter((r) => leadFamily(r) === 'glute_hip').length;
    check(
      `  ...at ${level} (${led}/${rs.length})`,
      rs.length > 0 && led === rs.length,
      rs
        .filter((r) => leadFamily(r) !== 'glute_hip')
        .slice(0, 2)
        .map((r) => `${r.where}: ${r.drills[0] && r.drills[0].name}`)
        .join(' | ')
    );
  }
  /**
   * THE COUNTERWEIGHT: an upper body day must NOT lead on glute work, or the
   * rule above is being passed by the pool having nothing else in it.
   */
  const upperLeads = new Set(upper.map(leadFamily));
  check(
    'and an upper body day leads on shoulder and upper back work instead',
    upperLeads.size === 1 && upperLeads.has('upper'),
    `upper body days led with: ${[...upperLeads].join(', ')}`
  );
  /**
   * THE SAME QUESTION PUT TO THE RECORDS, so the classifier cannot answer for
   * itself. Every assertion above reads `warmupFamilyOf`, which is the code
   * under test: rewrite it badly and the sessions and the assertions move
   * together. These two read the drills' own targetRegions instead.
   */
  const leadsAwayFromHip = lower.filter((r) => {
    const record = r.drills[0] && drillByKey.get(key(r.drills[0].name));
    return record && !worksTheHip(record);
  });
  check(
    'and the drill it leads with names the glutes or the hip on its own record',
    leadsAwayFromHip.length === 0,
    leadsAwayFromHip
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.drills[0].name}`)
      .join(' | ')
  );
  /**
   * AND NO GLUTE DRILL IS LEFT OUT IN THE COLD.
   *
   * The Glute Bridge names the lower back as well as the glutes, which is why
   * the family table reads the hip before the trunk. Read the trunk first and
   * the bridge is filed as core work, a leg day quietly stops being offered its
   * best drill, and every assertion above still passes because they all ask the
   * same classifier. This one asks whether the drill actually turns up.
   */
  const gluteDrills = drillPool.filter((t) => t.targetRegions.includes('glutes'));
  const missing = gluteDrills.filter(
    (t) => !lower.some((r) => r.drills.some((e) => key(e.name) === key(t.name)))
  );
  check(
    `every drill written at the glutes does reach a leg day (${gluteDrills.length - missing.length} of ${gluteDrills.length})`,
    gluteDrills.length > 0 && missing.length === 0,
    `never reached: ${missing.map((t) => t.name).join(', ')}`
  );
}

// ── [6] Core is what a lower body day drops ──────────────────────────────────
console.log('\n[6] Core work is dropped from a leg day and kept everywhere else');
{
  const coreDrills = (row) =>
    row.drills.filter((e) => warmupFamilyOf(drillByKey.get(key(e.name))) === 'core');
  const withCore = lower.filter((r) => coreDrills(r).length > 0);
  check(
    `no lower body warm-up contains core work (${lower.length} sessions)`,
    withCore.length === 0,
    withCore
      .slice(0, 3)
      .map((r) => `${r.where}: ${coreDrills(r).map((e) => e.name).join(', ')}`)
      .join(' | ')
  );
  const upperCore = upper.filter((r) => coreDrills(r).length > 0).length;
  const fullCore = full.filter((r) => coreDrills(r).length > 0).length;
  check(
    `but an upper body day still gets it (${upperCore} of ${upper.length})`,
    upperCore > 0,
    'core must not have been deleted from the pool'
  );
  check(
    `and so does a full body day (${fullCore} of ${full.length})`,
    fullCore > 0,
    'core must not have been deleted from the pool'
  );
  /**
   * AND THE REASON IT IS DROPPED IS THE CLOCK, NOT A BAN.
   *
   * The lower body order names glute and hip work twice and the lower limb
   * third, so core sits fourth and no session length ever asks for a fourth
   * drill. That is the rule Archie described, where core is what gives way when
   * there is not room for everything, rather than core being forbidden.
   */
  const longest = Math.max(...DURATIONS.flatMap((d) => AGES.map((a) => mobilityCountFor(d, a))));
  check(
    `core sits below every slot a session can ask for (slot ${WARMUP_ORDER.lower_body.indexOf('core') + 1} of at most ${longest})`,
    WARMUP_ORDER.lower_body.indexOf('core') >= longest,
    WARMUP_ORDER.lower_body.join(' > ')
  );
  /**
   * AND THE SAME THING ASKED OF THE RECORDS: no drill on a leg day is written
   * at the trunk and nowhere else. Independent of the classifier, for the
   * reason given in [5].
   */
  const trunkOnLegDay = lower.filter((r) =>
    r.drills.some((e) => trunkOnly(drillByKey.get(key(e.name))))
  );
  check(
    'and no leg-day drill is trunk work on its own record either',
    trunkOnLegDay.length === 0,
    trunkOnLegDay
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.drills.map((e) => e.name).join(', ')}`)
      .join(' | ')
  );
  const trunkOnUpperDay = upper.filter((r) =>
    r.drills.some((e) => trunkOnly(drillByKey.get(key(e.name))))
  ).length;
  check(
    `while an upper body day still gets one (${trunkOnUpperDay} of ${upper.length})`,
    trunkOnUpperDay > 0,
    'trunk work must not have left the pool'
  );
}

// ── [7] The order never overrules the screen ─────────────────────────────────
console.log('\n[7] A withheld drill stays withheld, however high up the order it sits');
{
  const carriesBanned = (row) =>
    row.drills.filter((e) => {
      if (row.banned.size === 0) return false;
      const record = drillByKey.get(key(e.name));
      return (
        restrictedTagsOn(e.name, row.banned, undefined, e.cue).length > 0 ||
        restrictedTagsOnRecord(record, row.banned).length > 0
      );
    });
  const leaked = rows.filter((r) => carriesBanned(r).length > 0);
  check(
    'no warm-up drill anywhere carries a tag that day ruled out',
    leaked.length === 0,
    leaked
      .slice(0, 3)
      .map((r) => `${r.where}: ${carriesBanned(r).map((e) => e.name).join(', ')}`)
      .join(' | ')
  );
  /**
   * THE WORKED EXAMPLE, WHICH IS THE ONE THAT WOULD ACTUALLY GO WRONG.
   *
   * The Copenhagen Adductor Hold is glute and hip work, so it sits at the very
   * top of a lower body day's preference order, and it is the one drill in the
   * pool a sore hip or groin withholds. Both halves are asserted: it is gone
   * when the hip is sore, and it is there when nothing is, so "never appears"
   * cannot be passing because the drill fell out of the pool.
   */
  const soreHip = lower.filter((r) => r.situation.regions.includes('hip_groin'));
  const nothingSore = lower.filter((r) => r.situation.regions.length === 0);
  const withheld = drillPool.find(
    (t) =>
      warmupFamilyOf(t) === 'glute_hip' &&
      restrictedTagsOnRecord(t, restrictedTagsFor(['hip_groin'], 'intermediate', 'moderate'))
        .length > 0
  );
  check(
    'a sore hip does withhold a glute and hip drill, so there is something to prove',
    !!withheld,
    'nothing in the pool is withheld from a sore hip, so the case below is empty'
  );
  const appearsWhenWell = nothingSore.filter((r) =>
    r.drills.some((e) => key(e.name) === key(withheld.name))
  ).length;
  const appearsWhenSore = soreHip.filter((r) =>
    r.drills.some((e) => key(e.name) === key(withheld.name))
  ).length;
  check(
    `${withheld.name} is reachable on a lower body day when nothing hurts (${appearsWhenWell} of ${nothingSore.length})`,
    appearsWhenWell > 0,
    'the counterweight for the assertion below'
  );
  check(
    `and never reaches one when the hip is sore, though its family leads the day (${appearsWhenSore} of ${soreHip.length})`,
    appearsWhenSore === 0,
    'the preference order decides the order, never the eligibility'
  );
  const soreHipStillLeads = soreHip.filter(
    (r) => r.drills[0] && warmupFamilyOf(drillByKey.get(key(r.drills[0].name))) === 'glute_hip'
  ).length;
  check(
    `and the day still leads on glute and hip work without it (${soreHipStillLeads} of ${soreHip.length})`,
    soreHipStillLeads === soreHip.length,
    'the slot falls through to another drill in the family, not out of it'
  );
  /**
   * AND THE BEGINNER RULE AT THE TOP OF THE SESSION, which is the other place a
   * preference could quietly overrule a safety rule. Skipping is the one record
   * on the nine a beginner is never given (decision 7).
   */
  const impact = CONDITIONING_EXERCISES.filter((e) => (e.stress ?? []).includes('high_impact'));
  check(
    `the nine contain a record kept away from beginners (${impact.map((e) => e.name).join(', ')})`,
    impact.length > 0,
    'otherwise the two assertions below prove nothing'
  );
  const impactKeys = new Set(impact.map((e) => key(e.name)));
  const beginnerImpact = rows.filter(
    (r) => r.level === 'beginner' && impactKeys.has(key(r.opener.name))
  );
  const otherImpact = rows.filter(
    (r) => r.level !== 'beginner' && impactKeys.has(key(r.opener.name))
  );
  check(
    'no beginner opens a session on it',
    beginnerImpact.length === 0,
    beginnerImpact
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.opener.name}`)
      .join(' | ')
  );
  check(
    `and everybody else still does (${otherImpact.length} sessions)`,
    otherImpact.length > 0,
    'the rule above must not be passing because the record left the warm-up pool'
  );
}

// ── [8] The conditioning session, which has a warm-up of its own ─────────────
console.log('\n[8] A Conditioning session opens on conditioning, but not on the sled');
{
  const condRows = [];
  for (const equipment of KITS) {
    for (const level of EXPERIENCE_LEVELS) {
      for (const duration of DURATIONS) {
        for (const situation of SITUATIONS) {
          for (const seed of SEEDS) {
            const session = generateLibraryConditioningSession({
              equipment,
              readiness: readinessFor(situation, duration),
              profile: profileFor(level, 34),
              sessionCount: seed,
            });
            if (session.exercises.length === 0) continue;
            condRows.push({
              where: `${equipment.join('+') || 'nothing'} / ${level} / ${duration} / ${situation.label} / ${seed}`,
              prep: session.exercises.filter((e) => e.category === 'prep'),
              blocks: session.exercises.filter((e) => e.category === 'cardio'),
            });
          }
        }
      }
    }
  }
  check(
    `the conditioning sweep built real sessions (${condRows.length})`,
    condRows.length > 0,
    'nothing was generated, so nothing below is being tested'
  );
  const sledOpen = condRows.filter((r) => r.prep[0] && cardNeedsSled(r.prep[0].name));
  check(
    'no conditioning session opens on a sled either',
    sledOpen.length === 0,
    sledOpen
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.prep[0].name}`)
      .join(' | ')
  );
  const sledBlocks = condRows.filter((r) => r.blocks.some((e) => cardNeedsSled(e.name)));
  check(
    `and the sled is still doing the work it belongs in (${sledBlocks.length} sessions with one in a block)`,
    sledBlocks.length > 0,
    'the sled must stay in the conditioning blocks'
  );
  const noWarmUp = condRows.filter((r) => r.prep.length === 0);
  check(
    'every conditioning session still has a warm-up card',
    noWarmUp.length === 0,
    noWarmUp
      .slice(0, 3)
      .map((r) => r.where)
      .join(' | ')
  );
}

// ── [9] The button behind the warm-up does not put the sled back ─────────────
console.log('\n[9] The swap button behind a warm-up is offered a warm-up');
{
  const profile = {
    name: 'T',
    sex: 'male',
    experienceLevel: 'intermediate',
    goals: ['muscle'],
    bodyweightKg: 80,
  };
  const prepCards = [];
  const finisherCards = [];
  for (const type of ['lower_body', 'upper_body', 'full_body', 'conditioning']) {
    for (const seed of [0, 1, 2, 3, 4, 5]) {
      const ex = generateWorkout(
        type,
        'fullgym',
        { hasAches: false, energy: 'normal', timeAvailable: '60' },
        profile,
        seed,
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { equipment: ['fullgym', 'bench'], sessionTypeCount: seed }
      );
      for (const card of ex) {
        if (card.category === 'prep') prepCards.push({ type, seed, card });
        if (card.category === 'finisher') finisherCards.push({ type, seed, card });
      }
    }
  }
  check(
    `the sweep produced warm-up cards to look behind (${prepCards.length})`,
    prepCards.length > 0,
    'nothing generated'
  );
  const sledBehind = prepCards.filter(
    (p) => cardNeedsSled(p.card.swapName) || cardNeedsSled(p.card.swap2Name)
  );
  check(
    'no warm-up card offers a sled behind its button',
    sledBehind.length === 0,
    sledBehind
      .slice(0, 3)
      .map((p) => `${p.type}/${p.seed}: ${p.card.name} -> ${p.card.swapName} / ${p.card.swap2Name}`)
      .join(' | ')
  );
  const nineWarmUps = prepCards.filter((p) => openerByKey.has(key(p.card.name)));
  const naked = nineWarmUps.filter((p) => !p.card.swapName);
  check(
    `and a pulse raiser still has something behind it (${nineWarmUps.length} checked)`,
    nineWarmUps.length > 0 && naked.length === 0,
    naked
      .slice(0, 3)
      .map((p) => `${p.type}/${p.seed}: ${p.card.name}`)
      .join(' | ')
  );
  /**
   * BOTH SLOTS, NOT JUST THE FIRST.
   *
   * The session writes two alternatives onto a pulse raiser and the engine used
   * to have room for only one of them, so the second slot was filled by the
   * catalogue's nearest-muscle ranking instead: a full-gym conditioning session
   * opened on a sled and offered Walking Lunges and a Wall Sit, neither of them
   * conditioning and neither of them a warm-up. Asserting only the first slot
   * would leave that half of the button unwatched.
   */
  const bothSlots = (p) => [p.card.swapName, p.card.swap2Name].filter(Boolean);
  const offList = nineWarmUps.filter((p) =>
    bothSlots(p).some((name) => !openerByKey.has(key(name)))
  );
  check(
    'and what it offers, in both slots, is another of the nine and not a strength movement',
    offList.length === 0,
    offList
      .slice(0, 3)
      .map((p) => `${p.type}/${p.seed}: ${p.card.name} -> ${bothSlots(p).join(' / ')}`)
      .join(' | ')
  );
  const oneSided = nineWarmUps.filter((p) => bothSlots(p).length < 2);
  check(
    `and it offers two of them rather than one and a space (${nineWarmUps.length - oneSided.length} of ${nineWarmUps.length})`,
    oneSided.length === 0,
    oneSided
      .slice(0, 3)
      .map((p) => `${p.type}/${p.seed}: ${p.card.name} -> ${bothSlots(p).join(' / ') || 'nothing'}`)
      .join(' | ')
  );
  /**
   * THE COUNTERWEIGHT: a FINISHER may still be offered a sled, because a
   * finisher is conditioning and is meant to be hard. If this ever goes to zero
   * the rule above has stopped being about the warm-up and started being about
   * the sled.
   */
  const sledFinisher = finisherCards.filter(
    (p) =>
      cardNeedsSled(p.card.name) ||
      cardNeedsSled(p.card.swapName) ||
      cardNeedsSled(p.card.swap2Name)
  );
  check(
    `a finisher is still allowed the sled (${sledFinisher.length} of ${finisherCards.length})`,
    finisherCards.length > 0 && sledFinisher.length > 0,
    'the sled has left the session entirely, which is more than Archie asked for'
  );
  /**
   * AND THE DRILL CARDS, THROUGH THE SAME REAL ENGINE, so the two layers are
   * both watched. The big sweep below asks the same question of many more
   * sessions; this one proves the answer survives the swap pass in
   * lib/workout-engine.ts, which is free to overrule what the session wrote.
   */
  const drillCards = prepCards.filter((p) => drillByKey.has(key(p.card.name)));
  const legDayCore = drillCards.filter(
    (p) =>
      p.type === 'lower_body' &&
      [p.card.swapName, p.card.swap2Name]
        .filter((n) => n && drillByKey.has(key(n)))
        .some((n) => warmupFamilyOf(drillByKey.get(key(n))) === 'core')
  );
  check(
    `a leg day's warm-up drill is not offered core work through the engine either (${drillCards.filter((p) => p.type === 'lower_body').length} cards)`,
    drillCards.some((p) => p.type === 'lower_body') && legDayCore.length === 0,
    legDayCore
      .slice(0, 3)
      .map((p) => `${p.type}/${p.seed}: ${p.card.name} -> ${p.card.swapName} / ${p.card.swap2Name}`)
      .join(' | ')
  );
}

// ── [10] The button behind a warm-up DRILL follows the same day ──────────────
console.log('\n[10] A warm-up drill is offered work the day it is in front of wants');
{
  const familyOfName = (name) => {
    const record = name && drillByKey.get(key(name));
    return record ? warmupFamilyOf(record) : null;
  };
  const optionsOn = (card) => [card.swapName, card.swap2Name].filter(Boolean);
  const drillCardsOf = (list) => list.flatMap((r) => r.drills);
  const lowerDrills = drillCardsOf(lower);
  const upperDrills = drillCardsOf(upper);
  check(
    `the sweep produced warm-up drill cards on a leg day (${lowerDrills.length})`,
    lowerDrills.length > 0,
    'nothing to look behind'
  );
  const naked = lowerDrills.filter((c) => optionsOn(c).length === 0);
  check(
    'every one of them has something behind its button',
    naked.length === 0,
    `${naked.length} with an empty button, so the rule below could pass by offering nothing`
  );
  const offPool = lowerDrills.filter((c) => optionsOn(c).some((n) => !drillByKey.has(key(n))));
  check(
    'and what it offers is another Restore drill, not a strength movement',
    offPool.length === 0,
    offPool
      .slice(0, 3)
      .map((c) => `${c.name} -> ${optionsOn(c).join(' / ')}`)
      .join(' | ')
  );
  const firstIsCore = lowerDrills.filter((c) => familyOfName(c.swapName) === 'core');
  check(
    `the first thing behind a leg-day warm-up card is never core work (${lowerDrills.length} cards)`,
    firstIsCore.length === 0,
    firstIsCore
      .slice(0, 3)
      .map((c) => `${c.name} -> ${optionsOn(c).join(' / ')}`)
      .join(' | ')
  );
  const firstNotLower = lowerDrills.filter(
    (c) => familyOfName(c.swapName) !== 'glute_hip' && familyOfName(c.swapName) !== 'lower_limb'
  );
  check(
    'it is hip or lower limb work instead',
    firstNotLower.length === 0,
    firstNotLower
      .slice(0, 3)
      .map((c) => `${c.name} -> ${optionsOn(c).join(' / ')}`)
      .join(' | ')
  );
  /**
   * AND WHERE CORE DOES APPEAR, IT IS THE LAST THING LEFT RATHER THAN A CHOICE.
   *
   * Sorted, not filtered: core is still eligible behind the button on a leg
   * day, it simply sits below the hip and the lower limb. It is reached in
   * 948 of these cards, and every one of them is a three-drill warm-up - the
   * 45 minute session for somebody past fifty - which has already spent the hip
   * and lower limb drills its kit allows. An empty button would be worse.
   */
  const coreBehind = lowerDrills.filter((c) =>
    optionsOn(c).some((n) => familyOfName(n) === 'core')
  );
  const coreOnShortWarmUp = lower.filter(
    (r) =>
      r.drills.length < 3 &&
      r.drills.some((c) => optionsOn(c).some((n) => familyOfName(n) === 'core'))
  );
  check(
    `core is only ever the second option, and only on a three-drill warm-up (${coreBehind.length} of ${lowerDrills.length} cards)`,
    coreOnShortWarmUp.length === 0,
    coreOnShortWarmUp
      .slice(0, 3)
      .map((r) => `${r.where}: ${r.drills.map((e) => e.name).join(' > ')}`)
      .join(' | ')
  );
  /**
   * THE ORDER ITSELF, ASKED OF EVERY DAY AT ONCE.
   *
   * Two options come off one sorted list, so the second can never sit higher up
   * the day's row than the first. That is the whole mechanism, and it holds on
   * an upper and a full body day as well, where the row is a different one.
   */
  const backwards = rows.flatMap((r) =>
    r.drills
      .filter((c) => optionsOn(c).length === 2)
      .filter((c) => {
        const rank = warmupFamilyOrder(r.sessionType, 0);
        return rank.indexOf(familyOfName(c.swapName)) > rank.indexOf(familyOfName(c.swap2Name));
      })
      .map((c) => `${r.where}: ${c.name} -> ${optionsOn(c).join(' / ')}`)
  );
  check(
    "and the button walks the day's order downwards, never back up it",
    backwards.length === 0,
    backwards.slice(0, 3).join(' | ')
  );
  /**
   * THE COUNTERWEIGHT, AND IT IS THE IMPORTANT ONE.
   *
   * "Core is never offered" would pass just as well if the core drills had been
   * deleted, withheld, or quietly used up. So: on the days when nothing hurts,
   * every core drill in the pool is still there, still allowed, and still
   * SPARE - unused by the warm-up and therefore available to the button - and
   * the button declines it anyway. That is an ordering, not an absence.
   */
  const coreDrills = drillPool.filter((t) => warmupFamilyOf(t) === 'core');
  const wellLower = lower.filter((r) => r.situation.regions.length === 0);
  const allCoreSpare = wellLower.every((r) => {
    const onCard = new Set(r.drills.map((e) => key(e.name)));
    return coreDrills.every((t) => !onCard.has(key(t.name)));
  });
  check(
    `every core drill is spare on a leg day when nothing hurts (${coreDrills.length} drills, ${wellLower.length} sessions)`,
    coreDrills.length > 0 && wellLower.length > 0 && allCoreSpare,
    coreDrills.map((t) => t.name).join(', ')
  );
  /**
   * AND THE COUNTERWEIGHT ON THE OTHER SIDE: an upper body day's button leads
   * with shoulder and upper back work, from the same sort reading a different
   * row. If this ever said glute_hip the sort would have stopped reading the
   * day and started reading a single hard-coded order.
   */
  const upperFirst = new Set(upperDrills.map((c) => familyOfName(c.swapName)));
  check(
    `and an upper body day's button leads with its own family instead (${[...upperFirst].join(', ')})`,
    upperFirst.size === 1 && upperFirst.has('upper'),
    [...upperFirst].join(', ')
  );
  /** And core is still offered SOMEWHERE, so the leg-day rule is not a deletion. */
  const coreOfferedOnUpper = upperDrills.filter((c) =>
    optionsOn(c).some((n) => familyOfName(n) === 'core')
  );
  check(
    `core work is still offered behind a button on an upper body day (${coreOfferedOnUpper.length} cards)`,
    coreOfferedOnUpper.length > 0,
    'core has left the swap options entirely, which is more than the rule asks for'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(
  `\nwarmup-shape: ${failed === 0 ? `all ${passed} checks passed` : `${failed}/${passed + failed} check(s) FAILED`}`
);
process.exit(failed === 0 ? 0 : 1);
