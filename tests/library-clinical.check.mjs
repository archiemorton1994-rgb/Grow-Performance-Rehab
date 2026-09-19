/**
 * Contract test: the library's RECORDS are safe, and their prescriptions are
 * ones the app can actually read.
 *
 * WHY THIS EXISTS ALONGSIDE library-safety-tags
 * ─────────────────────────────────────────────
 * That file asks the clinical questions of NAMES, because a name is all the
 * screen has ever had. This one asks the same questions of the records the
 * sessions will be built from, which is a different thing in two ways that both
 * matter:
 *
 *   1. A record carries its own `stress` list. Screening reads the UNION of
 *      that list and the name rules, so a record can only ever be MORE
 *      protected than its name. That is the point, and it is also a new place
 *      for a mistake to hide: an authored list that has fallen behind the name
 *      rules looks like a decision and is an oversight. Section [8] holds the
 *      authored list to being a superset, so it cannot go stale quietly.
 *   2. A record carries its own prescription. The catalogue's `reps` field is
 *      free text holding at least eight different kinds of thing, and getting
 *      that wrong is how a 40 m farmer's carry came back as "8-12 m". Library
 *      records say what kind of dose they are in a field, and sections [2] and
 *      [3] hold the text and the field to each other, in both directions.
 *
 * THE CLINICAL TABLE IS THE SAME TABLE
 * ────────────────────────────────────
 * tests/_clinical-expectations.mjs, imported by both files. A second copy of a
 * physiotherapist's "never serve this to a sore knee" list is how one copy
 * quietly stops matching the other.
 *
 * SORE AND CLINICIAN-PROTECTED ARE THE SAME LIST BY THE TIME THEY GET HERE
 * ───────────────────────────────────────────────────────────────────────
 * generateWorkout merges `clinicalAvoid` (areas a clinician told them to stay
 * off) and `standingSoreRegions` (areas they said are sore at sign-up) into the
 * session's pain regions before screening, so both arrive at restrictedTagsFor
 * as plain PainRegions. Everything below sweeps all nineteen regions, which
 * covers both lists by construction.
 *
 * Run:  npx tsx tests/library-clinical.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import {
  LIBRARY_EXERCISES,
  CONDITIONING_EXERCISES,
  authoredLibraryRecords,
  hasAuthoredContent,
  recordsWithoutVideo,
  libraryNamesOf,
  HOLD_SECONDS_BY_LEVEL,
  CARRY_METRES_BY_LEVEL,
} from '../lib/exercise-library.ts';
import {
  RESTRICTED_BY_REGION,
  restrictedTagsFor,
  restrictedTagsOnRecord,
  stressTagsForRecord,
  stressTagsFor,
} from '../lib/exercise-safety.ts';
import { parseReps, formatReps, nextPrescription } from '../lib/rep-scheme.ts';
import { videoUrlFor, VIDEO_URL_PATTERN } from '../lib/exercise-videos.ts';
import { CLINICAL, UNCLASSIFIED_BY_DESIGN } from './_clinical-expectations.mjs';

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

const ALL = [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES];
const AUTHORED = authoredLibraryRecords();
const REGIONS = Object.keys(RESTRICTED_BY_REGION);

/** Every spelling the document uses for a record, movement or conditioning. */
const namesOf = (e) => (e.pattern ? libraryNamesOf(e) : [e.libraryName]);

const byName = new Map();
for (const e of ALL) for (const n of namesOf(e)) byName.set(n, e);

/** Would this record reach someone whose only sore area is `region`? */
const reaches = (record, region) =>
  restrictedTagsOnRecord(record, restrictedTagsFor([region])).length === 0;

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[1] The records are here, and written where there was something to write from');

check(
  `the library is 160 movement records and 9 conditioning ones (${LIBRARY_EXERCISES.length} + ${CONDITIONING_EXERCISES.length})`,
  LIBRARY_EXERCISES.length === 160 && CONDITIONING_EXERCISES.length === 9,
  'the record list has changed size - every sweep below reads it'
);

// 122 movement records matched a template the app already had and were written
// first. The other 38 are movements the app has never carried in any form, and
// they are being authored one pattern at a time so that each set can be read
// and argued with on its own. Push (8), Pull (4), Hinge (6), Squat (9) and
// Lunge (3) are written, so 152 of the 160. Core is the last eight.
const authoredMovement = LIBRARY_EXERCISES.filter(hasAuthoredContent);
const authoredConditioning = CONDITIONING_EXERCISES.filter(hasAuthoredContent);
check(
  `152 of the 160 movement records are written (${authoredMovement.length})`,
  authoredMovement.length === 152,
  'either a record lost its content or one was written before its pattern was due'
);
check(
  `all nine conditioning records are written (${authoredConditioning.length})`,
  authoredConditioning.length === 9,
  authoredConditioning.map((e) => e.name).join(', ')
);

// `dose` and a written prescription have to arrive together, or "is this
// written yet" has two answers that can disagree.
const doseDrift = ALL.filter((e) => hasAuthoredContent(e) !== (e.dose !== undefined));
check(
  'every written record declares a dose, and no unwritten one does',
  doseDrift.length === 0,
  doseDrift.map((e) => `${e.name} (dose ${e.dose}, cue ${e.cue.length} chars)`).join(' | ')
);

const REGION_SET = new Set(REGIONS);
const hollow = AUTHORED.filter(
  (e) =>
    !(e.sets >= 1) ||
    !e.reps ||
    !e.cue ||
    !e.suggestedLoad ||
    !e.primaryMuscle ||
    !(e.secondaryMuscles ?? []).length ||
    !e.targetRegions.length ||
    e.targetRegions.some((r) => !REGION_SET.has(r))
);
check(
  'every written record has sets, reps, a cue, a load, muscles and real target regions',
  hollow.length === 0,
  hollow.map((e) => e.name).join(' | ')
);

const unwrittenServed = ALL.filter(
  (e) => !hasAuthoredContent(e) && (e.reps !== '' || e.suggestedLoad !== '' || e.sets !== 3)
);
check(
  'the records that are not written yet are blank rather than half-filled',
  unwrittenServed.length === 0,
  unwrittenServed.map((e) => e.name).join(' | ')
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[2] Every written prescription is a dose the app can read');

const countable = AUTHORED.filter((e) => e.dose === 'reps');
const fixed = AUTHORED.filter((e) => e.dose !== 'reps');

check(
  `something is prescribed in reps and something is not (${countable.length} / ${fixed.length})`,
  countable.length > 50 && fixed.length > 15,
  'one of the two halves of this section has nothing in it to guard'
);

const unreadable = countable.filter((e) => !parseReps(e.reps));
check(
  "every 'reps' record's text parses as a rep prescription",
  unreadable.length === 0,
  unreadable.map((e) => `${e.name}: "${e.reps}"`).join(' | ')
);

// Round-trip, because the engine reprints the range it read. A text that parses
// but comes back spelled differently changes what the card says every session.
const lossy = countable.filter((e) => {
  const p = parseReps(e.reps);
  return !p || formatReps(p.min, p.max, p.suffix) !== e.reps;
});
check(
  'and comes back out of the engine spelled exactly as it went in',
  lossy.length === 0,
  lossy.map((e) => `${e.name}: "${e.reps}"`).join(' | ')
);

const negotiable = fixed.filter((e) => parseReps(e.reps));
check(
  'no hold, carry or jump is written in a form the rep counter would try to climb',
  negotiable.length === 0,
  negotiable.map((e) => `${e.name}: "${e.reps}" (${e.dose})`).join(' | ')
);

/**
 * Run the real progression engine over every written record.
 *
 * A clean session on a countable record has to produce a countable
 * prescription, and a clean session on a hold, a carry or a jump has to produce
 * no prescription at all, so the card keeps the dose a physiotherapist wrote.
 */
const wrongWay = [];
for (const e of AUTHORED) {
  const next = nextPrescription(e.reps, e.reps, true, ['muscle'], e.category, undefined, true);
  if (next && e.dose !== 'reps') wrongWay.push(`${e.name} (${e.dose}) -> "${next.reps}"`);
  if (next && !parseReps(next.reps)) wrongWay.push(`${e.name} -> unreadable "${next.reps}"`);
  if (!next && e.dose === 'reps' && (e.category === 'main' || e.category === 'accessory'))
    wrongWay.push(`${e.name} climbs nowhere after a clean session`);
}
check(
  'a clean session climbs the countable records and leaves the fixed ones alone',
  wrongWay.length === 0,
  wrongWay.slice(0, 6).join(' | ')
);

// Decision 8 says jumps and throws are Athlete only whatever the goal, and the
// reason is that they are quality work. Role and dose are two ways of saying
// that, and they must not disagree.
const roleDoseDrift = AUTHORED.filter((e) => (e.role === 'power') !== (e.dose === 'quality'));
check(
  'every power record is dosed as quality work, and nothing else is',
  roleDoseDrift.length === 0,
  roleDoseDrift.map((e) => `${e.name} (role ${e.role}, dose ${e.dose})`).join(' | ')
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[3] Decision 9: a hold or a carry gets a fixed dose for its level');

const holds = AUTHORED.filter((e) => e.dose === 'time' && e.level);
const carries = AUTHORED.filter((e) => e.dose === 'distance' && e.level);
check(
  `there are holds and carries to check (${holds.length} / ${carries.length})`,
  holds.length >= 4 && carries.length >= 5,
  'the two ladders below guard nothing'
);

const wrongHold = holds.filter((e) => {
  const ladder = e.suggestedLoad === 'Bodyweight' ? 'bodyweight' : 'loaded';
  const want = HOLD_SECONDS_BY_LEVEL[ladder][e.level];
  return !new RegExp(`^${want}s\\b`).test(e.reps);
});
check(
  'every hold is the number of seconds its level and its load call for',
  wrongHold.length === 0,
  wrongHold.map((e) => `${e.name}: L${e.level} "${e.reps}"`).join(' | ')
);

const wrongCarry = carries.filter(
  (e) => !new RegExp(`^${CARRY_METRES_BY_LEVEL[e.level]} m\\b`).test(e.reps)
);
check(
  'every carry is the distance its level calls for',
  wrongCarry.length === 0,
  wrongCarry.map((e) => `${e.name}: L${e.level} "${e.reps}"`).join(' | ')
);

// The ladders themselves. A level that asks for less than the one below it is
// not a progression, and a loaded hold that outlasts a bodyweight one at the
// same level is the mistake the two ladders exist to avoid.
const ladderFaults = [];
for (const kind of ['bodyweight', 'loaded'])
  for (const lvl of [2, 3, 4])
    if (HOLD_SECONDS_BY_LEVEL[kind][lvl] < HOLD_SECONDS_BY_LEVEL[kind][lvl - 1])
      ladderFaults.push(`hold ${kind} L${lvl}`);
for (const lvl of [2, 3, 4])
  if (CARRY_METRES_BY_LEVEL[lvl] < CARRY_METRES_BY_LEVEL[lvl - 1]) ladderFaults.push(`carry L${lvl}`);
for (const lvl of [1, 2, 3, 4])
  if (HOLD_SECONDS_BY_LEVEL.loaded[lvl] > HOLD_SECONDS_BY_LEVEL.bodyweight[lvl])
    ladderFaults.push(`loaded hold outlasts bodyweight at L${lvl}`);
check(
  'the ladders go up with the level, and a loaded hold never outlasts an unloaded one',
  ladderFaults.length === 0,
  ladderFaults.join(' | ')
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[4] Region by region, over records, the way a physiotherapist would read it');

for (const [region, { never, still }] of Object.entries(CLINICAL)) {
  const label = region.replace(/_/g, ' ');
  const missing = [...never, ...still].filter((n) => !byName.has(n));
  check(
    `every name in the ${label} table is a record in the library`,
    missing.length === 0,
    missing.join(' | ')
  );
  const served = never.filter((n) => byName.has(n) && reaches(byName.get(n), region));
  check(
    `a sore ${label} is never served any of its ${never.length} contraindicated records`,
    served.length === 0,
    served.join(' | ')
  );
  const removed = still.filter((n) => byName.has(n) && !reaches(byName.get(n), region));
  check(
    `...and keeps all ${still.length} of the records it can safely still do`,
    removed.length === 0,
    removed.join(' | ')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[5] Decision 11: a sore chest gets no press-up, of any kind');

const PRESS_UP = /press-?\s?ups?\b|push-?\s?ups?\b/i;
const pressUps = ALL.filter((e) => namesOf(e).some((n) => PRESS_UP.test(n)));
check(
  `the library really does hold press-up records (${pressUps.length} found)`,
  pressUps.length >= 6,
  pressUps.map((e) => e.name).join(', ')
);
const servedToASoreChest = pressUps.filter((e) => reaches(e, 'chest'));
check(
  'not one of them reaches a sore chest',
  servedToASoreChest.length === 0,
  servedToASoreChest.map((e) => e.name).join(' | ')
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[6] Nothing that lands reaches a beginner');

const impact = ALL.filter((e) => stressTagsForRecord(e).includes('high_impact'));
check(
  `the library holds high-impact records (${impact.length} found)`,
  impact.length >= 10,
  impact.map((e) => e.name).join(', ')
);

// Decision 8: jumps and throws stay at Athlete level only, whatever the goal.
// A beginner is offered levels 1 to 2, so a high-impact record filed below 4 is
// one a beginner could be handed on a day they said nothing was sore at all.
const tooLow = impact.filter((e) => e.level && e.level < 4);
check(
  'every levelled high-impact record is Athlete level (decision 8)',
  tooLow.length === 0,
  tooLow.map((e) => `${e.name} (L${e.level})`).join(' | ')
);

// Conditioning has no level, so decision 7 carries this instead: beginners are
// not given skipping. Pinning the set means a second landing exercise cannot
// join the conditioning list without somebody noticing.
const impactConditioning = impact.filter((e) => !e.level).map((e) => e.name);
check(
  'the only conditioning exercise that lands is Skipping, which decision 7 keeps from beginners',
  impactConditioning.length === 1 && impactConditioning[0] === 'Skipping',
  impactConditioning.join(' | ')
);

// And the safety override, run for real: a beginner who reports ANY complaint
// loses impact everywhere, not only around the sore part.
const leakedToBeginner = [];
for (const region of REGIONS) {
  const banned = restrictedTagsFor([region], 'beginner');
  for (const e of impact)
    if (restrictedTagsOnRecord(e, banned).length === 0)
      leakedToBeginner.push(`${e.name} / ${region}`);
}
check(
  'a beginner who reports anything at all is served none of them',
  leakedToBeginner.length === 0,
  leakedToBeginner.slice(0, 6).join(' | ')
);

// Severe pain does the same for everybody, wherever it is.
const leakedToSevere = [];
for (const region of REGIONS) {
  const banned = restrictedTagsFor([region], 'advanced', 'severe');
  for (const e of impact)
    if (restrictedTagsOnRecord(e, banned).length === 0) leakedToSevere.push(`${e.name} / ${region}`);
}
check(
  'nor is anybody who calls their pain severe',
  leakedToSevere.length === 0,
  leakedToSevere.slice(0, 6).join(' | ')
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[7] And no complaint empties the library');

/**
 * The counterweight, region by region. Screening that takes everything away is
 * cheap to write and teaches people to stop telling the app the truth, so every
 * region has to leave a session behind: a third of the written library, and
 * something to train the upper body, the lower body and the trunk with.
 */
const UPPER = ['push', 'pull'];
const LOWER = ['squat', 'hinge', 'lunge'];
for (const region of REGIONS) {
  const banned = restrictedTagsFor([region]);
  const alive = AUTHORED.filter((e) => restrictedTagsOnRecord(e, banned).length === 0);
  const patterns = new Set(alive.map((e) => e.pattern).filter(Boolean));
  const ok =
    alive.length >= AUTHORED.length / 3 &&
    UPPER.some((p) => patterns.has(p)) &&
    LOWER.some((p) => patterns.has(p)) &&
    patterns.has('core');
  check(
    `a sore ${region.replace(/_/g, ' ')} keeps a session (${alive.length} of ${AUTHORED.length})`,
    ok,
    `patterns left: ${[...patterns].sort().join('/') || 'none'}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[8] The written tags never say less than the name does');

const stale = [];
for (const e of AUTHORED) {
  const fromName = stressTagsFor(e.name, e.movementPattern, `${e.reps} ${e.cue}`);
  const short = fromName.filter((t) => !(e.stress ?? []).includes(t));
  if (short.length) stale.push(`${e.name}: missing ${short.join(',')}`);
}
check(
  'every written record lists at least the tags its own name and cue imply',
  stale.length === 0,
  stale.slice(0, 6).join(' | ')
);

// The union is what screening reads, so a record can gain protection from its
// name but can never lose protection it has written down.
const weakened = [];
for (const e of AUTHORED) {
  const union = stressTagsForRecord(e);
  for (const t of e.stress ?? []) if (!union.includes(t)) weakened.push(`${e.name}: dropped ${t}`);
  for (const t of stressTagsFor(e.name, e.movementPattern, `${e.reps} ${e.cue}`))
    if (!union.includes(t)) weakened.push(`${e.name}: name tag ${t} not screened`);
}
check(
  'and screening reads the union of the two, so neither half can be lost',
  weakened.length === 0,
  weakened.slice(0, 6).join(' | ')
);

// A written record with no tags at all is the silent failure this whole file
// exists for, so the set that is allowed to be empty is the declared one.
const untagged = AUTHORED.filter(
  (e) => !(e.stress ?? []).length && !namesOf(e).some((n) => UNCLASSIFIED_BY_DESIGN.includes(n))
);
check(
  'a written record with no tags at all is one already declared to ask nothing',
  untagged.length === 0,
  untagged.map((e) => e.name).join(' | ')
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[9] Videos: decision 15 allows none, but a claimed one has to be real');

const badUrl = AUTHORED.filter((e) => {
  const url = videoUrlFor(e);
  return url !== undefined && !VIDEO_URL_PATTERN.test(url);
});
check(
  'every video a record claims resolves to a real YouTube link',
  badUrl.length === 0,
  badUrl.map((e) => `${e.name}: ${videoUrlFor(e)}`).join(' | ')
);

const byVideo = new Map();
for (const e of ALL) if (e.videoId) byVideo.set(e.videoId, [...(byVideo.get(e.videoId) ?? []), e.name]);
const shared = [...byVideo.entries()].filter(([, names]) => names.length > 1);
check(
  'no two records claim the same footage',
  shared.length === 0,
  shared.map(([id, names]) => `${id}: ${names.join(', ')}`).join(' | ')
);

const withVideo = AUTHORED.filter((e) => videoUrlFor(e));
const without = recordsWithoutVideo();
check(
  `most of the written records have footage (${withVideo.length} of ${AUTHORED.length})`,
  withVideo.length + without.length === AUTHORED.length && withVideo.length >= 50,
  'the count of records with and without a video does not add up'
);

// Decision 15: "New exercises may ship without a video until one is added."
// Printed rather than asserted, so the list is in front of whoever reads the
// gate output and nobody has to go looking for what still needs filming.
console.log(`\n  ${without.length} written records still need footage:`);
for (const e of without) console.log(`    ${e.pattern ?? 'conditioning'}  ${e.name}`);

console.log(
  failures === 0
    ? `\nlibrary-clinical: all ${total} checks passed`
    : `\nlibrary-clinical: ${total - failures}/${total} passed, ${failures} FAILED`
);
process.exit(failures === 0 ? 0 : 1);
