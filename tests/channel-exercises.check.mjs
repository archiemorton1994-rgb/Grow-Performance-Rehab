/**
 * Contract test: the movements added for the channel are actually in the app.
 *
 * WHAT THIS GUARDS
 * ────────────────
 * Thirty exercises were written because a demo video existed with nothing to
 * attach it to. Unlike everything else in lib/exercise-db.ts they are not typed
 * out inside the collections — they live in lib/channel-exercises.ts and are
 * pushed into the pools by spliceChannelExercises() at module load.
 *
 * That indirection buys reviewability and costs a failure mode: if the splice is
 * removed, renamed, or moved below something that reads a pool, all thirty
 * vanish in complete silence. Nothing crashes. The app just quietly stops
 * offering them, and thirty videos go back to pointing at nothing.
 *
 * So this asks the question from the far end — not "is the splice called?" but
 * "can the app find these exercises?" — which stays true however the wiring is
 * rearranged and false the moment it stops working.
 *
 * Run:  npx tsx tests/channel-exercises.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { getAllPickableExercises, exerciseCount, tierRequiredFor } from '../lib/exercise-db.ts';
import { CHANNEL_EXERCISES } from '../lib/channel-exercises.ts';
import { EXERCISE_VIDEOS, videoUrlFor } from '../lib/exercise-videos.ts';

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

const RANK = ['bodyweight', 'dumbbells', 'fullgym'];

console.log(`\n[1] All ${CHANNEL_EXERCISES.length} are reachable from the catalogue`);

const pickable = new Map(getAllPickableExercises().map((p) => [p.template.name, p]));

const unreachable = CHANNEL_EXERCISES.filter((c) => !pickable.has(c.template.name)).map(
  (c) => c.template.name
);
check(
  'every one is found by getAllPickableExercises',
  unreachable.length === 0,
  `${unreachable.join(', ')} — the splice is not reaching the pools`
);

check(
  `the catalogue counts them (${exerciseCount()} entries)`,
  exerciseCount() > 800,
  'EXERCISE_COUNT is evaluated at module load and must run after the splice'
);

console.log('\n[2] None is offered to someone without the equipment');

const misfiled = [];
for (const c of CHANNEL_EXERCISES) {
  const p = pickable.get(c.template.name);
  if (!p) continue;
  // The tier it was filed under must be one the catalogue agrees it belongs to.
  if (!p.tiers.includes(c.tier)) {
    misfiled.push(`${c.template.name}: filed ${c.tier}, resolved ${p.tiers.join('/')}`);
  }
  // And the kit it declares must not outrank that tier.
  const needs = tierRequiredFor(c.template.equipmentRequired);
  if (RANK.indexOf(needs) > RANK.indexOf(c.tier)) {
    misfiled.push(
      `${c.template.name}: needs ${c.template.equipmentRequired} (${needs}) but is filed ${c.tier}`
    );
  }
}
check('every one is filed at or above the tier its kit requires', misfiled.length === 0, misfiled.join(' | '));

console.log('\n[3] Each one still points at the video it was written for');

// These exist BECAUSE a video existed. An entry here with no video is either a
// mapping that was dropped or an exercise that should not have been added.
const videoless = CHANNEL_EXERCISES.filter((c) => !videoUrlFor(c.template)).map(
  (c) => c.template.name
);
check(
  'all of them resolve to a video',
  videoless.length === 0,
  `${videoless.join(', ')} — these were added to give a recording a home`
);

const distinctVideos = new Set(
  CHANNEL_EXERCISES.map((c) => videoUrlFor(c.template)).filter(Boolean)
);
check(
  `and to ${CHANNEL_EXERCISES.length} different videos, not the same one repeatedly`,
  distinctVideos.size === CHANNEL_EXERCISES.length,
  `${distinctVideos.size} distinct links for ${CHANNEL_EXERCISES.length} exercises`
);

console.log('\n[4] Each is a complete, usable exercise');

const incomplete = [];
for (const { template: t } of CHANNEL_EXERCISES) {
  if (!t.cue || t.cue.length < 25) incomplete.push(`${t.name}: cue too thin to coach from`);
  if (!t.reps) incomplete.push(`${t.name}: no rep prescription`);
  if (!t.targetRegions?.length) incomplete.push(`${t.name}: no target regions, so the body map cannot shade it`);
  if (!t.primaryMuscle) incomplete.push(`${t.name}: no primary muscle`);
  // The swap button is gated on this; without it the user cannot replace the
  // exercise mid-session. Only the loaded blocks need one.
  if ((t.category === 'main' || t.category === 'accessory') && !t.swapAlternative) {
    incomplete.push(`${t.name}: an accessory with no swap alternative`);
  }
}
check('none is missing anything the session screen needs', incomplete.length === 0, incomplete.join(' | '));

const emoji = CHANNEL_EXERCISES.filter((c) =>
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(`${c.template.name} ${c.template.cue}`)
).map((c) => c.template.name);
check('no emoji in any of the copy', emoji.length === 0, emoji.join(', '));

console.log('\n[5] Every mapped video belongs to something real');

// The far end of the same question: a link in the table for a name that no
// longer exists is a button that does nothing.
const mappedButMissing = Object.keys(EXERCISE_VIDEOS).filter(
  (name) =>
    !pickable.has(name) &&
    !CHANNEL_EXERCISES.some((c) => c.template.name.toLowerCase() === name.toLowerCase())
);
check(
  'no video is mapped to a name the catalogue does not have',
  mappedButMissing.length === 0,
  mappedButMissing.join(', ')
);

console.log('');
if (failures > 0) {
  console.error(`channel-exercises: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`channel-exercises: all ${total} checks passed\n`);
  process.exitCode = 0;
}
