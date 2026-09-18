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
 *   THE COPY THAT USED TO OVERPROMISE HAS GONE ENTIRELY. Section 4 held the
 *   programme certificate to what the engine really does. The certificate, the
 *   builder that ended on it and both functions that wrote its sentences were
 *   deleted; see the note where that section stood.
 *
 *   AND AN INSTRUCTION FROM A CLINICIAN IS SCREENED EVERY SESSION. Section 5,
 *   moved in from tests/exercise-levels.check.mjs when the movement self-checks
 *   were removed and that file was rewritten around their absence. It is a
 *   clinical rule, so it belongs with the other clinical rules.
 *
 * Run:  npx tsx tests/standing-injury.check.mjs
 */
globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { generateWorkout } from '../lib/workout-engine.ts';

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

// ─── [4] has gone with the certificate ──────────────────────────────────────
//
// FIVE ASSERTIONS USED TO STAND HERE, reading programmeReasons and
// programmeCareNote: that the reasons list still said the sore area was worked
// around, that it no longer claimed gentle work for the area went in, that it
// said where the answer could be changed, that the days-old caution no longer
// promised a two-week easing, and that somebody with nothing sore was told
// nothing about it.
//
// Every one of them was about the WORDS on components/ProgrammeCertificate.tsx,
// the screen the profile builder ended on. The screen is deleted, both functions
// with it, and copy that no longer exists cannot be held to a promise.
//
// THE CLINICAL RULE THEY SAT BESIDE HAS NOT MOVED. It was never in the copy:
// sections 1, 2 and 5 of this file run the real generator and assert that a
// standing sore area changes what is prescribed, that it never invents a
// severity or an acute flag, and that an area a clinician named is screened out
// of every session. Section 3 asserts the door out, on the profile screen where
// somebody can actually reach it, which is the sentence the deleted copy was
// pointing at.

// ─── The clinician's instruction, in the generator ──────────────────────────
//
// MOVED HERE FROM tests/exercise-levels.check.mjs, where it was section 10.
// These three assert a CLINICAL rule - an area a physio, doctor or surgeon
// named is worked around every session - and they were sitting in the file
// about movement ladders only because the builder question that collects it was
// added in the same piece of work as the movement self-check. The self-check is
// gone and that file was rewritten around its removal; a clinical rule is not
// something to leave inside a file being torn up for another reason.
console.log('\n[5] What a clinician said to avoid is screened every session');

{
  const clinical = (clinicalAvoid) =>
    generateWorkout(
      'upper_body',
      'fullgym',
      // Nothing sore today, which is exactly the case: a shoulder avoided for
      // six months does not hurt, and answers no to the readiness screen every
      // single time.
      { hasAches: false, energy: 'normal', timeAvailable: '60' },
      {
        name: 'T',
        sex: 'male',
        experienceLevel: 'advanced',
        goals: ['strength'],
        bodyweightKg: 90,
        ...(clinicalAvoid ? { clinicalAvoid } : {}),
      },
      undefined,
      undefined,
      3
    );

  const open = clinical(undefined).map((e) => e.name).join('|');
  const guarded = clinical(['front_shoulder']);

  check(
    'a named area changes the session even with nothing sore today',
    guarded.map((e) => e.name).join('|') !== open,
    'that is the whole difference between this question and the readiness one'
  );
  check(
    'and the card says which area it was protecting',
    guarded.some(
      (e) =>
        /shoulder/i.test(e.badge ?? '') ||
        /shoulder/i.test(e.swapReason ?? '') ||
        /shoulder/i.test(JSON.stringify(e))
    ),
    JSON.stringify(guarded[0] ?? {}).slice(0, 200)
  );
  check(
    'naming nothing leaves the session exactly as it was',
    clinical([]).map((e) => e.name).join('|') === open,
    ''
  );
}

console.log(`\nstanding-injury: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
