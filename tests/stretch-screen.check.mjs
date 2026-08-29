/**
 * Contract test: the pain flag reaches the stretches, in the session AND
 * behind the swap button.
 *
 * lib/acute-rehab.ts states region by region what must not be lengthened while
 * it heals. Nothing enforced it. The tag table in lib/exercise-safety.ts
 * described MOVEMENTS - jumping, hinging, pressing overhead - and had no
 * concept of a tissue being taken to its end range, so a stretch of the exact
 * muscle the user had just reported went through untouched.
 *
 * Measured over the real generator, before and after, with the sweep below:
 *
 *                       before            after
 *   session cards       14 distinct,      0
 *                       432 occurrences
 *   swap offers         16 distinct,      0
 *                       990 occurrences
 *
 * Every one was named in its own region's avoid list: Couch Stretch offered to
 * four regions that name it, Pigeon Pose to the three that name it, Doorway
 * Chest Opener to a strained pec, Cross-Body Shoulder Stretch to a bicep,
 * Gentle Neck Side Stretch to a strained neck, and Standing Hamstring Reach to
 * a hamstring strain.
 *
 * WHAT THIS TEST IS CAREFUL ABOUT
 * ──────────────────────────────
 * The rules read the CUE as well as the name, because the catalogue's worst
 * stretch instructions belong to innocently named things - "Bodyweight Hip
 * Hinge", cued "Feel the stretch in your hamstrings". Reading cues is also how
 * a rule turns into an over-removal, so three failure modes are pinned here
 * rather than left to trust:
 *
 *   1. A comfort variant that exists to REMOVE a stretch says so in the words
 *      the rules look for ("reduces shoulder end-range stretch"). Screening it
 *      out would delete the accommodation and leave the thing it accommodates.
 *   2. A dynamic drill passes through a range without holding it. "30s
 *      cross-body arm swings" is a warm-up; banning it takes the general
 *      warm-up off anyone with a sore arm.
 *   3. The session must not get shorter. Composition is asserted whole.
 *
 * And the swap slot on a card that ALREADY carries a safetyNote is excluded on
 * purpose: it holds the exercise that was removed, under the words "Swapped
 * from X to protect your Y". That is the user's own informed revert, not the
 * app choosing on their behalf, and the distinction is the one
 * substitutionRestrictedTags is built on.
 *
 * Run:  npx tsx tests/stretch-screen.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

const { generateWorkout } = await import('../lib/workout-engine.ts');
const { ACUTE_PROTOCOL_NOTES } = await import('../lib/acute-rehab.ts');
const S = await import('../lib/exercise-safety.ts');

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

const profile = {
  name: 'P',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['muscle'],
  bodyweightKg: 80,
};

// ── 1. The tags exist and mean something ───────────────────────────────────

console.log('\nthe tag table now describes lengthening, not only loading\n');

/**
 * One named exercise per rule, taken from the region's own avoid list, and the
 * tag it has to earn. These are RUN through stressTagsFor rather than read out
 * of the source, so a rule that stops matching fails here.
 */
const MUST_TAG = [
  ['Standing Hamstring Stretch', 'hamstring_lengthen'],
  ['Supine Hamstring Stretch (Strap)', 'hamstring_lengthen'],
  ['Hip Hinge Against Wall', 'hamstring_lengthen'],
  ['Standing Hamstring Reach', 'hamstring_lengthen'],
  ['Bodyweight Hip Hinge', 'hamstring_lengthen'],
  ['Bodyweight Good Morning', 'hamstring_lengthen'],
  ['Cool Down Stretch Sequence', 'hamstring_lengthen'],
  ['Calf Stretch (Wall)', 'calf_lengthen'],
  ['Soleus Stretch', 'calf_lengthen'],
  ['Couch Stretch', 'quad_hipflexor_lengthen'],
  ['Standing Quad Stretch', 'quad_hipflexor_lengthen'],
  ['Hip Flexor Stretch', 'quad_hipflexor_lengthen'],
  ['Hip Flexor Kneeling Stretch', 'quad_hipflexor_lengthen'],
  ['Pigeon Pose', 'hip_end_range'],
  ['Figure-4 Glute Stretch', 'hip_end_range'],
  ['Doorway Chest Stretch', 'pec_lengthen'],
  ['Pec Minor Stretch', 'pec_lengthen'],
  ['Floor Angel', 'pec_lengthen'],
  ['Cross-Body Shoulder Stretch', 'posterior_shoulder_lengthen'],
  ['Bicep Stretch (arm back)', 'bicep_lengthen'],
  ['Overhead Tricep Stretch', 'tricep_lengthen'],
  ['Wall Angel', 'tricep_lengthen'],
  ['Wrist Flexor Stretch', 'forearm_lengthen'],
  ['Wrist Extensor Stretch', 'forearm_lengthen'],
  ['Forearm Flexor & Extensor Stretch', 'forearm_lengthen'],
  ['Doorway Lat Stretch', 'lat_lengthen'],
  ['Side-Bend Overhead Reach', 'lat_lengthen'],
  ['Neck Side Stretch', 'neck_trap_lengthen'],
  ['Upper Trap Stretch', 'neck_trap_lengthen'],
  ['Levator Scapulae Stretch', 'neck_trap_lengthen'],
  ["Child's Pose", 'spinal_end_range'],
  ['Cat-Cow', 'spinal_end_range'],
];

for (const [name, tag] of MUST_TAG) {
  check(
    `${name} is tagged ${tag}`,
    S.stressTagsFor(name).includes(tag),
    'named in its region’s avoid list in lib/acute-rehab.ts'
  );
}

// A lat stretch performed in a doorway is a lat stretch, not a chest stretch.
check(
  'Doorway Lat Stretch is not counted as a chest stretch',
  !S.stressTagsFor('Doorway Lat Stretch').includes('pec_lengthen'),
  'the doorway pattern has to name the tissue, or it claims everything in a doorway'
);

// ── 2. Each region loses what its own protocol says to withhold ────────────

console.log('\neach region is off the stretches its own protocol names\n');

const REGION_BLOCKS = [
  ['hamstrings', 'Standing Hamstring Stretch'],
  ['hamstrings', 'Pigeon Pose'],
  ['calf_shin', 'Calf Stretch (Wall)'],
  ['ankle_achilles', 'Soleus Stretch'],
  ['quads', 'Couch Stretch'],
  ['quads', 'Standing Quad Stretch'],
  ['knee', 'Figure-4 Glute Stretch'],
  ['hip_groin', 'Pigeon Pose'],
  ['hip_groin', 'Hip Flexor Stretch'],
  ['glutes', 'Figure-4 Glute Stretch'],
  ['lower_back', 'Hip Flexor Stretch'],
  ['front_shoulder', 'Doorway Chest Stretch'],
  ['front_shoulder', 'Cross-Body Shoulder Stretch'],
  ['rear_shoulder', 'Cross-Body Shoulder Stretch'],
  ['chest', 'Pec Minor Stretch'],
  ['bicep', 'Bicep Stretch (arm back)'],
  ['bicep', 'Wrist Flexor Stretch'],
  ['tricep', 'Overhead Tricep Stretch'],
  ['tricep', 'Wrist Extensor Stretch'],
  ['elbow', 'Forearm Flexor & Extensor Stretch'],
  ['wrist', 'Wrist Flexor Stretch'],
  ['neck', 'Neck Side Stretch'],
  ['upper_back', "Child's Pose"],
  ['upper_back', 'Upper Trap Stretch'],
  ['lat_mid_back', 'Doorway Lat Stretch'],
  ['core_ribs', 'Cat-Cow'],
];

for (const [region, name] of REGION_BLOCKS) {
  const banned = S.restrictedTagsFor([region], 'intermediate', 'mild');
  check(
    `${region} blocks ${name}`,
    S.restrictedTagsOn(name, banned).length > 0,
    `ACUTE_PROTOCOL_NOTES.${region}.avoid names it`
  );
}

// Every one of those really is in the protocol text, so this file cannot drift
// into asserting a rule the clinician never wrote.
for (const [region, name] of REGION_BLOCKS.slice(0, 6)) {
  const words = (ACUTE_PROTOCOL_NOTES[region]?.avoid ?? []).join(' ').toLowerCase();
  const head = name.toLowerCase().split(' ')[0].replace(/[^a-z-]/g, '');
  check(
    `and ${region}.avoid actually mentions ${head}`,
    words.includes(head),
    'the assertion above has to trace back to something Archie wrote'
  );
}

// ── 3. A cue that removes a stretch is not screened out for saying so ──────

console.log('\nan accommodation is not deleted for the word it uses to promise safety\n');

/** The tags this change introduced. */
const LENGTHENING_TAGS = new Set([
  'hamstring_lengthen', 'calf_lengthen', 'quad_hipflexor_lengthen', 'hip_end_range',
  'pec_lengthen', 'posterior_shoulder_lengthen', 'bicep_lengthen', 'tricep_lengthen',
  'forearm_lengthen', 'lat_lengthen', 'neck_trap_lengthen', 'spinal_end_range',
]);

const DISCLAIMED = [
  ['DB Chest Fly (limited arc)', 'Arms only to parallel, smaller range - reduces shoulder end-range stretch'],
  ['High-to-Low Cable Fly (light)', 'Shorter range, lighter load - reduces front shoulder stretch stress'],
  ['Incline Push-Up (slow)', 'Hands elevated on bench or step, 3s down - reduce chest stretch depth to manage soreness'],
  ['Standing Hip Hinge Against Wall', 'Hands on the wall, push the hips back and stop while the back is still flat, then drive the hips forward to stand - no stretch at the bottom, this is the deloaded pattern'],
  ['Glute Bridge (isometric hold)', 'Feet flat and tucked in close, lift the hips and hold - the hamstring works with nothing lengthening'],
  ['Supported Hip Hinge', 'Hands on the wall, push the hips back only as far as the back stays flat, then drive the hips forward to stand - stop short of any pull down the back of the thigh'],
];

for (const [name, cue] of DISCLAIMED) {
  const tags = S.stressTagsFor(name, undefined, cue);
  // The NEW tags only. shoulder_end_range is a pre-existing movement tag and a
  // limited-arc fly legitimately carries it.
  const lengthening = tags.filter((t) => LENGTHENING_TAGS.has(t));
  check(
    `"${name}" keeps its accommodation`,
    lengthening.length === 0,
    `claimed ${lengthening.join(', ')} from a cue that says the stretch is not there`
  );
}

// ── 4. Dynamic drills are not stretches ────────────────────────────────────

console.log('\na drill that passes through a range is not a held stretch\n');

const DYNAMIC = [
  ['Leg Swing + Arm Cross Warm-Up', 'posterior_shoulder_lengthen'],
  ['Hip Hinge Speed Drill', 'hamstring_lengthen'],
  ['Goblet Squat (continuous)', 'pec_lengthen'],
  ['KB Side Lunge', 'pec_lengthen'],
  ['Landmine Split Squat', 'pec_lengthen'],
];

for (const [name, tag] of DYNAMIC) {
  check(
    `${name} is not tagged ${tag}`,
    !S.stressTagsFor(name).includes(tag),
    'holding a bell at your chest is where the bell goes, and an arm swing is not a held stretch'
  );
}

// ── 5. The authored swap is judged on its OWN cue ──────────────────────────

console.log('\na hand-authored swap is read, not just its title\n');

{
  const banned = S.restrictedTagsFor(['hamstrings'], 'intermediate', 'mild');
  const cue = 'Hands clasped behind the head, hinge forward - feel hamstrings stretch at bottom';
  check(
    'a swap cued to feel a hamstring stretch is refused for a hamstring strain',
    S.restrictedTagsOn('Some Unlisted Hinge', banned, undefined, cue).length > 0,
    'the cue is where the stretch instruction lives; the title says nothing'
  );
  check(
    'and the same title with a safe cue is allowed',
    S.restrictedTagsOn('Some Unlisted Hinge', banned, undefined, 'hinge and stand, flat back').length === 0,
    'the rule must read the words, not the name it never recognised'
  );
}

{
  // Through the real swap builder, not just the tag function. 322 of the 761
  // hand-authored alternatives are NOT catalogue templates, so there is no
  // entry to look their cue up from - the cue travelling with the option is
  // the only evidence there is.
  const { fillSwapAlternatives } = await import('../lib/workout-engine.ts');
  const readiness = {
    energy: 'normal', hasAches: true, painRegion: 'hamstrings',
    painRegions: ['hamstrings'], painSeverity: 'mild', timeAvailable: '60',
  };
  const card = {
    id: 't1', name: 'Bodyweight Squat', sets: 3, reps: '10', cue: 'sit down, stand up',
    category: 'accessory', suggestedLoad: 'Bodyweight', primaryMuscle: 'Quadriceps',
    hasSwap: true,
    swapName: 'Some Alternative The Catalogue Never Heard Of',
    swapCue: 'Hinge forward and feel the hamstring stretch at the bottom',
    swapLoad: 'Bodyweight',
  };
  const out = fillSwapAlternatives([card], readiness, 'bodyweight', profile, 0);
  const offered = [out[0].swapName, out[0].swap2Name].filter(Boolean);
  check(
    'the swap sheet refuses an authored option on the strength of its cue alone',
    !offered.includes('Some Alternative The Catalogue Never Heard Of'),
    'a name the catalogue does not know has no cue to look up; the one it travels with is all there is'
  );
}

// ── 6. End to end, over the real generator ─────────────────────────────────

console.log('\nand nothing reaches a real session or a real swap sheet\n');

/**
 * What each region must not be handed, in the protocol's own terms. Written
 * INDEPENDENTLY of the rules in lib/exercise-safety.ts on purpose - a probe
 * that reuses the implementation's regexes cannot catch the implementation.
 */
const HAZARD = {
  hamstrings: /hamstrings?[a-z ,'-]{0,14}(stretch|lengthen)|(stretch|lengthen)[a-z ,'-]{0,14}hamstrings?|standing hamstring reach|pigeon pose/i,
  calf_shin: /(calf|calves|soleus)[a-z ,'-]{0,14}stretch|stretch[a-z ,'-]{0,14}(calf|calves|soleus)/i,
  ankle_achilles: /(calf|calves|soleus)[a-z ,'-]{0,14}stretch|stretch[a-z ,'-]{0,14}(calf|calves|soleus)/i,
  quads: /couch stretch|(quad|hip flexor)[a-z ,'-]{0,14}stretch|stretch[a-z ,'-]{0,14}(quad|hip flexor)/i,
  knee: /couch stretch|(quad|hip flexor)[a-z ,'-]{0,14}stretch|figure-?4/i,
  hip_groin: /groin stretch|butterfly stretch|pigeon pose|frog stretch|hip flexor[a-z ,'-]{0,14}stretch/i,
  glutes: /figure-?4|pigeon pose/i,
  front_shoulder: /doorway (chest|pec)[a-z ]{0,8}(stretch|opener)|pec minor stretch|(pec|chest)[a-z ,'-]{0,14}stretch|cross-?body shoulder stretch/i,
  rear_shoulder: /cross-?body shoulder stretch|sleeper stretch/i,
  chest: /doorway (chest|pec)[a-z ]{0,8}(stretch|opener)|pec minor stretch|(pec|chest)[a-z ,'-]{0,14}stretch|floor angel/i,
  bicep: /bicep[a-z ,'-]{0,14}stretch|cross-?body shoulder stretch|wrist flexor stretch/i,
  tricep: /tricep[a-z ,'-]{0,14}stretch|wrist extensor stretch|wall angel/i,
  elbow: /wrist (flexor|extensor) stretch|forearm flexor|forearm extensor/i,
  wrist: /wrist (flexor|extensor) stretch|forearm flexor|forearm extensor/i,
  neck: /neck side stretch|upper trap stretch|levator scapulae/i,
  lower_back: /hip flexor[a-z ,'-]{0,14}stretch/i,
  upper_back: /cat-?cow|child's pose|upper trap stretch|levator scapulae|neck side stretch/i,
  // \blats?\b, not lat. Without the boundary this matched "more isoLATion and
  // stretch" on a Bulgarian Split Squat and reported it as a lat stretch being
  // offered to a sore mid-back. The app's own rules learned this the same way.
  lat_mid_back: /\blats?\b[a-z ,'-]{0,14}stretch|child's pose|side-?bend overhead reach/i,
  core_ribs: /cat-?cow/i,
};

const hazardCards = [];
const hazardSwaps = [];
let sessions = 0;
let cardCount = 0;
let slotCount = 0;
let noWarmUp = 0;
let noCooldown = 0;
let emptySessions = 0;

for (const sessionType of ['lower_body', 'upper_body', 'full_body', 'deadlift', 'squat', 'bench']) {
  for (const tier of ['bodyweight', 'bands', 'dumbbells', 'fullgym']) {
    for (const region of Object.keys(HAZARD)) {
      const re = HAZARD[region];
      for (const severity of ['mild', 'severe']) {
        for (let seed = 0; seed < 2; seed++) {
          let workout;
          try {
            workout = generateWorkout(
              sessionType,
              tier,
              {
                energy: 'normal',
                hasAches: true,
                painRegion: region,
                painRegions: [region],
                painSeverity: severity,
                timeAvailable: '60',
              },
              profile,
              undefined,
              undefined,
              // The seed is the SEVENTH POSITIONAL argument. Passing it as
              // `{ ...profile, strengthSessionCount: seed }` sets a property the
              // generator never reads, so every turn of this loop produced an
              // identical session and the sweep below counted duplicates.
              seed
            );
          } catch {
            continue;
          }
          sessions++;
          cardCount += workout.length;
          if (workout.length === 0) emptySessions++;
          const cats = new Set(workout.map((e) => e.category));
          if (!cats.has('prep')) noWarmUp++;
          if (!cats.has('cooldown')) noCooldown++;

          for (const ex of workout) {
            if (re.test(`${ex.name} :: ${ex.cue ?? ''}`)) {
              hazardCards.push(`[${region}] ${ex.name} (${ex.category})`);
            }
            // A card already carrying a safetyNote holds the exercise it
            // REPLACED behind its swap button, labelled. That is the revert.
            if (ex.safetyNote) continue;
            for (const [name, cue] of [
              [ex.swapName, ex.swapCue],
              [ex.swap2Name, ex.swap2Cue],
            ]) {
              if (!name) continue;
              slotCount++;
              if (re.test(`${name} :: ${cue ?? ''}`)) {
                hazardSwaps.push(`[${region}] ${name}`);
              }
            }
          }
        }
      }
    }
  }
}

const uniq = (a) => [...new Set(a)];

check(
  `the sweep actually ran (${sessions} sessions, ${cardCount} cards, ${slotCount} swap slots)`,
  sessions > 400 && cardCount > 4000 && slotCount > 6000,
  'a sweep that generates nothing proves nothing'
);
check(
  'no session card stretches the tissue the user reported',
  hazardCards.length === 0,
  uniq(hazardCards).slice(0, 6).join(' | ')
);
check(
  'no swap slot offers one either',
  hazardSwaps.length === 0,
  uniq(hazardSwaps).slice(0, 6).join(' | ')
);

// ── 7. And the session did not get shorter to achieve it ───────────────────

console.log('\nwithout quietly shrinking the session\n');

check('no session came back empty', emptySessions === 0, `${emptySessions} empty`);
check('every session still has a warm-up', noWarmUp === 0, `${noWarmUp} without prep`);
check('every session still has a cooldown', noCooldown === 0, `${noCooldown} without cooldown`);
check(
  'and the average session is still a full one',
  cardCount / sessions > 9,
  `${(cardCount / sessions).toFixed(2)} cards per session`
);

console.log('');
if (failures > 0) {
  console.error(`stretch-screen: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`stretch-screen: all ${total} checks passed\n`);
  process.exitCode = 0;
}
