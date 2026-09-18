/**
 * Contract test: a programme is optional, it can be stopped, and the level
 * control offers the four levels the app actually has.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * Three promises land together, and all three are easy to break quietly.
 *
 *   1. YOU CAN STOP. Until now the only way out of a block was to start a
 *      different block. leaveProgramme existed in the store and was called by
 *      nothing in the whole app. The hub has the control now, and what has to be
 *      true afterwards is not that a button exists but that the app goes back to
 *      suggesting from what somebody has been training, exactly as it does for
 *      everybody who never chose a programme.
 *
 *   2. TWO PROGRAMMES LEFT THE LIST AND STAYED IN THE DATA. Archie's decision
 *      12. Barbell Strength and Build Muscle are no longer offered, and anybody
 *      part way through one finishes it. That second half is the fragile one:
 *      programmeFor falls back to Full Body Foundations for an id it does not
 *      recognise, so deleting them instead of retiring them would have turned
 *      every frozen report and every running block into somebody else's
 *      programme, silently, and looked like the app working.
 *
 *   3. FOUR LEVELS, ONE LIST, AND AN HONEST NOTE UNDER IT. A level a control
 *      cannot draw is a level somebody is demoted out of by tapping the one next
 *      to it. And the note under the control has to stop promising harder
 *      movements between Advanced and Athlete, because today the engine hands
 *      those two identical sessions.
 *
 * HOW IT TESTS, which matters more here than what it tests. Sections 1, 2, 3, 4,
 * 5 and 7 RUN the real store, the real templates and the real copy functions:
 * they enrol, log sessions, stop, and read the suggestion back. Section 6 is the
 * one seam a node check cannot cross - a React Native screen's own JSX - and it
 * is declared as that rather than dressed up as behaviour.
 *
 * Run:  npx tsx tests/programmes-optional.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import './_persist-shim.mjs';
import { readFileSync } from 'fs';

globalThis.__DEV__ = false;

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    if (detail) console.error(`      ${detail}`);
    failed++;
  }
}

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
/** Comments are not behaviour, and a comment explaining a removal reads exactly
 *  like the thing it removed. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const { useAppStore, SESSION_ORDER, EXPERIENCE_LEVELS } = await import('../lib/store.ts');
const {
  PROGRAMMES,
  PROGRAMME_IDS,
  OFFERED_PROGRAMME_IDS,
  RETIRED_PROGRAMME_IDS,
  DIFFICULTY_LABELS,
  DIFFICULTY_DISPLAY_NAMES,
  closestProgramme,
  cycleFor,
  cycleOf,
  blockPlan,
  nameOf,
  programmeDifficulty,
  programmeFor,
  levelBandForExperience,
} = await import('../lib/programme.ts');
const { levelBandFor } = await import('../lib/exercise-levels.ts');
const { SESSION_DISPLAY_NAMES } = await import('../lib/session-meta.ts');
const { trainTypeOf } = await import('../lib/session-type.ts');
const {
  EXPERIENCE_LABELS,
  EXPERIENCE_OPTIONS,
  experienceNote,
  levelsTrainedTheSameAs,
} = await import('../lib/experience-options.ts');

const S = () => useAppStore.getState();

let seq = 0;
const session = (sessionType) => ({
  id: `s${seq++}`,
  sessionType,
  date: new Date(Date.now() - seq * 86400000).toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  energy: 'normal',
  timeAvailable: '45',
  exerciseCount: 6,
  exerciseLogs: [],
});
/** Newest first, which is how the store holds them. */
const historyOf = (types, n) =>
  Array.from({ length: n }, (_, i) => session(types[i % types.length]));

const PROFILE = (experienceLevel = 'intermediate') => ({
  name: 'Probe',
  sex: 'male',
  experienceLevel,
  goals: ['muscle'],
  bodyweightKg: 80,
  earnedLevelBonus: 0,
});

function seed({ level = 'intermediate', history = [], offset = 0 } = {}) {
  useAppStore.setState({
    programme: null,
    completedProgrammes: [],
    completedSessions: history,
    completedCount: history.length,
    cycleStartOffset: offset,
    userProfile: PROFILE(level),
    earnedBadges: [],
    lastReadinessTime: '45',
  });
}

// ─── 1. Stopping hands the sessions back ────────────────────────────────────
console.log('\n[1] Stopping a programme puts somebody back on the rotation');

const history = historyOf(['lower_body', 'upper_body', 'full_body', 'conditioning'], 7);
seed({ history });
const rotationAnswer = S().getCurrentSessionType();
check(
  `with no programme, the app suggests from what they have trained (${rotationAnswer})`,
  SESSION_ORDER.includes(rotationAnswer),
  `got ${rotationAnswer}, and the rotation is ${SESSION_ORDER.join(', ')}`
);

S().enrolInProgramme('joints', '2026-08-31T09:00:00.000Z');
const enrolledAnswer = S().getCurrentSessionType();
check(
  `enrolling makes the block decide instead (${enrolledAnswer})`,
  enrolledAnswer === S().getProgrammePosition()?.next && enrolledAnswer !== rotationAnswer,
  `got ${enrolledAnswer}, block asked for ${S().getProgrammePosition()?.next}`
);

const sessionsBefore = S().completedSessions.length;
S().leaveProgramme();
check(
  'stopping it leaves nobody enrolled',
  S().programme === null && S().getProgrammePosition() === null,
  JSON.stringify(S().programme)
);
check(
  'and the suggestion is the rotation again, the same answer as never having had one',
  S().getCurrentSessionType() === rotationAnswer,
  `got ${S().getCurrentSessionType()}, expected ${rotationAnswer}`
);
check(
  'every session they logged is still there',
  S().completedSessions.length === sessionsBefore && sessionsBefore === 7,
  `${S().completedSessions.length} of ${sessionsBefore}`
);
check(
  'stopping twice is not an error',
  (() => {
    S().leaveProgramme();
    return S().programme === null && S().getCurrentSessionType() === rotationAnswer;
  })(),
  ''
);

/**
 * The beginner half, because the rotation is not the only thing "back to
 * normal" can mean. Archie's second decision: a beginner with no earned rung
 * gets Full Body every session, and stopping a block has to return them to that
 * rather than to the three-session rotation.
 */
seed({ level: 'beginner', history });
S().enrolInProgramme('upper_lower', '2026-08-31T09:00:00.000Z');
const beginnerEnrolled = S().getCurrentSessionType();
S().leaveProgramme();
check(
  'a beginner who stops is offered Full Body again, not the rotation',
  beginnerEnrolled !== 'full_body' && S().getCurrentSessionType() === 'full_body',
  `on the block: ${beginnerEnrolled}, after stopping: ${S().getCurrentSessionType()}`
);

/**
 * Stopping is not pausing, and the hub offers both. Pausing keeps the block and
 * the place in it; stopping puts it down. If the two ever became the same
 * action, one of the two controls would be lying about what it does.
 */
seed({ history });
S().enrolInProgramme('lean', '2026-08-31T09:00:00.000Z');
S().setProgrammePaused(true);
const pausedKeeps = S().programme !== null && S().getProgrammePosition() !== null;
const pausedSuggestion = S().getCurrentSessionType();
S().leaveProgramme();
check(
  'pausing keeps the block and stopping does not, and both hand the suggestion back',
  pausedKeeps &&
    pausedSuggestion === rotationAnswer &&
    S().programme === null &&
    S().getProgrammePosition() === null,
  `paused kept a programme: ${pausedKeeps}, paused suggestion: ${pausedSuggestion}`
);

// ─── 2. The two that left the list are still in the data ────────────────────
console.log('\n[2] Barbell Strength and Build Muscle still resolve for anyone on one');

check(
  'both are still named programmes',
  RETIRED_PROGRAMME_IDS.length === 2 &&
    RETIRED_PROGRAMME_IDS.every((id) => PROGRAMME_IDS.includes(id)) &&
    RETIRED_PROGRAMME_IDS.includes('barbell') &&
    RETIRED_PROGRAMME_IDS.includes('muscle'),
  RETIRED_PROGRAMME_IDS.join(', ')
);
for (const [id, name] of [
  ['barbell', 'Barbell Strength'],
  ['muscle', 'Build Muscle'],
]) {
  check(
    `programmeFor('${id}') still resolves to ${name} rather than falling back`,
    programmeFor(id).id === id &&
      programmeFor(id).name === name &&
      // The trap this guards. programmeFor ends in `?? PROGRAMMES.foundations`,
      // so a deleted template does not throw: it quietly becomes somebody
      // else's programme and looks like the app working.
      programmeFor(id).id !== 'foundations',
    `${programmeFor(id).id} / ${programmeFor(id).name}`
  );
  check(
    `and a ${name} block still has a cycle to prescribe from at every frequency`,
    [2, 3, 4, 5].every((d) => cycleFor(id, d).length > 0),
    [2, 3, 4, 5].map((d) => `${d}: ${cycleFor(id, d).join(',')}`).join(' | ')
  );
}

/** Somebody nine weeks in finishes: the position advances, the plan draws, and
 *  the session they are sent to is named after a body part rather than a lift. */
seed({ history: [] });
S().enrolInProgramme('barbell', '2026-08-31T09:00:00.000Z');
S().updateProgramme({ days: 3, sessions: 4 });
const barbellCycle = cycleOf(S().programme);
// Newest first, so chronologically this is the first two sessions of the cycle.
useAppStore.setState({
  completedSessions: [session(barbellCycle[1]), session(barbellCycle[0])],
});
const barbellPos = S().getProgrammePosition();
check(
  'two sessions into a Barbell Strength block, the block says so',
  barbellPos?.onPlan === 2 && barbellPos?.totalSessions === 4 && !barbellPos?.complete,
  JSON.stringify(barbellPos)
);
check(
  'the whole block still lays out',
  blockPlan(S().programme).length === 4,
  `${blockPlan(S().programme).length} rows`
);
const barbellNext = S().getCurrentSessionType();
check(
  `and the next session is named after the body it trains (${SESSION_DISPLAY_NAMES[barbellNext]})`,
  barbellNext === barbellPos.next &&
    SESSION_DISPLAY_NAMES[barbellNext] === SESSION_DISPLAY_NAMES[trainTypeOf(barbellNext)] &&
    !/squat|bench|deadlift/i.test(SESSION_DISPLAY_NAMES[barbellNext]),
  `${barbellNext} -> ${SESSION_DISPLAY_NAMES[barbellNext]}`
);

/** And the block can still be finished and frozen, which is what "stored
 *  reports resolve" means when somebody opens one a year later. */
useAppStore.setState({
  completedSessions: [
    session(barbellCycle[0]),
    session(barbellCycle[1]),
    session(barbellCycle[2] ?? barbellCycle[0]),
    session(barbellCycle[0]),
  ].reverse(),
});
S().archiveIfBlockComplete('2026-10-01T09:00:00.000Z');
const archived = S().completedProgrammes[0];
check(
  'a finished Barbell Strength block freezes into a report that still knows its name',
  !!archived &&
    archived.templateId === 'barbell' &&
    archived.name === 'Barbell Strength' &&
    programmeFor(archived.templateId).name === 'Barbell Strength',
  JSON.stringify(archived && { id: archived.id, templateId: archived.templateId, name: archived.name })
);
check(
  'and a Build Muscle enrolment reads back as Build Muscle',
  nameOf({ templateId: 'muscle', days: 3, sessions: 12, minutes: 45, startedAt: '', startedAtSessionCount: 0 }) ===
    'Build Muscle',
  ''
);

// ─── 3. Neither is offered to anybody choosing ──────────────────────────────
console.log('\n[3] Neither appears anywhere somebody picks a programme');

check(
  'the browse list holds every programme except the two that were retired',
  OFFERED_PROGRAMME_IDS.join(',') ===
    PROGRAMME_IDS.filter((id) => !RETIRED_PROGRAMME_IDS.includes(id)).join(',') &&
    !OFFERED_PROGRAMME_IDS.includes('barbell') &&
    !OFFERED_PROGRAMME_IDS.includes('muscle'),
  OFFERED_PROGRAMME_IDS.join(', ')
);
check(
  'and nothing was lost doing it: offered plus retired is every named programme',
  OFFERED_PROGRAMME_IDS.length + RETIRED_PROGRAMME_IDS.length === PROGRAMME_IDS.length &&
    OFFERED_PROGRAMME_IDS.length === 5,
  `${OFFERED_PROGRAMME_IDS.length} + ${RETIRED_PROGRAMME_IDS.length} = ${PROGRAMME_IDS.length}`
);
check(
  'every one still on the list has a name and a line saying what it is for',
  OFFERED_PROGRAMME_IDS.every(
    (id) => PROGRAMMES[id].name.length > 3 && PROGRAMMES[id].blurb.length > 15
  ),
  ''
);

/**
 * The other place the app names a programme at somebody: the coach message that
 * says their training and their block have parted ways, and offers a better
 * fit. Run over every pattern of training there is, rather than asserted of the
 * list, because this is where a retired programme would be advertised without
 * anybody browsing anything.
 */
const drifters = [];
for (const id of PROGRAMME_IDS) {
  for (const pattern of [
    ['upper_body', 'lower_body'],
    ['upper_body'],
    ['lower_body'],
    ['full_body'],
    ['conditioning'],
    ['prehab', 'flexibility'],
    ['conditioning', 'full_body'],
    ['squat', 'bench', 'deadlift'],
  ]) {
    const recent = Array.from({ length: 8 }, (_, i) => pattern[i % pattern.length]);
    const s = closestProgramme(recent, id);
    if (s && RETIRED_PROGRAMME_IDS.includes(s)) drifters.push(`${id} <- ${pattern.join('/')} => ${s}`);
  }
}
check(
  `no pattern of training is ever pointed at a retired programme (${PROGRAMME_IDS.length * 8} tried)`,
  drifters.length === 0,
  drifters.slice(0, 4).join(' | ')
);
check(
  'while a genuinely different pattern is still pointed at one that is offered',
  closestProgramme(
    [...Array(4).fill('full_body'), ...Array(4).fill('conditioning')],
    'foundations'
  ) === 'lean',
  `${closestProgramme([...Array(4).fill('full_body'), ...Array(4).fill('conditioning')], 'foundations')}`
);

// ─── 4. Four levels, one list, every picker ─────────────────────────────────
console.log('\n[4] Every level picker offers exactly the levels the app has');

check(
  'the shared list is the store own levels, in the store own order',
  EXPERIENCE_OPTIONS.map((o) => o.value).join(',') === EXPERIENCE_LEVELS.join(',') &&
    EXPERIENCE_OPTIONS.length === 4,
  EXPERIENCE_OPTIONS.map((o) => o.value).join(',')
);
check(
  'each one has a word and they are all different',
  new Set(EXPERIENCE_OPTIONS.map((o) => o.label)).size === EXPERIENCE_OPTIONS.length &&
    EXPERIENCE_OPTIONS.every((o) => o.label.length > 2 && o.description.length > 10),
  EXPERIENCE_OPTIONS.map((o) => o.label).join(' | ')
);
check(
  // Why 12. The hub draws these two to a row: on a 360pt phone that is
  // (360 - 36 page - 8 padding - 6 gap) / 2, about 155 points each, against
  // roughly 85 points for twelve characters at 12.5pt semibold. Four to a row
  // would give each of them 74 points, which "Intermediate" does not fit in -
  // it was being shrunk to three quarters size to pretend that it did.
  'no level is long enough to need shrinking at two to a row on a 360pt screen',
  EXPERIENCE_OPTIONS.every((o) => o.label.length <= 12),
  EXPERIENCE_OPTIONS.map((o) => `${o.label}:${o.label.length}`).join(' | ')
);

// ─── 5. The note under the control cannot outlive the fact ──────────────────
console.log('\n[5] The note says what moving the level does, and what it does not');

check(
  'Advanced and Athlete are prescribed from the same band, which is why this matters',
  JSON.stringify(levelBandForExperience('advanced')) ===
    JSON.stringify(levelBandForExperience('athlete')),
  `${JSON.stringify(levelBandForExperience('advanced'))} vs ${JSON.stringify(levelBandForExperience('athlete'))}`
);

/**
 * The invariant, and the whole point of deriving the sentence rather than
 * writing it: a level's note names another level EXACTLY when the two are built
 * from the same band. Hardcode the sentence and this fails the day the bands
 * move apart; drop the sentence and it fails today.
 */
const wrongClaims = [];
for (const level of EXPERIENCE_LEVELS) {
  const note = experienceNote(level);
  for (const other of EXPERIENCE_LEVELS) {
    if (other === level) continue;
    const same =
      JSON.stringify(levelBandForExperience(level)) ===
      JSON.stringify(levelBandForExperience(other));
    const named = note.includes(EXPERIENCE_LABELS[other]);
    if (same !== named) {
      wrongClaims.push(`${level} vs ${other}: same band ${same}, note names it ${named}`);
    }
  }
}
check(
  'a note names another level exactly when the engine gives the two of them the same movements',
  wrongClaims.length === 0,
  wrongClaims.join(' | ')
);
check(
  'so the Advanced and Athlete note says they are the same for now',
  ['advanced', 'athlete'].every(
    (l) =>
      /Advanced and Athlete are given the same movements/.test(experienceNote(l)) &&
      levelsTrainedTheSameAs(l).length === 1
  ),
  experienceNote('athlete')
);
check(
  'and it does not promise harder movements further up than they go',
  ['advanced', 'athlete'].every((l) => !/harder|unlock|more advanced/i.test(experienceNote(l))),
  experienceNote('advanced')
);
check(
  'a beginner is not told about two levels they did not ask about',
  ['beginner', 'intermediate'].every(
    (l) => !/are given the same movements/.test(experienceNote(l)) && experienceNote(l).length > 60
  ),
  experienceNote('beginner')
);
check(
  'every note is house style: no em dash, no emoji, British spelling',
  EXPERIENCE_LEVELS.every(
    (l) => !/[—–―]/.test(experienceNote(l)) && !/customiz|personaliz|program\b/i.test(experienceNote(l))
  ),
  EXPERIENCE_LEVELS.map(experienceNote).join(' | ')
);

// ─── 6. The screens, which is the one seam a node check cannot cross ────────
console.log('\n[6] The controls are wired to all of that');

const hub = read('components/ProgrammeHub.tsx');
const hubCode = stripComments(hub);
const chooser = stripComments(read('components/ChooseProgramme.tsx'));
const profile = stripComments(read('app/(tabs)/profile.tsx'));
const signUp = stripComments(read('app/onboarding.tsx'));

check(
  'the hub has a stop control',
  /testID="hub-stop"/.test(hubCode) && /Stop this programme/.test(hub),
  'leaveProgramme existed in the store and was called by nothing in the app'
);
check(
  'it asks first, and the answer that does nothing is the default one',
  /const confirmStop = \(\) => \{[\s\S]*?Alert\.alert\(/.test(hubCode) &&
    /text: 'Keep going', style: 'cancel'/.test(hubCode),
  'a block somebody is nine weeks into should not go to a mis-tap'
);
check(
  'and it is the store action that stops it, not a local flag',
  /leaveProgramme\(\);/.test(hubCode) && /useAppStore\(\(s\) => s\.leaveProgramme\)/.test(hubCode),
  ''
);
check(
  'the alert says what survives, because the obvious fear is that nothing does',
  /Your history, your records and your weights are untouched/.test(hub),
  ''
);
for (const [name, src] of [
  ['the programme hub', hubCode],
  ['the Profile edit sheet', profile],
  ['sign-up', signUp],
]) {
  check(
    `${name} draws its levels from the one shared list`,
    /EXPERIENCE_OPTIONS\.map\(/.test(src),
    'three hand-written lists is three chances for a level to go missing'
  );
}
check(
  'the hub draws them two to a row rather than shrinking four into one',
  /styles\.segmentWrap[\s\S]{0,400}EXPERIENCE_OPTIONS\.map\(/.test(hubCode) &&
    /styles\.segHalf/.test(hubCode) &&
    !/adjustsFontSizeToFit/.test(hubCode),
  ''
);
check(
  'the hub prints the shared note rather than its own sentence about levels',
  /experienceNote\(experienceLevel \?\? 'beginner'\)/.test(hubCode) &&
    /experienceNote\(editExp\)/.test(profile),
  'two screens describing the same control differently is how one of them goes stale'
);
check(
  'and the chooser browses the offered list',
  // The lookbehind matters: OFFERED_PROGRAMME_IDS contains PROGRAMME_IDS, so a
  // plain "did it stop using the full list" test can never fail.
  /OFFERED_PROGRAMME_IDS\.map\(/.test(chooser) && !/(?<![A-Z_])PROGRAMME_IDS\.map\(/.test(chooser),
  ''
);
check(
  'as does the switch list inside the hub, keeping only the block they are on',
  /const switchTargets = PROGRAMME_IDS\.filter\(/.test(hubCode) &&
    /OFFERED_PROGRAMME_IDS\.includes\(id\) \|\| id === programme\.templateId/.test(hubCode) &&
    /switchTargets\.map\(/.test(hubCode),
  ''
);

// ─── 7. The word on the programme is not the word on the person ─────────────
console.log('\n[7] How hard the block is, said in words that are not the levels');

check(
  'every rung has a display name',
  DIFFICULTY_LABELS.every((k) => (DIFFICULTY_DISPLAY_NAMES[k] ?? '').length > 2) &&
    Object.keys(DIFFICULTY_DISPLAY_NAMES).length === DIFFICULTY_LABELS.length,
  JSON.stringify(DIFFICULTY_DISPLAY_NAMES)
);
check(
  'they are all different from each other',
  new Set(Object.values(DIFFICULTY_DISPLAY_NAMES)).size === DIFFICULTY_LABELS.length,
  Object.values(DIFFICULTY_DISPLAY_NAMES).join(', ')
);
check(
  // The whole reason for the rename. The hub prints one of these on a pill an
  // inch above a control where one of the level words is lit, and they mean
  // opposite kinds of thing: how hard the work is, against who the person is.
  'and none of them is a word the level control uses for the person',
  Object.values(DIFFICULTY_DISPLAY_NAMES).every(
    (word) =>
      !Object.values(EXPERIENCE_LABELS).some((l) => l.toLowerCase() === word.toLowerCase())
  ),
  `${Object.values(DIFFICULTY_DISPLAY_NAMES).join(', ')} vs ${Object.values(EXPERIENCE_LABELS).join(', ')}`
);

const badDifficulty = [];
for (const id of PROGRAMME_IDS) {
  for (const level of EXPERIENCE_LEVELS) {
    for (const days of [2, 3, 4, 5]) {
      const d = programmeDifficulty(id, level, days);
      if (
        !DIFFICULTY_LABELS.includes(d.key) ||
        d.label !== DIFFICULTY_DISPLAY_NAMES[d.key] ||
        // The key is what the movement band is looked up by, and levelBandFor
        // falls back to Intermediate for anything it does not recognise. If the
        // keys were ever renamed to match the display words, every programme in
        // the app would quietly be re-banded as Intermediate and nothing would
        // say so.
        JSON.stringify(d.band) !== JSON.stringify(levelBandFor(d.key))
      ) {
        badDifficulty.push(`${id}/${level}/${days} -> ${d.key}/${d.label}`);
      }
    }
  }
}
check(
  `all ${PROGRAMME_IDS.length * EXPERIENCE_LEVELS.length * 4} combinations show a display word and band on the key`,
  badDifficulty.length === 0,
  badDifficulty.slice(0, 4).join(' | ')
);
check(
  'and the keys still band to six different rungs, so none of them is falling back',
  new Set(DIFFICULTY_LABELS.map((k) => JSON.stringify(levelBandFor(k)))).size ===
    DIFFICULTY_LABELS.length,
  DIFFICULTY_LABELS.map((k) => `${k}:${JSON.stringify(levelBandFor(k))}`).join(' ')
);

console.log(`\nprogrammes-optional: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
