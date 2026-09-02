/**
 * Contract test: everybody gets a programme, and it is the right one.
 *
 * THE THREE THINGS THAT MUST HOLD
 * ───────────────────────────────
 * EVERY ANSWER LANDS. Six answers to "what should this be built around", four
 * frequencies and three experience levels. Every combination has to produce a
 * real programme with a real cycle of real session types. A combination that
 * falls through to undefined is a home screen offering an empty workout.
 *
 * THE OLD BEHAVIOUR SURVIVES. Barbell Strength on two or three days a week is
 * squat, bench, deadlift, in that order, which is exactly what every user of the
 * app has had until now. The whole change is that other people stop getting it.
 *
 * OFF PLAN IS FREE. Position is replayed from the session history, and a session
 * the programme did not ask for must leave the position exactly where it was.
 * That is the difference between "train what you like in between" being true and
 * being a slogan on a card.
 *
 * Run:  npx tsx tests/programme.check.mjs
 */
import { readFileSync } from 'fs';
import {
  PROGRAMMES,
  PROGRAMME_IDS,
  PROGRAMME_PROMISES,
  blockPlan,
  cycleFor,
  nextSessionType,
  programmeCareNote,
  programmePosition,
  programmeReasons,
  selectProgramme,
  templateIdFor,
  extrasFor,
  otherProgrammes,
  includedInGrow,
  tagSessions,
  cycleOf,
  programmeFor,
  deloadWeeksFor,
  deloadIndexes,
  DELOAD_EVERY_SESSIONS,
  isDeloadIndex,
  cycleHasLoadedWork,
  DELOAD_EVERY_WEEKS,
  programmeDrift,
  closestProgramme,
  DRIFT_WINDOW,
  DRIFT_MAX_ON_PLAN,
  extrasOf,
  nameOf,
  demandOfCycle,
  BUILDABLE_SESSION_TYPES,
  MAX_CUSTOM_CYCLE,
  DIFFICULTY_LABELS,
  programmeDifficulty,
  weeksFor,
} from '../lib/programme.ts';
import { outcomeFrom, SESSION_COUNTS } from '../lib/profile-tree.ts';

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

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** The SessionType union, read off the store rather than copied into this file. */
const SESSION_TYPES = (() => {
  const src = read('lib/store.ts');
  const at = src.indexOf('export type SessionType =');
  const block = src.slice(at, src.indexOf(';', at));
  return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
})();

const FOCUSES = ['barbell', 'strength', 'muscle', 'comeback', 'fitness', 'joints'];
const DAYS = [2, 3, 4, 5];
const LEVELS = ['beginner', 'intermediate', 'advanced'];

// ─── 1. The templates are sound ─────────────────────────────────────────────
console.log('\n[1] Every template can actually be trained');

check(
  'the session types were read off the store',
  SESSION_TYPES.length >= 8 && SESSION_TYPES.includes('squat'),
  `got ${JSON.stringify(SESSION_TYPES)}; the union has moved and this file is now guessing`
);

check('there are programmes', PROGRAMME_IDS.length >= 6, `${PROGRAMME_IDS.length}`);

const cycleFaults = [];
for (const id of PROGRAMME_IDS) {
  for (const d of DAYS) {
    const c = cycleFor(id, d);
    if (!Array.isArray(c) || c.length === 0) cycleFaults.push(`${id}@${d}: empty`);
    for (const t of c ?? []) {
      if (!SESSION_TYPES.includes(t)) cycleFaults.push(`${id}@${d}: "${t}" is not a session type`);
      // generateWorkout returns [] for custom: a custom session is assembled in
      // the builder, not generated, so a cycle slot holding it hands somebody an
      // empty workout with no way to tell what went wrong.
      if (t === 'custom') cycleFaults.push(`${id}@${d}: custom cannot be a programme slot`);
    }
  }
}
check(
  'every programme has a real cycle at every frequency',
  cycleFaults.length === 0,
  cycleFaults.slice(0, 5).join(' | ')
);

check(
  'every programme is named and described',
  PROGRAMME_IDS.every((id) => PROGRAMMES[id].name.length > 3 && PROGRAMMES[id].blurb.length > 15),
  'the name is what makes it feel like something somebody was given'
);

check(
  'names are unique',
  new Set(PROGRAMME_IDS.map((id) => PROGRAMMES[id].name)).size === PROGRAMME_IDS.length,
  ''
);

// ─── 2. The old behaviour survives ──────────────────────────────────────────
console.log('\n[2] Barbell Strength is the rotation the app already had');

const SESSION_ORDER = (() => {
  const src = read('lib/store.ts');
  const m = src.match(/export const SESSION_ORDER: SessionType\[\] = \[([^\]]+)\]/);
  return m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : [];
})();

check(
  'SESSION_ORDER was found in the store',
  SESSION_ORDER.length === 3,
  'the comparison below proves nothing otherwise'
);
check(
  'and Barbell Strength at 2 and 3 days a week is exactly it',
  JSON.stringify(cycleFor('barbell', 3)) === JSON.stringify(SESSION_ORDER) &&
    JSON.stringify(cycleFor('barbell', 2)) === JSON.stringify(SESSION_ORDER),
  `${JSON.stringify(cycleFor('barbell', 3))} vs ${JSON.stringify(SESSION_ORDER)}; every existing user is on this rotation and must not be moved off it`
);
check(
  'a four day barbell week keeps all three lifts and adds to them',
  SESSION_ORDER.every((t) => cycleFor('barbell', 4).includes(t)) &&
    cycleFor('barbell', 4).length > 3,
  'dropping a lift to make room for an accessory day would break the strength test'
);

// ─── 3. Every answer lands somewhere ────────────────────────────────────────
console.log('\n[3] No combination of answers falls through');

const misses = [];
for (const focus of FOCUSES) {
  for (const days of DAYS) {
    for (const experience of LEVELS) {
      const id = templateIdFor(focus, days, experience === 'beginner');
      if (!PROGRAMME_IDS.includes(id)) misses.push(`${focus}/${days}/${experience} -> ${id}`);
    }
  }
}
check(
  `all ${FOCUSES.length * DAYS.length * LEVELS.length} combinations produce a real programme`,
  misses.length === 0,
  misses.slice(0, 4).join(' | ')
);

check(
  'each focus that has its own programme gets it',
  templateIdFor('barbell', 3, false) === 'barbell' &&
    templateIdFor('muscle', 3, false) === 'muscle' &&
    templateIdFor('comeback', 3, false) === 'comeback' &&
    templateIdFor('fitness', 3, false) === 'lean' &&
    templateIdFor('joints', 3, false) === 'joints',
  'the answer to the one question that chooses a programme has to choose it'
);

check(
  // The reason both questions are asked. If general strength always produced the
  // same thing, experience and frequency would be decorative on this path.
  'general strength splits on experience and on frequency',
  templateIdFor('strength', 4, true) === 'foundations' &&
    templateIdFor('strength', 2, false) === 'foundations' &&
    templateIdFor('strength', 4, false) === 'upper_lower',
  'a beginner and a four day lifter should not be handed the same week'
);

check(
  'frequency changes the cycle, not just the pace',
  JSON.stringify(cycleFor('lean', 2)) !== JSON.stringify(cycleFor('lean', 5)) &&
    JSON.stringify(cycleFor('joints', 2)) !== JSON.stringify(cycleFor('joints', 5)),
  'asking how many days somebody trains and then ignoring it is the bug this replaces'
);

// ─── 4. Position is replayed, and off plan is free ──────────────────────────
console.log('\n[4] Training something else never costs you your place');

const enrol = selectProgramme(
  outcomeFrom({ focus: 'barbell', days: '3', minutes: '45', length: '12', experience: 'advanced' }),
  '2026-08-31T00:00:00.000Z',
  0
);

check(
  'enrolment carries the answers it was given',
  enrol.templateId === 'barbell' &&
    enrol.days === 3 &&
    enrol.sessions === 12 &&
    enrol.minutes === 45,
  `got ${JSON.stringify(enrol)}; an answer that is not stored cannot have an effect`
);

check(
  // Found by mutation: asserting one enrolment against one literal passes
  // happily against a hardcoded value. Two enrolments that differ only in the
  // answers cannot both be satisfied by a constant.
  'and two people who answered differently are enrolled differently',
  (() => {
    const a = selectProgramme(
      outcomeFrom({
        focus: 'muscle',
        days: '5',
        minutes: '30',
        length: '16',
        experience: 'advanced',
      }),
      '2026-08-31T00:00:00.000Z',
      0
    );
    return (
      a.minutes === 30 &&
      a.days === 5 &&
      a.sessions === 16 &&
      a.templateId === 'muscle' &&
      a.minutes !== enrol.minutes &&
      a.days !== enrol.days &&
      a.sessions !== enrol.sessions
    );
  })(),
  'every one of these is a question the builder asks; a constant here means the question was decorative'
);

check(
  'and enrolling later starts a fresh block rather than inheriting a position',
  selectProgramme(outcomeFrom({ focus: 'lean', days: '3' }), '2026-08-31T00:00:00.000Z', 240)
    .startedAtSessionCount === 240,
  'somebody with two years of history who picks a new programme must start at week one'
);

check(
  'a fresh block starts on the first session of the cycle',
  nextSessionType(enrol, []) === 'squat',
  ''
);

check(
  'doing what it asked advances it',
  nextSessionType(enrol, ['squat']) === 'bench' &&
    nextSessionType(enrol, ['squat', 'bench']) === 'deadlift' &&
    nextSessionType(enrol, ['squat', 'bench', 'deadlift']) === 'squat',
  'the cycle has to wrap'
);

check(
  'doing something else does NOT advance it',
  nextSessionType(enrol, ['conditioning', 'flexibility', 'prehab']) === 'squat',
  'this is the whole promise: train what you like in between and keep your place'
);

check(
  'and the off-plan work is still counted, not discarded',
  (() => {
    const p = programmePosition(enrol, ['conditioning', 'squat', 'flexibility', 'bench']);
    return p.onPlan === 2 && p.offPlan === 2 && p.next === 'deadlift';
  })(),
  'somebody who mixes their own training in has done four sessions, two of them on plan'
);

check(
  // The one way this function can be silently wrong. completedSessions is
  // newest-first in the store, so a caller that forgets to reverse it replays
  // the block backwards and lands on the wrong session.
  'order matters, so passing the history backwards gives a different answer',
  nextSessionType(enrol, ['squat', 'conditioning']) !==
    nextSessionType(enrol, ['conditioning', 'squat']) ||
    (() => {
      // Both happen to be 'bench' here, so prove the direction a harder way:
      // an on-plan first session followed by an off-plan one is one on-plan.
      const a = programmePosition(enrol, ['squat', 'bench']);
      const b = programmePosition(enrol, ['bench', 'squat']);
      return a.onPlan === 2 && b.onPlan === 1;
    })(),
  'chronological order, oldest first'
);

// ─── 5. The block has a size and an end ─────────────────────────────────────
console.log('\n[5] The block is a fixed size and it finishes');

check(
  // The whole point of counting in sessions: the block is the number they
  // chose, and how often they train changes how long it TAKES, not how big it
  // is. Under the old weeks model these two came out at 36 and 32.
  'the plan is exactly as many sessions as they asked for, whatever the frequency',
  blockPlan(enrol).length === 12 && blockPlan({ ...enrol, days: 4, sessions: 8 }).length === 8,
  ''
);
check(
  'weeks are a grouping over those sessions, and the last one can be short',
  blockPlan(enrol)[0].week === 1 &&
    blockPlan(enrol)[11].week === 4 &&
    blockPlan({ ...enrol, days: 3, sessions: 10 }).filter((p) => p.week === 4).length === 1,
  ''
);
check(
  'the week number never runs past the end of the block',
  (() => {
    const many = Array.from({ length: 200 }, (_, i) => cycleFor('barbell', 3)[i % 3]);
    const p = programmePosition(enrol, many);
    return p.week === 4 && p.weeks === 4 && p.complete;
  })(),
  'somebody who keeps going should see "block complete", not "week 67 of 4"'
);
check(
  'and it is not complete before it is',
  !programmePosition(enrol, ['squat', 'bench']).complete,
  ''
);

// ─── 6. It says why, in their own answers ───────────────────────────────────
console.log('\n[6] The programme explains itself');

const sore = outcomeFrom({
  focus: 'strength',
  days: '3',
  minutes: '30',
  length: '12',
  experience: 'beginner',
  sore: 'yes',
  soreArea: ['knee'],
  soreAge: 'months',
  equipment: ['dumbbells'],
});
const clean = outcomeFrom({
  focus: 'barbell',
  days: '4',
  minutes: '60',
  length: '12',
  experience: 'advanced',
  sore: 'no',
  equipment: ['fullgym'],
  testWeeks: '12',
});

check(
  'there are reasons, and they are sentences',
  programmeReasons(sore).length >= 3 && programmeReasons(sore).every((r) => r.length > 20),
  ''
);
check(
  'a sore area is named as a reason',
  programmeReasons(sore).some((r) => /sore/i.test(r)),
  'the app just made a decision on their behalf and has to say what caused it'
);
check(
  'and somebody with nothing sore is not told about an injury they do not have',
  !programmeReasons(clean).some((r) => /sore/i.test(r)),
  'a reason that applies to everybody is not a reason'
);
check(
  'the frequency and the session length both appear',
  programmeReasons(clean).some((r) => /4 days/.test(r)) &&
    programmeReasons(clean).some((r) => /60 minutes/.test(r)),
  'these are two of the six new questions; if they are not in the reasons they had better be somewhere'
);
check(
  'limited kit is named, and a full gym is not',
  programmeReasons(sore).some((r) => /kit/i.test(r)) &&
    !programmeReasons(clean).some((r) => /kit/i.test(r)),
  ''
);
check(
  'a strength test is only mentioned to somebody who has one',
  programmeReasons(clean).some((r) => /strength test/i.test(r)) &&
    !programmeReasons(sore).some((r) => /strength test/i.test(r)),
  'the sore user is on general strength, where a test never comes due'
);
check(
  // The list used to open with the cycle length, which is true and is not an
  // answer to the question written directly above it.
  'the first reason names the choice they actually made',
  (() => {
    const FOCI = [
      ['barbell', /barbell lifts/i],
      ['muscle', /building muscle/i],
      ['comeback', /coming back from an injury/i],
      ['fitness', /fitness and conditioning/i],
      ['joints', /joint health/i],
      ['strength', /whole body|general strength/i],
    ];
    return FOCI.every(([focus, rx]) => {
      const first = programmeReasons(outcomeFrom({ focus, days: '3', minutes: '45', experience: 'beginner' }))[0];
      return rx.test(first ?? '');
    });
  })(),
  'somebody who told the app what to build around should see that read back before anything else'
);

check(
  'and an experienced general-strength user gets their own line, not the beginner one',
  (() => {
    const first = programmeReasons(outcomeFrom({ focus: 'strength', days: '4', minutes: '45', experience: 'advanced' }))[0] ?? '';
    return /general strength/i.test(first) && !/new to structured/i.test(first);
  })(),
  'the two general-strength programmes are different shapes and should not share a reason'
);
check(
  'two different people get different reasons',
  JSON.stringify(programmeReasons(sore)) !== JSON.stringify(programmeReasons(clean)),
  ''
);

// ─── 7. The care note, and what it refuses to do ────────────────────────────
console.log('\n[7] A recent injury is noticed but never overrules the choice');

const freshInjury = { focus: 'barbell', days: '3', sore: 'yes', soreArea: ['knee'], soreAge: 'days' };
check(
  'somebody who chose the barbell with a three-day-old injury is warned',
  (programmeCareNote(outcomeFrom(freshInjury)) ?? '').length > 40,
  'a physiotherapist would not pretend not to have noticed'
);
check(
  'and is still given the barbell programme they asked for',
  templateIdFor(outcomeFrom(freshInjury).focus, 3, false) === 'barbell',
  'noticing is not the same as overruling; they asked for it and they get it'
);
check(
  'the note names the programme that would suit better',
  /Return to Lifting/.test(programmeCareNote(outcomeFrom(freshInjury)) ?? ''),
  'a warning with no action in it is just worry'
);
check(
  'a long standing ache does not trigger it',
  programmeCareNote(outcomeFrom({ ...freshInjury, soreAge: 'years' })) === null,
  'somebody who has trained around a bad shoulder for a decade does not need a caution every block'
);
check(
  'nor does somebody who already chose a rehab programme',
  programmeCareNote(outcomeFrom({ ...freshInjury, focus: 'comeback' })) === null &&
    programmeCareNote(outcomeFrom({ ...freshInjury, focus: 'joints' })) === null,
  'they have already done the thing the note would ask them to do'
);
check(
  'and nobody with nothing sore is warned about anything',
  programmeCareNote(outcomeFrom({ focus: 'barbell', days: '3', sore: 'no' })) === null,
  ''
);

// ─── 8. The three promises ──────────────────────────────────────────────────
console.log('\n[8] The three things they have to understand');

check(
  'there are exactly three, because four is a wall of text',
  PROGRAMME_PROMISES.length === 3,
  ''
);
check(
  'one of them says they can change it',
  PROGRAMME_PROMISES.some((p) => /change/i.test(p.body)),
  'the whole point is that it does not read as a cage'
);
check(
  'one says off-plan training still counts',
  PROGRAMME_PROMISES.some((p) => /counts/i.test(p.body) && /history|records/i.test(p.body)),
  ''
);
check(
  // The one that matters most. People who hear "programme" expect a fixed sheet,
  // and without this the first adaptive session reads as a fault.
  'and one warns them it will change by itself',
  PROGRAMME_PROMISES.some((p) => /changes as you do/i.test(p.title)),
  'this app rewrites the session around whatever hurts, which looks like a bug if nobody said so'
);

// ─── 9. Recovery is never more than one tap away ────────────────────────────
console.log('\n[9] Every programme can reach rehab and recovery work');

/**
 * Mechanically this already worked: an off-plan session leaves the block where
 * it was, so anybody could always have trained prehab on a Thursday. What was
 * missing was anything that said so, and a person on Barbell Strength with a
 * grumbling knee had no way to know it was allowed.
 */
const RECOVERY = ['prehab', 'flexibility'];
const unreachable = [];
for (const id of PROGRAMME_IDS) {
  for (const d of DAYS) {
    const offered = new Set([...cycleFor(id, d), ...extrasFor(id, d)]);
    if (!RECOVERY.some((r) => offered.has(r))) unreachable.push(id + '@' + d);
  }
}
check(
  'every programme offers rehab or mobility work, in its cycle or beside it',
  unreachable.length === 0,
  unreachable.join(', ')
);

const dupes = [];
for (const id of PROGRAMME_IDS) {
  for (const d of DAYS) {
    if (extrasFor(id, d).some((e) => cycleFor(id, d).includes(e))) dupes.push(id + '@' + d);
  }
}
check(
  'and nothing is offered as an extra that the programme already prescribes',
  dupes.length === 0,
  `${dupes.join(', ')}: Joint Health does not offer prehab as an extra, because prehab is the programme`
);

check(
  'every extra is a session the app can actually build',
  PROGRAMME_IDS.every((id) =>
    PROGRAMMES[id].extras.every((e) => SESSION_TYPES.includes(e) && e !== 'custom')
  ),
  'a custom session is assembled in the builder, not generated'
);

check(
  'choosing one programme leaves the other six reachable',
  otherProgrammes('barbell').length === PROGRAMME_IDS.length - 1 &&
    !otherProgrammes('barbell').some((p) => p.id === 'barbell'),
  'somebody handed a programme has to understand they have not been locked out of the rest'
);

// ─── 10. What the subscription buys, said once and truthfully ───────────────
console.log('\n[10] The list of what comes with it');

const included = includedInGrow({ exercises: 707, painAreas: 19, sessionTypes: 10 });
check(
  'there is a list, and every line says something',
  included.length >= 6 && included.every((i) => i.title.length > 5 && i.body.length > 40),
  'this is the first place in the app that states what the subscription is for'
);
check(
  'the counts it quotes are the ones it was given',
  included.some((i) => /707/.test(i.title)) && included.some((i) => /19/.test(i.title)),
  'hardcoding them here is how the paywall came to advertise 12 of the 19 pain zones'
);
check(
  // The store listing makes the same refusal for the same reason: only 103 of
  // the exercises have a recorded video and the rest fall back to a search.
  'it does not claim a video for every exercise',
  !included.some((i) => /video for every|every exercise has a video/i.test(i.body)),
  'a demonstration a tap away is true; a video for each is not'
);
check(
  'and it names no price',
  !included.some((i) => /[£$€]\s?\d/.test(i.title + i.body)),
  'the price comes from the store, and a hardcoded one is wrong in every country but one'
);

// ─── 11. Length in sessions, difficulty in work ─────────────────────────────
console.log('\n[11] Length and difficulty are two different axes');

check(
  'every offered length is even, from a fortnight of trying it to a long build',
  SESSION_COUNTS.length === 9 &&
    SESSION_COUNTS[0] === 4 &&
    SESSION_COUNTS[8] === 20 &&
    SESSION_COUNTS.every((n) => n % 2 === 0) &&
    SESSION_COUNTS.every((n, i) => i === 0 || n > SESSION_COUNTS[i - 1]),
  JSON.stringify(SESSION_COUNTS)
);
check(
  'a length nobody was offered is snapped back to the default rather than honoured',
  outcomeFrom({ length: '13' }).sessions === 12 &&
    outcomeFrom({ length: '999' }).sessions === 12 &&
    outcomeFrom({ length: 'garbage' }).sessions === 12 &&
    outcomeFrom({ length: '4' }).sessions === 4,
  'a block of 13 is a plan nobody designed'
);
check(
  'weeks are derived from the pair and always round UP',
  weeksFor(12, 3) === 4 && weeksFor(10, 3) === 4 && weeksFor(4, 5) === 1 && weeksFor(20, 2) === 10,
  'ten sessions at three a week is four weeks of training, not three and a third'
);

/**
 * THE ONE THAT MATTERS. Archie's brief in his own words: "The session amount
 * isnt what defines the difficulty necessarily, its the type of workouts and
 * volumes." A label that moved with the length would be measuring commitment
 * and calling it difficulty.
 */
check(
  'the difficulty does not move when only the length does',
  SESSION_COUNTS.every(
    (n) =>
      programmeDifficulty('barbell', 'advanced', 3).label ===
      programmeDifficulty('barbell', 'advanced', 3).label
  ) &&
    (() => {
      const short = selectProgramme(
        outcomeFrom({ focus: 'barbell', days: '3', experience: 'advanced', length: '4' }),
        '2026-08-31T00:00:00.000Z',
        0
      );
      const long = selectProgramme(
        outcomeFrom({ focus: 'barbell', days: '3', experience: 'advanced', length: '20' }),
        '2026-08-31T00:00:00.000Z',
        0
      );
      return (
        short.sessions !== long.sessions &&
        programmeDifficulty(short.templateId, 'advanced', short.days).label ===
          programmeDifficulty(long.templateId, 'advanced', long.days).label
      );
    })(),
  'twenty sessions of mobility work is longer than four of heavy barbell work, not harder'
);
check(
  'but it does move when the work does',
  programmeDifficulty('barbell', 'advanced', 3).score >
    programmeDifficulty('joints', 'advanced', 3).score,
  'the label describes the programme, so a gentle programme has to read as one'
);
check(
  'and when the weekly volume does',
  programmeDifficulty('barbell', 'advanced', 5).score >
    programmeDifficulty('barbell', 'advanced', 2).score,
  'five days a week is more than two, of anything'
);
check(
  // The same rule as earn-the-barbell in PROGRESSION-LADDERS.md, applied to the
  // whole block: the app will not prescribe work somebody has not earned.
  'a beginner is never handed anything past Novice, however they answer',
  ['barbell', 'muscle', 'upper_lower', 'lean', 'foundations', 'comeback', 'joints'].every((id) =>
    [2, 3, 4, 5].every((d) => programmeDifficulty(id, 'beginner', d).score <= 1)
  ),
  'a beginner on a five day barbell block being called Advanced is the app flattering them'
);
check(
  'and an intermediate never past Advanced',
  ['barbell', 'muscle', 'upper_lower'].every((id) =>
    [2, 3, 4, 5].every((d) => programmeDifficulty(id, 'intermediate', d).score <= 3)
  ),
  ''
);
check(
  'Elite is reachable, so it is a label rather than decoration',
  programmeDifficulty('barbell', 'advanced', 5).label === 'Elite' &&
    DIFFICULTY_LABELS[DIFFICULTY_LABELS.length - 1] === 'Elite',
  'a band nothing can ever land in is a word on a page'
);
check(
  'every label in the ladder is reachable by some real answer',
  (() => {
    const seen = new Set();
    for (const id of PROGRAMME_IDS)
      for (const e of ['beginner', 'intermediate', 'advanced'])
        for (const d of [2, 3, 4, 5]) seen.add(programmeDifficulty(id, e, d).label);
    return DIFFICULTY_LABELS.every((l) => seen.has(l));
  })(),
  'six words with only four outcomes behind them'
);
check(
  'and every one of them says why, naming something real',
  PROGRAMME_IDS.every((id) =>
    [2, 3, 4, 5].every((d) => {
      const why = programmeDifficulty(id, 'advanced', d).because;
      return why.length > 12 && !/undefined|NaN/.test(why);
    })
  ),
  'a label on its own invites the question it should be answering'
);

// ─── 12. Which sessions were the programme's ────────────────────────────────
console.log('\n[12] Every session done says which it was');

const barbellCycle = cycleFor('barbell', 3);
const mixed = [
  barbellCycle[0], // on
  'conditioning', // off
  barbellCycle[1], // on
  'flexibility', // off
  'flexibility', // off
  barbellCycle[2], // on
];
const tagged = tagSessions(enrol, mixed);

check(
  'one tag per session, in the order they were done',
  tagged.length === mixed.length,
  ''
);
check(
  'the programme sessions are marked, and numbered by their place in the block',
  JSON.stringify(tagged.map((t) => (t.onPlan ? t.blockIndex : 'x'))) ===
    JSON.stringify([1, 'x', 2, 'x', 'x', 3]),
  JSON.stringify(tagged)
);
check(
  'off-plan work carries no block number, because it has no place in the block',
  tagged.filter((t) => !t.onPlan).every((t) => t.blockIndex === null),
  'a number on an off-plan session is the app claiming credit for it'
);
check(
  // The two are one replay. If they ever came apart, the hub would say eleven
  // and the history would show twelve rows marked as the programme's.
  'the tags and the position agree, because they are the same walk',
  (() => {
    const p = programmePosition(enrol, mixed);
    return (
      p.onPlan === tagged.filter((t) => t.onPlan).length &&
      p.offPlan === tagged.filter((t) => !t.onPlan).length
    );
  })(),
  ''
);
check(
  'doing the right session at the wrong time is still off plan',
  (() => {
    // The third lift done first: it is in the cycle, but it is not what the
    // programme was asking for, so it must not advance the block.
    const t = tagSessions(enrol, [barbellCycle[2], barbellCycle[0]]);
    return t[0].onPlan === false && t[1].onPlan === true && t[1].blockIndex === 1;
  })(),
  'otherwise somebody could skip to the end of the block by picking their favourite session'
);
check(
  'and nothing is ever discarded: every session comes back tagged one way or the other',
  tagSessions(enrol, ['custom', 'conditioning', 'prehab']).length === 3,
  'a session that falls out of the replay is one the user did and the app forgot'
);

// ─── 13. A cycle somebody put together themselves ───────────────────────────
console.log('\n[13] A custom programme behaves like every other one');

const mine = {
  templateId: 'custom',
  custom: { name: 'Tuesdays and Fridays', cycle: ['upper_body', 'conditioning', 'lower_body'] },
  days: 3,
  sessions: 12,
  minutes: 45,
  startedAt: '2026-09-01T00:00:00.000Z',
  startedAtSessionCount: 0,
};

check(
  // The one that would break everything quietly. programmeFor falls back to
  // Full Body Foundations for an unknown id, so without a real entry a person's
  // own programme would silently become somebody else's, and it would look like
  // the app working.
  'custom is a real template rather than a hole that falls through to Foundations',
  PROGRAMMES.custom?.id === 'custom' && programmeFor('custom').id === 'custom',
  JSON.stringify(programmeFor('custom')?.id)
);
check(
  'and it is NOT on the list of programmes you can pick',
  !PROGRAMME_IDS.includes('custom') && PROGRAMME_IDS.length === 7,
  `${PROGRAMME_IDS.length}: ${PROGRAMME_IDS.join(', ')}`
);
check(
  'nor among the ones offered as alternatives to whatever you are on',
  otherProgrammes('barbell').every((p) => p.id !== 'custom') &&
    otherProgrammes('custom').length === 7,
  'a page that says "and 7 more, included" must not be counting the one they built'
);
check(
  'the cycle comes off the enrolment, not the template table',
  JSON.stringify(cycleOf(mine)) ===
    JSON.stringify(['upper_body', 'conditioning', 'lower_body']),
  JSON.stringify(cycleOf(mine))
);
check(
  'and a named programme still reads its own',
  JSON.stringify(cycleOf({ ...mine, templateId: 'barbell', custom: undefined })) ===
    JSON.stringify(cycleFor('barbell', 3)),
  ''
);
check(
  // Switching away leaves the custom cycle sitting on the enrolment unread.
  // If cycleOf looked at `custom` rather than at the id, switching to Barbell
  // Strength would hand back their own sessions under somebody else's name.
  'a leftover custom cycle is ignored the moment they are on something else',
  JSON.stringify(cycleOf({ ...mine, templateId: 'joints' })) ===
    JSON.stringify(cycleFor('joints', 3)),
  JSON.stringify(cycleOf({ ...mine, templateId: 'joints' }))
);
check(
  'it is called what they called it',
  nameOf(mine) === 'Tuesdays and Fridays' &&
    nameOf({ ...mine, custom: { name: '   ', cycle: mine.custom.cycle } }) ===
      'Your Own Programme' &&
    nameOf({ ...mine, templateId: 'lean' }) === PROGRAMMES.lean.name,
  nameOf(mine)
);
check(
  'the position, the plan and the tags all walk the cycle they built',
  (() => {
    const pos = programmePosition(mine, ['upper_body', 'squat', 'conditioning']);
    const plan = blockPlan(mine);
    return (
      pos.onPlan === 2 &&
      pos.offPlan === 1 &&
      pos.next === 'lower_body' &&
      plan.length === 12 &&
      plan[0].type === 'upper_body' &&
      plan[3].type === 'upper_body'
    );
  })(),
  JSON.stringify(programmePosition(mine, ['upper_body', 'squat', 'conditioning']))
);
check(
  'what it offers alongside is whatever is not already in it',
  (() => {
    const extras = extrasOf(mine);
    return extras.includes('prehab') && extras.includes('flexibility') && !extras.includes('conditioning');
  })(),
  JSON.stringify(extrasOf(mine))
);
check(
  // A cycle nobody wrote a description for has to be read off the work in it,
  // or every custom programme comes back at the same difficulty.
  'its difficulty is read from the cycle rather than from a table',
  (() => {
    const heavy = programmeDifficulty('custom', 'advanced', 3, ['squat', 'bench', 'deadlift']);
    const gentle = programmeDifficulty('custom', 'advanced', 3, ['prehab', 'flexibility']);
    return heavy.score > gentle.score && demandOfCycle(['squat', 'bench']) === 1;
  })(),
  `${programmeDifficulty('custom', 'advanced', 3, ['squat', 'bench', 'deadlift']).label} vs ${programmeDifficulty('custom', 'advanced', 3, ['prehab', 'flexibility']).label}`
);
check(
  'an empty cycle is neither heavy nor gentle, rather than dividing by zero',
  demandOfCycle([]) === 0 && Number.isFinite(programmeDifficulty('custom', 'beginner', 3, []).score),
  ''
);
check(
  // generateWorkout returns an empty list for 'custom', so a slot holding one
  // would hand somebody a workout with nothing in it.
  'the sessions you can put in a cycle are all sessions the app can build',
  BUILDABLE_SESSION_TYPES.length === 9 && !BUILDABLE_SESSION_TYPES.includes('custom'),
  BUILDABLE_SESSION_TYPES.join(', ')
);
check(
  'and there is a ceiling on how long a cycle can get',
  MAX_CUSTOM_CYCLE >= 4 && MAX_CUSTOM_CYCLE <= 12,
  `${MAX_CUSTOM_CYCLE}`
);

// ─── The planned easier week ────────────────────────────────────────────────
console.log('\n[D] A block that only ever goes up is not a block');

const block = (over) => ({
  templateId: 'barbell',
  days: 3,
  sessions: 12,
  minutes: 45,
  startedAt: '2026-01-01T00:00:00.000Z',
  startedAtSessionCount: 0,
  ...over,
});

/**
 * THE RULE CHANGED, AND THESE ASSERTIONS ARE WHY IT HAD TO.
 *
 * The old schedule counted in WEEKS, where a week is however many sessions you
 * train. That made the gap between easier weeks four times the training
 * frequency: every 8 sessions at twice a week, every 20 at five times a week.
 * The person doing the most work waited the longest. Worse, the last week was
 * excluded, so measured across every block length the builder offers against
 * every frequency, 24 of the 36 combinations had no easier week at all -
 * including the DEFAULT block at every realistic frequency.
 *
 * Fatigue accumulates per session, so the schedule counts sessions now, and the
 * deload lands on the same session number whoever you are.
 */
check(
  'a block long enough to need one gets it after a fixed number of SESSIONS',
  (() => {
    const idx = [...deloadIndexes(block({ sessions: 16, days: 3 }))].sort((a, b) => a - b);
    return idx.length > 0 && idx[0] === DELOAD_EVERY_SESSIONS;
  })(),
  JSON.stringify([...deloadIndexes(block({ sessions: 16, days: 3 }))])
);
check(
  // The whole point of the change. Two people on the same block, training at
  // different frequencies, must ease at the same place in it.
  'and the same block eases at the same place however often you train',
  (() => {
    // TWENTY, not sixteen. A sixteen session block only has room for one window,
    // and its start is the same under both the old rule and the new one - so a
    // sixteen session block cannot tell them apart, and this assertion stayed
    // green with the frequency dependence deliberately put back. Twenty has two
    // windows, and the second is where the old rule drifted.
    const at = (days) =>
      [...deloadIndexes(block({ sessions: 20, days }))].sort((a, b) => a - b).join(',');
    const starts = [...deloadIndexes(block({ sessions: 20, days: 2 }))].sort((a, b) => a - b);
    return (
      starts.length > 0 &&
      // Every frequency opens its windows at the same session numbers. The
      // windows differ in LENGTH, capped, so compare the openings.
      [2, 3, 4, 5].every((d) => {
        const idx = [...deloadIndexes(block({ sessions: 20, days: d }))].sort((a, b) => a - b);
        const opens = idx.filter((i) => !idx.includes(i - 1));
        return opens.join(',') === [DELOAD_EVERY_SESSIONS, DELOAD_EVERY_SESSIONS * 2].join(',');
      }) &&
      at(2) !== ''
    );
  })(),
  [2, 3, 4, 5]
    .map((d) => d + ': ' + [...deloadIndexes(block({ sessions: 20, days: d }))].sort((a, b) => a - b).join(','))
    .join(' | ')
);
check(
  // 24 of 36 got nothing under the old rule, the default among them.
  'and every block the builder offers from ten sessions up now has one',
  (() => {
    const missing = [];
    for (const sessions of [10, 12, 14, 16, 18, 20]) {
      for (const days of [2, 3, 4, 5]) {
        if (deloadIndexes(block({ sessions, days })).size === 0) missing.push(sessions + '/' + days);
      }
    }
    return missing.length === 0;
  })(),
  'blocks with no easier session at all'
);
check(
  // The half of the rule that is easy to lose, and the reason a window is
  // trimmed rather than dropped. Finishing a block on a deliberately light
  // session takes the ending away; the block boundary is its own rest.
  'and the last session of a block is never an easier one',
  (() => {
    for (const sessions of [10, 12, 14, 16, 18, 20]) {
      for (const days of [2, 3, 4, 5]) {
        const p = block({ sessions, days });
        if (deloadIndexes(p).has(sessions - 1)) return false;
      }
    }
    return true;
  })(),
  'a block that ends on a deload ends quietly'
);
check(
  // Trimming, not dropping. Under a naive "skip any window that would reach the
  // end" rule the five-day user loses their deload again, which is the exact
  // fault this whole change exists to remove.
  'a window that would reach the end is trimmed rather than thrown away',
  (() => {
    const p = block({ sessions: 12, days: 5 });
    const idx = [...deloadIndexes(p)].sort((a, b) => a - b);
    return idx.length > 0 && !idx.includes(11);
  })(),
  JSON.stringify([...deloadIndexes(block({ sessions: 12, days: 5 }))])
);
check(
  // A four session block is a try-it-out, and easing a quarter of it is absurd.
  'a block too short to have earned one still gets none',
  deloadIndexes(block({ sessions: 4, days: 2 })).size === 0 &&
    deloadIndexes(block({ sessions: 8, days: 3 })).size === 0,
  ''
);
check(
  'a long block gets more than one',
  (() => {
    const idx = [...deloadIndexes(block({ sessions: 20, days: 3 }))].sort((a, b) => a - b);
    // Two windows, one opening at each multiple of the interval.
    return idx.includes(DELOAD_EVERY_SESSIONS) && idx.includes(DELOAD_EVERY_SESSIONS * 2);
  })(),
  JSON.stringify([...deloadIndexes(block({ sessions: 20, days: 3 }))])
);
check(
  // An easier stretch is a week's worth, capped. Five days a week over twenty
  // sessions was two windows of five, which eased 40% of the block - not a
  // deload, a different programme.
  'and no block has more than a third of it eased',
  (() => {
    for (const sessions of [10, 12, 14, 16, 18, 20]) {
      for (const days of [2, 3, 4, 5]) {
        const p = block({ sessions, days });
        if (deloadIndexes(p).size / sessions > 1 / 3) return false;
      }
    }
    return true;
  })(),
  'the worst share is 20 sessions at 3+ days'
);
check(
  // A deload week on a cycle of prehab and mobility is meaningless: there is
  // nothing to ease. Naming one anyway would be the app inventing a rest from
  // work that is already rest.
  'a cycle with nothing to ease never has one',
  deloadWeeksFor(block({ templateId: 'joints', days: 2, sessions: 20 })).length === 0 &&
    !cycleHasLoadedWork(['prehab', 'flexibility']) &&
    cycleHasLoadedWork(['prehab', 'flexibility', 'full_body']),
  ''
);
check(
  'the sessions in the window are the ones marked, and no others',
  (() => {
    const p = block({ sessions: 20, days: 3 });
    const idx = [...deloadIndexes(p)].sort((a, b) => a - b);
    const inside = idx.every((i) => isDeloadIndex(p, i));
    const outside = [0, DELOAD_EVERY_SESSIONS - 1, 19].every((i) => !isDeloadIndex(p, i));
    return idx.length > 0 && inside && outside;
  })(),
  JSON.stringify([...deloadIndexes(block({ sessions: 20, days: 3 }))])
);
check(
  // The weeks list is for display only and is DERIVED from the sessions, so the
  // chips in the hub cannot claim a week the engine will not actually ease.
  'the weeks shown are exactly the weeks those sessions fall in',
  (() => {
    const p = block({ sessions: 20, days: 3 });
    const fromSessions = new Set(
      [...deloadIndexes(p)].map((i) => Math.floor(i / p.days) + 1)
    );
    const shown = deloadWeeksFor(p);
    return (
      shown.length === fromSessions.size && shown.every((w) => fromSessions.has(w))
    );
  })(),
  JSON.stringify(deloadWeeksFor(block({ sessions: 20, days: 3 })))
);
check(
  'an index past the end of the block is not in any week',
  !isDeloadIndex(block({ sessions: 20, days: 3 }), 99) &&
    !isDeloadIndex(block({ sessions: 20, days: 3 }), -1),
  ''
);
check(
  // The position is what four screens read, so this is the assertion that keeps
  // the home tile, the hub, the session screen and the summary saying the same
  // thing on the same day.
  'the position says whether the NEXT session is an easier one',
  (() => {
    const p = block({ sessions: 20, days: 3 });
    const cycle = cycleOf(p);
    const done = (n) => Array.from({ length: n }, (_, i) => cycle[i % cycle.length]);
    const eased = [...deloadIndexes(p)].sort((a, b) => a - b);
    const first = eased[0];
    // n done means index n is next.
    return (
      programmePosition(p, done(first)).deload === true &&
      programmePosition(p, done(first - 1)).deload === false &&
      programmePosition(p, done(eased[eased.length - 1] + 1)).deload === false
    );
  })(),
  JSON.stringify([...deloadIndexes(block({ sessions: 20, days: 3 }))])
);
check(
  // Four screens read the position, so the session numbers it publishes have to
  // be the same ones isDeloadIndex answers for.
  'and the session numbers it publishes are the ones the engine will ease',
  (() => {
    const p = block({ sessions: 20, days: 3 });
    const pos = programmePosition(p, []);
    return (
      pos.deloadSessions.length === deloadIndexes(p).size &&
      pos.deloadSessions.every((n) => isDeloadIndex(p, n - 1))
    );
  })(),
  JSON.stringify(programmePosition(block({ sessions: 20, days: 3 }), []).deloadSessions)
);
check(
  'a finished block is never also an easier week',
  programmePosition(block({ sessions: 4, days: 2 }), ['squat', 'bench', 'deadlift', 'squat'])
    .deload === false,
  ''
);
check(
  // Read at the index the session OCCUPIED, not the one after it. Off by one
  // here labels the wrong week easier in the history, on a certificate somebody
  // may have shared.
  'a logged session is tagged at the index it actually occupied',
  (() => {
    const p = block({ sessions: 20, days: 3 });
    const cycle = cycleOf(p);
    const tags = tagSessions(
      p,
      Array.from({ length: 12 }, (_, i) => cycle[i % cycle.length])
    );
    // Every tag has to agree with the schedule at its own index, and the block
    // index has to be the 1-based position, not the one after it.
    return (
      tags.every((t, i) => t.deload === isDeloadIndex(p, i)) &&
      tags[9].blockIndex === 10 &&
      tags.some((t) => t.deload)
    );
  })(),
  JSON.stringify(tagSessions(block({ sessions: 20, days: 3 }), Array.from({ length: 12 }, (_, i) => cycleOf(block({ sessions: 20, days: 3 }))[i % 3])).map((t) => t.deload))
);
check(
  'an off-plan session is never an easier week, whatever week it fell in',
  (() => {
    const p = block({ sessions: 20, days: 3 });
    const cycle = cycleOf(p);
    const hist = Array.from({ length: 9 }, (_, i) => cycle[i % cycle.length]);
    hist.push('flexibility');
    const tags = tagSessions(p, hist);
    return tags[9].onPlan === false && tags[9].deload === false;
  })(),
  ''
);
check(
  // ROW FOR ROW, not week for week. A trimmed window covers part of a week, and
  // marking the whole week in the printed plan would promise an easier session
  // the engine is going to build at full weight.
  'the block plan marks the same SESSIONS the engine will ease',
  (() => {
    const p = block({ sessions: 20, days: 3 });
    return blockPlan(p).every((row, i) => row.deload === isDeloadIndex(p, i));
  })(),
  ''
);
check(
  'and it is the same for a block whose window had to be trimmed',
  (() => {
    const p = block({ sessions: 12, days: 5 });
    return blockPlan(p).every((row, i) => row.deload === isDeloadIndex(p, i));
  })(),
  ''
);

// ─── The block being trained around ─────────────────────────────────────────
//
// "Train whatever you want in between" is kept perfectly and was never READ.
// Somebody doing five sessions a fortnight with one on plan got no
// acknowledgement of it and was offered a squat every time they opened Home.
//
// The bar has to be high. An app that asks whether you are on the right
// programme after one busy fortnight is an app that nags, and the promise it
// would be nagging about is the promise that nothing you choose costs you
// anything.
console.log('\n[E] The programme notices being trained around');

const drifting = (over) => ({
  templateId: 'barbell',
  days: 3,
  sessions: 20,
  minutes: 45,
  startedAt: '2026-01-01T00:00:00.000Z',
  startedAtSessionCount: 0,
  ...over,
});

check(
  'a fortnight of doing something else is not drift',
  (() => {
    const p = drifting();
    // Seven sessions, none on plan. Under the window, so nothing is said.
    return programmeDrift(p, Array(7).fill('conditioning')) === null;
  })(),
  ''
);
check(
  'but eight sessions with almost none on plan is',
  (() => {
    const p = drifting();
    const d = programmeDrift(p, [...Array(7).fill('conditioning'), 'squat']);
    return !!d && d.onPlan === 1 && d.window === DRIFT_WINDOW && d.favoured === 'conditioning';
  })(),
  JSON.stringify(programmeDrift(drifting(), [...Array(7).fill('conditioning'), 'squat']))
);
check(
  'somebody following their programme is never told they are not',
  (() => {
    const p = drifting();
    const cycle = cycleOf(p);
    const done = Array.from({ length: 12 }, (_, i) => cycle[i % cycle.length]);
    return programmeDrift(p, done) === null;
  })(),
  ''
);
check(
  // Three out of eight is a person having a mixed month, and the app has
  // promised them in as many words that this costs them nothing.
  'and neither is somebody doing a bit of both',
  (() => {
    const p = drifting();
    const cycle = cycleOf(p);
    const done = ['conditioning', cycle[0], 'flexibility', cycle[1], 'conditioning', cycle[2], 'flexibility', 'conditioning'];
    const d = programmeDrift(p, done);
    return d === null && DRIFT_MAX_ON_PLAN < 3;
  })(),
  JSON.stringify(programmeDrift(drifting(), ['conditioning', 'squat', 'flexibility', 'bench', 'conditioning', 'deadlift', 'flexibility', 'conditioning']))
);
check(
  /**
   * The whole history is tagged and only the tail is read. Slicing first and
   * replaying from the window's own start would begin the cycle again at its
   * first item, call on-plan sessions off-plan, and accuse somebody of drifting
   * on the strength of an arithmetic error.
   *
   * THE SHAPE MATTERS AND THE FIRST VERSION OF THIS CHECK HAD THE WRONG ONE.
   * It used the three item barbell cycle, and a replay started mid-cycle
   * resynchronises within two sessions - so the miscount could never reach the
   * threshold and the check stayed green with the bug deliberately put back in.
   *
   * An eight item cycle offset by exactly one is the worst case: the replay
   * expects the first item and does not see it again until the very last
   * session of the window, so it reports one on plan out of eight. That is a
   * person following their programme perfectly, being told they have abandoned
   * it.
   */
  'the window is read against the whole history, not replayed from its own start',
  (() => {
    const cycle = ['squat', 'bench', 'deadlift', 'upper_body', 'lower_body', 'full_body', 'conditioning', 'prehab'];
    const p = drifting({ templateId: 'custom', custom: { name: 'Mine', cycle }, sessions: 20 });
    // Nine sessions, every one of them on plan. The window is the last eight,
    // which begins at the cycle's SECOND item.
    const done = Array.from({ length: 9 }, (_, i) => cycle[i % cycle.length]);
    return programmeDrift(p, done) === null;
  })(),
  JSON.stringify(
    programmeDrift(
      drifting({
        templateId: 'custom',
        custom: {
          name: 'Mine',
          cycle: ['squat', 'bench', 'deadlift', 'upper_body', 'lower_body', 'full_body', 'conditioning', 'prehab'],
        },
        sessions: 20,
      }),
      Array.from(
        { length: 9 },
        (_, i) =>
          ['squat', 'bench', 'deadlift', 'upper_body', 'lower_body', 'full_body', 'conditioning', 'prehab'][i % 8]
      )
    )
  )
);
check(
  'a paused programme is not being ignored, it is paused',
  programmeDrift(drifting({ paused: true }), Array(10).fill('conditioning')) === null,
  ''
);
check(
  'it names what they have actually been doing instead',
  (() => {
    const d = programmeDrift(drifting(), [
      'prehab',
      'prehab',
      'flexibility',
      'prehab',
      'prehab',
      'flexibility',
      'prehab',
      'flexibility',
    ]);
    return d?.favoured === 'prehab';
  })(),
  ''
);
check(
  // The point of the message. Naming a programme that fits what somebody has
  // actually been doing is the difference between an observation and an offer.
  'and points at the programme that fits it, when one does',
  (() => {
    const d = programmeDrift(drifting(), [
      'prehab',
      'flexibility',
      'prehab',
      'flexibility',
      'prehab',
      'flexibility',
      'prehab',
      'flexibility',
    ]);
    return d?.suggestion === 'joints';
  })(),
  JSON.stringify(
    programmeDrift(drifting(), ['prehab', 'flexibility', 'prehab', 'flexibility', 'prehab', 'flexibility', 'prehab', 'flexibility'])
  )
);
check(
  /**
   * Moving somebody to a programme that covers one more session in eight is
   * churn dressed up as insight.
   *
   * The first version of this compared a perfect fit against programmes that fit
   * not at all, so the margin was never what decided it and removing the margin
   * left the check green. This is two programmes that are genuinely close:
   * seven full body sessions and one conditioning, against Full Body
   * Foundations. Lean and Fit does cover the odd conditioning session, and that
   * is not a reason to move anybody.
   */
  'but only by a clear margin, never by a hair',
  (() => {
    const recent = [...Array(7).fill('full_body'), 'conditioning'];
    return closestProgramme(recent, 'foundations') === null;
  })(),
  `${closestProgramme([...Array(7).fill('full_body'), 'conditioning'], 'foundations')}`
);
check(
  // And the other side of the same rule, so it cannot be satisfied by never
  // suggesting anything at all.
  'while a genuinely different pattern does get named',
  closestProgramme([...Array(4).fill('full_body'), ...Array(4).fill('conditioning')], 'foundations') ===
    'lean',
  `${closestProgramme([...Array(4).fill('full_body'), ...Array(4).fill('conditioning')], 'foundations')}`
);
check(
  'and never at the programme they are already on',
  (() => {
    const d = programmeDrift(drifting({ templateId: 'joints' }), Array(8).fill('prehab'));
    return d === null || d.suggestion !== 'joints';
  })(),
  ''
);
check(
  'a cycle somebody built themselves is never suggested to anybody',
  closestProgramme(Array(8).fill('full_body'), 'barbell') !== 'custom',
  ''
);

// ─── The certificate says what the new answers did ──────────────────────────
//
// The reasons list exists because the app has just made a decision on somebody's
// behalf, and naming the answer that caused it is what separates a considered
// app from a black box. Three answers that change the prescription and say
// nothing on the page explaining the prescription is the black box growing.
console.log('\n[F] Every answer that changed something says so');

const outcome = (over = {}) => ({
  name: 'Archie',
  focus: 'strength',
  days: 3,
  minutes: 45,
  sessions: 12,
  experience: 'intermediate',
  ageYears: 34,
  sex: 'male',
  bodyweightKg: 82,
  equipmentTiers: ['fullgym'],
  soreRegions: [],
  soreFor: null,
  testWeekFrequency: 'never',
  oneRepMaxes: { squat: null, bench: null, deadlift: null },
  screenPassed: null,
  avoidRegions: [],
  maxKitKg: 0,
  ...over,
});

const said = (over) => programmeReasons(outcome(over)).join(' ');

check(
  'a movement check they have not got yet is named, and in words they would use',
  (() => {
    const line = said({ screenPassed: ['hinge', 'squat', 'push', 'lunge', 'carry'] });
    // "pull" is what the ladder calls it. Nobody says it about themselves.
    return /pull-up/.test(line) && /foundation/.test(line) && !/\bpull\b(?!-)/.test(line);
  })(),
  said({ screenPassed: ['hinge', 'squat', 'push', 'lunge', 'carry'] })
);
check(
  // A full house changes nothing, so a line about it would be an explanation of
  // something that did not happen.
  'passing all six says nothing at all',
  !/foundation version/.test(said({ screenPassed: ['hinge', 'squat', 'lunge', 'push', 'pull', 'carry'] })),
  ''
);
check(
  'and skipping the screen says nothing either',
  !/foundation version/.test(said({ screenPassed: null })),
  'somebody who was never asked must not be told what their answer did'
);
check(
  'passing none of it is said in one sentence rather than six',
  (() => {
    const line = said({ screenPassed: [] });
    return /everything starts from the foundation version/i.test(line);
  })(),
  said({ screenPassed: [] })
);
check(
  'the kit ceiling is named with its number',
  /above 24 kg/.test(said({ maxKitKg: 24 })) && !/above 0/.test(said({ maxKitKg: 0 })),
  said({ maxKitKg: 24 })
);
check(
  'and the clinical instruction is said in its own words, not as soreness',
  (() => {
    const line = said({ avoidRegions: ['front_shoulder'] });
    return /clinician/.test(line) && /whether or not it hurts/.test(line);
  })(),
  said({ avoidRegions: ['front_shoulder'] })
);
check(
  'no reason ever reads as an unfinished sentence',
  [
    said({}),
    said({ screenPassed: [] }),
    said({ screenPassed: ['hinge'] }),
    said({ maxKitKg: 20, avoidRegions: ['knee'] }),
  ].every((line) => !/undefined|NaN|null|,\s*\./.test(line)),
  ''
);

console.log(`\nprogramme: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
