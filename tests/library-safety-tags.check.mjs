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

/** Every stress an exercise carries, by name. Used to ask whether an avoid
 *  phrase still guards anything when the app has stopped spelling it that way. */
const tagsOn = (name) => stressTagsFor(name);

/**
 * Avoid phrases the app has no movement for at all, with the reason.
 *
 * Keyed `<region>.<phrase>`. An entry here says "we looked, and Archie's list
 * genuinely does not contain this movement" - not "this rule stopped working".
 * The rule itself stays in lib/acute-rehab.ts and in the tag table, so the day
 * one of these IS added it is screened from the first session it appears in.
 */
const NOTHING_DOES_THIS = {
  'neck.Loaded shrugs':
    'the library has no shrug, and nothing else in it loads the neck directly - no record in the app carries neck_load',
};

/** Would this exercise reach someone whose only sore area is `region`? */
const reaches = (name, region) =>
  restrictedTagsOn(name, restrictedTagsFor([region])).length === 0;

console.log('\n[2] Nothing in the library is invisible to the screen');

// A name with no tags at all is not necessarily wrong - a Bird Dog genuinely
// asks nothing of anything - but it is where the silent failure lives, so the
// set is pinned. Anything joining this list is a name no rule recognised.
// UNCLASSIFIED_BY_DESIGN now lives in tests/_clinical-expectations.mjs.

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
 * The clinical expectation table now lives in tests/_clinical-expectations.mjs,
 * because tests/library-clinical.check.mjs asks the same questions of library
 * RECORDS and two copies of a clinical table is how one stops matching the
 * other. The questions below are unchanged: they are asked of NAMES, which is
 * what the screen reads when nothing has written its tags down.
 */

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
    { phrase: 'Loaded shrugs', movement: /\bshrugs?\b/i, tag: 'neck_load' },
    { phrase: "farmer's carries", movement: /farmer/i },
    /**
     * Matched by the TAG rather than by the name, because the app's overhead
     * pressing is not called that any more.
     *
     * Archie's library presses overhead as Standing, Seated, Single Arm and
     * Alternating Dumbbell Press and as a Landmine Press, and not one of those
     * names contains the words "overhead press". Asked by name this rule went
     * from guarding six movements to guarding none, while the protection itself
     * never moved: all five carry `overhead`, which is on the neck's banned
     * list, so a sore neck refuses every one of them.
     */
    { phrase: 'overhead pressing', movement: /overhead press/i, tag: 'overhead' },
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
  for (const entry of entries) {
    const { phrase, movement: pattern } = entry;
    check(
      `${region}.avoid still says "${phrase}"`,
      avoidText.toLowerCase().includes(phrase.toLowerCase()),
      'the protocol was reworded and the rule that enforces it was left behind'
    );
    const matches = everyName.filter((n) => pattern.test(n));
    /**
     * A phrase guards something, or the app genuinely has nothing it is about.
     *
     * Three ways to satisfy this, and the third one has to be written down.
     *
     *  - a NAME matches, which is the ordinary case;
     *  - or the TAG the phrase stands for is carried by something, which is how
     *    a movement Archie spells differently is still caught (see neck's
     *    "overhead pressing");
     *  - or the movement is not in the app at all, in which case it has to be on
     *    NOTHING_DOES_THIS below with a reason, so a rule that has quietly
     *    stopped matching cannot be mistaken for one the app has outgrown.
     */
    const byTag = entry.tag ? everyName.filter((n) => tagsOn(n).includes(entry.tag)) : [];
    const declaredAbsent = NOTHING_DOES_THIS[`${region}.${phrase}`];
    check(
      `...and something in the app matches it (${matches.length} by name, ${byTag.length} by tag)`,
      matches.length > 0 || byTag.length > 0 || !!declaredAbsent,
      `"${phrase}" now guards nothing, and is not on the list of movements the app does not have`
    );
    if (declaredAbsent && matches.length === 0 && byTag.length === 0) {
      console.log(`      (nothing in the app does this: ${declaredAbsent})`);
    }
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
