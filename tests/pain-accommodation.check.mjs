/**
 * Contract test: the app does not prescribe what its own acute protocol says
 * to withhold.
 *
 * lib/acute-rehab.ts states, in the app's own words, what a sore quad, knee,
 * groin or hamstring must NOT be given. Four things were doing exactly that,
 * and every one of them was found by generating real sessions rather than by
 * reading the catalogue.
 *
 * WALL SIT WAS THE PROTECTION FOR A SORE QUAD. quads.avoid names "Isometric
 * Wall Sit" and knee.avoid names "any long hold at 90 degrees", but no rule in
 * lib/exercise-safety.ts matched the words "wall sit". Its primaryMuscle is
 * Quadriceps, so it ranked near the top of the accessory pool, and the card
 * read "Swapped from Bulgarian Split Squat to protect your quads" over a
 * 45-second full-depth quad isometric. At severe as well as mild.
 *
 * COPENHAGEN PLANK WAS THE PROTECTION FOR A SORE GROIN. hip_groin.avoid opens
 * with it by name. The entry even declares its own injury-friendly alternative,
 * and the substitution screen never reads a candidate's own opinion of itself.
 *
 * A HAMSTRING STRAIN WAS CUED TO STRETCH. Two entries, one of them the
 * bodyweight main lift, told a user who had just reported hamstring pain to
 * "feel hamstring stretch" - which acute-rehab.ts's own file header lists as
 * one of the two defects it was written to fix. And a Partial Nordic Curl was
 * the accommodation offered for the same complaint.
 *
 * AND 48 ACCOMMODATIONS COULD NEVER FIRE. The prep and mechanical blocks called
 * templateToExercise directly while every other block used applyComfortOrBadge,
 * so 18 warm-up and 30 priming comfort variants were unreachable. Measured
 * before the fix: 11,600 cards for users in pain, zero comfort ids in either
 * block.
 *
 * Run:  npx tsx tests/pain-accommodation.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';

const { generateWorkout } = await import('../lib/workout-engine.ts');
const { ACUTE_PROTOCOL_NOTES } = await import('../lib/acute-rehab.ts');
const S = await import('../lib/exercise-safety.ts');
const { getAllPickableExercises, SESSION_POOLS } = await import('../lib/exercise-db.ts');

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

/** Every card the app would show, across the shapes a sore user can be in. */
function sweep() {
  const cards = [];
  // The three sessions the app builds. 'squat', 'bench' and 'deadlift' used to
  // be here as well; they now build these same three, card for card, which
  // tests/legacy-session-ids.check.mjs proves, so sweeping them again would
  // only be the same sessions counted twice.
  for (const sessionType of ['lower_body', 'upper_body', 'full_body']) {
    for (const tier of ['bodyweight', 'bands', 'dumbbells', 'fullgym']) {
      for (const region of ['quads', 'knee', 'hip_groin', 'hamstrings', 'front_shoulder', 'glutes']) {
        for (const severity of ['mild', 'severe']) {
          for (const timeAvailable of ['60', '45'])
          for (let seed = 0; seed < 10; seed++) {
            let w;
            try {
              w = generateWorkout(
                sessionType,
                tier,
                {
                  energy: 'normal',
                  hasAches: true,
                  painRegion: region,
                  painRegions: [region],
                  painSeverity: severity,
                  timeAvailable,
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
            for (const ex of w) {
              cards.push({ ...ex, region, sessionType, tier, severity, seed, timeAvailable });
            }
          }
        }
      }
    }
  }
  return cards;
}

const cards = sweep();

// ─── 1. The sweep is real ────────────────────────────────────────────────────
console.log('\n[1] The sessions were actually generated');
check(
  `${cards.length} cards built for users reporting pain`,
  cards.length > 5000,
  'everything below is measuring nothing if this is small'
);

/**
 * And the seed loop has to actually vary the sessions.
 *
 * It did not, for a long time. `strengthSessionCount` is the generator's
 * SEVENTH POSITIONAL argument and the sweep was passing it as a property on the
 * profile object, where nothing reads it - so every turn of the loop built an
 * identical session and the count above was a count of duplicates. A live seed
 * took the sweep from 11,600 cards to 50,104 and immediately turned up a Nordic
 * Hamstring Curl being served to a torn hamstring, which is line two of that
 * region's own avoid list.
 *
 * A count is not coverage. This checks the thing the count is standing in for.
 */
const seedGroups = new Map();
for (const c of cards) {
  const key = `${c.sessionType}|${c.tier}|${c.region}|${c.severity}|${c.timeAvailable}`;
  if (!seedGroups.has(key)) seedGroups.set(key, new Map());
  const bySeed = seedGroups.get(key);
  bySeed.set(c.seed, (bySeed.get(c.seed) ?? '') + c.name + ',');
}
let variedGroups = 0;
let flatGroups = 0;
for (const bySeed of seedGroups.values()) {
  if (bySeed.size < 2) continue;
  if (new Set(bySeed.values()).size > 1) variedGroups++;
  else flatGroups++;
}

check(
  `the seed actually varies the session (${variedGroups} of ${variedGroups + flatGroups} groups differ)`,
  variedGroups > flatGroups,
  'if every seed builds the same session the sweep is one session counted many times - see the header of this block'
);

// ─── 1b. The catalogue itself, exhaustively, with no seed involved ───────────
//
// See the header above: the sweep samples a ten-wide seed window that slides
// with the calendar, so which exercises it happens to serve depends on the day
// it runs. That is fine for testing how sessions are BUILT and useless for
// asking whether anything forbidden is reachable at all.
//
// This asks that question directly. Every pickable exercise, every hand-written
// swap alternative and every comfort variant, against every region that has an
// avoid list. No generator, no seed, same answer in January and in June.
console.log('\n[1b] Nothing in the catalogue is reachable by the region that forbids it');

const everyEntry = [];
{
  const seenEntry = new Set();
  const add = (name, cue) => {
    if (!name) return;
    const key = name + '||' + (cue ?? '');
    if (seenEntry.has(key)) return;
    seenEntry.add(key);
    everyEntry.push({ name, cue: cue ?? '' });
  };
  for (const { template: e } of getAllPickableExercises()) {
    add(e.name, e.cue);
    // A swap the user can choose is served just as surely as the card it
    // replaces, and the swap sheet was where two of these hid last time.
    add(e.swapAlternative?.name, e.swapAlternative?.cue);
    add(e.comfortVariant?.name, e.comfortVariant?.cue);
  }
}

check(
  `${everyEntry.length} catalogue entries screened, swaps and comfort variants included`,
  everyEntry.length > 500,
  'if this is small the screen below is looking at almost nothing'
);

// ─── 2. Nothing on a region's own avoid list is served to that region ────────
console.log('\n[2] Nothing named on the avoid list reaches the region it names');

/**
 * Movement-level patterns, taken from the wording of ACUTE_PROTOCOL_NOTES. Kept
 * narrow on purpose: a hamstring exercise served to a sore SHOULDER is fine,
 * and the whole point is the region-matched case.
 */
const FORBIDDEN = {
  quads: [/\bwall sit\b/i, /quad stretch/i, /couch stretch/i],
  knee: [/\bwall sit\b/i],
  hip_groin: [/copenhagen/i, /butterfly stretch/i, /groin stretch/i],
  hamstrings: [/nordic/i, /hamstrings? stretch/i, /feel hamstring/i],
  // "Deep squats and lunges, which take the hip into the loaded, folded
  // position the tissue least tolerates right now". The region restricted
  // loaded hinges and impact, which is lines one, two and four of its avoid
  // list, and had nothing for line three. Measured before the rule was added:
  // 144 deep squat or lunge cards over 160 sessions, a Back Squat among them
  // AS THE MAIN LIFT, 24 times.
  glutes: [
    /bulgarian|split squat/i,
    /lunge/i,
    /back squat|hack squat|leg press|cossack|pistol/i,
    /pigeon pose|figure-?4/i,
  ],
};

for (const [region, patterns] of Object.entries(FORBIDDEN)) {
  const offenders = cards
    .filter((c) => c.region === region)
    .filter((c) => patterns.some((p) => p.test(`${c.name} ${c.cue ?? ''}`)))
    .map((c) => `${c.sessionType}/${c.tier}/${c.severity} :: ${c.name} :: ${String(c.cue ?? '').slice(0, 60)}`);
  check(
    `a sore ${region} is never given anything on its own avoid list`,
    offenders.length === 0,
    `${offenders.length} card(s), e.g. ${offenders[0] ?? ''}`
  );
}

check(
  'and the protocol still says all of that, so the patterns above mean something',
  /wall sit/i.test(ACUTE_PROTOCOL_NOTES.quads.avoid) &&
    /copenhagen/i.test(ACUTE_PROTOCOL_NOTES.hip_groin.avoid) &&
    /nordic/i.test(ACUTE_PROTOCOL_NOTES.hamstrings.avoid) &&
    /stretch/i.test(ACUTE_PROTOCOL_NOTES.hamstrings.avoid) &&
    /deep squats and lunges/i.test(ACUTE_PROTOCOL_NOTES.glutes.avoid),
  'if the protocol stops naming these, this test is guarding words nobody uses any more'
);

// The exhaustive half of [1b]: now that FORBIDDEN exists, run every catalogue
// entry past it. An entry whose NAME or CUE matches a region's avoid pattern
// must be tagged by the safety screen for that region, or it is servable.
console.log('\n[2b] Every catalogue entry, against every region that forbids it');

for (const [region, patterns] of Object.entries(FORBIDDEN)) {
  // restrictedTagsOn takes a Set, which is what the screen holds internally.
  const banned = new Set(S.RESTRICTED_BY_REGION[region] ?? []);
  const leaks = [];
  for (const entry of everyEntry) {
    const spoken = `${entry.name} ${entry.cue}`;
    if (!patterns.some((p) => p.test(spoken))) continue;
    if (S.restrictedTagsOn(entry.name, banned, undefined, entry.cue).length === 0) {
      leaks.push(`${entry.name} :: ${entry.cue.slice(0, 70)}`);
    }
  }
  check(
    `a sore ${region} cannot be served anything in the catalogue on its own avoid list`,
    leaks.length === 0,
    `${leaks.length} entr(y/ies): ${leaks.slice(0, 3).join(' | ')}`
  );
}

// ─── 3. The screen knows about them ──────────────────────────────────────────
console.log('\n[3] The safety screen carries the rules that make that true');

check(
  'a wall sit counts as deep knee bending',
  S.stressTagsFor('Wall Sit').includes('deep_knee_flexion'),
  'it was matched by nothing, so it ranked top of the pool as a QUAD exercise and was chosen AS the protection'
);
check(
  'and both knee and quads restrict that',
  S.RESTRICTED_BY_REGION.knee.includes('deep_knee_flexion') &&
    S.RESTRICTED_BY_REGION.quads.includes('deep_knee_flexion'),
  ''
);
check(
  'a Copenhagen plank counts as adductor load',
  S.stressTagsFor('Copenhagen Plank').includes('adductor_load'),
  ''
);
check(
  'and a sore groin restricts it',
  S.RESTRICTED_BY_REGION.hip_groin.includes('adductor_load'),
  ''
);
check(
  'but the gentle adduction regression is still available',
  !S.stressTagsFor('Side-Lying Hip Adduction').includes('adductor_load'),
  'banning the substitute along with the movement leaves nothing to put in its place'
);

// ─── 4. Warm-ups accommodate pain like everything else ───────────────────────
console.log('\n[4] Every block applies its comfort variants, not just three of them');

const comfortByCategory = {};
for (const c of cards) {
  if (String(c.id ?? '').endsWith('-comfort')) {
    comfortByCategory[c.category ?? '?'] = (comfortByCategory[c.category ?? '?'] ?? 0) + 1;
  }
}

/**
 * WHICH BLOCKS ARE ASKED, DERIVED RATHER THAN TYPED OUT.
 *
 * This used to name five categories - prep, mechanical, neuro, main and
 * accessory - which was a list of the blocks the old lift-day generator had.
 * Two of those blocks do not exist in the session anybody is given now, and a
 * hardcoded list of them would either fail for ever or have to be quietly
 * shortened, which is how a clinical promise turns into a comment.
 *
 * So the question is asked the other way round, off the catalogue and off the
 * sessions actually built: if the app can put an exercise in a slot, and
 * SOMEBODY HAS WRITTEN A GENTLER VERSION OF THAT EXERCISE, then a user in pain
 * has to be able to receive it. A category with no accommodation authored for
 * it is not asked for one; a category nothing builds is not asked either.
 *
 * It answers the same question the five names did, and it answers it for
 * whatever the app looks like next: author a comfort variant on a finisher
 * tomorrow, and the finisher block has to start applying it.
 */
function templatesIn(value, out = []) {
  if (Array.isArray(value)) {
    for (const v of value) templatesIn(v, out);
    return out;
  }
  if (value && typeof value === 'object') {
    if (typeof value.name === 'string' && typeof value.category === 'string') {
      out.push(value);
      return out;
    }
    for (const v of Object.values(value)) templatesIn(v, out);
  }
  return out;
}

const authoredByCategory = {};
for (const t of templatesIn(SESSION_POOLS)) {
  if (!t.comfortVariant) continue;
  authoredByCategory[t.category] = (authoredByCategory[t.category] ?? 0) + 1;
}
const builtCategories = new Set(cards.map((c) => c.category));
const accommodating = Object.keys(authoredByCategory)
  .filter((c) => builtCategories.has(c))
  .sort();

check(
  `${accommodating.length} kinds of block both get built and have accommodations written for them`,
  accommodating.length >= 2,
  `only ${accommodating.join(', ') || 'none'}, so everything below would be measuring almost nothing`
);
for (const category of accommodating) {
  check(
    `${category}: ${comfortByCategory[category] ?? 0} of its ${authoredByCategory[category]} authored accommodations fired`,
    (comfortByCategory[category] ?? 0) > 0,
    'this block calls templateToExercise directly, so every accommodation written for it is unreachable'
  );
}


/**
 * PER SESSION LENGTH, because how many cards a block pushes branches on it.
 *
 * An aggregate count is satisfied by one branch on its own: a mutation run
 * proved exactly that, by breaking the short-session push and watching the
 * checks above stay green on the 60-minute numbers alone. So each length is
 * counted separately, over the same derived list of blocks.
 *
 * There was a source-text assertion here as well, pinning the exact spelling of
 * the prep loop's call to applyComfortOrBadge. It is gone: the loop it pinned
 * belonged to the lift-day generator nothing reaches any more, so it had become
 * a test that reads a line nobody runs, and the counts above and below say the
 * same thing about the code that does run.
 */
for (const t of ['60', '45']) {
  for (const category of accommodating) {
    const applied = cards.filter(
      (c) =>
        c.timeAvailable === t &&
        c.category === category &&
        String(c.id ?? '').endsWith('-comfort')
    ).length;
    check(
      `${category} at ${t} minutes: ${applied} comfort variants applied`,
      applied > 0,
      'this block has a separate code path per session length and each one has to accommodate pain'
    );
  }
}

// ─── 5. The rehab slot survives a collision with the warm-up ─────────────────
console.log('\n[5] The acute rehab card is never the one deleted');

/**
 * Switching comfort variants on for prep immediately cost two rehab slots: a
 * bench session for a sore shoulder began with a Pendulum Shoulder Swing, which
 * is what the acute protocol prescribes for that region, and first-wins dedup
 * deleted the rehab card rather than the warm-up. The movement survived; the
 * card saying what it was for did not.
 */
/** Every name the warm-up block could put on a card, gentler versions included. */
const prepNames = new Set();
for (const t of templatesIn(SESSION_POOLS.PREP)) {
  prepNames.add(t.name.toLowerCase().trim());
  if (t.comfortVariant?.name) prepNames.add(t.comfortVariant.name.toLowerCase().trim());
}

let slots = 0;
const missing = [];
const collided = [];
for (const region of Object.keys(ACUTE_PROTOCOL_NOTES)) {
  for (const type of ['lower_body', 'upper_body', 'full_body']) {
    const w = generateWorkout(
      type,
      'fullgym',
      {
        hasAches: true,
        painRegion: region,
        painSeverity: 'mild',
        energy: 'normal',
        timeAvailable: '45',
      },
      profile,
      undefined,
      undefined,
      3
    );
    const rehab = w.filter((e) => e.category === 'prehab');
    slots += rehab.length;
    if (rehab.length === 0) missing.push(`${type}/${region}`);
    // The card that survived a clash is the rehab one, not the warm-up one.
    for (const r of rehab) {
      if (prepNames.has(r.name.toLowerCase().trim())) collided.push(`${type}/${region}: ${r.name}`);
    }
  }
}
check(
  `every one of the ${Object.keys(ACUTE_PROTOCOL_NOTES).length * 3} region and session pairs keeps its rehab slot (${slots} found)`,
  missing.length === 0,
  `missing: ${missing.join(', ')}`
);
check(
  // Without this the assertion above is satisfied by a session where nothing
  // ever clashes, and the rule it is guarding would never be exercised. There
  // has to be at least one pair where the acute protocol's exercise is also
  // something the warm-up could have offered, and on those the surviving card
  // has to be the rehab one. A plain first-wins dedup drops whichever card was
  // assembled later, and the rehab slot is always assembled after the warm-up.
  `and the clash this rule exists for really does happen (${collided.length} pair(s))`,
  collided.length > 0,
  'no rehab exercise shares a name with anything the warm-up can offer, so the tie-break is untested'
);

// ─── 6. A swap does not hand somebody a different prescription ───────────────
console.log('\n[6] A swap button offers something the card can actually describe');

const db = readFileSync(new URL('../lib/exercise-db.ts', import.meta.url), 'utf8');
check(
  'the deadlift-day stretch no longer offers a Nordic behind its swap',
  !/name: 'Nordic Hamstring Curl \(slow eccentric\)'/.test(db),
  "swapping inherits the ORIGINAL sets and reps, so the card read 'Nordic Hamstring Curl - 2 x 30s each'"
);
check(
  'and no cue tells anyone to load a band across their neck',
  !/band around neck/i.test(db),
  'the app restricts neck_load elsewhere for exactly this reason'
);

console.log('');
if (failures > 0) {
  console.error(`pain-accommodation: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`pain-accommodation: all ${total} checks passed\n`);
  process.exitCode = 0;
}
