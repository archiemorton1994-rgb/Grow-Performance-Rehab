/**
 * Contract test: the library session builder, swept and then lived through.
 *
 * WHY THIS EXISTS
 * ───────────────
 * `generateLibrarySession` is the thing that decides what a person is asked to
 * do. Every way it can be wrong is silent and most of them are invisible in one
 * example: a level ceiling that leaks upward hands a brand-new beginner a depth
 * jump and still returns a perfectly ordinary-looking session; a kit filter that
 * forgets a requirement prescribes a barbell to somebody with a kitchen floor;
 * a pain screen that runs after the pick rather than before it quietly refills
 * the session out of the OLD catalogue, which is the list this whole rebuild is
 * removing.
 *
 * So nothing here greps the source. Every assertion runs the real generator
 * over a sweep of real answers and reads what comes back, and the last section
 * plays a real progression loop through the real store.
 *
 * THE SWEEP
 * ─────────
 * Three session types x seven equipment answers (with and without the bench
 * value) x four experience levels x three session lengths x three energies x
 * six pain situations (none, plus five areas reported today, carried since
 * sign-up or named by a clinician, at three severities) x twelve sessions of
 * history. Roughly fifty thousand sessions, every one of them checked for:
 *
 *   [1] only library, conditioning or Restore names
 *   [2] no exercise above the person's level ceiling
 *   [3] no exercise they have not got the kit for
 *   [4] no movement carrying a tag today's areas rule out
 *   [5] nothing thrown, and a session that is actually a session
 *   [6] no high impact and no skipping for a beginner
 *   [7] every Upper Body session contains a pull, or declares the gap
 *
 * Then, separately:
 *
 *   [8]  the same answers build the same session twice
 *   [9]  the main exercise changes about once in four sessions, not every one
 *   [10] the level window widens DOWNWARD and stops at MIN_SLOT_POOL
 *   [11] the shape of the session: pulse raiser, mobility count, power, finisher
 *   [12] sets, and the first-time load's age factor
 *   [13] a progression round trip: reps climb, then the weight goes up, a stall
 *        deloads on the third failure, and time away eases the weight back
 *   [14] the same rules re-asked through the real generateWorkout door, for
 *        every session type that has actually been switched over
 *   [15] where a session cannot fill its slots from Archie's list, written down
 *        exactly so it can neither creep nor be absorbed in silence
 *
 * Run:  npx tsx tests/train-library.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { useAppStore, EXPERIENCE_LEVELS } from '../lib/store.ts';
import {
  CONDITIONING_EXERCISES,
  LIBRARY_EXERCISES,
  patternsOf,
} from '../lib/exercise-library.ts';
import { canPerformWith } from '../lib/kit.ts';
import {
  RESTRICTED_BY_REGION,
  restrictedTagsFor,
  restrictedTagsOn,
  restrictedTagsOnRecord,
  stressTagsForRecord,
} from '../lib/exercise-safety.ts';
import {
  getCooldown,
  getRegionPrehabWorkout,
  getStandalonePrehabWorkout,
  possibleFor,
} from '../lib/exercise-db.ts';
import {
  MIN_SLOT_POOL,
  NO_KIT_PULL,
  SLOT_COUNTS,
  ageLoadFactor,
  generateLibrarySession,
  levelCeilingFor,
  mobilityCountFor,
  slotPool,
} from '../lib/library-session.ts';
import {
  LAYOFF_GRACE_DAYS,
  LIBRARY_LIVE_TYPES,
  generateWorkout,
} from '../lib/workout-engine.ts';
import { nextAnchorKg } from '../lib/auto-regulation.ts';
import { parseReps } from '../lib/rep-scheme.ts';

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

// ── What the generator is ALLOWED to reach for ───────────────────────────────
// Built by asking the three lists themselves, so a record renamed in any of
// them moves this set with it rather than leaving the check pinned to a
// spelling that no longer exists.
const libraryByKey = new Map(LIBRARY_EXERCISES.map((e) => [key(e.name), e]));
const conditioningByKey = new Map(CONDITIONING_EXERCISES.map((e) => [key(e.name), e]));
const ALL_REGIONS = Object.keys(RESTRICTED_BY_REGION);
const restoreTemplates = [
  ...getStandalonePrehabWorkout(),
  ...getCooldown(),
  ...ALL_REGIONS.flatMap((r) => getRegionPrehabWorkout(r, { acute: true })),
];
const restoreByKey = new Map(restoreTemplates.map((t) => [key(t.name), t]));

console.log('\n[0] The lists this session may draw on');
check(
  'the library, the nine conditioning records and Restore are all non-empty',
  libraryByKey.size > 100 && conditioningByKey.size === 9 && restoreByKey.size > 20,
  `${libraryByKey.size} library, ${conditioningByKey.size} conditioning, ${restoreByKey.size} Restore`
);
check(
  `${NO_KIT_PULL} is a real pull record that needs no equipment`,
  (() => {
    const record = LIBRARY_EXERCISES.find((e) => e.libraryName === NO_KIT_PULL);
    return !!record && patternsOf(record).includes('pull') && canPerformWith(record, []);
  })(),
  'decision 4: the only pulling exercise anybody without kit has'
);

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
const ENERGIES = ['low', 'normal', 'high'];
/**
 * Six situations, covering all three ways an area reaches the generator: today's
 * readiness answer, the areas carried since sign-up, and the ones a clinician
 * named. The last two are the pair that were collected, stored, synced and read
 * by nothing for a long time.
 */
const SITUATIONS = [
  { label: 'nothing sore', regions: [], where: 'today', severity: 'mild' },
  { label: 'knee today, mild', regions: ['knee'], where: 'today', severity: 'mild' },
  {
    label: 'front shoulder today, moderate',
    regions: ['front_shoulder'],
    where: 'today',
    severity: 'moderate',
  },
  { label: 'lower back today, severe', regions: ['lower_back'], where: 'today', severity: 'severe' },
  { label: 'hamstrings since sign-up', regions: ['hamstrings'], where: 'standing', severity: 'mild' },
  {
    label: 'ankle and wrist named by a clinician',
    regions: ['ankle_achilles', 'wrist'],
    where: 'clinical',
    severity: 'mild',
  },
];
const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
/**
 * The stored id that means each of these sessions, for section [14].
 *
 * Years of history, everything the server has synced and every frozen programme
 * cycle are tagged with these three, and they arrive at the same door. Written
 * as a table so that a type with no lift-named ancestor simply has none.
 */
const LEGACY_FOR_TRAIN_TYPE = {
  lower_body: 'squat',
  upper_body: 'bench',
  full_body: 'deadlift',
};

function profileFor(level, situation, extra = {}) {
  return {
    name: 'Sweep',
    sex: 'female',
    experienceLevel: level,
    goals: ['muscle'],
    bodyweightKg: 72,
    ageYears: 34,
    standingSoreRegions: situation.where === 'standing' ? situation.regions : [],
    clinicalAvoid: situation.where === 'clinical' ? situation.regions : [],
    ...extra,
  };
}

function readinessFor(situation, duration, energy) {
  const today = situation.where === 'today' ? situation.regions : [];
  return {
    hasAches: today.length > 0,
    painRegion: today.length > 0 ? today : undefined,
    painSeverity: situation.severity,
    acute: today.length > 0,
    energy,
    timeAvailable: duration,
  };
}

/** Aggregated so fifty thousand sessions produce one line per rule, not fifty thousand. */
const violations = {
  offList: [],
  aboveCeiling: [],
  wrongKit: [],
  bannedTag: [],
  threw: [],
  empty: [],
  beginnerImpact: [],
  upperPull: [],
  repeated: [],
};
let swept = 0;

for (const sessionType of SESSION_TYPES) {
  for (const equipment of KITS) {
    for (const level of EXPERIENCE_LEVELS) {
      for (const duration of DURATIONS) {
        for (const energy of ENERGIES) {
          for (const situation of SITUATIONS) {
            const profile = profileFor(level, situation);
            const readiness = readinessFor(situation, duration, energy);
            const ceiling = levelCeilingFor(profile);
            const banned = restrictedTagsFor(
              [
                ...new Set([
                  ...(readiness.painRegion ?? []),
                  ...profile.standingSoreRegions,
                  ...profile.clinicalAvoid,
                ]),
              ],
              level,
              situation.severity
            );
            for (const seed of SEEDS) {
              const where = `${sessionType} / ${equipment.join('+') || 'nothing'} / ${level} / ${duration} min / ${energy} / ${situation.label} / session ${seed}`;
              let session;
              try {
                session = generateLibrarySession({
                  sessionType,
                  equipment,
                  readiness,
                  profile,
                  sessionTypeCount: seed,
                  strengthSessionCount: seed,
                  daysSinceLastSession: null,
                });
              } catch (err) {
                violations.threw.push(`${where}: ${err && err.message}`);
                continue;
              }
              swept++;
              const { exercises, gaps } = session;

              // [5] A session is a session.
              if (exercises.length < 3) violations.empty.push(`${where}: ${exercises.length} cards`);

              let hasPull = false;
              /**
               * The session draws on three lists written at different times, and
               * they do not spell everything the same way. Restore has a "Dead
               * Bug" and the library has a "Deadbug"; both have a Glute Bridge.
               * Two cards for one movement is the warm-up and the work asking
               * for the same thing twice.
               */
              const seenMovements = new Set();
              for (const ex of exercises) {
                const k = key(ex.name);
                if (seenMovements.has(k)) violations.repeated.push(`${where}: ${ex.name} twice`);
                seenMovements.add(k);
                const lib = libraryByKey.get(k);
                const cond = conditioningByKey.get(k);
                const restore = restoreByKey.get(k);

                // [1] Only the three approved lists.
                if (!lib && !cond && !restore) {
                  violations.offList.push(`${where}: ${ex.name}`);
                  continue;
                }
                // [2] Never above the ceiling. Restore and conditioning have no
                //     level, and are not meant to: a rehab drill is not a rung
                //     of the strength ladder.
                if (lib && lib.level > ceiling) {
                  violations.aboveCeiling.push(`${where}: ${ex.name} is level ${lib.level}`);
                }
                if (lib && patternsOf(lib).includes('pull')) hasPull = true;
                // [3] Kit honoured, asked of whichever list owns the record.
                const possible = lib || cond
                  ? canPerformWith(lib ?? cond, equipment)
                  : possibleFor([restore], equipment.length > 0 ? equipment : ['bodyweight'])
                      .length === 1;
                if (!possible) violations.wrongKit.push(`${where}: ${ex.name}`);
                // [4] Nothing carrying a tag today's areas rule out. The rehab
                //     slot is exempt, as it is everywhere else in the app: it is
                //     chosen FOR the sore area, and screening it removes the
                //     treatment because it mentions the injury.
                if (ex.category !== 'prehab' && banned.size > 0) {
                  const hits = new Set([
                    ...restrictedTagsOn(ex.name, banned, undefined, ex.cue),
                    ...(lib || cond ? restrictedTagsOnRecord(lib ?? cond, banned) : []),
                  ]);
                  if (hits.size > 0) {
                    violations.bannedTag.push(`${where}: ${ex.name} carries ${[...hits].join(', ')}`);
                  }
                }
                // [6] A beginner is never landed on, and never skips.
                if (level === 'beginner') {
                  const record = lib ?? cond ?? restore;
                  if (stressTagsForRecord(record).includes('high_impact')) {
                    violations.beginnerImpact.push(`${where}: ${ex.name}`);
                  }
                }
              }
              // [7] An Upper Body session pulls, or says why it does not.
              if (sessionType === 'upper_body' && !hasPull && !gaps.some((g) => g.pattern === 'pull')) {
                violations.upperPull.push(where);
              }
            }
          }
        }
      }
    }
  }
}

console.log(`\n[1-7] ${swept.toLocaleString('en-GB')} sessions swept`);
const noneOf = (list, label, why) =>
  check(label, list.length === 0, list.length === 0 ? '' : `${list.length} of ${swept}, e.g. ${list[0]}${why ? ` — ${why}` : ''}`);

noneOf(violations.threw, 'nothing throws, whatever the answers');
noneOf(violations.empty, 'every session has something in it');
noneOf(
  violations.offList,
  'every exercise comes from the library, the nine conditioning records or Restore',
  'anything else means the old catalogue has leaked back in'
);
noneOf(
  violations.aboveCeiling,
  'nothing is ever prescribed above the level the person has reached',
  'the ceiling is the only thing keeping a beginner off a depth jump'
);
noneOf(violations.wrongKit, 'nothing is prescribed that the person has not got the kit for');
noneOf(
  violations.bannedTag,
  'nothing carries a stress today’s sore areas rule out',
  'screening has to happen before the pick, not after it'
);
noneOf(
  violations.beginnerImpact,
  'a beginner is given no high-impact work at all, sore or not (decision 7)'
);
noneOf(violations.upperPull, 'every Upper Body session contains a pull or declares the gap');
noneOf(
  violations.repeated,
  'no movement is asked for twice in one session, however the three lists spell it'
);

// ── [8] The same answers build the same session ──────────────────────────────
console.log('\n[8] Deterministic: no clock, no shuffle, no day index');
{
  const differing = [];
  for (const sessionType of SESSION_TYPES) {
    for (const equipment of [KITS[1], KITS[4], KITS[6]]) {
      for (const level of EXPERIENCE_LEVELS) {
        for (const seed of [0, 3, 7, 11]) {
          const input = {
            sessionType,
            equipment,
            readiness: readinessFor(SITUATIONS[1], '60', 'normal'),
            profile: profileFor(level, SITUATIONS[1]),
            sessionTypeCount: seed,
            strengthSessionCount: seed,
            daysSinceLastSession: null,
          };
          const a = JSON.stringify(generateLibrarySession(input));
          const b = JSON.stringify(generateLibrarySession(input));
          if (a !== b) differing.push(`${sessionType}/${level}/${seed}`);
        }
      }
    }
  }
  check('built twice from the same answers, the session is identical', differing.length === 0, differing.join(', '));
}

// ── [9] The main exercise is the one that holds still ────────────────────────
console.log('\n[9] The main exercise changes about once in four sessions');
{
  /**
   * ASKED PER MOVEMENT PATTERN, WHICH IS THE ONLY WAY THE QUESTION MEANS
   * ANYTHING.
   *
   * The slot lists alternate, so a Lower Body day leads on a squat one session
   * and a hinge the next, by design and by the plan. The thing that must hold
   * still is the SQUAT somebody is progressing, not the pattern that happens to
   * be first. So the mains are grouped by the pattern they belong to, and each
   * group is asked whether the exercise inside it stays put.
   */
  const tooOften = [];
  for (const sessionType of SESSION_TYPES) {
    for (const equipment of [KITS[3], KITS[6]]) {
      for (const level of EXPERIENCE_LEVELS) {
        const byPattern = new Map();
        const mains = [];
        for (let n = 0; n < 12; n++) {
          const s = generateLibrarySession({
            sessionType,
            equipment,
            readiness: readinessFor(SITUATIONS[0], '60', 'normal'),
            profile: profileFor(level, SITUATIONS[0]),
            sessionTypeCount: n,
            strengthSessionCount: n,
            daysSinceLastSession: null,
          });
          const main = s.exercises.find((e) => e.category === 'main');
          const record = main && libraryByKey.get(key(main.name));
          const pattern = record ? record.pattern : '-';
          mains.push(`${pattern}:${main ? main.name : '-'}`);
          if (!byPattern.has(pattern)) byPattern.set(pattern, []);
          byPattern.get(pattern).push(main ? main.name : '-');
        }
        for (const [pattern, seen] of byPattern) {
          let changes = 0;
          for (let i = 1; i < seen.length; i++) if (seen[i] !== seen[i - 1]) changes++;
          /**
           * THREE, WRITTEN OUT, NOT DERIVED FROM MAIN_ROTATION_EVERY.
           *
           * It was derived, and that made the check worthless: setting the
           * constant to 1 - a main exercise that changes EVERY session, the
           * exact failure this section exists to catch - moved the allowance to
           * twelve and the check stayed green. A test that recomputes its
           * expectation from the thing it is testing cannot fail.
           *
           * The claim is about what a lifter experiences: over twelve sessions
           * the movement they are progressing changes about three times, not
           * eleven. That number is the claim, so it is the number here.
           */
          if (changes > 3) {
            tooOften.push(
              `${sessionType}/${equipment.join('+')}/${level}/${pattern}: ${changes} changes (${mains.join(' -> ')})`
            );
          }
        }
      }
    }
  }
  check(
    'over twelve sessions the main exercise for a pattern changes no more than three times',
    tooOften.length === 0,
    tooOften[0]
  );
  // And it does move: a main lift frozen for ever is the other failure.
  const moved = (() => {
    const seen = new Set();
    for (let n = 0; n < 12; n++) {
      const s = generateLibrarySession({
        sessionType: 'lower_body',
        equipment: ['fullgym'],
        readiness: readinessFor(SITUATIONS[0], '60', 'normal'),
        profile: profileFor('intermediate', SITUATIONS[0]),
        sessionTypeCount: n,
        strengthSessionCount: n,
        daysSinceLastSession: null,
      });
      seen.add((s.exercises.find((e) => e.category === 'main') ?? {}).name);
    }
    return seen.size;
  })();
  check('and it does change: twelve sessions are not all the same lift', moved > 1, `${moved} distinct`);
}

// ── [10] The level window widens downward and never up ───────────────────────
console.log('\n[10] The level window');
{
  const above = [];
  const tooNarrow = [];
  for (const pattern of ['push', 'pull', 'hinge', 'squat', 'lunge', 'core']) {
    for (const ceiling of [1, 2, 3, 4]) {
      const pool = slotPool(pattern, ceiling, ['fullgym']);
      if (pool.some((e) => e.level > ceiling)) above.push(`${pattern} at ${ceiling}`);
      if (pool.length < MIN_SLOT_POOL) tooNarrow.push(`${pattern} at ${ceiling}: ${pool.length}`);
    }
  }
  check('a pool never contains anything above the ceiling', above.length === 0, above.join(', '));
  check(
    `with a full gym every pattern reaches ${MIN_SLOT_POOL} choices at every level`,
    tooNarrow.length === 0,
    tooNarrow.join(', ')
  );
  // The widening is what makes that true, and it only goes one way.
  const athleteLunge = slotPool('lunge', 4, ['fullgym']);
  check(
    'an Athlete lunge slot drops to Advanced rather than coming up empty',
    athleteLunge.length >= MIN_SLOT_POOL && athleteLunge.every((e) => e.level <= 4),
    `${athleteLunge.length} options, levels ${[...new Set(athleteLunge.map((e) => e.level))].join('/')}`
  );
  const beginnerSquat = slotPool('squat', 1, ['fullgym']);
  check(
    'a Beginner squat slot stays at Beginner even though it is short of three',
    beginnerSquat.every((e) => e.level === 1),
    `levels ${[...new Set(beginnerSquat.map((e) => e.level))].join('/')}`
  );
  check(
    'and the ceiling itself is the experience answer plus what has been earned, stopping below Athlete',
    levelCeilingFor({ experienceLevel: 'beginner' }) === 1 &&
      levelCeilingFor({ experienceLevel: 'beginner', earnedLevelBonus: 1 }) === 2 &&
      /**
       * SAME CLINICAL RULE, TIGHTER. This used to read `advanced + 5 === 4`,
       * from when the only cap was the top of the library. Decision 8 puts
       * jumps, throws and depth work behind the Athlete answer, which is
       * something a person says about themselves, so earned rungs now stop one
       * below it however many of them there are. Athlete itself is unchanged.
       */
      levelCeilingFor({ experienceLevel: 'advanced', earnedLevelBonus: 5 }) === 3 &&
      levelCeilingFor({ experienceLevel: 'athlete' }) === 4,
    `beginner ${levelCeilingFor({ experienceLevel: 'beginner' })}, beginner+1 ${levelCeilingFor({ experienceLevel: 'beginner', earnedLevelBonus: 1 })}, advanced+5 ${levelCeilingFor({ experienceLevel: 'advanced', earnedLevelBonus: 5 })}, athlete ${levelCeilingFor({ experienceLevel: 'athlete' })}`
  );
}

// ── [11] The shape of the session ────────────────────────────────────────────
console.log('\n[11] The shape: pulse raiser, mobility, power, finisher, cool-down');
{
  const build = (over = {}) =>
    generateLibrarySession({
      sessionType: 'full_body',
      equipment: ['fullgym'],
      readiness: readinessFor(SITUATIONS[0], '60', 'normal'),
      profile: profileFor('intermediate', SITUATIONS[0]),
      sessionTypeCount: 0,
      strengthSessionCount: 0,
      daysSinceLastSession: null,
      ...over,
    });

  const full = build();
  check(
    'it opens on a conditioning item at an easy pace',
    conditioningByKey.has(key(full.exercises[0].name)) &&
      full.exercises[0].category === 'prep' &&
      /easy/i.test(full.exercises[0].suggestedLoad),
    `${full.exercises[0].name} / ${full.exercises[0].suggestedLoad}`
  );
  const mobilityOf = (s) =>
    s.exercises.filter((e) => e.category === 'prep' && restoreByKey.has(key(e.name))).length;
  for (const [duration, expected] of [
    ['30', 1],
    ['45', 2],
    ['60', 2],
  ]) {
    const s = build({ readiness: readinessFor(SITUATIONS[0], duration, 'normal') });
    check(
      `${duration} minutes gets ${expected} mobility drill(s)`,
      mobilityOf(s) === expected && mobilityCountFor(duration, 34) === expected,
      `${mobilityOf(s)}`
    );
  }
  const older = build({
    readiness: readinessFor(SITUATIONS[0], '45', 'normal'),
    profile: profileFor('intermediate', SITUATIONS[0], { ageYears: 56 }),
  });
  check(
    'from fifty the 45 minute session keeps a third mobility drill',
    mobilityOf(older) === 3,
    `${mobilityOf(older)}`
  );

  const athlete = build({ profile: profileFor('athlete', SITUATIONS[0]) });
  check(
    'an Athlete gets a power block, and it is a jump or a throw',
    (() => {
      const power = athlete.exercises.find((e) => e.category === 'neuro');
      const record = power && libraryByKey.get(key(power.name));
      return !!record && record.role === 'power' && record.level === 4 && power.sets === 4;
    })(),
    (athlete.exercises.find((e) => e.category === 'neuro') ?? {}).name ?? 'no power block'
  );
  for (const level of ['beginner', 'intermediate', 'advanced']) {
    const s = build({ profile: profileFor(level, SITUATIONS[0]) });
    check(
      `${level} gets no power block and nothing in its place (decision 8)`,
      !s.exercises.some((e) => e.category === 'neuro') &&
        !s.exercises.some((e) => (libraryByKey.get(key(e.name)) ?? {}).role === 'power')
    );
  }
  const athlete30 = build({
    profile: profileFor('athlete', SITUATIONS[0]),
    readiness: readinessFor(SITUATIONS[0], '30', 'normal'),
  });
  check(
    'and not in the half hour session, where it would cost a movement',
    !athlete30.exercises.some((e) => e.category === 'neuro')
  );

  const hasFinisher = (s) => s.exercises.some((e) => e.category === 'finisher');
  check('60 minutes ends on a finisher', hasFinisher(build()));
  check(
    '45 minutes does not, unless the goal asks for it',
    !hasFinisher(build({ readiness: readinessFor(SITUATIONS[0], '45', 'normal') })) &&
      hasFinisher(
        build({
          readiness: readinessFor(SITUATIONS[0], '45', 'normal'),
          profile: profileFor('intermediate', SITUATIONS[0], { goals: ['fat_loss'] }),
        })
      ) &&
      hasFinisher(
        build({
          readiness: readinessFor(SITUATIONS[0], '45', 'normal'),
          profile: profileFor('intermediate', SITUATIONS[0], { goals: ['fitness'] }),
        })
      )
  );
  check(
    'the finisher is added on top and never takes a strength slot',
    (() => {
      const withOut = build({ readiness: readinessFor(SITUATIONS[0], '45', 'normal') });
      const withIt = build({
        readiness: readinessFor(SITUATIONS[0], '45', 'normal'),
        profile: profileFor('intermediate', SITUATIONS[0], { goals: ['fat_loss'] }),
      });
      const work = (s) => s.exercises.filter((e) => e.category === 'main' || e.category === 'accessory').length;
      return work(withIt) === work(withOut) && hasFinisher(withIt);
    })()
  );

  check(
    'a beginner is never given skipping in the warm-up or the finisher (decision 7)',
    (() => {
      for (const duration of DURATIONS) {
        for (let n = 0; n < 12; n++) {
          const s = build({
            equipment: ['bodyweight'],
            profile: profileFor('beginner', SITUATIONS[0]),
            readiness: readinessFor(SITUATIONS[0], duration, 'normal'),
            sessionTypeCount: n,
          });
          if (s.exercises.some((e) => key(e.name) === key('Skipping'))) return false;
        }
      }
      return true;
    })()
  );

  check(
    '45 and 60 minutes close on a Restore cool-down; 30 minutes has no room',
    (() => {
      const closes = (d) => {
        const s = build({ readiness: readinessFor(SITUATIONS[0], d, 'normal') });
        const last = s.exercises[s.exercises.length - 1];
        return last.category === 'cooldown' && restoreByKey.has(key(last.name));
      };
      const thirty = build({ readiness: readinessFor(SITUATIONS[0], '30', 'normal') });
      return closes('45') && closes('60') && !thirty.exercises.some((e) => e.category === 'cooldown');
    })()
  );

  check(
    'a flagged area gets the gentlest rehab drill it has, whether it hurts today or was named at sign-up (decision 10)',
    (() => {
      const acuteFirst = getRegionPrehabWorkout('knee', { acute: true });
      for (const situation of [SITUATIONS[1], { ...SITUATIONS[1], where: 'standing' }, { ...SITUATIONS[1], where: 'clinical' }]) {
        const s = build({
          profile: profileFor('intermediate', situation),
          readiness: readinessFor(situation, '60', 'normal'),
        });
        const rehab = s.exercises.find((e) => e.category === 'prehab');
        if (!rehab) return false;
        // The acute list is ordered gentlest first and its head is what the
        // session takes. [0] is the shared warm-up, so [1] is the first drill.
        if (key(rehab.name) !== key(acuteFirst[1].name)) return false;
      }
      return true;
    })(),
    'a standing area must keep getting the acute drill, not the fuller maintenance work'
  );
  check(
    'and no rehab slot at all when nothing is flagged',
    !build().exercises.some((e) => e.category === 'prehab')
  );

  check(
    'the first slot filled is the main exercise and the rest are accessories',
    (() => {
      const cats = full.exercises
        .filter((e) => e.category === 'main' || e.category === 'accessory')
        .map((e) => e.category);
      return cats.length > 1 && cats[0] === 'main' && cats.slice(1).every((c) => c === 'accessory');
    })(),
    full.exercises.map((e) => e.category).join(',')
  );

  check(
    `somebody with no kit at all still gets a pull, because ${NO_KIT_PULL} needs none (decision 4)`,
    (() => {
      const missing = [];
      for (const level of EXPERIENCE_LEVELS) {
        for (const duration of DURATIONS) {
          for (let n = 0; n < 4; n++) {
            const s = build({
              sessionType: 'upper_body',
              equipment: ['bodyweight'],
              profile: profileFor(level, SITUATIONS[0]),
              readiness: readinessFor(SITUATIONS[0], duration, 'normal'),
              sessionTypeCount: n,
            });
            const pulls = s.exercises.filter((e) => {
              const record = libraryByKey.get(key(e.name));
              return record && patternsOf(record).includes('pull');
            });
            if (pulls.length === 0) missing.push(`${level}/${duration}/${n}`);
          }
        }
      }
      return missing.length === 0;
    })(),
    'a declared gap is honest, but there is an exercise for this and it has to be reached'
  );

  check(
    'a gap names the pattern and says what kit would open more up',
    (() => {
      // Nobody at home has an Advanced squat or hinge, which is the honest
      // answer the plan sheet has to print rather than hide.
      const s = build({
        equipment: ['bodyweight'],
        sessionType: 'lower_body',
        profile: profileFor('advanced', SITUATIONS[0]),
      });
      if (s.gaps.length === 0) return true; // nothing to declare is also valid
      return s.gaps.every(
        (g) => typeof g.pattern === 'string' && g.line.length > 20 && /\.$/.test(g.line.trim())
      );
    })()
  );
}

// ── [12] Sets, and the first weight ──────────────────────────────────────────
console.log('\n[12] Sets by level and goal, and the age factor on a first weight');
{
  const setsFor = (level, over = {}) => {
    const s = generateLibrarySession({
      sessionType: 'lower_body',
      equipment: ['fullgym'],
      readiness: readinessFor(SITUATIONS[0], '60', 'normal'),
      profile: profileFor(level, SITUATIONS[0], { goals: ['fitness'], ...over.profile }),
      sessionTypeCount: 0,
      strengthSessionCount: 0,
      daysSinceLastSession: null,
      ...over.input,
    });
    const main = s.exercises.find((e) => e.category === 'main');
    const acc = s.exercises.find((e) => e.category === 'accessory');
    return { main: main.sets, acc: acc.sets };
  };
  check('a beginner starts at two sets', setsFor('beginner').main === 2, JSON.stringify(setsFor('beginner')));
  check('an intermediate at three', setsFor('intermediate').main === 3, JSON.stringify(setsFor('intermediate')));
  check(
    'advanced and athlete at three, with four on the main exercise',
    setsFor('advanced').main === 4 &&
      setsFor('advanced').acc === 3 &&
      setsFor('athlete').main === 4 &&
      setsFor('athlete').acc === 3,
    `${JSON.stringify(setsFor('advanced'))} / ${JSON.stringify(setsFor('athlete'))}`
  );
  check(
    'a strength goal adds a set to the main exercise and takes one off the accessories',
    (() => {
      const plain = setsFor('intermediate');
      const strength = setsFor('intermediate', { profile: { goals: ['strength'] } });
      return strength.main === plain.main + 1 && strength.acc === plain.acc - 1;
    })()
  );
  check(
    'a low-energy day takes a set off and a high-energy day adds one, inside 2 to 5',
    (() => {
      const low = generateLibrarySession({
        sessionType: 'lower_body',
        equipment: ['fullgym'],
        readiness: readinessFor(SITUATIONS[0], '60', 'low'),
        profile: profileFor('advanced', SITUATIONS[0], { goals: ['fitness'] }),
        sessionTypeCount: 0,
        daysSinceLastSession: null,
      });
      const high = generateLibrarySession({
        sessionType: 'lower_body',
        equipment: ['fullgym'],
        readiness: readinessFor(SITUATIONS[0], '60', 'high'),
        profile: profileFor('advanced', SITUATIONS[0], { goals: ['fitness'] }),
        sessionTypeCount: 0,
        daysSinceLastSession: null,
      });
      const mainOf = (s) => s.exercises.find((e) => e.category === 'main').sets;
      const every = (s) =>
        s.exercises
          .filter((e) => e.category === 'main' || e.category === 'accessory')
          .every((e) => e.sets >= 2 && e.sets <= 5);
      return mainOf(low) === 3 && mainOf(high) === 5 && every(low) && every(high);
    })()
  );

  /**
   * Upper or lower is answered PER EXERCISE, from the pattern it is filed under.
   *
   * It matters most to the person it is least fair to: the female factor is
   * 0.55 on upper body work and 0.72 on lower. Answered per SESSION, as the old
   * engine answers it, every movement in a full body session is treated as
   * upper body and a woman's first squat comes out a fifth light. So the two
   * halves have to come out at different ratios, and the lower one has to be
   * the heavier share.
   */
  {
    /**
     * Read as the RATIO between two people who differ only in the answer to the
     * sex question, which is the one number the factor actually is. Only cards
     * heavy enough that the 2.5 kg grid cannot blur a 0.55 into a 0.72 are
     * counted: at fifteen kilos both round to ten.
     */
    const ratios = { upper: [], lower: [] };
    for (const sessionType of SESSION_TYPES) {
      for (const level of EXPERIENCE_LEVELS) {
        for (let n = 0; n < 4; n++) {
          const forSex = (sex) =>
            generateLibrarySession({
              sessionType,
              equipment: ['fullgym'],
              readiness: readinessFor(SITUATIONS[0], '60', 'normal'),
              profile: {
                ...profileFor(level, SITUATIONS[0]),
                sex,
                bodyweightKg: 80,
                goals: ['muscle'],
              },
              sessionTypeCount: n,
              strengthSessionCount: n,
              daysSinceLastSession: null,
            });
          const female = forSex('female').exercises;
          const male = forSex('male').exercises;
          for (let i = 0; i < male.length; i++) {
            const record = libraryByKey.get(key(male[i].name));
            if (!record || male[i].name !== female[i].name) continue;
            const mk = (male[i].loadKg ?? [])[0];
            const fk = (female[i].loadKg ?? [])[0];
            if (!mk || !fk || mk < 30) continue;
            const half = record.pattern === 'push' || record.pattern === 'pull' ? 'upper' : 'lower';
            ratios[half].push(fk / mk);
          }
        }
      }
    }
    check(
      'a woman’s first weight is scaled by the half of the body the EXERCISE loads, not the session',
      ratios.upper.length > 0 &&
        ratios.lower.length > 0 &&
        Math.max(...ratios.upper) < 0.65 &&
        Math.min(...ratios.lower) > 0.62,
      `upper ${ratios.upper.length} cards, worst ${Math.max(...ratios.upper).toFixed(3)}; lower ${ratios.lower.length} cards, worst ${Math.min(...ratios.lower).toFixed(3)}` +
        ' — a full body session treated as one half of the body prescribes a woman her squat at bench-press scale'
    );
  }

  // The age factor: lighter first weights, and never a lighter LOGGED weight.
  check(
    'the age factor is the plan’s: under 18 x0.85, 50-59 x0.9, 60+ x0.8, otherwise nothing',
    ageLoadFactor(16) === 0.85 &&
      ageLoadFactor(30) === 1 &&
      ageLoadFactor(55) === 0.9 &&
      ageLoadFactor(65) === 0.8 &&
      ageLoadFactor(undefined) === 1
  );
  const firstWeightAt = (ageYears, lastLoggedWeights) => {
    const s = generateLibrarySession({
      sessionType: 'lower_body',
      equipment: ['fullgym'],
      readiness: readinessFor(SITUATIONS[0], '60', 'normal'),
      profile: profileFor('intermediate', SITUATIONS[0], { ageYears }),
      sessionTypeCount: 0,
      strengthSessionCount: 0,
      daysSinceLastSession: null,
      lastLoggedWeights,
    });
    const main = s.exercises.find((e) => e.category === 'main');
    return { id: main.id, kg: (main.loadKg ?? [])[0] ?? null };
  };
  const young = firstWeightAt(34);
  const old = firstWeightAt(65);
  check(
    'a 65 year old’s first weight on a movement they have never done is lighter than a 34 year old’s',
    young.kg !== null && old.kg !== null && old.kg < young.kg,
    `${young.kg} kg vs ${old.kg} kg`
  );
  check(
    'but a weight they have actually lifted is not touched by their age',
    (() => {
      const logged = { [young.id]: 60 };
      const a = firstWeightAt(34, logged);
      const b = firstWeightAt(65, logged);
      return a.id === b.id && a.kg === b.kg && a.kg > 60;
    })(),
    'progression reads a logged weight before the estimate is ever reached'
  );
}

// ── [13] A progression round trip through the real store ─────────────────────
console.log('\n[13] Reps climb, then the weight goes up; a stall deloads; time away eases');
{
  /**
   * Advanced on a full gym, because the main exercise has to be a loaded one.
   *
   * A 12.5 kg goblet squat cannot express a 10% deload on a 2.5 kg grid, so the
   * engine correctly holds rather than reporting a cut that did not happen -
   * true behaviour, and no way to see the rules being tested through it.
   */
  const baseProfile = {
    name: 'Round trip',
    sex: 'male',
    experienceLevel: 'advanced',
    goals: ['muscle'],
    bodyweightKg: 92,
    ageYears: 34,
    standingSoreRegions: [],
    clinicalAvoid: [],
  };
  const buildRoundTrip = (over = {}) => {
    const state = useAppStore.getState();
    return generateLibrarySession({
      sessionType: 'lower_body',
      equipment: ['fullgym'],
      readiness: { hasAches: false, energy: 'normal', timeAvailable: '60' },
      profile: { ...baseProfile, ...state.userProfile },
      sessionTypeCount: 0,
      strengthSessionCount: 0,
      daysSinceLastSession: null,
      lastLoggedWeights: state.lastLoggedWeights,
      exerciseNormalStreak: state.exerciseNormalStreak,
      exerciseStuckStreak: state.exerciseStuckStreak,
      lastSessionPerformance: state.lastSessionPerformance,
      exerciseRepTarget: state.exerciseRepTarget,
      exerciseFeedback: state.exerciseFeedback,
      ...over,
    });
  };
  /**
   * One session logged the way the session screen logs one.
   *
   * Both halves, in the same order: the weights that were actually lifted go to
   * `updateLastLoggedWeights` through `nextAnchorKg`, and the sets and the
   * prescription they were measured against go to `completeSession`. Doing only
   * the second is a round trip in which nobody ever lifts anything - the engine
   * keeps handing back its opening estimate, and every progression rule below
   * looks broken while being perfectly correct.
   */
  const logSession = (card, repsEach, completed, at) => {
    const lifted = card.sets > 0 && completed ? ((card.loadKg ?? [])[0] ?? 0) : 0;
    if (lifted > 0) {
      const previous = useAppStore.getState().lastLoggedWeights[card.id] ?? 0;
      useAppStore.getState().updateLastLoggedWeights({
        [card.id]: nextAnchorKg(lifted, previous, undefined),
      });
    }
    useAppStore.getState().completeSession({
      sessionType: 'lower_body',
      date: new Date(Date.parse('2026-06-01T09:00:00Z') + at * 3 * 86400000).toISOString(),
      equipmentTier: 'fullgym',
      hadAches: false,
      painRegions: [],
      energy: 'normal',
      timeAvailable: '60',
      exerciseCount: 1,
      durationSeconds: 3600,
      exerciseLogs: [
        {
          exerciseId: card.id,
          exerciseName: card.name,
          targetReps: card.reps,
          category: card.category,
          sets: Array.from({ length: card.sets }, () => ({
            weight: (card.loadKg ?? [])[0] ?? 0,
            reps: repsEach,
            completed,
            skipped: false,
          })),
        },
      ],
    });
  };

  useAppStore.getState().resetProgress();
  useAppStore.getState().setUserProfile(baseProfile);

  const opening = buildRoundTrip().exercises.find((e) => e.category === 'main');
  check(
    'the main exercise arrives with a countable rep range and a weight',
    !!parseReps(opening.reps) && ((opening.loadKg ?? [])[0] ?? 0) > 0,
    `${opening.name} ${opening.sets}x${opening.reps} at ${(opening.loadKg ?? [])[0]} kg`
  );

  const trail = [];
  for (let i = 0; i < 8; i++) {
    const card = buildRoundTrip().exercises.find((e) => e.id === opening.id);
    if (!card) break;
    const parsed = parseReps(card.reps);
    trail.push({ reps: card.reps, kg: (card.loadKg ?? [])[0] ?? 0 });
    // Every set finished, at the floor of whatever is being asked for today.
    logSession(card, parsed ? parsed.min : 10, true, i);
  }
  const startKg = trail[0].kg;
  const firstClimb = trail.findIndex((t) => t.reps !== trail[0].reps);
  const firstLift = trail.findIndex((t) => t.kg > startKg);
  console.log(`      ${trail.map((t) => `${t.reps}@${t.kg}kg`).join(' -> ')}`);
  check('the reps climb first', firstClimb > 0, trail.map((t) => t.reps).join(' -> '));
  check(
    'and the weight only moves after they have',
    firstLift > firstClimb,
    `reps moved at session ${firstClimb + 1}, weight at ${firstLift + 1}`
  );
  check(
    'the weight held while the reps were climbing',
    trail.slice(0, firstLift).every((t) => t.kg === startKg),
    trail.map((t) => t.kg).join(' -> ')
  );

  // A stall: three failed sessions in a row, and the third one backs it off.
  useAppStore.getState().resetProgress();
  useAppStore.getState().setUserProfile(baseProfile);
  const stallCard = buildRoundTrip().exercises.find((e) => e.category === 'main');
  logSession(stallCard, parseReps(stallCard.reps).min, true, 0);
  const stalled = [];
  for (let i = 0; i < 3; i++) {
    const card = buildRoundTrip().exercises.find((e) => e.id === stallCard.id);
    stalled.push((card.loadKg ?? [])[0] ?? 0);
    // A set left unfinished is a failed session.
    logSession(card, 1, false, i + 1);
  }
  const afterStall = (buildRoundTrip().exercises.find((e) => e.id === stallCard.id).loadKg ?? [])[0];
  stalled.push(afterStall);
  console.log(`      ${stalled.join(' -> ')} kg`);
  check(
    'two failures hold the weight',
    stalled[0] === stalled[1] && stalled[1] === stalled[2],
    stalled.join(' -> ')
  );
  check(
    'the third one backs it off, by about a tenth',
    stalled[3] < stalled[2] && (stalled[2] - stalled[3]) / stalled[2] >= 0.05,
    stalled.join(' -> ')
  );

  // Time away: the same history, eased.
  useAppStore.getState().resetProgress();
  useAppStore.getState().setUserProfile(baseProfile);
  const layoffCard = buildRoundTrip().exercises.find((e) => e.category === 'main');
  logSession(layoffCard, parseReps(layoffCard.reps).min, true, 0);
  const fresh = buildRoundTrip({ daysSinceLastSession: 0 }).exercises.find(
    (e) => e.id === layoffCard.id
  );
  const returning = buildRoundTrip({ daysSinceLastSession: LAYOFF_GRACE_DAYS + 25 }).exercises.find(
    (e) => e.id === layoffCard.id
  );
  check(
    'coming back after five weeks away is prescribed lighter than carrying straight on',
    (returning.loadKg ?? [])[0] < (fresh.loadKg ?? [])[0],
    `${(fresh.loadKg ?? [])[0]} kg fresh vs ${(returning.loadKg ?? [])[0]} kg returning`
  );
  check(
    'and the card says why rather than just moving the number',
    /week|day|away|fresh/i.test(returning.progressionNote ?? ''),
    returning.progressionNote
  );
  useAppStore.getState().resetProgress();
}

// ── [14] Through the door the app actually uses ──────────────────────────────
/**
 * EVERYTHING ABOVE CALLS `generateLibrarySession`. NOBODY IN THE APP DOES.
 *
 * The session screen calls `generateWorkout`, which is where the switch is
 * made, so a session type can be built perfectly by the library and still be
 * served out of the old catalogue because the routing was never made or was
 * made for a different id. That is the one failure the twelve sections above
 * cannot see, and it is silent: the session looks like a session.
 *
 * So this section re-asks the four rules that matter through the real door, for
 * every type the app says is live (LIBRARY_LIVE_TYPES, imported rather than
 * written down here, so the next type to be switched is swept the day it is),
 * and for the lift-named id that maps onto it. A stored 'squat' day out of
 * somebody's history has to come back as today's Lower Body session, not as a
 * near miss.
 *
 * AND FOR THE TYPES THAT HAVE ALREADY BEEN SWITCHED, WHICH ARE WRITTEN DOWN.
 * Reading the list from the app alone would make this section agree with it:
 * take Lower Body out of LIBRARY_LIVE_TYPES and every assertion below passes,
 * because nothing is swept. Each type is added to ALREADY_SWITCHED as its own
 * phase lands, so "a Lower Body session cannot contain an off-library name"
 * stays a promise the app has to keep rather than one it gets to withdraw.
 */
/** Switched over, one line per phase, and never taken out again. */
const ALREADY_SWITCHED = ['lower_body', 'upper_body', 'full_body'];
console.log('\n[14] generateWorkout serves the library for every live type');
{
  const offList = [];
  const aboveCeiling = [];
  const wrongKit = [];
  const bannedTagged = [];
  const legacyDiffers = [];
  const differsFromBuilder = [];
  let built = 0;

  /** What the card says it is, ignoring the swap slots the engine fills after. */
  const shapeOf = (list) =>
    list
      .map((e) => `${e.category}|${e.name}|${e.sets}|${e.reps}|${e.suggestedLoad ?? ''}`)
      .join('\n');

  const sweepTypes = [...new Set([...ALREADY_SWITCHED, ...LIBRARY_LIVE_TYPES])];
  for (const sessionType of sweepTypes) {
    const legacyFor = LEGACY_FOR_TRAIN_TYPE[sessionType];
    for (const equipment of KITS) {
      for (const level of EXPERIENCE_LEVELS) {
        for (const duration of DURATIONS) {
          for (const situation of SITUATIONS) {
            const profile = profileFor(level, situation);
            const readiness = readinessFor(situation, duration, 'normal');
            const ceiling = levelCeilingFor(profile);
            const banned = restrictedTagsFor(
              [
                ...new Set([
                  ...(readiness.painRegion ?? []),
                  ...profile.standingSoreRegions,
                  ...profile.clinicalAvoid,
                ]),
              ],
              level,
              situation.severity
            );
            for (const seed of [0, 1, 5, 11]) {
              const where = `${sessionType} / ${equipment.join('+') || 'nothing'} / ${level} / ${duration} min / ${situation.label} / session ${seed}`;
              // Exactly as app/session.tsx calls it: the single tier it resolved
              // for today, plus the whole owned set and the per-type count.
              const args = [
                equipment.length > 0 ? equipment[equipment.length - 1] : 'bodyweight',
                readiness,
                profile,
                undefined,
                undefined,
                seed,
                undefined,
                undefined,
                undefined,
                null,
                'kg',
                undefined,
                undefined,
                0,
                { equipment, sessionTypeCount: seed },
              ];
              const session = generateWorkout(sessionType, ...args);
              built++;

              for (const ex of session) {
                const k = key(ex.name);
                const lib = libraryByKey.get(k);
                const cond = conditioningByKey.get(k);
                const restore = restoreByKey.get(k);
                if (!lib && !cond && !restore) {
                  offList.push(`${where}: ${ex.name}`);
                  continue;
                }
                if (lib && lib.level > ceiling) {
                  aboveCeiling.push(`${where}: ${ex.name} is level ${lib.level}`);
                }
                const possible = lib || cond
                  ? canPerformWith(lib ?? cond, equipment)
                  : possibleFor([restore], equipment.length > 0 ? equipment : ['bodyweight'])
                      .length === 1;
                if (!possible) wrongKit.push(`${where}: ${ex.name}`);
                if (ex.category !== 'prehab' && banned.size > 0) {
                  const hits = new Set([
                    ...restrictedTagsOn(ex.name, banned, undefined, ex.cue),
                    ...(lib || cond ? restrictedTagsOnRecord(lib ?? cond, banned) : []),
                  ]);
                  if (hits.size > 0) {
                    bannedTagged.push(`${where}: ${ex.name} carries ${[...hits].join(', ')}`);
                  }
                }
              }

              // The lift-named id builds the same session, card for card.
              if (legacyFor) {
                const legacy = generateWorkout(legacyFor, ...args);
                if (shapeOf(legacy) !== shapeOf(session)) legacyDiffers.push(where);
              }

              // And it is the builder's session, not a rebuilt near-copy.
              const direct = generateLibrarySession({
                sessionType,
                equipment,
                readiness,
                profile,
                sessionTypeCount: seed,
                strengthSessionCount: seed,
                daysSinceLastSession: null,
              });
              if (shapeOf(direct.exercises) !== shapeOf(session)) differsFromBuilder.push(where);
            }
          }
        }
      }
    }
  }

  console.log(`      ${built.toLocaleString('en-GB')} sessions built through generateWorkout`);
  check(
    `every switched type really was swept (${sweepTypes.join(', ') || 'none'})`,
    sweepTypes.length > 0 && built > 1000,
    `${built} sessions built - nothing was generated, so this whole section proves nothing`
  );
  check(
    `and the app still says every one of them is live (${LIBRARY_LIVE_TYPES.join(', ') || 'none'})`,
    ALREADY_SWITCHED.every((t) => LIBRARY_LIVE_TYPES.includes(t)),
    `${ALREADY_SWITCHED.filter((t) => !LIBRARY_LIVE_TYPES.includes(t)).join(', ')} left LIBRARY_LIVE_TYPES, so the old catalogue is building a session that was switched over`
  );
  check(
    'nothing the app serves comes from anywhere but the library, the nine or Restore',
    offList.length === 0,
    `${offList.length} of ${built} sessions, e.g. ${offList[0]} — the switch in generateWorkout is what this catches`
  );
  check(
    'nothing above the level ceiling reaches the session screen',
    aboveCeiling.length === 0,
    aboveCeiling[0]
  );
  check('nothing the person has not got the kit for does either', wrongKit.length === 0, wrongKit[0]);
  check(
    'and nothing carrying a stress today’s sore areas rule out',
    bannedTagged.length === 0,
    bannedTagged[0]
  );
  check(
    'a stored squat, bench or deadlift day builds the same session as the type it means',
    legacyDiffers.length === 0,
    legacyDiffers[0]
  );
  check(
    'and what comes through the door is what the builder built',
    differsFromBuilder.length === 0,
    differsFromBuilder[0]
  );
}

/**
 * [15] WHERE A SESSION RUNS SHORT OF WHAT IT ASKED FOR, PINNED BOTH WAYS.
 *
 * An Upper Body session asks for push, pull, core, push, pull, and the two
 * repeats are where Archie's list runs out at home: below Intermediate on no
 * kit there is one beginner push (Kneeling Press Ups) and one beginner pull
 * (Door Frame Rows), so the fourth and fifth slots come up with nothing left to
 * give and are dropped. The session is honest - it contains a push, a pull and
 * a core piece, all at the right level and all with the kit the person owns -
 * but somebody who chose 60 minutes gets three pieces of work rather than five.
 * A bench buys one more, bands buy the rest: once there is a second pull in
 * reach, every kit set fills every slot at every level.
 *
 * That is a fact about the LIST, not a fault in the builder, and the two wrong
 * ways to make it go away are both worse: widening the level window upward
 * hands a beginner work they are not ready for, and filling the slot from
 * another pattern gives them a second core piece captioned as a press.
 *
 * So it is measured and written down instead, exactly, in both directions. A
 * combination that starts running short is a regression - something stopped
 * being reachable. One that stops running short means the library gained a
 * record, which is good news and should be recorded here rather than absorbed
 * silently. Lower Body appears nowhere in the list, and that is the point of
 * sweeping it too: it never runs short at any kit or level.
 */
console.log('\n[15] What a session runs short of, and where');
{
  /** Written down, one line per combination that cannot fill its slots. */
  const EXPECTED_SHORTFALL = [
    'upper_body / nothing / beginner / 45 min: 3 of 4',
    'upper_body / nothing / beginner / 60 min: 3 of 5',
    'upper_body / nothing / intermediate / 60 min: 4 of 5',
    'upper_body / nothing / advanced / 60 min: 4 of 5',
    'upper_body / nothing / athlete / 60 min: 4 of 5',
    'upper_body / bodyweight / beginner / 45 min: 3 of 4',
    'upper_body / bodyweight / beginner / 60 min: 3 of 5',
    'upper_body / bodyweight / intermediate / 60 min: 4 of 5',
    'upper_body / bodyweight / advanced / 60 min: 4 of 5',
    'upper_body / bodyweight / athlete / 60 min: 4 of 5',
    'upper_body / bodyweight+bench / beginner / 60 min: 4 of 5',
    'upper_body / bodyweight+bench / intermediate / 60 min: 4 of 5',
    'upper_body / bodyweight+bench / advanced / 60 min: 4 of 5',
    'upper_body / bodyweight+bench / athlete / 60 min: 4 of 5',
  ];

  const shortfall = [];
  const noWork = [];
  for (const sessionType of [...new Set([...ALREADY_SWITCHED, ...LIBRARY_LIVE_TYPES])]) {
    for (const equipment of KITS) {
      for (const level of EXPERIENCE_LEVELS) {
        for (const duration of DURATIONS) {
          const asked = SLOT_COUNTS[sessionType][duration];
          let fewest = Infinity;
          for (const seed of SEEDS) {
            const { exercises } = generateLibrarySession({
              sessionType,
              equipment,
              readiness: readinessFor(SITUATIONS[0], duration, 'normal'),
              profile: profileFor(level, SITUATIONS[0]),
              sessionTypeCount: seed,
              strengthSessionCount: seed,
              daysSinceLastSession: null,
            });
            const work = exercises.filter(
              (e) => e.category === 'main' || e.category === 'accessory'
            ).length;
            if (work < fewest) fewest = work;
          }
          const where = `${sessionType} / ${equipment.join('+') || 'nothing'} / ${level} / ${duration} min`;
          if (fewest < asked) shortfall.push(`${where}: ${fewest} of ${asked}`);
          if (fewest < 3) noWork.push(`${where}: ${fewest}`);
        }
      }
    }
  }

  check(
    `the sessions that cannot fill their slots are exactly the ${EXPECTED_SHORTFALL.length} written down`,
    shortfall.join('\n') === EXPECTED_SHORTFALL.join('\n'),
    `got:\n      ${shortfall.join('\n      ') || '(none)'}\n      expected:\n      ${EXPECTED_SHORTFALL.join('\n      ')}`
  );
  check(
    // The floor under the floor: however thin the list gets, nobody is handed a
    // session with fewer than three things to do in it.
    'and nobody, on any kit at any level, gets fewer than three pieces of work',
    noWork.length === 0,
    noWork[0]
  );
  check(
    'every shortfall is an Upper Body one, so the pull and push repeats are what runs out',
    shortfall.every((line) => line.startsWith('upper_body /')),
    shortfall.filter((line) => !line.startsWith('upper_body /'))[0]
  );
  check(
    // A bench earns a beginner one more push, which is why that row reads 4 of
    // 5 rather than 3. Bands are what actually fill the session, because they
    // bring a second pull.
    'and only where the kit is bodyweight, with or without a bench',
    shortfall.every((line) => /\/ (nothing|bodyweight|bodyweight\+bench) \//.test(line)),
    shortfall.filter((line) => !/\/ (nothing|bodyweight|bodyweight\+bench) \//.test(line))[0]
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
