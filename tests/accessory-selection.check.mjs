/**
 * Contract test: what an accessory is allowed to be, once the main lift is in.
 *
 * WHAT THIS PINS DOWN
 * ───────────────────
 * Three rules, all of them Archie's, given on 24 September 2026 after testing
 * on Expo. The first is the one he gave a reason for, and the reason is why
 * this file exists rather than a preference note:
 *
 *   "The exercises following the main lift should be accessory movements from
 *    an easier exercise client level category. For a example, athlete level
 *    squat variation should be followed by an advanced/intermediate or beginner
 *    exercise to avoid the client getting too fatigued and injured from
 *    attempting two athlete level movements.
 *    The accessory exercises should be from a different movement too. For
 *    example, hinge then squat or lunge or squat then hinge or lunge or Lunge
 *    then squat or hinge."
 *
 * and separately:
 *
 *   "accessory movements should be leg related not completely core related when
 *    doing a lower body workout."
 *
 * So:
 *
 *   1. AN ACCESSORY SITS A RUNG BELOW THE MAIN LIFT. Measured against the main
 *      lift's own level in the library, not the person's ceiling. Under a
 *      level 1 main lift there is no rung below, so the floor holds at 1 and
 *      the accessories sit alongside it - section [4] asserts that on its own,
 *      because it is deliberate rather than a leak.
 *   2. AN ACCESSORY IS A DIFFERENT MOVEMENT FROM THE MAIN LIFT.
 *   3. A LEG DAY'S ACCESSORIES ARE LEG WORK, never core.
 *
 * WHAT IT WAS BEFORE, MEASURED OVER THE SAME 4,608 SESSIONS THIS FILE SWEEPS
 * ─────────────────────────────────────────────────────────────────────────
 *                                          before    after
 *   accessory at or above the main          90.1%     59.4%
 *   accessory strictly above the main       16.3%      0.0%
 *   accessory sharing the main's pattern     5.6%      3.8%
 *   core work on a leg day                  35.4%      2.8%
 *   sessions with fewer than 3 pieces of work  216         0
 *
 * The clearest single line: behind an ATHLETE main lift, 560 of 732 accessory
 * cards were themselves athlete level. Afterwards, 0 of 792. That is Archie's
 * sentence about stacking two athlete movements, answered.
 *
 * The 59.4% that remains is entirely rule 1's floor: a main lift at level 1 has
 * no rung beneath it, and most of the sweep is at home where level 1 is where
 * the library lives. At a full gym with nothing sore, where the library is deep
 * enough for the rule to bite, "at or above" fell from 95.2% to 25.0%.
 *
 * The 2.8% of core left on a leg day is all days when something was sore, which
 * section [2] asserts rather than assumes.
 *
 * THE NUMBER THAT DID NOT MOVE, AND WHY THAT IS RIGHT
 * ──────────────────────────────────────────────────
 * The recon that started this work measured the accessory slot from the other
 * end: 68.3% of the cards landing in it are records the library files as MAIN
 * lifts. Over this sweep that share went 50.8% to 48.7%, and over the recon's
 * own slice - a full gym with nothing sore - 62.5% to 62.1%. It barely moved,
 * and it should not have. A Dumbbell Romanian Deadlift is a main-lift record
 * and a perfectly good accessory behind a Barbell Back Squat: it is a rung
 * lower and a different movement, which is exactly the session Archie
 * described. What he objected to was the SECOND HARD MOVEMENT, and that is the
 * level, which is what moved.
 *
 * WHERE THE RULES BEND, AND WHICH ONE BENDS
 * ─────────────────────────────────────────
 * Rule 1, the level, NEVER bends. It is the one he gave a clinical reason for,
 * and the honest answer when it cannot be met is a shorter session, not a
 * heavier one.
 *
 * Rule 2, the pattern, bends first, and section [5] measures where. At home the
 * library holds exactly one pulling exercise that needs no kit, so an Upper
 * Body session that has used Door Frame Rows has no second pull to give and
 * takes an easier PRESS instead, still a rung below the main lift. With nothing
 * sore that happens 40 times in 15,036 accessory cards and only at home: no
 * kit, bodyweight, and bodyweight with a bench. With an area sore it happens
 * 524 times and at every kit set, which is the screen emptying the slot rather
 * than the shelf being bare.
 *
 * Rule 3, leg work on a leg day, bends last and only on a leg day: a sore hip
 * or knee can rule out every squat, hinge and lunge in reach, and then the
 * choice is a core piece or an empty slot. 128 of the 4,544 leg-day accessory
 * cards are core, every one of them on a day something was sore, which section
 * [2] asserts rather than assumes.
 *
 * Below all three is the oldest answer of all: the slot is dropped and the
 * session is one piece of work shorter, and it says so in a line the person
 * reads. Section [6] is about that line.
 *
 * NOTHING HERE GREPS FOR A SPELLING. Every assertion runs the real generator
 * over a sweep of real answers, matches each card back to its library record
 * and reads the record's own level, pattern and role.
 *
 * Run:  npx tsx tests/accessory-selection.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { EXPERIENCE_LEVELS } from '../lib/store.ts';
import { LIBRARY_EXERCISES, patternsOf } from '../lib/exercise-library.ts';
import {
  accessoryLevelCeiling,
  accessoryPatternsFor,
  generateLibrarySession,
  levelCeilingFor,
  slotPool,
} from '../lib/library-session.ts';
import { restSecondsForSet } from '../lib/rep-scheme.ts';
import {
  restrictedTagsFor,
  restrictedTagsOn,
  restrictedTagsOnRecord,
} from '../lib/exercise-safety.ts';

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
const key = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
const recordByName = new Map();
for (const e of LIBRARY_EXERCISES) recordByName.set(key(e.name), e);

const profileFor = (level, extra = {}) => ({
  name: 'Sweep',
  sex: 'male',
  experienceLevel: level,
  goals: ['muscle'],
  bodyweightKg: 80,
  ageYears: 32,
  standingSoreRegions: [],
  clinicalAvoid: [],
  ...extra,
});
const readinessFor = (timeAvailable, extra = {}) => ({
  hasAches: false,
  painSeverity: 'mild',
  acute: false,
  energy: 'normal',
  timeAvailable,
  ...extra,
});

const TYPES = ['lower_body', 'upper_body', 'full_body'];
const KITS = [
  [],
  ['bodyweight'],
  ['bodyweight', 'bands'],
  ['bodyweight', 'bench'],
  ['bodyweight', 'bands', 'dumbbells'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells'],
  ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'],
  ['fullgym', 'bench'],
];
const TIMES = ['30', '45', '60'];
/** Nothing sore, then three areas reported today, so the substitution path is swept too. */
const SITUATIONS = [
  {},
  { hasAches: true, painRegion: 'knee' },
  { hasAches: true, painRegion: 'front_shoulder' },
  { hasAches: true, painRegion: 'lower_back', painSeverity: 'moderate' },
];

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[1] The two rules, asked of themselves before anything is built');
// ─────────────────────────────────────────────────────────────────────────────

check(
  'an athlete main lift is followed by advanced work, and so on down the ladder',
  accessoryLevelCeiling(4) === 3 && accessoryLevelCeiling(3) === 2 && accessoryLevelCeiling(2) === 1,
  `4 -> ${accessoryLevelCeiling(4)}, 3 -> ${accessoryLevelCeiling(3)}, 2 -> ${accessoryLevelCeiling(2)}`
);
check(
  'and a beginner main lift keeps its accessories at the bottom rung rather than below it',
  accessoryLevelCeiling(1) === 1,
  `1 -> ${accessoryLevelCeiling(1)}`
);
check(
  'a leg day may follow a squat with a hinge or a lunge, and with nothing else',
  accessoryPatternsFor('lower_body', 'squat').join(',') === 'hinge,lunge' &&
    accessoryPatternsFor('lower_body', 'hinge').join(',') === 'squat,lunge' &&
    accessoryPatternsFor('lower_body', 'lunge').join(',') === 'squat,hinge',
  `squat -> ${accessoryPatternsFor('lower_body', 'squat').join('/')}`
);
check(
  'so core is never what a leg day falls back on',
  TYPES.every((t) =>
    ['squat', 'hinge', 'lunge', 'push', 'pull'].every(
      (p) => !accessoryPatternsFor(t, p).includes('core')
    )
  ),
  TYPES.map((t) => `${t}: ${accessoryPatternsFor(t, 'squat').join('/')}`).join(' | ')
);
check(
  'and the pattern of the main lift is never what follows it',
  TYPES.every((t) =>
    ['squat', 'hinge', 'lunge', 'push', 'pull'].every((p) => !accessoryPatternsFor(t, p).includes(p))
  ),
  'a pattern offered itself back'
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[2] The sweep: every session type, kit, level, length and rotation');
// ─────────────────────────────────────────────────────────────────────────────

/** One row per accessory card built, with what the library knows about it. */
const cards = [];
let sessions = 0;
let workCards = 0;
let thinSessions = 0;
const notARecord = [];
for (const sessionType of TYPES) {
  for (const equipment of KITS) {
    for (const level of EXPERIENCE_LEVELS) {
      for (const timeAvailable of TIMES) {
        for (const situation of SITUATIONS) {
          for (let n = 0; n < 4; n++) {
            const { exercises } = generateLibrarySession({
              sessionType,
              equipment,
              readiness: readinessFor(timeAvailable, situation),
              profile: profileFor(level),
              sessionTypeCount: n,
              strengthSessionCount: 12,
              daysSinceLastSession: null,
            });
            sessions++;
            const work = exercises.filter(
              (e) => e.category === 'main' || e.category === 'accessory'
            );
            workCards += work.length;
            if (work.length < 3) thinSessions++;
            const where = `${sessionType} / ${equipment.join('+') || 'nothing'} / ${level} / ${timeAvailable} min / n${n}${situation.painRegion ? ` / sore ${situation.painRegion}` : ''}`;
            const main = exercises.find((e) => e.category === 'main');
            const mainRecord = main ? recordByName.get(key(main.name)) : undefined;
            if (main && !mainRecord) notARecord.push(`${where}: main ${main.name}`);
            for (const card of exercises.filter((e) => e.category === 'accessory')) {
              const record = recordByName.get(key(card.name));
              if (!record) {
                notARecord.push(`${where}: ${card.name}`);
                continue;
              }
              if (!mainRecord) continue;
              cards.push({
                where,
                sessionType,
                equipment,
                level,
                situation,
                main: mainRecord,
                record,
                card,
                inSession: new Set(exercises.map((e) => key(e.name))),
              });
            }
          }
        }
      }
    }
  }
}

check(
  `the sweep really built sessions (${sessions} sessions, ${workCards} pieces of work, ${cards.length} accessories)`,
  sessions > 1000 && cards.length > 2000,
  'nothing was generated, so everything below proves nothing'
);
check(
  'and every card in them is a library record, so the rules below are asked of real data',
  notARecord.length === 0,
  notARecord.slice(0, 3).join(' | ')
);
check(
  'nobody is left with fewer than three pieces of work by any of this',
  thinSessions === 0,
  `${thinSessions} sessions came back with fewer than three`
);

// ─── Rule 1: a rung below the main lift ──────────────────────────────────────
const tooHard = cards.filter((c) => c.record.level > accessoryLevelCeiling(c.main.level));
check(
  'no accessory is harder than a rung below the main lift, anywhere in the sweep',
  tooHard.length === 0,
  tooHard
    .slice(0, 5)
    .map((c) => `${c.where}: main ${c.main.name} (level ${c.main.level}) -> ${c.record.name} (level ${c.record.level})`)
    .join(' | ')
);
const strictlyAbove = cards.filter((c) => c.record.level > c.main.level);
check(
  'and none is above it at all, which is the 13.7% the rule was written for',
  strictlyAbove.length === 0,
  strictlyAbove.slice(0, 5).map((c) => `${c.where}: ${c.record.name}`).join(' | ')
);
/**
 * The counterweight. "Nothing is above the cap" is also true of a sweep that
 * never built a hard main lift, so the sweep is asked to prove it contains the
 * case the rule is about: a main lift at the top of the ladder with easier work
 * behind it.
 */
const underAthlete = cards.filter((c) => c.main.level === 4);
const underAdvanced = cards.filter((c) => c.main.level === 3);
check(
  `the sweep contains the case the rule is about (${underAthlete.length} accessories behind an athlete main lift, ${underAdvanced.length} behind an advanced one)`,
  underAthlete.length > 50 && underAdvanced.length > 50,
  'no hard main lift was built, so the cap was never tested'
);
check(
  `an athlete main lift is followed by advanced, intermediate or beginner work, in his words (levels ${[...new Set(underAthlete.map((c) => c.record.level))].sort().join('/')})`,
  underAthlete.every((c) => c.record.level <= 3),
  `levels seen: ${[...new Set(underAthlete.map((c) => c.record.level))].sort().join('/')}`
);

// ─── Rule 3: a leg day is leg work ───────────────────────────────────────────
const coreOnLegDay = cards.filter(
  (c) => c.sessionType === 'lower_body' && patternsOf(c.record).includes('core')
);
const legDay = cards.filter((c) => c.sessionType === 'lower_body');
const legDayFresh = legDay.filter((c) => !c.situation.painRegion);
check(
  `a lower body day with nothing sore never spends an accessory slot on core work (${legDayFresh.length} cards)`,
  legDayFresh.length > 500 &&
    legDayFresh.every((c) => ['squat', 'hinge', 'lunge'].includes(c.record.pattern)),
  legDayFresh
    .filter((c) => !['squat', 'hinge', 'lunge'].includes(c.record.pattern))
    .slice(0, 5)
    .map((c) => `${c.where}: ${c.record.name} is ${c.record.pattern}`)
    .join(' | ')
);
/**
 * THE ONE CASE WHERE RULE 3 GIVES WAY, AND IT IS THE RIGHT ONE.
 *
 * A sore hip or knee can rule out every squat, hinge and lunge in reach, and
 * then the choice is a core piece or an empty slot. Losing three of ten cards
 * is the app punishing somebody for telling it the truth, which is what
 * tests/injury-safety.check.mjs exists to stop. So core is the last thing tried
 * on a leg day, after every leg pattern including the main lift's own.
 */
check(
  `so the ${coreOnLegDay.length} core pieces on a leg day are all days when something was sore`,
  coreOnLegDay.every((c) => c.situation.painRegion),
  coreOnLegDay
    .filter((c) => !c.situation.painRegion)
    .slice(0, 5)
    .map((c) => `${c.where}: ${c.record.name}`)
    .join(' | ')
);
/** Counterweight: core has not simply left the app. */
const coreElsewhere = cards.filter(
  (c) => c.sessionType !== 'lower_body' && patternsOf(c.record).includes('core')
);
check(
  `core work is still prescribed where it belongs (${coreElsewhere.length} accessory slots on upper body and full body days)`,
  coreElsewhere.length > 100,
  'core disappeared from every session, which is not what he asked for'
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[3] Rule 2: a different movement from the main lift');
// ─────────────────────────────────────────────────────────────────────────────

const sharesPattern = cards.filter((c) => patternsOf(c.record).includes(c.main.pattern));
check(
  `all but ${sharesPattern.length} of ${cards.length} accessories are a different pattern from the main lift (${((sharesPattern.length / cards.length) * 100).toFixed(1)}%)`,
  sharesPattern.length / cards.length < 0.1,
  `${((sharesPattern.length / cards.length) * 100).toFixed(1)}% share it, which is too many to be slots with nothing left`
);
check(
  'and the sweep contains the three lower body orders he named: squat then hinge or lunge, and back',
  ['squat', 'hinge', 'lunge'].every((p) =>
    legDay.some((c) => c.main.pattern === p && c.record.pattern !== p)
  ),
  'a leg day pattern never led a session, so the rule was never asked'
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[4] The floor under rule 1, which is deliberate');
// ─────────────────────────────────────────────────────────────────────────────

const underBeginnerLift = cards.filter((c) => c.main.level === 1);
check(
  `a main lift on the bottom rung keeps its accessories there too (${underBeginnerLift.length} cards)`,
  underBeginnerLift.length > 100 && underBeginnerLift.every((c) => c.record.level === 1),
  underBeginnerLift
    .filter((c) => c.record.level !== 1)
    .slice(0, 5)
    .map((c) => `${c.where}: ${c.record.name} is level ${c.record.level}`)
    .join(' | ')
);
check(
  'so nobody with a beginner main lift is left with an empty session instead',
  underBeginnerLift.length > 100,
  'the floor is not being exercised by the sweep at all'
);
check(
  'and every accessory above the bottom rung sits under a main lift that is higher still',
  cards.filter((c) => c.record.level > 1).every((c) => c.main.level > c.record.level),
  cards
    .filter((c) => c.record.level > 1 && c.main.level <= c.record.level)
    .slice(0, 5)
    .map((c) => `${c.where}: ${c.main.name} (${c.main.level}) -> ${c.record.name} (${c.record.level})`)
    .join(' | ')
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[5] Where the pattern rule bends, and that it never bends further');
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every bend is asked to justify itself, the way the comfort-variant check asks
 * a substitution to: was there an allowed pattern with something in it, at the
 * accessory's own rung, that the session was not already doing? If there was,
 * the builder took the main lift's pattern when it did not have to.
 */
/** What today rules out, asked the same two ways the builder asks it. */
const cleanToday = (record, c) => {
  const regions = c.situation.painRegion ? [c.situation.painRegion] : [];
  const banned = restrictedTagsFor(regions, c.level, c.situation.painSeverity ?? 'mild');
  if (c.level === 'beginner') banned.add('high_impact');
  return (
    restrictedTagsOnRecord(
      {
        name: record.name,
        movementPattern: record.movementPattern,
        reps: record.reps,
        cue: record.cue,
        stress: record.stress,
      },
      banned
    ).length === 0 && restrictedTagsOn(record.name, banned, undefined, record.cue).length === 0
  );
};
const avoidable = sharesPattern.filter((c) => {
  const cap = accessoryLevelCeiling(c.main.level);
  return accessoryPatternsFor(c.sessionType, c.main.pattern).some((pattern) =>
    slotPool(pattern, cap, c.equipment.length > 0 ? c.equipment : ['bodyweight']).some(
      (record) =>
        record.level <= cap && !c.inSession.has(key(record.name)) && cleanToday(record, c)
    )
  );
});
check(
  'every repeat of the main lift pattern is a slot with nothing else left to give',
  avoidable.length === 0,
  avoidable
    .slice(0, 5)
    .map((c) => `${c.where}: ${c.main.name} -> ${c.record.name}`)
    .join(' | ')
);
check(
  'and it is still inside the rung rule, which is the one that does not bend',
  sharesPattern.every((c) => c.record.level <= accessoryLevelCeiling(c.main.level)) &&
    sharesPattern.every((c) => c.main.level === 1 || c.record.level < c.main.level),
  sharesPattern
    .filter((c) => c.record.level > accessoryLevelCeiling(c.main.level))
    .slice(0, 5)
    .map((c) => `${c.where}: ${c.main.name} (${c.main.level}) -> ${c.record.name} (${c.record.level})`)
    .join(' | ')
);
/**
 * WHERE IT BENDS, SAID PRECISELY, because "it only bends where it has to" is a
 * sentence anybody can write and this is the number behind it.
 *
 * With nothing sore it is a home problem and nothing else: the library holds
 * one pulling exercise and two beginner hinges that need no kit, so those are
 * the slots that run out. With an area sore it can happen at a full gym too,
 * and it should: a sore knee takes every squat and lunge out of a leg day, and
 * an easier hinge is a better answer than a fourth exercise for the same knee.
 */
const bentSore = sharesPattern.filter((c) => c.situation.painRegion);
const bentFresh = sharesPattern.filter((c) => !c.situation.painRegion);
const freshKits = [...new Set(bentFresh.map((c) => c.equipment.join('+') || 'no kit'))];
check(
  `with nothing sore it bends ${bentFresh.length} times in ${cards.length}, and only at home (${freshKits.join(', ') || 'nowhere'})`,
  bentFresh.every((c) => !c.equipment.includes('fullgym') && !c.equipment.includes('dumbbells')),
  bentFresh
    .filter((c) => c.equipment.includes('fullgym') || c.equipment.includes('dumbbells'))
    .slice(0, 5)
    .map((c) => c.where)
    .join(' | ')
);
console.log(
  `      (and ${bentSore.length} times where an area was sore, which is the screen emptying the slot rather than the kit)`
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[6] The sentence a dropped slot leaves behind still means what it says');
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE RELAXATION MUST NOT MAKE THE PLAN SHEET BLAME THE WRONG THING.
 *
 * When a pattern makes it into no slot at all, the session says so in a line
 * the person reads. There are two written reasons - "No lunging exercise in the
 * library matches your level and your kit" and "No lunging exercise was safe to
 * give you today" - and a generic fall-through, "No lunging exercise made it
 * into today's session", used when the builder recorded no reason at all.
 *
 * Both of those matter here because the pattern rule BENDS, and a bent slot
 * gets filled. A sore knee takes every lunge out of a leg day, the slot takes a
 * second hinge instead, and the session contains no lunging while no slot was
 * ever dropped. 788 of these 4,608 sessions read that way before this section
 * existed: the generic sentence, followed by an offer to sell them a box, for a
 * lunge their knee had removed.
 *
 * And the choice between the two written reasons is read at the person's OWN
 * ceiling, never at the accessory cap. The cap is a rule this app lays on top
 * of the library, so the capped pool would tell somebody at Intermediate that
 * nothing at their level exists while an intermediate row sat there.
 */
const gapRows = [];
for (const sessionType of TYPES) {
  for (const equipment of KITS) {
    for (const level of EXPERIENCE_LEVELS) {
      for (const timeAvailable of TIMES) {
        for (const situation of SITUATIONS) {
          for (let n = 0; n < 4; n++) {
            const { gaps } = generateLibrarySession({
              sessionType,
              equipment,
              readiness: readinessFor(timeAvailable, situation),
              profile: profileFor(level),
              sessionTypeCount: n,
              strengthSessionCount: 12,
              daysSinceLastSession: null,
            });
            for (const gap of gaps ?? []) {
              gapRows.push({
                where: `${sessionType} / ${equipment.join('+') || 'nothing'} / ${level} / ${timeAvailable} min`,
                gap,
                empty:
                  slotPool(gap.pattern, levelCeilingFor(profileFor(level)), equipment).length === 0,
              });
            }
          }
        }
      }
    }
  }
}
const generic = gapRows.filter((r) => r.gap.line.includes("made it into today's session"));
check(
  `the sweep produced gap lines to read at all (${gapRows.length} lines over ${sessions} sessions)`,
  gapRows.length > 100,
  'nothing came up short anywhere, so the three checks below prove nothing'
);
check(
  'every one of them names a reason, so no slot the relaxation filled goes unexplained',
  generic.length === 0,
  `${generic.length} fell through to the generic sentence, e.g. ${generic.slice(0, 3).map((r) => `${r.where}: ${r.gap.line}`).join(' | ')}`
);
/**
 * The sentence has to agree with the library at the person's own rung, in both
 * directions. Over this sweep every gap is a screening gap rather than an empty
 * shelf, so the whole 1,112 exercise the "was safe" side - swap the ceiling in
 * `noteMissing` for the accessory cap, or pin one sentence, and this goes red.
 */
const wrongSentence = gapRows.filter(
  (r) => r.empty !== r.gap.line.includes('matches your level and your kit')
);
check(
  `and the reason it names agrees with what the library holds at their own level (${gapRows.filter((r) => r.empty).length} empty-shelf, ${gapRows.filter((r) => !r.empty).length} screened out)`,
  wrongSentence.length === 0,
  wrongSentence
    .slice(0, 5)
    .map((r) => `${r.where}: shelf ${r.empty ? 'empty' : 'stocked'} but says "${r.gap.line}"`)
    .join(' | ')
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[7] And the rest the new mix earns, which is the other half of this');
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The previous step made rest follow the MOVEMENT rather than the slot, on the
 * measurement that 60% of what lands in an accessory slot is a record the
 * library calls a main lift. Making accessories a rung easier does not change
 * that share much - an easier main-lift record is still a main-lift record -
 * so the two rules together give a compound two minutes and isolation one,
 * which is exactly what they were each written to do.
 */
const restSeconds = cards.map((c) =>
  restSecondsForSet({ category: 'accessory', libraryRole: c.card.libraryRole, setKind: 'working' })
);
const share = (value) =>
  `${((restSeconds.filter((s) => s === value).length / restSeconds.length) * 100).toFixed(1)}%`;
check(
  `no accessory is given a main lift's three minutes (60s on ${share(60)}, 120s on ${share(120)})`,
  restSeconds.every((s) => s === 60 || s === 120),
  `other values: ${[...new Set(restSeconds.filter((s) => s !== 60 && s !== 120))].join('/')}`
);
check(
  'and both numbers are actually in use, so neither rule has quietly swallowed the other',
  restSeconds.some((s) => s === 60) && restSeconds.some((s) => s === 120),
  `values seen: ${[...new Set(restSeconds)].join('/')}`
);

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\naccessory-selection: ${failed === 0 ? `all ${passed} checks passed` : `${failed}/${passed + failed} check(s) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
