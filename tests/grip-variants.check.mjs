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

// ─── 4. Wired into session generation ────────────────────────────────────────
console.log('\n[4] Wired into the accessory slots only');

check(
  'the engine applies it',
  /applyGripVariant\(base, sessionSeed \+ i\)/.test(engineSrc),
  ''
);
// It must sit in the ELSE arm of the `i === 0` test — the main lift has its own,
// deliberately rarer, rotation and must not also flip its grip.
const mainBranch = engineSrc.slice(
  engineSrc.indexOf('const base = selectedMain[i];'),
  engineSrc.indexOf('const ex = applyComfortOrBadge(t, hasAches, painRegion, equipmentTier);')
);
check(
  'it is applied to accessories, not the main lift',
  /i === 0/.test(mainBranch) &&
    mainBranch.indexOf('applyGripVariant') > mainBranch.indexOf('i === 0'),
  'the main lift has its own, deliberately rarer, rotation'
);

// ─── 5. It fires in a real session ───────────────────────────────────────────
console.log('\n[5] Observed in generated sessions');

const { generateWorkout } = await import('../lib/workout-engine.ts');
const profile = { name: 'A', sex: 'male', experienceLevel: 'intermediate', goals: ['muscle'], bodyweightKg: 80 };
const variantSet = new Set(variantNames);
let sightings = 0;
for (const type of ['upper_body', 'full_body']) {
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
      if (w.some((e) => variantSet.has(e.name))) sightings++;
    }
  }
}
check(
  `a grip variant appears in real sessions (${sightings} of 72 sampled)`,
  sightings > 0,
  'the table is wired but nothing it covers is ever selected — coverage is too thin to be worth having'
);

console.log('');
if (failures > 0) {
  console.error(`grip-variants: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`grip-variants: all ${total} checks passed\n`);
  process.exitCode = 0;
}
