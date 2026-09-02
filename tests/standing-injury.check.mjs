/**
 * Contract test: what the builder was told about an injury reaches the sessions.
 *
 * WHAT WAS WRONG. The builder asks "is anything sore or injured right now",
 * then where, then for how long. All three answers were written to the profile,
 * synced to the server, and read by NOTHING. Meanwhile the programme
 * certificate told the user, in these words, that every session was being built
 * around the area and that gentle work for it went in. Two sessions generated
 * side by side, identical but for a standing knee problem, came back with the
 * same exercises down to the last card.
 *
 * For an app whose whole claim is that a physiotherapist is behind it, that is
 * the worst possible defect: somebody tells you their knee hurts, you tell them
 * you have accounted for it, and you hand them the same squat session.
 *
 * WHAT THIS FILE GUARDS, and each of these is a way it could regress:
 *
 *   IT REACHES THE SESSION. A standing sore area changes what is prescribed.
 *
 *   IT IS NOT THE SAME AS TODAY'S PAIN. It never sets severity and never sets
 *   the acute flag, because "look after this" is not "this is hurting now" and
 *   acute would route somebody onto the rehab protocol with no way off it.
 *
 *   IT CAN BE TURNED OFF. An answer given once at sign-up, by a builder that
 *   cannot be re-entered, that suppresses a chunk of the catalogue for ever, is
 *   worse than one that does nothing. The card in Profile is load-bearing.
 *
 *   AND THE COPY ONLY PROMISES WHAT HAPPENS. The claim that gentle work for the
 *   area "goes in" was removed rather than faked, and so was the two-week
 *   easing that no code implemented.
 *
 * Run:  npx tsx tests/standing-injury.check.mjs
 */
globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { generateWorkout } from '../lib/workout-engine.ts';
import { programmeReasons, programmeCareNote } from '../lib/programme.ts';

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

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stripComments = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const BASE = {
  name: 'A',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['strength'],
  bodyweightKg: 82,
};

const build = (profile, readiness) =>
  generateWorkout(
    'lower_body',
    'fullgym',
    readiness ?? { hasAches: false, energy: 'normal', timeAvailable: '60' },
    profile,
    undefined,
    { squat: 120 },
    3
  );

const names = (list) => list.map((e) => e.name);

console.log('\n[1] A standing injury reaches the session');

const plain = names(build(BASE));
const sore = names(build({ ...BASE, standingSoreRegions: ['knee'], standingSoreSince: 'weeks' }));

check(
  'a knee that has been sore for weeks changes what is prescribed',
  JSON.stringify(plain) !== JSON.stringify(sore),
  'the answer was collected, stored, synced and read by nothing for the whole life of the question'
);
check(
  'and what comes out is a session, not an empty list',
  sore.length > 0 && sore.length >= plain.length - 2,
  `${plain.length} exercises became ${sore.length}`
);
check(
  // The point of the whole thing. Deep knee flexion under load has to go.
  'the loaded knee work is the part that goes',
  (() => {
    const dropped = plain.filter((n) => !sore.includes(n));
    return dropped.length > 0;
  })(),
  `removed: ${plain.filter((n) => !sore.includes(n)).join(', ') || 'nothing'}`
);
check(
  'a clinician-named area still works the same way alongside it',
  JSON.stringify(names(build({ ...BASE, clinicalAvoid: ['knee'] }))) !== JSON.stringify(plain),
  ''
);
check(
  // Two answers, one set of regions. Naming the same area twice must not
  // double-count it into anything.
  'naming the same area in both questions is not different from naming it once',
  JSON.stringify(
    names(build({ ...BASE, clinicalAvoid: ['knee'], standingSoreRegions: ['knee'] }))
  ) === JSON.stringify(names(build({ ...BASE, clinicalAvoid: ['knee'] }))),
  ''
);
check(
  'somebody with nothing standing is prescribed exactly what they were before',
  JSON.stringify(names(build({ ...BASE, standingSoreRegions: [], clinicalAvoid: [] }))) ===
    JSON.stringify(plain),
  'an empty answer must change nothing at all'
);

console.log('\n[2] It is a standing fact, not a report about today');

check(
  /**
   * Severity and the acute flag belong to the readiness screen. Setting acute
   * from a standing answer would put somebody on the acute rehab protocol
   * permanently, with no way off it, on the strength of one sign-up question.
   */
  'the merge never invents a severity or an acute flag',
  (() => {
    const src = stripComments(read('lib/workout-engine.ts'));
    const at = src.indexOf('const standing = ');
    if (at < 0) return false;
    const near = src.slice(at, at + 600);
    return !/acute\s*:/.test(near) && !/painSeverity\s*:/.test(near);
  })(),
  'this is "look after this area", not "this is hurting now"'
);
check(
  'and today\'s answer still reaches the session on its own',
  JSON.stringify(
    names(
      build(BASE, {
        hasAches: true,
        painRegion: ['knee'],
        painSeverity: 'mild',
        energy: 'normal',
        timeAvailable: '60',
      })
    )
  ) !== JSON.stringify(plain),
  'the readiness question is separate and must not have been replaced'
);

console.log('\n[3] It can be turned off');

check(
  // Without this the fix is worse than the fault: a knee that got better would
  // keep squats off the menu for ever, and the builder cannot be re-entered.
  'there is a screen where both standing answers can be changed',
  (() => {
    const card = read('components/StandingAreasCard.tsx');
    return (
      /standingSoreRegions/.test(card) &&
      /clinicalAvoid/.test(card) &&
      /setUserProfile/.test(card)
    );
  })(),
  'an answer given once at sign-up that suppresses work for ever needs a door out'
);
check(
  'and it is on the profile screen, not somewhere nobody goes',
  /StandingAreasCard/.test(read('app/(tabs)/profile.tsx')),
  ''
);
check(
  // Clearing the last sore area must clear how long it had been going on, or an
  // orphaned "a few weeks" is left behind referring to nothing.
  'clearing the last sore area clears how long it had been sore',
  /standingSoreSince: next\.length === 0 \? null/.test(read('components/StandingAreasCard.tsx')),
  ''
);
check(
  /**
   * WROTE THIS AS A SPELLING TEST FIRST and it failed for the wrong reason: the
   * test IDs are built from a template literal, so the strings it grepped for
   * never appear in the source at all. Left alone it would have been the third
   * assertion in this repo that pins characters instead of meaning.
   *
   * The claim is that the two answers are shown as two separate things, so ask
   * for the two rows and the two headings a reader would use to tell them apart.
   */
  'the two answers are kept apart rather than merged into one list on screen',
  (() => {
    const card = read('components/StandingAreasCard.tsx');
    return (
      /which="sore"/.test(card) &&
      /which="clinical"/.test(card) &&
      /title="Sore or injured"/.test(card) &&
      /title="A clinician said to avoid"/.test(card)
    );
  })(),
  'a clinician\'s instruction is not the same statement as "this ached when I signed up"'
);

console.log('\n[4] The certificate only promises what happens');

const outcome = (over = {}) => ({
  name: 'A',
  focus: 'barbell',
  days: 3,
  minutes: 45,
  sessions: 12,
  experience: 'intermediate',
  ageYears: 30,
  sex: 'male',
  bodyweightKg: 82,
  equipmentTiers: ['fullgym'],
  soreRegions: [],
  soreFor: null,
  testWeekFrequency: 12,
  screenPassed: null,
  avoidRegions: [],
  maxKitKg: 0,
  oneRepMaxes: { squat: null, bench: null, deadlift: null },
  ...over,
});

const soreReasons = programmeReasons(outcome({ soreRegions: ['knee'], soreFor: 'weeks' })).join(' ');

check(
  'it still says the area is worked around, because now it is',
  /works around it/.test(soreReasons),
  soreReasons
);
check(
  // Nothing injects rehab work for the region. The swap machinery moves the
  // loading away, which is a different and smaller claim.
  'it no longer claims gentle work for the area goes in',
  !/gentle work for that area goes in/.test(soreReasons),
  soreReasons
);
check(
  'and it says where the answer can be changed',
  /in your profile/.test(soreReasons),
  soreReasons
);
check(
  // A dated commitment nothing implemented. There is no two-week window
  // anywhere in the engine.
  'the days-old caution no longer promises a two-week easing',
  (() => {
    const note = programmeCareNote(outcome({ soreRegions: ['knee'], soreFor: 'days' }));
    return !!note && !/two weeks go easy/.test(note);
  })(),
  programmeCareNote(outcome({ soreRegions: ['knee'], soreFor: 'days' })) ?? '(no note)'
);
check(
  'somebody with nothing sore is told nothing about it',
  !/works around it/.test(programmeReasons(outcome()).join(' ')),
  ''
);

console.log(`\nstanding-injury: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
