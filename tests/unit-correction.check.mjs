/**
 * Contract test: putting the pounds fault right without guessing.
 *
 * WHAT THE FAULT WAS. The profile builder validated a typed bodyweight in the
 * user's chosen unit and then stored the raw number as kilograms. Somebody who
 * picked pounds and typed 176 had 176 KILOGRAMS written to their profile, and
 * the same happened to the three best lifts. Bodyweight scales every accessory
 * load and the maxes set every working weight, so both were more than doubled
 * for everybody training in pounds.
 *
 * WHAT THIS FILE GUARDS, and every one of them is a way the repair could do
 * more harm than the fault:
 *
 *   IT NEVER FIRES ON SOMEBODY WHO IS FINE. Anyone in kilograms, anyone who has
 *   since put their weight in by hand, and anyone whose figure is ordinary
 *   enough that asking would be inventing a problem.
 *
 *   IT NEVER TOUCHES A NUMBER SOMEBODY EARNED. The maxes typed in the builder
 *   are corrected; a max measured in a test week, or worked out on the
 *   calculator, is somebody's real lift and is left alone.
 *
 *   IT ASKS, AND ANSWERING EITHER WAY ENDS IT. A card that comes back every
 *   launch after being answered is worse than the fault.
 *
 *   AND IT DOES NOT PRETEND TO ASK when the recorded figure is impossible as a
 *   bodyweight in kilograms.
 *
 * Run:  npx tsx tests/unit-correction.check.mjs
 */
globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import {
  unitCorrectionFor,
  builderTypedMaxes,
  ASK_ABOVE_KG,
} from '../lib/unit-correction.ts';
import { MAX_BODYWEIGHT_KG } from '../lib/store.ts';

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

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
/**
 * This repo comments heavily and deliberately, so a check that greps for a
 * forbidden CALL will find the sentence explaining why it is forbidden. Strip
 * first, then read.
 */
const stripComments = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** A max as the BUILDER writes them: one rep, kg, no source, one shared date. */
const builderMax = (lift, weight, date = '2026-01-01T09:00:00.000Z') => ({
  lift,
  weight,
  reps: 1,
  date,
  unit: 'kg',
});

const account = (over = {}) => ({
  weightUnit: 'lbs',
  bodyweightKg: 176,
  bodyweightUpdatedAt: null,
  oneRepMaxes: [],
  ...over,
});

// ─── 1. Who it fires on ─────────────────────────────────────────────────────
console.log('\n[1] It finds the accounts that have it');

check(
  'an account in pounds whose weight came from the builder is found',
  (() => {
    const c = unitCorrectionFor(account());
    return !!c && c.storedKg === 176 && Math.abs(c.correctedKg - 79.8) < 0.2;
  })(),
  JSON.stringify(unitCorrectionFor(account()))
);
check(
  'and it says what the figure should be, rather than only that it is wrong',
  (() => {
    const c = unitCorrectionFor(account({ bodyweightKg: 220 }));
    return !!c && Math.abs(c.correctedKg - 99.8) < 0.2;
  })(),
  JSON.stringify(unitCorrectionFor(account({ bodyweightKg: 220 })))
);

// ─── 2. Who it must never fire on ───────────────────────────────────────────
console.log('\n[2] And never on anybody who is fine');

check(
  'somebody training in kilograms is never asked',
  unitCorrectionFor(account({ weightUnit: 'kg' })) === null,
  'the fault only ever touched the people who typed pounds'
);
check(
  /**
   * THE DETECTOR ITSELF. The builder writes the bodyweight straight into state
   * rather than through setUserProfile, so it is the one path that never stamps
   * bodyweightUpdatedAt. A stamp means a human has put a weight in since, and
   * every screen that does so converts properly.
   */
  'somebody who has put their weight in by hand since is never asked',
  unitCorrectionFor(account({ bodyweightUpdatedAt: '2026-02-01T09:00:00.000Z' })) === null,
  ''
);
check(
  // Read as pounds a stored 90 is a 41 kg adult. Read as kilograms it is an
  // ordinary bodyweight. Asking there would be the app inventing a problem.
  'and neither is somebody whose figure is ordinary in kilograms',
  unitCorrectionFor(account({ bodyweightKg: 90 })) === null &&
    unitCorrectionFor(account({ bodyweightKg: ASK_ABOVE_KG - 1 })) === null,
  `the floor is ${ASK_ABOVE_KG} kg`
);
check(
  'an account with no bodyweight at all is not asked about one',
  unitCorrectionFor(account({ bodyweightKg: 0 })) === null,
  'skipping the question is allowed, and produces nothing to correct'
);
check(
  // Reading it as pounds would make them lighter than anybody is, so the
  // reading is wrong and there is no correction to offer.
  'and nor is a figure that makes no sense read either way',
  unitCorrectionFor(account({ bodyweightKg: 3000 })) === null,
  JSON.stringify(unitCorrectionFor(account({ bodyweightKg: 3000 })))
);

// ─── 3. Asking versus stating ───────────────────────────────────────────────
console.log('\n[3] It only asks when there is something to ask');

check(
  'a figure that is possible in kilograms is a question',
  unitCorrectionFor(account({ bodyweightKg: 176 }))?.certain === false,
  '176 kg is a real, if rare, bodyweight'
);
check(
  // setUserProfile refuses an implausible bodyweight, so offering "no, I really
  // am 340 kg" would leave the card coming back for ever.
  'a figure that is impossible in kilograms is a statement',
  unitCorrectionFor(account({ bodyweightKg: MAX_BODYWEIGHT_KG + 40 }))?.certain === true,
  `${MAX_BODYWEIGHT_KG} kg is the most the app will accept`
);

// ─── 4. Which lifts are touched ─────────────────────────────────────────────
console.log('\n[4] It corrects what was typed and nothing that was earned');

check(
  'the three lifts typed in the builder are corrected with the bodyweight',
  (() => {
    const c = unitCorrectionFor(
      account({
        oneRepMaxes: [
          builderMax('squat', 315),
          builderMax('bench', 225),
          builderMax('deadlift', 405),
        ],
      })
    );
    const squat = c?.lifts.find((l) => l.lift === 'squat');
    return c?.lifts.length === 3 && !!squat && Math.abs(squat.correctedKg - 142.9) < 0.2;
  })(),
  JSON.stringify(unitCorrectionFor(account({ oneRepMaxes: [builderMax('squat', 315)] }))?.lifts)
);
check(
  // A max measured in a test week is a real lift somebody actually did, logged
  // through a screen that has always converted properly. Halving it would be
  // the repair doing more damage than the fault.
  'a max earned in a test week is left exactly alone',
  (() => {
    const tested = { ...builderMax('squat', 150, '2026-03-01T09:00:00.000Z'), source: 'test', reps: 5 };
    const c = unitCorrectionFor(account({ oneRepMaxes: [builderMax('bench', 225), tested] }));
    return c?.lifts.length === 1 && c.lifts[0].lift === 'bench';
  })(),
  ''
);
check(
  'and so is one worked out on the calculator',
  (() => {
    const manual = { ...builderMax('squat', 160, '2026-03-01T09:00:00.000Z'), source: 'manual' };
    const c = unitCorrectionFor(account({ oneRepMaxes: [manual] }));
    return c?.lifts.length === 0;
  })(),
  ''
);
check(
  /**
   * Somebody who has tested since the builder has two maxes for that lift: the
   * bad one they typed and the good one they earned. Only the older group is
   * taken, so the good one survives.
   */
  'when both exist, only the one they typed is corrected',
  (() => {
    const typed = builderMax('squat', 315, '2026-01-01T09:00:00.000Z');
    const later = { ...builderMax('squat', 150, '2026-06-01T09:00:00.000Z'), source: 'test' };
    const found = builderTypedMaxes([later, typed]);
    return found.length === 1 && found[0].weight === 315;
  })(),
  ''
);
check(
  'an account that never typed any lifts still gets its bodyweight put right',
  (() => {
    const c = unitCorrectionFor(account({ oneRepMaxes: [] }));
    return !!c && c.lifts.length === 0 && c.correctedKg > 0;
  })(),
  ''
);

// ─── 5. Nothing here changes anything ───────────────────────────────────────
console.log('\n[5] Detecting is not deciding');

check(
  'the detector reports and never writes',
  (() => {
    const src = stripComments(read('lib/unit-correction.ts'));
    // No store writes, and it takes what it needs as arguments rather than
    // reaching for the live state.
    return !/useAppStore|set\(|getState\(\)/.test(src);
  })(),
  'deciding is the user, and applying it is the store'
);
check(
  'the card asks rather than rewriting on its own',
  (() => {
    const home = read('app/(tabs)/index.tsx');
    return /unit-fix-accept/.test(home) && /unit-fix-keep/.test(home);
  })(),
  ''
);
check(
  // Every "the app has frozen" report this project has had was two root-level
  // Modals at once, and this needs to be nowhere near that.
  'and it is a card in the scroll rather than another root modal',
  (() => {
    const home = read('app/(tabs)/index.tsx');
    const at = home.indexOf('testID="unit-fix-card"');
    if (at < 0) return false;
    const near = home.slice(at - 600, at + 200);
    return /Animated\.View/.test(near) && !/<Modal/.test(near);
  })(),
  ''
);
check(
  /**
   * ANSWERING EITHER WAY HAS TO END IT, and the record that it was answered is
   * the bodyweight stamp rather than a second flag. setUserProfile writes that
   * stamp, so an answered account stops matching the detector - on this device
   * and on every other one the profile syncs to.
   */
  'answering either way writes a bodyweight, which is what stops it asking again',
  (() => {
    const store = read('lib/store.ts');
    const at = store.indexOf('resolveUnitCorrection: (answer)');
    if (at < 0) return false;
    const body = store.slice(at, at + 2000);
    return /setUserProfile\(\{/.test(body) && /answer === 'pounds' \? found\.correctedKg : found\.storedKg/.test(body);
  })(),
  'a card that comes back every launch after being answered is worse than the fault'
);
check(
  'the impossible case is not offered a "no" it could not act on',
  (() => {
    const home = read('app/(tabs)/index.tsx');
    return /\{!unitFix\.certain && \(/.test(home);
  })(),
  'setUserProfile refuses an implausible bodyweight, so the card would never clear'
);

console.log(`\nunit-correction: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
