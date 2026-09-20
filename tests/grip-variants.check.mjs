/**
 * Contract test: the grip/stance variant table is real and wired up.
 *
 * WHY THIS MATTERS
 * ────────────────
 * lib/grip-variants.ts maps exercise NAMES to grip variants. A name that does
 * not exactly match a database entry produces no variant, silently and forever
 * — the feature would simply never fire and nothing would say so. That is the
 * failure this file exists to catch, and it is easy to hit: the database
 * contains "Inverted Row" AND "Inverted Row (Table/Bar)", "Pull-Up" AND
 * "Pull-Up / Chin-Up".
 *
 * It also pins the safety reasoning. Every entry was adversarially reviewed
 * against whether it needs a different working weight (it inherits the base's
 * suggestedLoad) and whether it increases load on a vulnerable joint — this is
 * a rehab-adjacent app. Wide-grip pulldowns and rows were rejected on
 * impingement grounds; the Inverted Row survived because the torso is
 * horizontal and the shoulder never passes 90 degrees of abduction. If someone
 * adds a wide-grip vertical pull later, the count assertions below will make
 * them read this note first.
 *
 * Run:  npx tsx tests/grip-variants.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

globalThis.__DEV__ = false;

const __dir = dirname(fileURLToPath(import.meta.url));
const engineSrc = readFileSync(join(__dir, '../lib/workout-engine.ts'), 'utf8');

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

const { GRIP_VARIANTS, applyGripVariant } = await import('../lib/grip-variants.ts');
const { getAllPickableExercises } = await import('../lib/exercise-db.ts');

// ─── 1. Every base name exists, exactly ──────────────────────────────────────
console.log('\n[1] Base names match the database exactly');

const dbNames = new Set(getAllPickableExercises().map((e) => e.template.name));
const bases = Object.keys(GRIP_VARIANTS);
check(`the table has entries (${bases.length})`, bases.length > 0, '');

const unknown = bases.filter((b) => !dbNames.has(b));
check(
  'every base name resolves to a real exercise',
  unknown.length === 0,
  unknown.length ? `no such exercise: ${unknown.join(', ')} — a typo here means the variant never fires` : ''
);

// A variant must not collide with a real exercise, or the session dedupe would
// treat them as the same thing and one would vanish.
const variantNames = Object.values(GRIP_VARIANTS).flat().map((v) => v.name);
const collisions = variantNames.filter((v) => dbNames.has(v));
check(
  'no variant name collides with an existing exercise',
  collisions.length === 0,
  collisions.join(', ')
);

// ─── 2. The variants are well-formed ─────────────────────────────────────────
console.log('\n[2] Variants are usable without separate footage');

const badCue = Object.entries(GRIP_VARIANTS).flatMap(([base, vs]) =>
  vs.filter((v) => v.cueSuffix.trim().length < 40).map((v) => `${base} -> ${v.name}`)
);
check(
  'every variant carries a substantive cue',
  badCue.length === 0,
  `${badCue.join(', ')} — the variant inherits the base's video, so the cue is all the user gets`
);

const sameAsBase = Object.entries(GRIP_VARIANTS).flatMap(([base, vs]) =>
  vs.filter((v) => v.name === base).map((v) => v.name)
);
check('no variant is just the base renamed', sameAsBase.length === 0, sameAsBase.join(', '));

// ─── 3. Rotation actually alternates ─────────────────────────────────────────
console.log('\n[3] applyGripVariant rotates');

const sample = { id: 'x', name: bases[0], cue: 'Base cue.', sets: 3, reps: '8', suggestedLoad: 'Bodyweight' };
const produced = new Set();
for (let seed = 0; seed < 8; seed++) produced.add(applyGripVariant(sample, seed).name);
check(
  `"${bases[0]}" yields both itself and its variant across seeds (${produced.size})`,
  produced.size === GRIP_VARIANTS[bases[0]].length + 1,
  `got ${[...produced].join(', ')}`
);

check(
  'the id is preserved so progression continues',
  applyGripVariant(sample, 1).id === sample.id,
  'a variant that changes id would restart the weight history for the same movement'
);

const untouched = { id: 'y', name: 'Definitely Not In The Table', cue: 'c', sets: 3, reps: '8', suggestedLoad: '' };
check(
  'an exercise with no curated variant is returned unchanged',
  applyGripVariant(untouched, 3) === untouched,
  ''
);

// ─── 4. Unwired from session generation ──────────────────────────────────────
console.log('\n[4] Nothing in the app applies it any more');

/**
 * THE TABLE IS DATA THE APP NO LONGER USES, AND THAT IS THE POINT NOW.
 *
 * This used to assert the opposite - that the weekly generator's accessory loop
 * called `applyGripVariant(base, sessionSeed + i)`, in the else arm of the
 * `i === 0` test so the main lift kept its own rarer rotation. Both were true
 * and both stopped mattering: every Train session is built from Archie's
 * library, and a library record is named exactly once. A card reading
 * "Wide-Grip Inverted Row" is a card the video table, the level ladders, the
 * safety regexes and the user's own history cannot look up, because no list
 * holds that name.
 *
 * So the wiring assertion is inverted rather than deleted. The table and its
 * rotation are still held by sections 1 to 3 - lib/grip-variants.ts goes when
 * the old pools go - and section 5 asks the question that actually protects the
 * user: does a grip variant ever reach a session.
 */
check(
  'no generator calls applyGripVariant',
  !/applyGripVariant\s*\(/.test(engineSrc),
  'a renamed card is a card no list can answer for'
);
check(
  'and the engine does not import it either',
  !/from '\.\/grip-variants'/.test(engineSrc),
  'an unused import is the wiring waiting to be put back by accident'
);

// ─── 5. Where it can and cannot reach ────────────────────────────────────────
console.log('\n[5] Observed in generated sessions');

/**
 * THE TABLE IS DORMANT, AND THAT IS NOW THE THING WORTH ASSERTING.
 *
 * This used to say "a grip variant appears in real sessions", sampled on Upper
 * Body and Full Body, because a table that fires nowhere is a table not worth
 * having. Then Lower, Upper and Full Body were switched to Archie's library and
 * the only caller - the weekly generator's accessory loop - stopped building
 * anything, so the honest reading became "not in a library session". The call
 * itself has now gone, so the sweep is held to the whole app: NO session the
 * app builds, of any type, at any tier, may serve a grip variant.
 *
 * The table itself and its rotation are still held by sections 1 to 3, because
 * lib/grip-variants.ts stays until the old pools are deleted. What this section
 * guarantees is that nothing reads it on the way to a card.
 */
const { generateWorkout, LIBRARY_LIVE_TYPES } = await import('../lib/workout-engine.ts');
const { trainTypeOf } = await import('../lib/session-type.ts');
const profile = { name: 'A', sex: 'male', experienceLevel: 'intermediate', goals: ['muscle'], bodyweightKg: 80 };
const variantSet = new Set(variantNames);
const TYPES = [
  'squat',
  'bench',
  'deadlift',
  'upper_body',
  'lower_body',
  'full_body',
  'conditioning',
  'prehab',
  'flexibility',
];
const sightings = [];
let sampled = 0;
for (const type of TYPES) {
  for (const tier of ['bodyweight', 'dumbbells', 'fullgym']) {
    for (let n = 0; n < 12; n++) {
      const w = generateWorkout(
        type,
        tier,
        { energy: 'normal', timeAvailable: '60', hasAches: false },
        profile,
        {},
        undefined,
        n
      );
      sampled++;
      for (const e of w) {
        if (variantSet.has(e.name)) sightings.push({ type, tier, n, name: e.name });
      }
    }
  }
}
check(
  `the sweep really built sessions (${sampled} sampled)`,
  sampled > 300,
  'nothing was generated, so the rule below proves nothing'
);
const inLibrarySession = sightings.filter((s) => LIBRARY_LIVE_TYPES.includes(trainTypeOf(s.type)));
check(
  'no session built from the library is ever served a grip variant',
  inLibrarySession.length === 0,
  inLibrarySession.slice(0, 3).map((s) => `${s.type}/${s.tier}#${s.n}: ${s.name}`).join(' | ')
);
check(
  'and no session of any kind is, because nothing applies the table',
  sightings.length === 0,
  sightings.slice(0, 3).map((s) => `${s.type}/${s.tier}#${s.n}: ${s.name}`).join(' | ')
);

/**
 * AND NOTHING THE APP SERVES IS EVEN ELIGIBLE FOR ONE.
 *
 * The assertion above and the wiring assertion in section 4 are both worth
 * having and neither is sufficient on its own: re-wiring the table today
 * changes no card, because not one of its five base names is a name the app
 * serves any more. So the sweep is asked the other question as well - is there
 * a card the table COULD rename - and the answer has to stay no. The day a
 * library record is authored as "Inverted Row" or "Pull-Up", this is what says
 * so, before somebody puts the call back and the rename becomes real.
 */
const eligible = [];
for (const type of TYPES) {
  for (const tier of ['bodyweight', 'dumbbells', 'fullgym']) {
    const w = generateWorkout(
      type,
      tier,
      { energy: 'normal', timeAvailable: '60', hasAches: false },
      profile,
      {},
      undefined,
      0
    );
    for (const e of w) {
      if (GRIP_VARIANTS[e.name]) eligible.push(`${type}/${tier}: ${e.name}`);
    }
  }
}
check(
  'and no card the app serves is a name the table would rename',
  eligible.length === 0,
  eligible.slice(0, 3).join(' | ')
);

console.log('');
if (failures > 0) {
  console.error(`grip-variants: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`grip-variants: all ${total} checks passed\n`);
  process.exitCode = 0;
}
