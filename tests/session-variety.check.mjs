/**
 * Contract test: weekly sessions actually vary.
 *
 * WHY THIS MATTERS
 * ────────────────
 * "If someone does upper body over and over, is it just the same exercises each
 * time?" It was, and the reason was not the rotation engine — that already
 * existed and was already used. It was the pool:
 *
 *   WEEKLY_UPPER_BODY / _LOWER_BODY / _FULL_BODY are hand-written lists of five
 *   or six exercises per tier, held separately from the exercise database. With
 *   four required movement patterns out of a pool of five, an upper body session
 *   had exactly one rotating slot — and none at all at 30 minutes.
 *
 * Meanwhile the database holds 447 pickable exercises and the KPI sessions have
 * been drawing accessories from pools of 14-18 the whole time. The optional
 * slots in a weekly session now come from that same accessory pool.
 *
 * Two things must hold together, and they pull against each other:
 *   VARIETY  — the accessories must genuinely change between sessions
 *   COHERENCE— the required movement patterns must still be covered, the
 *              curated choices must still lead, and the main lift must stay put
 *              most of the time because it is the thing being progressed
 *
 * Run:  npx tsx tests/session-variety.check.mjs
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

// ─── 1. Wiring ───────────────────────────────────────────────────────────────
console.log('\n[1] Weekly sessions draw on the real accessory pool');

check(
  'the wide pool is built from getAccessories',
  /const widePool = \[[\s\S]{0,160}?getAccessories\(accessorySource, equipmentTier\),?\s*\]/.test(
    engineSrc
  ),
  'the optional slots used to be leftovers of the same five-exercise weekly list'
);
check(
  'the optional slots draw from that wide pool',
  /const accessoryPool = widePool\.filter\(/.test(engineSrc),
  ''
);
check(
  'the main movement is resolved before the pool is filtered',
  engineSrc.indexOf('const resolvedMainName') < engineSrc.indexOf('const accessoryPool'),
  'otherwise an accessory can duplicate whichever variant the main became'
);
check(
  'main variation is occasional, not a shuffle',
  /const MAIN_VARIATION_EVERY = ([2-9]|\d\d);/.test(engineSrc),
  'the main lift is what you are progressing; it needs to stay put most of the time'
);

// ─── 2. Behaviour ────────────────────────────────────────────────────────────
console.log('\n[2] Generated for real');

const { generateWorkout } = await import('../lib/workout-engine.ts');
const {
  getWeeklyUpperBodyExercises,
  getWeeklyLowerBodyExercises,
  getWeeklyFullBodyExercises,
} = await import('../lib/exercise-db.ts');

const profile = {
  name: 'A',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['muscle'],
  bodyweightKg: 80,
};
const gen = (type, tier, time, n) =>
  generateWorkout(
    type,
    tier,
    { energy: 'normal', timeAvailable: time, hasAches: false },
    profile,
    {},
    undefined,
    n
  );

for (const type of ['upper_body', 'lower_body']) {
  const accessories = new Set();
  const mains = new Set();
  for (let n = 0; n < 8; n++) {
    const w = gen(type, 'fullgym', '60', n);
    w.filter((e) => e.category === 'accessory').forEach((e) => accessories.add(e.name));
    w.filter((e) => e.category === 'main').forEach((e) => mains.add(e.name));
  }
  check(
    `${type}: accessories vary across 8 sessions (${accessories.size} distinct)`,
    accessories.size >= 6,
    `only ${accessories.size} — the whole point is that these rotate`
  );
  check(
    `${type}: the main lift stays put (${mains.size} distinct across 8)`,
    mains.size >= 1 && mains.size <= 3,
    `${mains.size} distinct mains — progression needs the same movement most weeks`
  );
}

// Coverage must survive the extra variety.
const CURATED = {
  upper_body: getWeeklyUpperBodyExercises,
  lower_body: getWeeklyLowerBodyExercises,
  full_body: getWeeklyFullBodyExercises,
};
const REQUIRED = { upper_body: 4, lower_body: 3, full_body: 6 };
// A required exercise satisfies coverage whether it appears as itself or as one
// of its curated grip variants — a Wide-Grip Inverted Row is still the pull that
// slot exists to guarantee. Checking by bare name would fail the moment the
// variant fires, which is a test problem, not a coverage problem.
const { GRIP_VARIANTS } = await import('../lib/grip-variants.ts');
const acceptableNames = (base) => [base, ...(GRIP_VARIANTS[base] ?? []).map((v) => v.name)];

// Coverage is about MOVEMENTS, not exercise names.
//
// A required slot may legitimately be filled by a different exercise now — a
// barbell row by a bent-over row, an overhead press by a landmine press — and
// the main lift may appear as its own alternative. Asserting exact names would
// fail on exactly the behaviour this file exists to encourage. What must hold is
// that each required movement pattern is still present.
const { getAllPickableExercises: pickables } = await import('../lib/exercise-db.ts');
const templateByName = new Map(pickables().map((e) => [e.template.name, e.template]));
// A grip variant is not in the database under its variant name, so map it back.
const variantToBase = new Map();
for (const [base, vs] of Object.entries(GRIP_VARIANTS)) {
  for (const v of vs) variantToBase.set(v.name, base);
}
const patternOf = (name) =>
  templateByName.get(name)?.movementPattern ??
  templateByName.get(variantToBase.get(name))?.movementPattern;

let coverageOk = true;
const coverageDetail = [];
for (const [type, getter] of Object.entries(CURATED)) {
  for (const tier of ['bodyweight', 'dumbbells', 'fullgym']) {
    // Slot 0 is the main lift, which has its own alternative and is checked by
    // the "main stays put" assertion above.
    const requiredPatterns = getter(tier)
      .slice(1, REQUIRED[type])
      .map((e) => e.movementPattern)
      .filter(Boolean);
    for (let n = 0; n < 4; n++) {
      const present = gen(type, tier, '60', n)
        .filter((e) => e.category === 'main' || e.category === 'accessory')
        .map((e) => patternOf(e.name))
        .filter(Boolean);
      const missing = requiredPatterns.filter((p) => !present.includes(p));
      if (missing.length > 0) {
        coverageOk = false;
        coverageDetail.push(`${type}/${tier}#${n}: no ${missing.join(', ')}`);
      }
    }
  }
}
check(
  'every required movement pattern is present in every session',
  coverageOk,
  coverageDetail.slice(0, 3).join(' | ')
);

// Sessions must not contain the same movement twice because of the wider pool.
const NOISE = new Set([
  'barbell',
  'dumbbell',
  'db',
  'kb',
  'kettlebell',
  'cable',
  'machine',
  'seated',
  'standing',
  'the',
  'with',
  'a',
]);
const tokens = (s) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/[\s-]+/)
      .filter((w) => w.length > 1 && !NOISE.has(w))
  );
const sameMovement = (x, y) => {
  const A = tokens(x);
  const B = tokens(y);
  const [s, l] = A.size <= B.size ? [A, B] : [B, A];
  return s.size >= 2
    ? [...s].every((w) => l.has(w))
    : s.size === l.size && [...s].every((w) => l.has(w));
};

let introduced = 0;
for (const [type, getter] of Object.entries(CURATED)) {
  for (const tier of ['bodyweight', 'dumbbells', 'fullgym']) {
    const curated = new Set(getter(tier).map((e) => e.name));
    for (const time of ['30', '45', '60']) {
      for (let n = 0; n < 8; n++) {
        const names = gen(type, tier, time, n)
          .filter((e) => e.category === 'main' || e.category === 'accessory')
          .map((e) => e.name);
        for (let i = 0; i < names.length; i++) {
          for (let j = i + 1; j < names.length; j++) {
            if (!sameMovement(names[i], names[j])) continue;
            // Pairs where BOTH sides are from the pre-existing curated list are
            // not this change's doing — e.g. Push-Up and Pike Push-Up, which are
            // genuinely different patterns the name heuristic cannot separate.
            if (curated.has(names[i]) && curated.has(names[j])) continue;
            introduced++;
          }
        }
      }
    }
  }
}
check(
  'the wider pool introduces no duplicated movements',
  introduced === 0,
  `${introduced} pair(s) where an accessory repeats another exercise in the same session`
);

// ─── 3. Required slots substitute like for like ──────────────────────────────
console.log('\n[3] Required-slot substitutes are equivalent, not merely same-pattern');

check(
  'substitutes must share the movement pattern',
  /a\.movementPattern === t\.movementPattern &&/.test(engineSrc),
  ''
);
check(
  'and the muscle family',
  /sameMuscleFamily\(a\.primaryMuscle, t\.primaryMuscle\)/.test(engineSrc),
  'pattern alone lets a tricep pushdown fill the vertical-press slot'
);
check(
  'and be compound enough to hold a required slot',
  /\(a\.secondaryMuscles\?\.length \?\? 0\) >= MIN_COMPOUND_SECONDARIES/.test(engineSrc),
  'muscle family alone lets a cable front raise replace an overhead press, leaving no vertical pressing'
);
check(
  'required rotation is staggered per slot, not session-wide',
  /\(sessionSeed \+ i\) % REQUIRED_VARIATION_EVERY !== 0/.test(engineSrc),
  'switching every required slot at once is a different workout, not a variation'
);
check(
  'the main lift is excluded from required rotation',
  /if \(i === 0 \|\| REQUIRED_VARIATION_EVERY <= 0\) return t;/.test(engineSrc),
  'it has its own, rarer, rotation'
);

// Behaviour: no isolation movement may occupy a required slot.
const { getAllPickableExercises } = await import('../lib/exercise-db.ts');
const byName = new Map(getAllPickableExercises().map((e) => [e.template.name, e.template]));
const isolationInRequired = [];
for (const [type, getter] of Object.entries(CURATED)) {
  for (const tier of ['bodyweight', 'dumbbells', 'fullgym']) {
    for (let n = 0; n < 8; n++) {
      const w = gen(type, tier, '60', n);
      // Required slots are the first REQUIRED[type] main/accessory entries.
      const core = w
        .filter((e) => e.category === 'main' || e.category === 'accessory')
        .slice(0, REQUIRED[type]);
      for (const e of core) {
        const t = byName.get(e.name);
        if (!t) continue; // a grip variant or comfort swap — not a substitution
        if ((t.secondaryMuscles?.length ?? 0) < 2 && !getter(tier).some((c) => c.name === e.name)) {
          isolationInRequired.push(`${type}/${tier}#${n}: ${e.name}`);
        }
      }
    }
  }
}
check(
  'no isolation movement ever fills a required slot',
  isolationInRequired.length === 0,
  isolationInRequired.slice(0, 4).join(' | ')
);

console.log('');
if (failures > 0) {
  console.error(`session-variety: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`session-variety: all ${total} checks passed\n`);
  process.exitCode = 0;
}
