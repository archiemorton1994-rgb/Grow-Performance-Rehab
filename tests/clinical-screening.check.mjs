/**
 * Contract test: the safety screen and the load labelling behave clinically.
 *
 * ── CHEST PAIN CHANGED NOTHING ─────────────────────────────────────────────
 * Every region could remove the work that loads it, except the chest. `chest`
 * restricted `shoulder_end_range` alone, which catches flyes, dips and pullovers
 * and misses every press — because no horizontal-pressing tag existed at all.
 *
 * So a user with a strained pec tapping "Chest" and "Severe" still got Barbell
 * Bench Press 60-100 kg as their main lift, with close-grip and decline bench
 * behind it, and a Doorway Chest Opener taking the same pec to end range in the
 * warm-up. The app asked where it hurt and then did nothing about it. For a
 * physiotherapist's product that is the worst kind of defect: the screen looks
 * like it works.
 *
 * ── AND KETTLEBELL REHAB WAS PRESCRIBED AT 2-4x THE LOAD ───────────────────
 * Loads were relabelled by rounding every number to the nearest real bell,
 * independently. The lightest bell is 8 kg, so "2-4 kg per hand" — the
 * prescription for rotator-cuff external rotations, the most load-sensitive
 * drill in the app and one that sits in the PREHAB slot — printed as
 * "8-8 kg per hand". Two to four times the intended load, for someone who has
 * just told the app their shoulder hurts. It also produced "6-10 kg" -> "8-8 kg"
 * across fourteen cards.
 *
 * Two rules now: never round a load UP past what was prescribed, and a range
 * that collapses onto one bell prints as one number.
 */
import { readFileSync } from 'fs';
import { restrictedTagsOn, restrictedTagsFor, STRESS_TAG_LABELS } from '../lib/exercise-safety.ts';
import { getExerciseTargetRegionsMap, ACUTE_PREHAB_BY_REGION } from '../lib/exercise-db.ts';

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

console.log('\n[1] Reporting chest pain removes the pressing');

const chestBanned = restrictedTagsFor(['chest'], 'severe');
const blocked = (name) => restrictedTagsOn(name, chestBanned).length > 0;

for (const name of [
  'Barbell Bench Press',
  'Close-Grip Bench Press',
  'Decline Bench Press',
  'Incline DB Press',
  'DB Incline Press',
  'Incline Barbell Bench Press',
  'Board Press',
  'JM Press',
  'DB Floor Press',
  'Floor Press',
  'Dumbbell Bench Press',
  'Flat Bench Press',
]) {
  check(`"${name}" is screened out`, blocked(name), 'a strained pec must not be handed a press');
}

check(
  'the end-range chest stretch goes too',
  blocked('Doorway Chest Opener'),
  'an end-range passive stretch on a strained pec, in the warm-up, is the one place it must not go'
);

console.log('\n[2] ...without gutting the session or banning the substitutes');

for (const name of [
  'Push-Up',
  'Leg Press',
  'DB Shoulder Press',
  'Landmine Press',
  'Barbell Row',
  'Bodyweight Squat',
]) {
  check(
    `"${name}" is still allowed`,
    !blocked(name),
    'over-screening leaves nothing to put in the gap - push-ups in particular are the regression the screen reaches for'
  );
}

check(
  'the new tag has a human label for the swap caption',
  typeof STRESS_TAG_LABELS.horizontal_press === 'string' &&
    STRESS_TAG_LABELS.horizontal_press.length > 0,
  'an untagged label prints "undefined" into the note on the card'
);

console.log('\n[3] Kettlebell loads are never rounded UP past the prescription');

const engine = readFileSync(new URL('../lib/workout-engine.ts', import.meta.url), 'utf8');

check(
  'a load lighter than the lightest bell is left as written',
  /if \(num < KB_WEIGHTS\[0\]\) return match;/.test(engine),
  '"2-4 kg per hand" became "8-8 kg per hand" - 2-4x the load on rotator-cuff rehab'
);

check(
  'a whole range below the lightest bell is left as written',
  /if \(hi < KB_WEIGHTS\[0\]\) return labelled;/.test(engine),
  'the rehab case: both ends under 8 kg'
);

check(
  'the two ends of a range are rounded separately',
  /const loKb = Math\.min\(nearestKbWeight\(lo\), nearestKbWeight\(hi\)\);/.test(engine),
  'one rounding applied to both is what produced "8-8 kg"'
);

check(
  'a range that collapses prints one number',
  /loKb === hiKb \? String\(loKb\) : `\$\{loKb\}-\$\{hiKb\}`/.test(engine),
  '"8-8 kg" is not a range, it is a bug on the card'
);

console.log('\n[4] Rehab sessions shade the body parts they actually worked');

const regionMap = getExerciseTargetRegionsMap();
const unmapped = [];
for (const [, list] of Object.entries(ACUTE_PREHAB_BY_REGION)) {
  for (const ex of list) if (!regionMap[ex.id]) unmapped.push(ex.id);
}

check(
  'every acute exercise resolves to its regions',
  unmapped.length === 0,
  unmapped.length
    ? `${unmapped.length} unmapped, e.g. ${unmapped.slice(0, 3).join(', ')} - the summary map shades the wrong body parts`
    : ''
);

check(
  'the chest protocol maps to the chest',
  (ACUTE_PREHAB_BY_REGION.chest ?? []).some((ex) => (regionMap[ex.id] ?? []).includes('chest')),
  'it used to shade hip, lower back and core - four areas the user never touched'
);

check(
  'the groin protocol maps to the hip/groin',
  (ACUTE_PREHAB_BY_REGION.hip_groin ?? []).some((ex) =>
    (regionMap[ex.id] ?? []).includes('hip_groin')
  ),
  'it used to shade glutes, lower back and ankle'
);

console.log(`\nclinical-screening: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
