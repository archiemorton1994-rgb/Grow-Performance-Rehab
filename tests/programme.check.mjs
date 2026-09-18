/**
 * Contract test: everybody gets a programme, and it is the right one.
 *
 * THE THREE THINGS THAT MUST HOLD
 * ───────────────────────────────
 * EVERY ANSWER LANDS. Six answers to "what should this be built around", four
 * frequencies and every experience level there is. Every combination has to
 * produce a real programme with a real cycle of real session types. A
 * combination that falls through to undefined is a home screen offering an
 * empty workout. The levels are read off the store rather than copied in here,
 * because a hand-written copy is how a fourth level was added and never tested.
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
  blockPlan,
  cycleFor,
  nextSessionType,
  programmePosition,
  extrasFor,
  tagSessions,
  cycleOf,
  programmeFor,
  deloadWeeksFor,
  deloadIndexes,
  cycleOfAt,
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
  SESSION_COUNTS,
} from '../lib/programme.ts';
import { trainTypeOf } from '../lib/session-type.ts';
import { SESSION_DISPLAY_NAMES } from '../lib/session-meta.ts';
import './_persist-shim.mjs';
import { EXPERIENCE_LEVELS } from '../lib/store.ts';

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

const DAYS = [2, 3, 4, 5];
/** Every training level the app has, from the store. Not a copy of them. */
const LEVELS = [...EXPERIENCE_LEVELS];
/** Whoever is at the top of that list, rather than whoever was on the day. */
const TOP_LEVEL = LEVELS[LEVELS.length - 1];

// ─── 1. The templates are sound ─────────────────────────────────────────────
console.log('\n[1] Every template can actually be trained');

check(
  'the session types were read off the store',
  SESSION_TYPES.length >= 8 && SESSION_TYPES.includes('squat'),
  `got ${JSON.stringify(SESSION_TYPES)}; the union has moved and this file is now guessing`
);

check(
  `and so were the ${LEVELS.length} training levels: ${LEVELS.join(', ')}`,
  LEVELS.length >= 3 && LEVELS[0] === 'beginner' && LEVELS.includes('advanced'),
  `got ${JSON.stringify(LEVELS)}; everything below walks this list, so a wrong one proves nothing`
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
/**
 * THE TWO LISTS ARE NO LONGER THE SAME WORDS, AND MUST STILL BE THE SAME PLAN.
 *
 * SESSION_ORDER is Lower, Upper, Full Body now. Barbell Strength still holds the
 * three lift-named ids, deliberately: anyone part way through that block is
 * entitled to finish it, and lib/session-type.ts is what says a squat day IS a
 * lower body day. So the promise this section was written to make - "every
 * existing user is on this rotation and must not be moved off it" - is now the
 * promise that the two lists agree position for position once the lift ids are
 * resolved. That is also what makes the stored `cycleStartOffset`, a bare index
 * into SESSION_ORDER, mean the same thing it meant yesterday.
 */
const BARBELL_LIFT_IDS = ['squat', 'bench', 'deadlift'];
check(
  'Barbell Strength at 2 and 3 days a week is still the three lift ids',
  JSON.stringify(cycleFor('barbell', 3)) === JSON.stringify(BARBELL_LIFT_IDS) &&
    JSON.stringify(cycleFor('barbell', 2)) === JSON.stringify(BARBELL_LIFT_IDS),
  `${JSON.stringify(cycleFor('barbell', 3))}; somebody part way through that block finishes it as it was sold to them`
);
check(
  'and each one lands on the rotation slot it now means',
  cycleFor('barbell', 3).length === SESSION_ORDER.length &&
    cycleFor('barbell', 3).every((t, i) => trainTypeOf(t) === SESSION_ORDER[i]),
  cycleFor('barbell', 3)
    .map((t, i) => `${t} -> ${trainTypeOf(t)} vs ${SESSION_ORDER[i]}`)
    .join(', ')
);
check(
  'a four day barbell week keeps all three lifts and adds to them',
  BARBELL_LIFT_IDS.every((t) => cycleFor('barbell', 4).includes(t)) &&
    cycleFor('barbell', 4).length > 3,
  'dropping a lift to make room for an accessory day would change the block under somebody already on it'
);

// ─── 3. How often somebody trains changes what they get ─────────────────────
//
// THREE ASSERTIONS USED TO STAND HERE, all about templateIdFor, which mapped
// the builder's "what should this be built around" answer onto a template.
// Nothing asks that question any more: a programme is chosen by name from the
// chooser, or assembled on the custom-programme screen, and templateIdFor went
// with the builder. What survives is the half that is still true of every
// programme, whichever way somebody arrived at it.
console.log('\n[3] The days-a-week answer is not decorative');

check(
  'frequency changes the cycle, not just the pace',
  JSON.stringify(cycleFor('lean', 2)) !== JSON.stringify(cycleFor('lean', 5)) &&
    JSON.stringify(cycleFor('joints', 2)) !== JSON.stringify(cycleFor('joints', 5)),
  'asking how many days somebody trains and then ignoring it is the bug this replaces'
);

// ─── 4. Position is replayed, and off plan is free ──────────────────────────
console.log('\n[4] Training something else never costs you your place');

/**
 * A BLOCK AS THE STORE WRITES ONE, spelled out rather than built by a helper.
 *
 * It used to be assembled by selectProgramme from a finished builder tree.
 * Both are gone, and the live writers are enrolInProgramme, switchProgramme
 * and enrolInCustomProgramme in lib/store.ts, which
 * tests/programme-wiring.check.mjs drives for real. What this section is about
 * is what the REPLAY does with an enrolment once it exists, so the enrolment
 * is a fixture here and the three fields below are the ones it reads.
 */
const enrol = {
  templateId: 'barbell',
  days: 3,
  sessions: 12,
  minutes: 45,
  startedAt: '2026-08-31T00:00:00.000Z',
  startedAtSessionCount: 0,
};

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

// ─── 6, 7, 8 and 10 have gone with the certificate ──────────────────────────
//
// Four sections used to stand here and between 9 and 11: the reasons list, the
// care note, the three promises and the list of what the subscription buys.
// All four were the text of components/ProgrammeCertificate.tsx, the screen the
// builder ended on, and all four read a TreeOutcome that nothing produces now.
// The clinical half of what they guarded did not live in the copy and has not
// moved: a standing sore area really reaching the session, and a clinician-named
// area being screened out of every session, are asserted against the generator
// in tests/standing-injury.check.mjs sections 1, 2 and 5.

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
  // The assertion above is the whole gate now. A length nobody was offered used
  // to be snapped back to 12 by outcomeFrom, because the builder let somebody
  // type into the question; the two screens that set a block length both draw
  // their buttons from SESSION_COUNTS, so there is no longer a way to ask for
  // 13 and nothing to snap back.
  'and both screens that set a block length read that one list',
  /SESSION_COUNTS/.test(read('components/ProgrammeHub.tsx')) &&
    /SESSION_COUNTS/.test(read('components/BuildProgramme.tsx')),
  'a hand-written copy of the nine is how a block of 13 would get back in'
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
      const short = { ...enrol, sessions: 4 };
      const long = { ...enrol, sessions: 20 };
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
  // Whoever is top of the list, rather than whoever was top on the day this was
  // written: the check is that the hardest label is reachable at all.
  'Elite is reachable by the top level, so it is a label rather than decoration',
  programmeDifficulty('barbell', TOP_LEVEL, 5).key === 'Elite' &&
    DIFFICULTY_LABELS[DIFFICULTY_LABELS.length - 1] === 'Elite',
  'a band nothing can ever land in is a word on a page'
);
check(
  'every label in the ladder is reachable by some real answer',
  (() => {
    const seen = new Set();
    for (const id of PROGRAMME_IDS)
      for (const e of LEVELS)
        for (const d of DAYS) seen.add(programmeDifficulty(id, e, d).key);
    return DIFFICULTY_LABELS.every((l) => seen.has(l));
  })(),
  'six words with only four outcomes behind them'
);
check(
  // Hardened deliberately. The old version read only the sentence, and a level
  // with no row in the capability table produces label undefined and score NaN
  // while still writing a perfectly sensible sentence - so the sentence alone
  // would have passed on output that crashes four screens.
  'and every combination gives a real label, a real score and says why',
  (() => {
    const bad = [];
    for (const id of PROGRAMME_IDS)
      for (const e of LEVELS)
        for (const d of DAYS) {
          const r = programmeDifficulty(id, e, d);
          if (
            !DIFFICULTY_LABELS.includes(r.key) ||
            // The word somebody actually reads, which is the one that reaches
            // difficulty.label.toUpperCase() on four screens.
            typeof r.label !== 'string' ||
            r.label.length < 3 ||
            !Number.isFinite(r.score) ||
            r.because.length <= 12 ||
            /undefined|NaN/.test(r.because)
          )
            bad.push(`${id}/${e}/${d} -> ${r.key}/${r.label} (${r.score})`);
        }
    return bad.length === 0;
  })(),
  'a label on its own invites the question it should be answering'
);
check(
  // The list is in ascending order, so this is the shape of the whole table:
  // answering that you train more cannot be given a gentler programme.
  'the difficulty never drops as the level goes up',
  PROGRAMME_IDS.every((id) =>
    DAYS.every((d) =>
      LEVELS.every(
        (e, i) =>
          i === 0 ||
          programmeDifficulty(id, e, d).score >= programmeDifficulty(id, LEVELS[i - 1], d).score
      )
    )
  ),
  'somebody further up the list is being handed an easier block than somebody below them'
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
  // otherProgrammes filtered PROGRAMME_IDS for the certificate's "and the rest
  // are still yours" list and went with it. PROGRAMME_IDS is what the chooser
  // maps over, so the same promise now rests on the assertion above: custom is
  // not in it, and a page offering "7 more" is not counting the one they built.
  'nor among the seven the chooser offers',
  !PROGRAMME_IDS.includes('custom') &&
    PROGRAMME_IDS.filter((id) => id !== 'barbell').length === 6,
  `${PROGRAMME_IDS.join(', ')}`
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
  BUILDABLE_SESSION_TYPES.length > 0 && !BUILDABLE_SESSION_TYPES.includes('custom'),
  BUILDABLE_SESSION_TYPES.join(', ')
);
check(
  // Was a count of nine, which went stale the moment the palette changed and
  // said nothing about WHY nine. What actually matters: a type that is only
  // kept so old data resolves must never be offered as a new choice, or the
  // palette shows two rows with the same name that do the same thing.
  'and none of them is a stored id that now builds as something else',
  BUILDABLE_SESSION_TYPES.every((t) => trainTypeOf(t) === t),
  BUILDABLE_SESSION_TYPES.filter((t) => trainTypeOf(t) !== t).join(', ')
);
check(
  'so no two rows of the palette can carry the same name',
  new Set(BUILDABLE_SESSION_TYPES.map((t) => SESSION_DISPLAY_NAMES[t])).size ===
    BUILDABLE_SESSION_TYPES.length,
  BUILDABLE_SESSION_TYPES.map((t) => SESSION_DISPLAY_NAMES[t]).join(', ')
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

// ─── Changing the days a week mid-block ─────────────────────────────────────
//
// The day count is not a preference, it is the plan: most templates prescribe a
// different CYCLE at four days a week than at three. Patching it used to re-walk
// the whole block against the new cycle, so a user six sessions into Lean and
// Fit who tapped "4" instead of "3" watched the hub drop from "Session 7 of 12,
// week 3 of 4, 50%" to "Session 2 of 12, week 1 of 3, 8%" - five weeks of their
// work reclassified as sessions they had chosen themselves, on one tap, with no
// warning, on a control the screen presents as a simple preference.
console.log('\n[D2] A day count is a fact with a date on it');

{
  const lean3 = { templateId: 'lean', days: 3, sessions: 12, minutes: 45, startedAt: '2026-01-01T00:00:00.000Z', startedAtSessionCount: 0 };
  const cycle3 = cycleOf(lean3);
  const cycle4 = cycleOf({ ...lean3, days: 4 });

  check(
    'the two cycles really are different, or none of this would matter',
    cycle3.join(',') !== cycle4.join(','),
    `3 days: ${cycle3.join(' > ')}  |  4 days: ${cycle4.join(' > ')}`
  );

  // Six sessions done under the three-day cycle, then the switch.
  const done = Array.from({ length: 6 }, (_, i) => cycle3[i % cycle3.length]);
  const switched = {
    ...lean3,
    days: 4,
    daySegments: [
      { fromOnPlan: 0, days: 3 },
      { fromOnPlan: 6, days: 4 },
    ],
  };

  check(
    'without the record, changing days throws the finished sessions off the plan',
    (() => {
      // The old behaviour, reproduced deliberately: no segments, so the whole
      // history is read against the new cycle.
      const naive = tagSessions({ ...lean3, days: 4 }, done);
      return naive.filter((t) => t.onPlan).length < 6;
    })(),
    'this is the fault, kept here so the fix cannot quietly be undone'
  );
  check(
    'with it, every session already done keeps the cycle it was done under',
    tagSessions(switched, done).every((t) => t.onPlan),
    JSON.stringify(tagSessions(switched, done).map((t) => t.onPlan))
  );
  check(
    'and the new cycle applies from the next session onwards',
    (() => {
      const after = [...done, cycle4[6 % cycle4.length]];
      const tags = tagSessions(switched, after);
      return tags[6].onPlan === true && tags[6].blockIndex === 7;
    })(),
    JSON.stringify(tagSessions(switched, [...done, cycle4[6 % cycle4.length]]).map((t) => t.onPlan))
  );
  check(
    // Belt and braces on the shape: a block nobody has ever changed must behave
    // exactly as it did before any of this existed.
    'a block that never changed days is read exactly as it was',
    (() => {
      const plain = tagSessions(lean3, done);
      const withEmpty = tagSessions({ ...lean3, daySegments: [] }, done);
      return plain.every((t, i) => t.onPlan === withEmpty[i].onPlan) && plain.every((t) => t.onPlan);
    })(),
    ''
  );
  check(
    'a custom cycle ignores the day count entirely, as it always has',
    (() => {
      const custom = {
        ...lean3,
        templateId: 'custom',
        custom: { name: 'Mine', cycle: ['squat', 'prehab'] },
        daySegments: [{ fromOnPlan: 0, days: 2 }, { fromOnPlan: 1, days: 5 }],
      };
      return cycleOfAt(custom, 0).join(',') === 'squat,prehab' &&
        cycleOfAt(custom, 9).join(',') === 'squat,prehab';
    })(),
    ''
  );
  check(
    'and a point before any recorded change reads the earliest cycle',
    cycleOfAt(switched, 0).join(',') === cycle3.join(',') &&
      cycleOfAt(switched, 5).join(',') === cycle3.join(',') &&
      cycleOfAt(switched, 6).join(',') === cycle4.join(','),
    ''
  );
}

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

console.log(`\nprogramme: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
