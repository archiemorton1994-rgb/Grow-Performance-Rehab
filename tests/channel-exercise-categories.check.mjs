/**
 * Contract test: the movements filmed for the channel are in the blocks Archie
 * put them in.
 *
 * WHY THIS IS PINNED
 * ──────────────────
 * These sixteen came with their category stated, not inferred:
 *
 *   KPI                 Trapbar Deadlift, Box Squat
 *   Strength/Accessory  Trapbar RDL, Trapbar Rows, Gorilla Rows,
 *                       Kettlebell Side Lunge, Bench Dumbbell Reverse Fly
 *   Power               Trapbar Jumps, Skater Jumps, Split Squat Jumps,
 *                       Supine Medball Throws, Seated Box Jumps
 *   Activation          Banded Monster Walks, Banded Marches
 *   Active Mobility     Kneeling Rocks
 *   Conditioning        Sled Rows
 *
 * Six of them landed somewhere else when they were added, and both mistakes
 * were the same kind — a general rule reading a movement correctly in the
 * abstract and wrongly in context:
 *
 *   canBeMainLift() accepts a Gorilla Row and a Trap Bar Row, because they are
 *   loaded compounds. They are support work whatever bar they use, and offering
 *   one as the lift a whole training block is built around is wrong.
 *
 *   Banded Monster Walks are filed 'prehab', which is true of them, and that
 *   routed them to Core & Prehab — the block that runs AFTER the lift they
 *   exist to prime.
 *
 * Both are now entries in CATEGORY_OVERRIDES. This test exists so the next edit
 * to the classification rules cannot quietly undo a decision that was made by a
 * coach rather than by a regex.
 *
 * Run:  npx tsx tests/channel-exercise-categories.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { CHANNEL_EXERCISES } from '../lib/channel-exercises.ts';
import { builderCategoryOf } from '../lib/session-builder.ts';

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

/** Exercise name → the builder block it must be filed in. */
const STATED = {
  'Trap Bar Deadlift': 'kpi',
  'Box Squat': 'kpi',
  'Trap Bar Romanian Deadlift': 'accessory',
  'Trap Bar Row': 'accessory',
  'Gorilla Row': 'accessory',
  'KB Side Lunge': 'accessory',
  'Bench Dumbbell Reverse Fly': 'accessory',
  'Trap Bar Jump': 'power',
  'Skater Jump': 'power',
  'Split Squat Jump': 'power',
  'Supine Med Ball Throw': 'power',
  'Seated Box Jump': 'power',
  'Banded Monster Walk': 'activation',
  'Banded March': 'activation',
  'Kneeling Rock-Back': 'active_stretch',
  'Sled Row': 'conditioning',
};

const byName = new Map(CHANNEL_EXERCISES.map((c) => [c.template.name, c.template]));

for (const [name, want] of Object.entries(STATED)) {
  const t = byName.get(name);
  if (!t) {
    check(`${name} is in the catalogue`, false, 'not found in CHANNEL_EXERCISES');
    continue;
  }
  const got = builderCategoryOf(t);
  check(`${name} -> ${want}`, got === want, `it is filed as ${got}`);
}

// The two KPI lifts are the load-bearing case: a session is built around one,
// so it has to be reachable in the step that picks it.
for (const name of ['Trap Bar Deadlift', 'Box Squat']) {
  const t = byName.get(name);
  check(
    `${name} can actually be chosen as a main lift`,
    !!t && builderCategoryOf(t) === 'kpi',
    'it will not appear in the KPI step'
  );
}

console.log('');
if (failures > 0) {
  console.error(`channel-exercise-categories: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`channel-exercise-categories: all ${total} checks passed\n`);
  process.exitCode = 0;
}
