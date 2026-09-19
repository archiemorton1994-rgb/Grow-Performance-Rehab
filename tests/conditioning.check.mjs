/**
 * Contract test: the conditioning session the app serves TODAY actually builds.
 *
 * WHAT CHANGED, AND WHY
 * ─────────────────────
 * This check used to walk the braces of lib/exercise-db.ts counting `id:`
 * strings, and conclude from that count that a conditioning session would
 * contain at least one exercise. It never built one. A pool that is full in the
 * file and empty after the equipment filter, or after the injury screen, passed
 * it every time, which is this repo's commonest defect: a test that pins a
 * spelling and stays green while the behaviour breaks.
 *
 * So the floor is now ACHIEVABLE rather than declared. Every assertion below
 * that can run the real code runs it, over every equipment answer and every
 * energy, and reads the session that comes back. Only the two that cross into a
 * React screen still read source, because a node check cannot render one.
 *
 * The NEW conditioning session, built from Archie's nine records, has its own
 * per-kit floor in tests/library-conditioning.check.mjs. Nothing calls that one
 * yet; this file guards the session people are being given in the meantime, and
 * should be retired with the old engine rather than before it.
 *
 * Checks:
 *  1. THE ACHIEVABLE FLOOR — every tier x energy x rotation yields real work
 *                            that survives the equipment filter
 *  2. ENERGY IS READ       — the three energy answers are not one pool
 *  3. THE WHOLE SESSION    — generateWorkout('conditioning', ...) returns a
 *                            session at every tier, sore or not
 *  4. ID UNIQUENESS        — no session contains one id twice
 *  5. NOT THE STRENGTH ONE — conditioning does not fall through to the lifting
 *                            generator
 *  6. UI WIRING            — train.tsx launches it; session.tsx generates it
 *
 * Run:  npx tsx tests/conditioning.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import './_persist-shim.mjs';
import { getConditioningWorkout, possibleFor } from '../lib/exercise-db.ts';
import { generateWorkout } from '../lib/workout-engine.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const trainSrc = readFileSync(join(__dir, '../app/(tabs)/train.tsx'), 'utf8');
const sessionSrc = readFileSync(join(__dir, '../app/session.tsx'), 'utf8');

let failures = 0;
let total = 0;

function check(label, condition, detail) {
  total++;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

/**
 * Every conditioning session this file builds goes through here.
 *
 * Routing conditioning away from its own generator does not return the wrong
 * session, it throws, because the lifting generator indexes its warm-up table
 * by a session type conditioning has no row in. Catching it turns a stack trace
 * into a named failure that says what broke.
 */
const thrown = [];
function buildConditioning(tier, readiness, profile, sessionCount, where) {
  try {
    return generateWorkout(
      'conditioning',
      tier,
      readiness,
      profile,
      undefined,
      undefined,
      sessionCount
    );
  } catch (error) {
    thrown.push(`${where}: ${error.message}`);
    return null;
  }
}

/** Every answer onboarding can leave in the profile, bench aside (a supply). */
const TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
const ENERGY_KEYS = ['easy', 'normal', 'hard'];
const ENERGIES = ['low', 'normal', 'high'];
const ROTATIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
/**
 * Swept rather than left to today's date.
 *
 * The engine seeds conditioning on the session count PLUS the local day index,
 * so a single-example assertion here would pass or fail depending on the
 * calendar. Two checks in this repo have already been found doing that.
 */
const SESSION_COUNTS = [0, 1, 2, 3, 4, 5];

// ─── 1. The achievable floor ──────────────────────────────────────────────────
console.log('\n[1] The achievable floor — every tier and energy yields real work');

const emptyPools = [];
const filteredToNothing = [];
const noWorkBlock = [];

for (const tier of TIERS) {
  for (const energy of ENERGY_KEYS) {
    for (const rotation of ROTATIONS) {
      const templates = getConditioningWorkout(tier, energy, rotation);
      const where = `${tier}/${energy}/rotation ${rotation}`;
      if (templates.length === 0) {
        emptyPools.push(where);
        continue;
      }
      const usable = possibleFor(templates, tier);
      if (usable.length === 0) {
        filteredToNothing.push(where);
        continue;
      }
      // A warm-up and a cooldown are not a conditioning session on their own.
      const work = usable.filter((t) => t.category !== 'prep' && t.category !== 'cooldown');
      if (work.length === 0) noWorkBlock.push(where);
    }
  }
}

check(
  `every tier x energy x rotation returns a pool (${TIERS.length * ENERGY_KEYS.length * ROTATIONS.length} asked)`,
  emptyPools.length === 0,
  `${emptyPools.length} empty, e.g. ${emptyPools.slice(0, 3).join(', ')}`
);
check(
  'every pool still holds something once the equipment filter has run',
  filteredToNothing.length === 0,
  `${filteredToNothing.length} filtered to nothing, e.g. ${filteredToNothing.slice(0, 3).join(', ')}`
);
check(
  'every pool holds actual work, not just a warm-up and a cooldown',
  noWorkBlock.length === 0,
  `${noWorkBlock.length} with no work block, e.g. ${noWorkBlock.slice(0, 3).join(', ')}`
);

// ─── 2. Energy is read ────────────────────────────────────────────────────────
console.log('\n[2] Energy is read — the three answers are not one pool');

const sameForEveryEnergy = [];
for (const tier of TIERS) {
  const byEnergy = ENERGY_KEYS.map((energy) =>
    getConditioningWorkout(tier, energy, 0)
      .map((t) => t.id)
      .join('>')
  );
  if (new Set(byEnergy).size === 1) sameForEveryEnergy.push(tier);
}
check(
  'at least one tier prescribes different work for easy, normal and hard',
  sameForEveryEnergy.length < TIERS.length,
  `every tier identical across all three energies: ${sameForEveryEnergy.join(', ')}`
);

let energyChangedSomething = 0;
for (const tier of TIERS) {
  for (const sessionCount of SESSION_COUNTS) {
    const byEnergy = ENERGIES.map((energy) =>
      (
        buildConditioning(
          tier,
          { hasAches: false, energy, timeAvailable: '45' },
          undefined,
          sessionCount,
          `${tier}/${energy}/n=${sessionCount}`
        ) ?? []
      )
        .map((e) => e.name)
        .join('>')
    );
    if (new Set(byEnergy).size > 1) energyChangedSomething++;
  }
}
check(
  "the readiness screen's low / normal / high really reaches the pool",
  energyChangedSomething === TIERS.length * SESSION_COUNTS.length,
  `energy changed the session in only ${energyChangedSomething} of ${TIERS.length * SESSION_COUNTS.length} tier and history pairs`
);

// ─── 3. The whole session ─────────────────────────────────────────────────────
console.log('\n[3] The whole session — generateWorkout returns one at every tier');

const SITUATIONS = [
  { label: 'nothing sore', readiness: {} },
  {
    label: 'sore knee, mild',
    readiness: { hasAches: true, painRegion: 'knee', painSeverity: 'mild', acute: true },
  },
  {
    label: 'sore knee, severe',
    readiness: { hasAches: true, painRegion: 'knee', painSeverity: 'severe', acute: true },
  },
  {
    label: 'sore lower back, moderate',
    readiness: { hasAches: true, painRegion: 'lower_back', painSeverity: 'moderate', acute: true },
  },
];
const LEVELS = ['beginner', 'intermediate', 'advanced', 'athlete'];

const emptySessions = [];
const duplicateIds = [];
const missingCue = [];
let built = 0;

for (const tier of TIERS) {
  for (const energy of ENERGIES) {
    for (const timeAvailable of ['30', '45', '60']) {
      for (const situation of SITUATIONS) {
        for (const level of LEVELS) {
          for (const sessionCount of [0, 3, 7]) {
            const where = `${tier}/${energy}/${timeAvailable}/${situation.label}/${level}/n=${sessionCount}`;
            const session = buildConditioning(
              tier,
              { hasAches: false, energy, timeAvailable, ...situation.readiness },
              { experienceLevel: level },
              sessionCount,
              where
            );
            built++;
            if (session === null) continue;
            if (session.length === 0) {
              emptySessions.push(where);
              continue;
            }
            const ids = session.map((e) => e.id);
            if (new Set(ids).size !== ids.length) {
              duplicateIds.push(
                `${where}: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`
              );
            }
            for (const exercise of session) {
              if (!exercise.name || !exercise.cue || !exercise.reps) {
                missingCue.push(`${where}: ${exercise.name || '(no name)'}`);
              }
            }
          }
        }
      }
    }
  }
}

check(
  'no conditioning session throws, which is what routing it elsewhere does',
  thrown.length === 0,
  `${thrown.length} threw, e.g. ${thrown.slice(0, 2).join(' / ')}`
);
check(
  `no conditioning session comes back empty (${built.toLocaleString()} built)`,
  emptySessions.length === 0,
  `${emptySessions.length} empty, e.g. ${emptySessions.slice(0, 3).join(' / ')}`
);
check(
  'every card in every session has a name, a cue and a prescription',
  missingCue.length === 0,
  `${missingCue.length} incomplete, e.g. ${missingCue.slice(0, 3).join(' / ')}`
);

// ─── 4. ID uniqueness ─────────────────────────────────────────────────────────
console.log('\n[4] ID uniqueness — two cards sharing an id would share their set log');

check(
  'no generated conditioning session contains the same exercise id twice',
  duplicateIds.length === 0,
  `${duplicateIds.length} sessions, e.g. ${duplicateIds.slice(0, 3).join(' / ')}`
);

const poolDupes = [];
for (const tier of TIERS) {
  for (const energy of ENERGY_KEYS) {
    for (const rotation of ROTATIONS) {
      const ids = getConditioningWorkout(tier, energy, rotation).map((t) => t.id);
      if (new Set(ids).size !== ids.length) {
        poolDupes.push(`${tier}/${energy}/${rotation}`);
      }
    }
  }
}
check(
  'no conditioning pool hands back the same id twice either',
  poolDupes.length === 0,
  `${poolDupes.length} pools, e.g. ${poolDupes.slice(0, 3).join(', ')}`
);

// ─── 5. Not the strength one ──────────────────────────────────────────────────
console.log('\n[5] Conditioning does not fall through to the lifting generator');

const leaked = [];
for (const tier of TIERS) {
  for (const energy of ENERGIES) {
    const conditioning =
      buildConditioning(
        tier,
        { hasAches: false, energy, timeAvailable: '45' },
        undefined,
        0,
        `${tier}/${energy}`
      ) ?? [];
    const allowed = new Set(
      ENERGY_KEYS.flatMap((key) =>
        ROTATIONS.flatMap((rotation) => getConditioningWorkout(tier, key, rotation).map((t) => t.id))
      )
    );
    // Routing to the strength generator would fill the session with main lifts,
    // and a main lift is never in any conditioning pool at any rotation.
    for (const exercise of conditioning) {
      if (exercise.category === 'main') leaked.push(`${tier}/${energy}: main lift ${exercise.name}`);
      else if (!allowed.has(exercise.id) && exercise.category !== 'prep') {
        leaked.push(`${tier}/${energy}: ${exercise.name} is from no conditioning pool`);
      }
    }
  }
}
check(
  'a conditioning session contains no main lift and nothing from outside the conditioning pools',
  leaked.length === 0,
  `${leaked.length} cards, e.g. ${leaked.slice(0, 3).join(' / ')}`
);

// ─── 6. UI wiring ─────────────────────────────────────────────────────────────
// The two assertions a node check cannot run, because they live in React
// screens. Kept as source reads, and kept positive: each asserts that text
// which must be present IS present.
console.log('\n[6] UI wiring — train.tsx launches it; session.tsx generates it');

check(
  "train.tsx navigates to /readiness with sessionType: 'conditioning'",
  trainSrc.includes("sessionType: 'conditioning'") ||
    /sessionType === 'conditioning'\)\s*\{[\s\S]{0,200}?pathname: '\/readiness',[\s\S]{0,120}?params: \{ sessionType,/.test(
      trainSrc
    ),
  'navigation call not found — tapping conditioning never launches a conditioning session'
);

check(
  'session.tsx imports generateWorkout from workout-engine',
  sessionSrc.includes('generateWorkout'),
  'import not found — session screen cannot generate any session type including conditioning'
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`conditioning: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`conditioning: all ${total} checks passed\n`);
  process.exitCode = 0;
}
