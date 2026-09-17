/**
 * Contract test: every exercise Archie's library can serve is screened.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The injury screen recognises a movement from its NAME. That is a deliberate
 * design - see the header of lib/exercise-safety.ts for why - and it has one
 * failure mode, which is silent: a name the patterns do not recognise carries
 * no stress tags at all, so it is safe for every complaint at once and is also
 * eligible to be chosen as the REPLACEMENT for the thing that was taken away.
 * Nothing goes red. The card just says "Swapped from X to protect your knee"
 * over an exercise nobody classified.
 *
 * docs/EXERCISE-LIBRARY.md is the new source of truth for the Train side, and
 * when it was measured against the screen it was full of exactly that:
 *
 *     Skipping            nothing   the only rope exercise in the library, and
 *                                   \bskip\b matched neither "Skipping" nor
 *                                   "Skipping Rope"
 *     Pull Ups            nothing   \bpull-?up\b wanted the hyphen the
 *     Chin Ups            nothing   catalogue uses, so the library's spelling
 *                                   was not overhead, not grip, not elbow
 *     Box Step Downs      nothing   named in knee.avoid AND quads.avoid
 *     Duck Walks          nothing   a squat, walked, held at the bottom
 *     Band Resisted       spinal    \bback squat\b cannot match "Back Squats",
 *       Back Squats       only      so the heaviest squat in the library had
 *                                   no knee tag while "Back Squat" did
 *     Seated Dumbbell     nothing   every dumbbell overhead press in the
 *       Press                       library is named after the stance
 *     Wall Hip Hinge      nothing   named in hamstrings.avoid and in
 *                                   lower_back.avoid, in those words
 *     Rack Pull           nothing   a deadlift started at the knee
 *     Band Pull Aparts    nothing   named in three protocols at once
 *
 * HOW THIS TEST IS WRITTEN
 * ────────────────────────
 * It parses docs/EXERCISE-LIBRARY.md itself - the six movement sections and the
 * conditioning list - so a name Archie adds next month is screened by this test
 * on the day he adds it, without anyone having to remember the test exists.
 * Then it runs every one of those names through the REAL classification
 * functions and holds the answer against a clinical expectation table written
 * below in plain English: with a sore X, this must never be served, and this
 * must still be.
 *
 * The table is deliberately written as clinical intent rather than as tags. A
 * test that asserted "Duck Walks has deep_knee_flexion" would pass happily if
 * the knee region stopped restricting that tag tomorrow. What matters to the
 * person with the sore knee is whether the exercise reaches them.
 *
 * Run:  npx tsx tests/library-safety-tags.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';

import { restrictedTagsFor, restrictedTagsOn, stressTagsFor } from '../lib/exercise-safety.ts';
import { ACUTE_PROTOCOL_NOTES, getAllPickableExercises } from '../lib/exercise-db.ts';

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

// ─── The library, read from the document ─────────────────────────────────────

const MOVEMENT_SECTIONS = ['Push', 'Pull', 'Hinge', 'Squat', 'Lunge', 'Core'];

/**
 * Every exercise name in the library document.
 *
 * The list items read "Name - Equipment, Equipment", so the name is everything
 * before the first " - ". Only the six movement sections and the conditioning
 * section are read; the decisions and the transcription notes underneath them
 * are prose with bullet points in it and are not exercises.
 */
function parseLibrary() {
  const md = readFileSync(new URL('../docs/EXERCISE-LIBRARY.md', import.meta.url), 'utf8');
  const movement = [];
  const conditioning = [];
  let section = null;
  for (const line of md.split(/\r?\n/)) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      section = heading[1].trim();
      continue;
    }
    const item = /^- (.+)$/.exec(line);
    if (!item) continue;
    const inMovement = MOVEMENT_SECTIONS.includes(section);
    if (!inMovement && section !== 'Conditioning') continue;
    const text = item[1];
    const cut = text.indexOf(' - ');
    const name = (cut === -1 ? text : text.slice(0, cut)).trim();
    if (!name) continue;
    (inMovement ? movement : conditioning).push(name);
  }
  return { movement, conditioning };
}

const { movement, conditioning } = parseLibrary();
const libraryNames = [...new Set([...movement, ...conditioning])];

console.log('\n[1] The library document still parses');

// The parser is the foundation of everything below it. If a heading is renamed
// and it silently reads nothing, every sweep underneath passes over an empty
// list and this file becomes 200 lines of green that guards nothing.
check(
  `all six movement sections yield exercises (${movement.length} found)`,
  movement.length >= 150,
  `only ${movement.length} parsed - has a "## Push" style heading been renamed?`
);
check(
  `the conditioning list is Archie's nine (${conditioning.length} found)`,
  conditioning.length === 9,
  conditioning.join(', ')
);
check(
  'the names that anchor this test are all present',
  [
    'Door Frame Rows',
    'Skipping',
    'Duck Walks',
    'Sled Push',
    'Box Step Downs',
    'Wall Hip Hinge',
    'Pull Ups',
    'Chin Ups',
    'Band Pull Aparts',
    'Kneeling Press Ups',
    'TRX Push Ups',
    'Plate Squeeze Press',
    'Supine Medball Throws',
    'Bear Crawl',
    'Rack Pull',
  ].every((n) => libraryNames.includes(n)),
  'a name this test asserts on has been renamed in the library'
);

// ─── The screen, run for real ────────────────────────────────────────────────

/** Would this exercise reach someone whose only sore area is `region`? */
const reaches = (name, region) =>
  restrictedTagsOn(name, restrictedTagsFor([region])).length === 0;

console.log('\n[2] Nothing in the library is invisible to the screen');

// A name with no tags at all is not necessarily wrong - a Bird Dog genuinely
// asks nothing of anything - but it is where the silent failure lives, so the
// set is pinned. Anything joining this list is a name no rule recognised.
const UNCLASSIFIED_BY_DESIGN = [
  // Low-load band and cable work that loads nothing to the point of mattering.
  'Banded Serratus Punch',
  'Banded Face Pulls',
  'Cable Face Pulls',
  'TRX Face Pulls',
  'Bench Dumbbell Face Pulls',
  // Supported and machine rows. Rowing with a sore lat or rear shoulder is a
  // real question and Archie has not answered it yet; see the note on
  // lat_mid_back in RESTRICTED_BY_REGION.
  'Seated Single Arm Rows',
  'Seated Close Grip Rows',
  'Seated Wide Grip Rows',
  'Cable Single Arm Rows',
  'TRX Rows',
  'Chest Supported Dumbbell Row',
  'Bent Over Dumbbell Rows',
  'Single Arm Dumbbell Rows',
  'Landmine Single Arm Rows',
  'Gorilla Rows',
  'Barbell Row',
  'Trapbar Rows',
  'Rack Rows',
  'Elevated Feet Rack Rows',
  // Squats that are deliberately left whole: they are the regressions the
  // screen reaches for when the heavy squats are taken away.
  'Assisted Squats',
  'Bodyweight Squats',
  'Box Squats',
  'Kettlebell Box Squats',
  'Kettlebell Goblet Squats',
  'Landmine Goblet Squats',
  // Unloaded or lightly loaded trunk work.
  'Glute Bridge',
  'Deadbug',
  'Banded Deadbugs',
  'Bird Dog',
  'Banded Pallof Press',
  'Cable Pallof Hold',
  'Cable Pallof Press',
  'Forearm Side Plank',
  'Kneeling Cable Rotations',
  'Cable Woodchops',
  'Cable Reverse Woodchops',
  'Landmine Rotations',
  'Kettlebell Marches',
  // Machine and sled conditioning. Nothing lands and nothing is lifted.
  'Sled Pull',
  'Assault Bike',
  'Incline Treadmill Walk',
  'Rowing Machine',
];

const untagged = libraryNames.filter(
  (n) => stressTagsFor(n).length === 0 && !UNCLASSIFIED_BY_DESIGN.includes(n)
);
check(
  'every library name the screen should recognise carries at least one tag',
  untagged.length === 0,
  untagged.join(' | ')
);

// The reverse guard: an entry that has since been classified should leave the
// list above rather than sit there excusing a rule that now exists.
const staleExcuses = UNCLASSIFIED_BY_DESIGN.filter(
  (n) => libraryNames.includes(n) && stressTagsFor(n).length > 0
);
check(
  'nothing on the "no tags by design" list has quietly gained one',
  staleExcuses.length === 0,
  staleExcuses.join(' | ')
);

console.log('\n[3] Region by region, the way a physiotherapist would read it');

/**
 * The clinical expectation table.
 *
 * `never` is "with this area sore, the app must not serve this". `still` is the
 * counterweight and it is not decoration: the cheap way to pass a safety test
 * is to ban everything, and an app that empties the session for anyone honest
 * about being sore teaches them to stop being honest. Every region therefore
 * has to name things it KEEPS.
 */
const CLINICAL = {
  knee: {
    never: [
      'Box Step Downs',
      'Box Step Ups',
      'Box Step Over',
      'Duck Walks',
      'Split Squat Jumps',
      'Depth Jumps',
      'Box Jumps',
      'Skater Jumps',
      'Skipping',
      'Squat Jump',
      'Broad Jumps',
      'Wall Sit',
      'Barbell Back Squat',
      'Band Resisted Back Squats',
      'Band Resisted Front Squats',
      'Pause Squats',
      'Pin Squats',
      'Zombie Squat',
      'Zercher Squat',
      'Dumbbell Front Squats',
      'Bulgarian Split Squat',
      'Walking Lunges',
      'Curtsy Lunge',
      'Side Lunge',
    ],
    still: [
      // Concentric-only conditioning is what a sore knee is FOR. A backwards
      // sled drag in particular is a knee rehab staple.
      'Sled Push',
      'Sled Pull',
      'Sled Rows',
      'Assault Bike',
      'Rowing Machine',
      'Incline Treadmill Walk',
      'Bodyweight Squats',
      'Box Squats',
      'Kettlebell Goblet Squats',
      'Glute Bridge',
      'Barbell Deadlift',
      'Plank',
    ],
  },
  ankle_achilles: {
    never: [
      'Skipping',
      'Box Jumps',
      'Seated Box Jumps',
      'Depth Jumps',
      'Skater Jumps',
      'Broad Jumps',
      'Duck Walks',
      'Sled Push',
      'Squat Jumps',
      'Split Squat Jumps',
    ],
    still: ['Sled Pull', 'Assault Bike', 'Rowing Machine', 'Barbell Back Squat', 'Plank'],
  },
  calf_shin: {
    never: ['Skipping', 'Box Jumps', 'Skater Jumps', 'Duck Walks', 'Sled Push', 'Depth Jumps'],
    still: ['Sled Pull', 'Assault Bike', 'Rowing Machine', 'Bodyweight Squats'],
  },
  lower_back: {
    never: [
      'Barbell Good Mornings',
      'Banded Good Mornings',
      'Suitcase Deadlift',
      'Rack Pull',
      'Reeves Deadlift',
      'Sumo Deadlift',
      'Zercher Squat',
      'Barbell Back Squat',
      'Barbell Box Squats',
      'Wall Hip Hinge',
      'Cable Pull Through',
      'Kettlebell Swings',
      'High Pulls',
      'Dumbbell Farmers Carry',
      'Waiter Carry',
      'Standing Dumbbell Press',
      'Hanging Knee Raises',
      'Broad Jumps',
      'Skipping',
    ],
    still: [
      // Conditioning a sore back keeps. Sled Rows is upright, concentric
      // pulling; Archie can overrule it, and the note in exercise-safety.ts
      // says where to change it if he does.
      'Sled Rows',
      'Sled Push',
      'Sled Pull',
      'Assault Bike',
      'Rowing Machine',
      'Glute Bridge',
      'Bodyweight Squats',
      'Box Squats',
      'Plank',
      'Bird Dog',
      'Deadbug',
      'Door Frame Rows',
      'Push Up',
    ],
  },
  hip_groin: {
    never: [
      'Side Lunge',
      'Kettlebell Side Lunge',
      'Curtsy Lunge',
      'Sumo Deadlift',
      'Skater Jumps',
      'Duck Walks',
      'Split Squat Jumps',
      'Bulgarian Split Squat',
      'Walking Lunges',
      'Box Step Downs',
      'Wall Sit',
      'Barbell Deadlift',
      'Kettlebell Swings',
      'Wall Hip Hinge',
      'Broad Jumps',
    ],
    still: [
      'Bodyweight Squats',
      'Box Squats',
      'Kettlebell Goblet Squats',
      'Glute Bridge',
      'Plank',
      'Sled Push',
      'Assault Bike',
    ],
  },
  quads: {
    never: [
      'Box Step Downs',
      'Box Step Over',
      'Wall Sit',
      'Duck Walks',
      'Bulgarian Split Squat',
      'Split Squat Jumps',
      'Barbell Back Squat',
      'Pause Squats',
      'Zercher Squat',
      'Walking Lunges',
      'Curtsy Lunge',
      'Skipping',
    ],
    still: [
      'Barbell Deadlift',
      'Kettlebell Romanian Deadlift',
      'Glute Bridge',
      'Bodyweight Squats',
      'Box Squats',
      'Sled Pull',
    ],
  },
  hamstrings: {
    never: [
      'Barbell Deadlift',
      'Kettlebell Romanian Deadlift',
      'Barbell Good Mornings',
      'Wall Hip Hinge',
      'Rack Pull',
      'Cable Pull Through',
      'Kettlebell Swings',
      'Sumo Deadlift',
      'Reeves Deadlift',
      'Suitcase Deadlift',
      'High Pulls',
      'Skipping',
      'Broad Jumps',
      'Skater Jumps',
    ],
    still: ['Bodyweight Squats', 'Wall Sit', 'Box Squats', 'Plank', 'Sled Push', 'Assault Bike'],
  },
  glutes: {
    never: [
      'Barbell Deadlift',
      'Kettlebell Swings',
      'Wall Hip Hinge',
      'Rack Pull',
      'Walking Lunges',
      'Bulgarian Split Squat',
      'Barbell Back Squat',
      'Skater Jumps',
      'Box Step Downs',
      'Duck Walks',
      'Skipping',
    ],
    still: ['Glute Bridge', 'Bodyweight Squats', 'Box Squats', 'Plank', 'Sled Pull', 'Assault Bike'],
  },
  chest: {
    // Decision 11 in full. Section 4 below spells out the press-up half of it.
    never: [
      'Kneeling Press Ups',
      'Kneeling Incline Press Ups',
      'Bench Press Ups',
      'Push Up',
      'Deficit Press Ups',
      'Decline Press Ups',
      'TRX Push Ups',
      'Plate Squeeze Press',
      'Plate Bench Press',
      'Dumbbell Bench Press',
      'Dumbbell Floor Press',
      'Incline Dumbbell Bench Press',
      'Alternating Dumbbell Bench Press',
      'Barbell Floor Press',
      'Band Resisted Barbell Press',
      'Supine Medball Throws',
      'Medball Floor Chest Pass',
      'Bear Crawl',
      'Bench Dips',
      'Band Pull Aparts',
    ],
    still: [
      // The no-equipment pull, which must survive the doorway chest-opener
      // rule it looks so much like.
      'Door Frame Rows',
      'Banded Serratus Punch',
      'Seated Dumbbell Press',
      'Standing Dumbbell Press',
      'Landmine Press',
      'Pull Ups',
      'Lat Pulldowns',
      'Seated Close Grip Rows',
      'Bodyweight Squats',
    ],
  },
  front_shoulder: {
    never: [
      'Kneeling Press Ups',
      'Push Up',
      'TRX Push Ups',
      'Deficit Press Ups',
      'Decline Press Ups',
      'Plate Squeeze Press',
      'Dumbbell Bench Press',
      'Barbell Floor Press',
      'Supine Medball Throws',
      'Medball Floor Chest Pass',
      'Bear Crawl',
      'Landmine Press',
      'Seated Dumbbell Press',
      'Standing Dumbbell Press',
      'Pull Ups',
      'Chin Ups',
      'Lat Pulldowns',
      'Bench Dips',
      'Band Pull Aparts',
      'Kettlebell Halos',
      'Medball Slams',
      'Hanging Knee Raises',
    ],
    still: [
      'Door Frame Rows',
      'Banded Serratus Punch',
      'Seated Close Grip Rows',
      'Chest Supported Dumbbell Row',
      'Barbell Deadlift',
      'Bodyweight Squats',
    ],
  },
  rear_shoulder: {
    never: [
      'Band Pull Aparts',
      'Pull Ups',
      'Chin Ups',
      'Lat Pulldowns',
      'Bench Dips',
      'Kettlebell Halos',
      'Seated Dumbbell Press',
      'Landmine Press',
      'Medball Slams',
      'High Pulls',
    ],
    still: [
      'Door Frame Rows',
      'Push Up',
      'Chest Supported Dumbbell Row',
      'Seated Close Grip Rows',
      'Bodyweight Squats',
    ],
  },
  upper_back: {
    never: [
      'Band Pull Aparts',
      'Pull Ups',
      'Chin Ups',
      'Lat Pulldowns',
      'Seated Dumbbell Press',
      'Standing Dumbbell Press',
      'Landmine Press',
      'Kettlebell Halos',
      'Waiter Carry',
      'Hanging Knee Raises',
      'Dumbbell Farmers Carry',
      'Barbell Back Squat',
      'Bench Dips',
    ],
    still: [
      'Door Frame Rows',
      'Seated Close Grip Rows',
      'Chest Supported Dumbbell Row',
      'Push Up',
      'Bodyweight Squats',
    ],
  },
  neck: {
    never: [
      'Pull Ups',
      'Chin Ups',
      'Lat Pulldowns',
      'Seated Dumbbell Press',
      'Standing Dumbbell Press',
      'Landmine Press',
      'Kettlebell Halos',
      'Waiter Carry',
      'Dumbbell Farmers Carry',
      'Barbell Back Squat',
      'Hanging Knee Raises',
      'Medball Slams',
    ],
    still: ['Door Frame Rows', 'Bench Press Ups', 'Push Up', 'Bodyweight Squats', 'Plank'],
  },
  elbow: {
    never: [
      'Bear Crawl',
      'Kneeling Press Ups',
      'Medball Floor Chest Pass',
      'Supine Medball Throws',
      'Chin Ups',
      'Pull Ups',
      'Plank',
      'Plank Taps',
      'Bench Dips',
      'Ab Wheel Rollout (Kneeling)',
      'Hanging Knee Raises',
      'Seated Dumbbell Press',
      'Landmine Press',
      'Kettlebell Halos',
      'Waiter Carry',
    ],
    still: [
      'Forearm Side Plank',
      'Door Frame Rows',
      'Bodyweight Squats',
      'Glute Bridge',
      'Wall Sit',
    ],
  },
  wrist: {
    never: [
      'Kneeling Press Ups',
      'Push Up',
      'TRX Push Ups',
      'Bear Crawl',
      'Plank',
      'Plank Taps',
      'Ab Wheel Rollout (Kneeling)',
      'Medball Floor Chest Pass',
      'Supine Medball Throws',
      'Medball Slams',
      'Barbell Deadlift',
      'Rack Pull',
      'Dumbbell Farmers Carry',
      'Dumbbell Suitcase Carry',
      'Dumbbell Suitcase Hold',
      'Barbell Suitcase Hold',
      'Kettlebell Swings',
      'Pull Ups',
      'Chin Ups',
      'Hanging Knee Raises',
      'Door Frame Rows',
      'Sled Rows',
      'Earthquake Carry',
      'Bench Dips',
    ],
    still: [
      // The forearm plank is what a sore wrist is given INSTEAD of a plank.
      'Forearm Side Plank',
      'Bodyweight Squats',
      'Wall Sit',
      'Glute Bridge',
      'Box Step Ups',
    ],
  },
  bicep: {
    never: [
      'Chin Ups',
      'Pull Ups',
      'Barbell Deadlift',
      'Rack Pull',
      'Dumbbell Farmers Carry',
      'Dumbbell Suitcase Hold',
      'Door Frame Rows',
      'Sled Rows',
      'Kettlebell Swings',
      'Hanging Knee Raises',
      'Bench Dips',
    ],
    still: ['Push Up', 'Kneeling Press Ups', 'Bodyweight Squats', 'Plank', 'Wall Sit'],
  },
  tricep: {
    never: [
      'Bench Dips',
      'Chin Ups',
      'Pull Ups',
      'Lat Pulldowns',
      'Seated Dumbbell Press',
      'Standing Dumbbell Press',
      'Landmine Press',
      'Kettlebell Halos',
      'Waiter Carry',
      'Hanging Knee Raises',
      'Medball Slams',
    ],
    still: ['Door Frame Rows', 'Seated Close Grip Rows', 'Bodyweight Squats', 'Glute Bridge'],
  },
  lat_mid_back: {
    never: [
      'Pull Ups',
      'Chin Ups',
      'Lat Pulldowns',
      'Hanging Knee Raises',
      'Barbell Deadlift',
      'Rack Pull',
      'Barbell Back Squat',
      'Dumbbell Farmers Carry',
      'Waiter Carry',
      'Seated Dumbbell Press',
      'Kettlebell Halos',
      'Medball Slams',
    ],
    still: [
      'Door Frame Rows',
      'Seated Close Grip Rows',
      'Chest Supported Dumbbell Row',
      'Bodyweight Squats',
      'Push Up',
    ],
  },
  core_ribs: {
    never: [
      'Hanging Knee Raises',
      'Barbell Deadlift',
      'Kettlebell Swings',
      'Wall Hip Hinge',
      'Rack Pull',
      'Cable Pull Through',
      'Barbell Good Mornings',
      'Sumo Deadlift',
      'High Pulls',
    ],
    still: [
      'Plank',
      'Forearm Side Plank',
      'Deadbug',
      'Bird Dog',
      'Banded Pallof Press',
      'Bodyweight Squats',
      'Door Frame Rows',
    ],
  },
};

for (const [region, { never, still }] of Object.entries(CLINICAL)) {
  const served = never.filter((n) => reaches(n, region));
  check(
    `a sore ${region.replace(/_/g, ' ')} is never served any of its ${never.length} contraindicated movements`,
    served.length === 0,
    served.join(' | ')
  );
  const removed = still.filter((n) => !reaches(n, region));
  check(
    `...and keeps all ${still.length} of the things it can safely still do`,
    removed.length === 0,
    removed.join(' | ')
  );
  const missing = [...never, ...still].filter((n) => !libraryNames.includes(n));
  check(
    `...and every name in the ${region.replace(/_/g, ' ')} table is still in the library`,
    missing.length === 0,
    missing.join(' | ')
  );
}

console.log('\n[4] Decision 11: a sore chest gets no press-up, of any kind');

/**
 * Archie, 2026-09-17, decision 11: "Sore chest: no press-ups, because the chest
 * rehab notes win. The plan left this open, so the cautious answer was taken."
 *
 * The notes he means are ACUTE_PROTOCOL_NOTES.chest.avoid, whose second line
 * reads "Press-ups of any kind, including incline - the bottom of a press-up is
 * a loaded stretch of the pec". Before this the screen printed that sentence on
 * the rehab banner and served press-ups in the same session.
 *
 * Read off the library rather than from a list, so a press-up variation added
 * to the library later is covered without being named here.
 */
const PRESS_UP = /press-?\s?ups?\b|push-?\s?ups?\b/i;
const libraryPressUps = libraryNames.filter((n) => PRESS_UP.test(n));
check(
  `the library really does contain press-up variations (${libraryPressUps.length} found)`,
  libraryPressUps.length >= 6,
  libraryPressUps.join(', ')
);
const servedToASoreChest = libraryPressUps.filter((n) => reaches(n, 'chest'));
check(
  'not one of them reaches a sore chest',
  servedToASoreChest.length === 0,
  servedToASoreChest.join(' | ')
);
check(
  'and the protocol the decision defers to still says so',
  /press-?ups? of any kind/i.test(ACUTE_PROTOCOL_NOTES.chest.avoid.join(' ')),
  'chest.avoid no longer names press-ups - decision 11 and the notes have drifted apart'
);

console.log('\n[5] The words on the rehab banner match what the session does');

/**
 * Each region's acute protocol lists what it deliberately leaves out, and the
 * session screen shows that list to the user as an unmissable banner. Every
 * line of it is therefore a promise about the session underneath.
 *
 * `phrase` is quoted from the region's own avoid text and is checked to still
 * be there, so that rewording the protocol cannot silently retire the rule that
 * enforces it. `movement` is the same instruction expressed over exercise
 * NAMES, and every name that matches it - anywhere in the library or in the
 * catalogue - has to be screened out for that region.
 *
 * Not every avoid line is enforceable this way and the ones that are not are
 * left out on purpose rather than fudged. "Rows, pull-downs, rear flyes and any
 * pulling with weight" (rear_shoulder) would empty the pull pattern, and
 * whether a sore rear shoulder may row at all is a question for Archie, not a
 * spelling. "Sitting with the legs crossed" is not an exercise.
 */
const AVOID_VOCABULARY = {
  knee: [
    { phrase: 'step-ups', movement: /step-?\s?ups?\b|step-?\s?downs?\b/i },
    { phrase: 'jumping and running', movement: /\bjump|\bsprints?\b/i },
    { phrase: 'Wall Sit', movement: /wall sit/i },
  ],
  quads: [
    { phrase: 'Slow Step-Down', movement: /step-?\s?downs?\b/i },
    { phrase: 'Isometric Wall Sit', movement: /wall sit/i },
    { phrase: 'Couch Stretch', movement: /couch stretch/i },
    { phrase: 'Standing Quad Stretch', movement: /quad stretch/i },
  ],
  hamstrings: [
    { phrase: 'Nordic curl negatives', movement: /\bnordic\b/i },
    { phrase: 'hamstring stretches', movement: /hamstring stretch/i },
    { phrase: 'wall hip hinge', movement: /wall hip hinge|hip hinge against wall/i },
    { phrase: 'Pigeon Pose', movement: /pigeon pose/i },
    { phrase: 'seated forward fold', movement: /seated forward fold/i },
  ],
  calf_shin: [
    { phrase: 'Running, skipping and jumping', movement: /\bskipping\b|\bskip\b|\bjump/i },
    { phrase: 'Calf and soleus stretches', movement: /calf stretch|soleus stretch/i },
    { phrase: 'calf raises', movement: /calf raise/i },
  ],
  ankle_achilles: [
    { phrase: 'Running, hopping, skipping and jumping', movement: /\bskipping\b|\bjump|\bhops?\b/i },
    { phrase: 'Calf and soleus stretches', movement: /calf stretch|soleus stretch/i },
  ],
  hip_groin: [
    { phrase: 'Copenhagen Adductor Hold', movement: /copenhagen/i },
    { phrase: 'side lunges and wide-stance squats', movement: /side lunges?\b|lateral lunges?\b|\bsumo\b/i },
    { phrase: 'Butterfly and seated groin stretches', movement: /\bbutterfly\b|\badductor\b|groin stretch/i },
  ],
  lower_back: [
    {
      phrase: 'Any hip hinge, deadlift or good morning pattern',
      movement: /deadlift|good morning|wall hip hinge|hip hinge against wall/i,
    },
    { phrase: 'Hip Flexor Stretch', movement: /hip flexor stretch/i },
  ],
  upper_back: [
    { phrase: 'Band Pull-Apart', movement: /pull-?\s?aparts?\b/i },
    { phrase: 'pull-ups and overhead pressing', movement: /pull-?\s?ups?\b|overhead press/i },
    { phrase: 'Upper Trap Stretch', movement: /upper trap stretch/i },
  ],
  neck: [
    { phrase: 'Loaded shrugs', movement: /\bshrugs?\b/i },
    { phrase: "farmer's carries", movement: /farmer/i },
    { phrase: 'overhead pressing', movement: /overhead press/i },
    { phrase: 'Neck side stretches', movement: /neck side stretch/i },
  ],
  front_shoulder: [
    {
      phrase: 'Press-ups, dips, bench pressing and overhead pressing',
      movement: /press-?\s?ups?\b|push-?\s?ups?\b|\bdips?\b|bench press|overhead press/i,
    },
    { phrase: 'Doorway chest stretch', movement: /doorway/i },
  ],
  rear_shoulder: [
    { phrase: 'Band Pull-Apart', movement: /pull-?\s?aparts?\b/i },
    { phrase: 'Cross-body shoulder stretch', movement: /cross-?body shoulder stretch/i },
    { phrase: 'pull-downs', movement: /lat pulldowns?/i },
  ],
  chest: [
    { phrase: 'Press-ups of any kind', movement: /press-?\s?ups?\b|push-?\s?ups?\b/i },
    { phrase: 'Flyes, dips and bench pressing', movement: /\bflyes?\b|\bdips?\b|bench press/i },
    { phrase: 'Doorway chest stretch', movement: /doorway/i },
  ],
  bicep: [
    { phrase: 'chin-ups', movement: /chin-?\s?ups?\b/i },
    { phrase: 'Carrying shopping or heavy bags', movement: /\bcarry\b|carries/i },
  ],
  tricep: [
    { phrase: 'Dips, close-grip pressing', movement: /\bdips?\b|skull ?crusher|overhead press/i },
    { phrase: 'Overhead and cross-body tricep stretches', movement: /tricep stretch/i },
  ],
  elbow: [
    {
      phrase: 'Hanging, heavy gripping, press-ups',
      movement: /\bhanging\b|press-?\s?ups?\b|push-?\s?ups?\b/i,
    },
    { phrase: 'Wrist flexor and extensor stretches', movement: /wrist (?:flexor|extensor) stretch/i },
  ],
  wrist: [
    {
      phrase: 'front rack holds',
      movement: /press-?\s?ups?\b|push-?\s?ups?\b|front rack/i,
    },
    { phrase: 'heavy gripping and hanging', movement: /\bhanging\b|\bcarry\b|farmer/i },
  ],
  lat_mid_back: [
    { phrase: 'Pull-ups, lat pulldowns', movement: /pull-?\s?ups?\b|lat pulldowns?/i },
    { phrase: 'Any overhead reaching or hanging position', movement: /\bhanging\b|dead hang|overhead press/i },
    { phrase: 'Doorway Lat Stretch', movement: /doorway lat stretch/i },
  ],
  core_ribs: [
    {
      phrase: 'Sit-ups, crunches, russian twists and leg raises',
      movement: /sit-?ups?\b|crunch|russian twist|hanging (?:leg|knee) raises?/i,
    },
    { phrase: 'Cat-Cow', movement: /cat-?cow/i },
  ],
  glutes: [
    { phrase: 'Loaded hip hinges', movement: /deadlift|kettlebell swing|\bkb swing|hip thrust/i },
    { phrase: 'Deep squats and lunges', movement: /\blunges?\b|bulgarian|split squat/i },
    { phrase: 'Jumping, running', movement: /\bjump|\bsprints?\b/i },
  ],
};

// Everything a session can contain: the library Archie wrote and the catalogue
// the generator still picks from. Both, because several of the movements the
// protocols name by name ("Slow Step-Down", "VMO Wall Sit", "Copenhagen
// Adductor Hold") live only in the catalogue.
const everyName = [
  ...new Set([...libraryNames, ...getAllPickableExercises().map((e) => e.template.name)]),
];

for (const [region, entries] of Object.entries(AVOID_VOCABULARY)) {
  const avoidText = (ACUTE_PROTOCOL_NOTES[region]?.avoid ?? []).join(' ');
  for (const { phrase, movement: pattern } of entries) {
    check(
      `${region}.avoid still says "${phrase}"`,
      avoidText.toLowerCase().includes(phrase.toLowerCase()),
      'the protocol was reworded and the rule that enforces it was left behind'
    );
    const matches = everyName.filter((n) => pattern.test(n));
    check(
      `...and something in the app matches it (${matches.length} names)`,
      matches.length > 0,
      `"${phrase}" now guards nothing`
    );
    const leaked = matches.filter((n) => reaches(n, region));
    check(
      `...and none of them reach a sore ${region.replace(/_/g, ' ')}`,
      leaked.length === 0,
      leaked.slice(0, 6).join(' | ')
    );
  }
}

console.log('\n[6] A hand plank is weight through the wrist; a forearm plank is not');

// The one place this file asks for LESS screening. wrist.avoid draws the line
// itself - "anything that puts bodyweight through the palm" - and a forearm
// plank is what a sore wrist is supposed to be given instead of a plank.
check(
  'a plank on the hands is screened out for a sore wrist',
  !reaches('Plank', 'wrist') && !reaches('Plank Taps', 'wrist'),
  'the wrist rule has stopped recognising planks altogether'
);
check(
  'a forearm plank is not',
  reaches('Forearm Side Plank', 'wrist') && reaches('Forearm Side Plank', 'elbow'),
  'the accommodation is being removed along with the thing it accommodates'
);

console.log(
  failures === 0
    ? `\nlibrary-safety-tags: all ${total} checks passed`
    : `\nlibrary-safety-tags: ${total - failures}/${total} passed, ${failures} FAILED`
);
process.exit(failures === 0 ? 0 : 1);
