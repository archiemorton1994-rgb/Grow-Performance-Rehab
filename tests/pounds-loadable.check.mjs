/**
 * Contract test: everything a pounds user is asked to lift is a weight that
 * exists.
 *
 * WHAT WENT WRONG
 * ───────────────
 * Every rounding decision in the engine was `Math.round(v / 2.5) * 2.5`
 * KILOGRAMS, for everybody. 2.5 kg is 5.5 lbs, so somebody training in pounds
 * was walked up 143.3 → 154.3 → 165.3 → 176.4 → 187.4 lbs: a constant 11.0 lb
 * step, and not one of those weights can be made with plates on a bar.
 *
 * Two more, on the same screen. `convertLoadString` rounded the card to whole
 * pounds while the logging bar prefilled one decimal, so the same set read
 * 143 lbs on the card and 143.3 in the box. And "New Record!" compared
 * kilograms — the pounds in the box converted back — which for 48 of the 120
 * weights on the 2.5 kg grid lands FRACTIONALLY ABOVE where it started
 * (100 kg → 220.5 lbs → 100.02 kg), so submitting the number the app itself
 * prefilled congratulated the user on a personal best for repeating last
 * week's set.
 *
 * WHAT MUST BE TRUE INSTEAD
 * ─────────────────────────
 * Judged the way the user reads the screen, not the way the engine stores it:
 *
 *   1. Every weight printed on a card and every weight prefilled into the box
 *      is one a pound gym can make — 5 lb steps, closing to 2.5 lb at the light
 *      end of the dumbbell rack.
 *   2. The card and the box say the SAME number for the same set.
 *   3. Progressing a lift moves it by 5 lb, not 11.0.
 *   4. Repeating a weight is not a personal best; adding 0.5 kg still is.
 *   5. None of this moves a single number for anyone training in kilograms.
 *   6. Switching units mid-programme does not make the numbers jump.
 *
 * Everything below runs against the real modules, wired the way the session
 * screen wires them, plus source checks that the screen actually wires them
 * that way — a library that is right on its own is worth nothing if the screen
 * never tells it which gym the user is in.
 *
 * Run:  npx tsx tests/pounds-loadable.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import {
  generateWorkout,
  expandSetTargets,
  getWeightGuideKg,
  getWeightGuide,
  workingWeightFromOrm,
} from '../lib/workout-engine.ts';
import {
  convertLoadString,
  kgToDisplayUnit,
  displayUnitToKg,
  formatWeight,
  isHeavierThan,
  roundToLoadable,
  snapToLoadable,
} from '../lib/utils.ts';
import { suggestSetWeight } from '../lib/auto-regulation.ts';

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

/** The rule the engine used to apply to everybody, kept here to measure against. */
const oldKgGrid = (v) => Math.max(2.5, Math.round(v / 2.5) * 2.5);

const isMultiple = (v, step) => Math.abs(v / step - Math.round(v / step)) < 1e-6;
/**
 * A weight a gym stocked in pounds can actually make: 5 lb steps, or 2.5 lb
 * below 25 lb where the dumbbells sit closer together. Written out here rather
 * than imported so this file is judging the app against a stated promise, not
 * against the app's own arithmetic.
 */
const loadableInPounds = (lbs) => lbs > 0 && isMultiple(lbs, 2.5) && (lbs < 25 || isMultiple(lbs, 5));
const loadableInKilos = (kg) => kg > 0 && isMultiple(kg, 2.5);

const PROFILE = {
  name: 'P',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['fitness'],
  bodyweightKg: 80,
};
const READINESS = { hasAches: false, energy: 'normal', timeAvailable: '60' };
const SESSION_TYPES = [
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
const TIERS = ['fullgym', 'dumbbells', 'kettlebells', 'bodyweight', 'bands'];

/** Build a session exactly as app/session.tsx builds one. */
const build = (type, tier, unit, opts = {}) =>
  generateWorkout(
    type,
    tier,
    opts.readiness ?? READINESS,
    opts.profile ?? PROFILE,
    {},
    opts.bestOrmKg,
    opts.strengthCount ?? 4,
    opts.lastLoggedWeights ?? {},
    opts.normalStreak ?? {},
    opts.performance ?? {},
    opts.daysSince ?? 1,
    unit
  );

/**
 * THE MAIN LIFT, WITH THE HISTORY RECORDED AGAINST WHICHEVER EXERCISE IT IS.
 *
 * Every progression section below used to build a 'squat' session and key the
 * user's history off the literal id 'sq-main-fg' - the one main lift a squat day
 * could ever have. Squat days are not built any more: 'squat', 'bench' and
 * 'deadlift' all build a lower, upper or full body session now, and those rotate
 * their main lift on the session count and on the calendar, so there is no
 * single id to write down.
 *
 * A hardcoded id that stops matching fails silently rather than loudly. The
 * engine simply sees no history, prescribes a first-time estimate, and every
 * progression assertion below goes on running against a lifter who apparently
 * never lifted anything. So the id is read off the session that was actually
 * built, the history is recorded against THAT exercise, and the second build has
 * to come back with the same one or this returns nothing and the caller fails.
 */
function mainLift(type, tier, unit, opts = {}, history = () => ({})) {
  const first = build(type, tier, unit, opts).find((e) => e.category === 'main');
  if (!first) return undefined;
  const again = build(type, tier, unit, { ...opts, ...history(first.id) }).find(
    (e) => e.category === 'main'
  );
  return again && again.id === first.id ? again : undefined;
}

/** The per-set numbers the logging bar prefills, exactly as session.tsx derives them. */
const boxTargetsKg = (ex, unit) =>
  ex.loadKg
    ? expandSetTargets(ex.category, ex.sets, ex.loadKg, unit)
    : getWeightGuideKg(ex.category, ex.sets, ex.suggestedLoad, unit);

/** Every number the card actually prints, read back out of the rendered text. */
const cardNumbers = (ex, unit) =>
  (convertLoadString(ex.suggestedLoad, unit).match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

// ─── 1. The reported sequence ────────────────────────────────────────────────
console.log('\n[1] The progression the audit read off the screen');
{
  // The reported run: a lifter earning the +5 kg step, session after session.
  const before = [];
  let a = 65;
  for (let i = 0; i < 5; i++) {
    before.push(Number((a * 2.20462).toFixed(1)));
    a = oldKgGrid(a + 5);
  }
  console.log('     was: ' + before.join(' → ') + ' lbs');
  check(
    'the old rule really did produce 143.3 → 154.3 → 165.3 → 176.4 → 187.4',
    before.join() === [143.3, 154.3, 165.3, 176.4, 187.4].join(),
    before.join(' → ')
  );
  const steps = before.slice(1).map((v, i) => Number((v - before[i]).toFixed(1)));
  check(
    'an 11.0 lb step — a number no gym works in',
    steps.every((s) => Math.abs(s - 11.0) <= 0.1),
    steps.join()
  );
  check(
    'and not one of those five was loadable',
    before.every((v) => !loadableInPounds(v)),
    before.filter(loadableInPounds).join()
  );

  // The same lifter, earning the same step, run through the real engine now.
  const runSteps = (performance) => {
    let lastKg = displayUnitToKg(145, 'lbs');
    const seq = [];
    for (let i = 0; i < 5; i++) {
      const ex = mainLift('lower_body', 'fullgym', 'lbs', {}, (id) => ({
        lastLoggedWeights: { [id]: lastKg },
        performance: performance ? { [id]: performance } : {},
      }));
      const working = boxTargetsKg(ex, 'lbs').at(-1);
      seq.push(kgToDisplayUnit(working, 'lbs'));
      lastKg = working;
    }
    return seq;
  };
  const now = runSteps('easy');
  console.log('     now: ' + now.join(' → ') + ' lbs');
  check('every weight in the sequence is loadable', now.every(loadableInPounds), now.join(' → '));
  const nowSteps = now.slice(1).map((v, i) => Number((v - now[i]).toFixed(2)));
  check(
    'and the step is a round 10 lb instead of 11.0',
    nowSteps.length > 0 && nowSteps.every((s) => s === 10),
    nowSteps.join(' , ')
  );

  const ordinary = runSteps(undefined);
  console.log('     ordinary progression: ' + ordinary.join(' → ') + ' lbs');
  const ordinarySteps = ordinary.slice(1).map((v, i) => Number((v - ordinary[i]).toFixed(2)));
  check(
    'the ordinary progression is 5 lb, the smallest jump a pound gym can make',
    ordinary.every(loadableInPounds) && ordinarySteps.every((s) => s === 5),
    ordinary.join(' → ')
  );
}

// ─── 2. The bigger steps keep their meaning ──────────────────────────────────
//
// REWRITTEN when progression stopped being a flat number of kilograms.
//
// This used to assert three exact numbers — +5, +10 and +15 lb — which were the
// pound faces of the old flat +2.5 / +5 / +7.5 kg steps. Those steps were the
// bug: the same kilograms went onto a deadlift and onto a lateral raise, and
// twelve quiet sessions took a 10 kg dumbbell to 62.5 kg. The step is a share of
// the load now, so a fixed pound figure is no longer the thing to check.
//
// What still has to hold is the PROMISE the three sizes make: a bigger answer
// never moves you less, and answering at all beats saying nothing. That is what
// keeps the feedback prompt worth using.
//
// Three DISTINCT sizes are deliberately not required. The pound grid is 5 lb, so
// three distinct multiples on a 145 lb squat means +15 lb — 10.3% in one
// session, which is more than a tap of "plenty left" should authorise. Where the
// grid can express the difference the engine takes it (see the tier-separation
// step in progressedLoad); where it cannot, two answers landing on the same
// weight is the honest outcome and not a fault.
console.log('\n[2] A bigger answer never moves you less');
{
  const stepsFor = (performance, normalStreak) => {
    let lastKg = displayUnitToKg(145, 'lbs');
    const seq = [];
    for (let i = 0; i < 4; i++) {
      const ex = mainLift('lower_body', 'fullgym', 'lbs', {}, (id) => ({
        lastLoggedWeights: { [id]: lastKg },
        performance: performance ? { [id]: performance } : {},
        normalStreak: normalStreak ? { [id]: normalStreak } : {},
      }));
      const working = boxTargetsKg(ex, 'lbs').at(-1);
      seq.push(kgToDisplayUnit(working, 'lbs'));
      lastKg = working;
    }
    return seq.slice(1).map((v, i) => Number((v - seq[i]).toFixed(2)));
  };
  const normal = stepsFor(undefined, 0);
  const easy = stepsFor('easy', 0);
  const veryEasy = stepsFor('very_easy', 0);
  const held = stepsFor('failed', 0);
  console.log(`     normal ${normal.join()} | easy ${easy.join()} | very easy ${veryEasy.join()} | hold ${held.join()}`);
  check('a clean session is +5 lb, the smallest a pound gym can make', normal.every((s) => s === 5), normal.join());
  check(
    'every step is a whole number of pounds the gym can load',
    [...normal, ...easy, ...veryEasy].every((s) => s % 5 === 0),
    `${normal.join()} | ${easy.join()} | ${veryEasy.join()}`
  );
  check(
    '"that felt easy" moves more than saying nothing',
    easy.every((s, i) => s > normal[i]),
    `easy ${easy.join()} vs normal ${normal.join()}`
  );
  check(
    '"plenty left" is never less than "that felt easy"',
    veryEasy.every((s, i) => s >= easy[i]),
    `very easy ${veryEasy.join()} vs easy ${easy.join()}`
  );
  check(
    'and no single answer adds more than a tenth of the bar',
    veryEasy.every((s) => s / 145 <= 0.105),
    veryEasy.join()
  );
  check('a failed session holds the weight exactly', held.every((s) => s === 0), held.join());
}

// ─── 3. Every weight, in every session the app can build ─────────────────────
console.log('\n[3] Every card and every box, across every session type and tier');
{
  const offGrid = [];
  const disagreements = [];
  let weightsSeen = 0;
  let exercisesSeen = 0;

  for (const type of SESSION_TYPES) {
    for (const tier of TIERS) {
      for (const anchor of [0, 20, 42.5, 65.77, 102.5]) {
        const lastLoggedWeights = {};
        const session = build(type, tier, 'lbs', {
          lastLoggedWeights,
          bestOrmKg: anchor > 0 ? anchor * 1.3 : undefined,
        });
        for (const ex of session) {
          exercisesSeen++;
          for (const n of cardNumbers(ex, 'lbs')) {
            weightsSeen++;
            if (!loadableInPounds(n)) offGrid.push(`${type}/${tier} card "${ex.name}" → ${n} lbs`);
          }
          const box = boxTargetsKg(ex, 'lbs').filter((k) => k > 0);
          for (const kg of box) {
            weightsSeen++;
            const lbs = kgToDisplayUnit(kg, 'lbs');
            if (!loadableInPounds(lbs)) offGrid.push(`${type}/${tier} box "${ex.name}" → ${lbs} lbs`);
          }
          // The card names the target; the box prefills it. On a card that
          // states one weight, or a range whose bottom the app prescribes, the
          // first number on the card IS the number in the box.
          //
          // KETTLEBELLS USED TO BE EXCLUDED HERE, AND ARE NOT ANY MORE.
          // `applyKettlebellNaming` rewrote the load SENTENCE to the nearest
          // real bell after the load had been worked out, without touching the
          // structured weight behind it, so a KB Good Morning said "8 kg" on
          // the card and prefilled 5 kg. That renaming only ever ran inside the
          // old weekly generator, and with Full Body switched over no lifting
          // session reaches it, so the gap has closed on its own. Section 4
          // holds it closed in both units.
          const card = cardNumbers(ex, 'lbs');
          if (card.length > 0 && box.length > 0) {
            const boxTop = kgToDisplayUnit(box.at(-1), 'lbs');
            const cardTarget = card.length >= box.length ? card.at(-1) : card[0];
            const matches = card.includes(boxTop) || cardTarget === boxTop || card[0] === kgToDisplayUnit(box[0], 'lbs');
            if (!matches) {
              disagreements.push(
                `${type}/${tier} "${ex.name}": card [${card.join(', ')}] vs box [${box.map((k) => kgToDisplayUnit(k, 'lbs')).join(', ')}]`
              );
            }
          }
        }
      }
    }
  }

  // Non-vacuity: this walk must actually have read weights off cards. A probe
  // that silently found nothing would "pass" every assertion below it.
  check(
    `the walk actually read weights (${weightsSeen} numbers across ${exercisesSeen} exercises)`,
    weightsSeen > 500 && exercisesSeen > 300,
    `${weightsSeen} weights, ${exercisesSeen} exercises`
  );
  check(
    `every weight a pounds user is shown can be loaded (${weightsSeen} checked)`,
    offGrid.length === 0,
    offGrid.slice(0, 6).join(' | ')
  );
  check(
    'the card and the logging box never disagree',
    disagreements.length === 0,
    disagreements.slice(0, 4).join(' | ')
  );
}

// ─── 4. Nothing moves for kilograms ──────────────────────────────────────────
console.log('\n[4] The kilogram user sees exactly what they saw before');
{
  let mismatches = 0;
  for (let i = 0; i <= 8000; i++) {
    const v = i * 0.125;
    if (roundToLoadable(v, 'kg') !== oldKgGrid(v)) mismatches++;
  }
  check(
    'the kilogram grid is the identical Math.max(2.5, round(v/2.5)*2.5) it replaced (8001 values)',
    mismatches === 0,
    `${mismatches} mismatches`
  );

  const offGrid = [];
  let seen = 0;
  for (const type of SESSION_TYPES) {
    for (const tier of TIERS) {
      // A 65 kg history against every exercise the session actually holds, so
      // the progression path is what gets swept rather than the first-time
      // estimate. Keyed off the real ids for the reason mainLift explains.
      const lastLoggedWeights = Object.fromEntries(build(type, tier, 'kg').map((e) => [e.id, 65]));
      for (const ex of build(type, tier, 'kg', { lastLoggedWeights })) {
        for (const kg of boxTargetsKg(ex, 'kg').filter((k) => k > 0)) {
          seen++;
          if (!loadableInKilos(kg)) offGrid.push(`${type}/${tier} "${ex.name}" → ${kg} kg`);
        }
      }
    }
  }
  check(
    `every kilogram prescription is still a 2.5 kg multiple (${seen} checked)`,
    seen > 100 && offGrid.length === 0,
    offGrid.slice(0, 5).join(' | ')
  );

  // The database's own kilogram strings must come through untouched. Rounding
  // those onto a grid would quietly re-prescribe a third of the catalogue.
  const kgStrings = ['10–18 kg per hand', '12.5 kg', '5-10 kg', '25-35 kg', '60/50/40 kg', '3 kgs'];
  const changed = kgStrings.filter((s) => convertLoadString(s, 'kg') !== s);
  check('database load strings are unchanged in kilograms', changed.length === 0, changed.join(' | '));

  check(
    'auto-regulation is untouched in kilograms',
    [0.5, 2.3, 4.5, 12, 26, 65.77, 102.5].every((v) => snapToLoadable(v, 10, 'kg') === v),
    'snapToLoadable must be identity for kg'
  );

  /**
   * THE KETTLEBELL CARD AND ITS BOX NOW AGREE, AND THIS IS WHAT HOLDS THEM TO IT.
   *
   * This used to be the opposite assertion. `applyKettlebellNaming` rewrote the
   * load sentence to the nearest real bell after the load had been worked out
   * and left the structured weight behind it alone, so a kettlebell card named
   * one weight and prefilled another, in kilograms as much as in pounds.
   * Section 3 skipped the kettlebell tier because of it and this pinned the
   * gap, in both units, so that it was on the record rather than quietly
   * excluded - and said in its own failure message that if it ever passed, the
   * exclusion should go with it.
   *
   * It passes. The renaming only ever ran inside the old weekly generator, and
   * with Full Body switched over there is no lifting session left that reaches
   * it. So the exclusion in section 3 is gone and every kettlebell card is now
   * swept with the rest, and this asks the same question the other way up: the
   * first weight a kettlebell card names is the weight its box prefills, in
   * kilograms and in pounds. Swept over every session type, because a type that
   * came back to the old engine would bring the gap back with it.
   */
  const kbMismatch = (unit) => {
    for (const type of SESSION_TYPES) {
      for (const ex of build(type, 'kettlebells', unit)) {
        const box = boxTargetsKg(ex, unit).filter((k) => k > 0);
        const card = cardNumbers(ex, unit);
        if (card.length > 0 && box.length > 0 && !card.includes(kgToDisplayUnit(box[0], unit))) {
          return `${type} ${ex.name}: card [${card.join(', ')}] vs box [${box.map((k) => kgToDisplayUnit(k, unit)).join(', ')}]`;
        }
      }
    }
    return null;
  };
  const inKg = kbMismatch('kg');
  const inLbs = kbMismatch('lbs');
  check(
    'a kettlebell card names the weight its box prefills, in both units',
    inKg === null && inLbs === null,
    `kg: ${inKg} | lbs: ${inLbs} — the load sentence and the structured weight behind it have come apart again`
  );
}

// ─── 5. "New Record!" ────────────────────────────────────────────────────────
console.log('\n[5] Repeating a weight is not a personal best');
{
  // The exact round trip the bar performs: the stored best is rendered into the
  // box, and the box is parsed back when the set is submitted.
  const resubmit = (bestKg, unit) => displayUnitToKg(kgToDisplayUnit(bestKg, unit), unit);

  let falsePbs = 0;
  let driftedAbove = 0;
  let missedGenuine = 0;
  const grid = [];
  for (let i = 1; i <= 120; i++) grid.push(i * 2.5);
  for (const best of grid) {
    const back = resubmit(best, 'lbs');
    if (back > best) driftedAbove++;
    if (isHeavierThan(back, best, 'lbs')) falsePbs++;
    if (!isHeavierThan(best + 0.5, best, 'lbs')) missedGenuine++;
  }
  check(
    `the round trip still drifts above on ${driftedAbove} of 120 weights — that part is real`,
    driftedAbove >= 40,
    `${driftedAbove} — the audit measured 48`
  );
  check(
    'and none of them is reported as a record any more',
    falsePbs === 0,
    `${falsePbs} of 120 still flash "New Record!" for repeating last week`
  );
  check('a genuine 0.5 kg personal best still registers', missedGenuine === 0, `${missedGenuine} missed`);

  // In pounds, where the user reads it.
  check('221 lbs beats 220.5 lbs', isHeavierThan(displayUnitToKg(221, 'lbs'), 100, 'lbs'), '');
  check('220.5 lbs does not beat 220.5 lbs', !isHeavierThan(displayUnitToKg(220.5, 'lbs'), 100, 'lbs'), '');
  check('150 lbs beats 145 lbs', isHeavierThan(displayUnitToKg(150, 'lbs'), displayUnitToKg(145, 'lbs'), 'lbs'), '');
  check('145 lbs does not beat 145 lbs', !isHeavierThan(displayUnitToKg(145, 'lbs'), displayUnitToKg(145, 'lbs'), 'lbs'), '');
  check('and kilograms still compare as before', isHeavierThan(102.5, 100, 'kg') && !isHeavierThan(100, 100, 'kg'), '');
}

// ─── 6. The unit switch ──────────────────────────────────────────────────────
console.log('\n[6] Switching units mid-programme');
{
  // A pounds user at 145 lbs switches to kilograms. History must read back as
  // the same set, and the next prescription must not lurch.
  const kgOnFile = displayUnitToKg(145, 'lbs');
  check(
    'a set logged at 145 lbs still reads 145 lbs',
    kgToDisplayUnit(kgOnFile, 'lbs') === 145,
    `${kgToDisplayUnit(kgOnFile, 'lbs')}`
  );
  check(
    'and reads as 65.8 kg for someone in kilograms — the weight they actually lifted',
    formatWeight(kgOnFile, 'kg') === '65.8 kg',
    formatWeight(kgOnFile, 'kg')
  );

  const nextIn = (unit) => {
    const ex = mainLift('lower_body', 'fullgym', unit, {}, (id) => ({
      lastLoggedWeights: { [id]: kgOnFile },
    }));
    return boxTargetsKg(ex, unit).at(-1);
  };
  const stayed = nextIn('lbs');
  const switched = nextIn('kg');
  const gapLbs = Math.abs(kgToDisplayUnit(stayed, 'lbs') - kgToDisplayUnit(switched, 'lbs'));
  console.log(
    `     next session: staying in lbs → ${kgToDisplayUnit(stayed, 'lbs')} lbs; ` +
      `switching to kg → ${switched} kg (${kgToDisplayUnit(switched, 'lbs')} lbs)`
  );
  check(
    'the weight does not jump when the unit changes (within one grid step)',
    gapLbs <= 5.51,
    `${gapLbs.toFixed(2)} lb apart`
  );
  check('both are progressions, not resets', stayed > kgOnFile && switched > kgOnFile, '');
  check(
    'and the kilogram one lands on the kilogram grid',
    loadableInKilos(switched),
    `${switched} kg`
  );

  // The other direction: a kilogram user's 100 kg read by someone who has just
  // switched to pounds.
  const toPounds = mainLift('lower_body', 'fullgym', 'lbs', {}, (id) => ({
    lastLoggedWeights: { [id]: 100 },
  }));
  const nextLbs = kgToDisplayUnit(boxTargetsKg(toPounds, 'lbs').at(-1), 'lbs');
  const wouldHaveBeen = kgToDisplayUnit(oldKgGrid(100 + 2.5), 'lbs');
  check(
    'a 100 kg lifter switching to pounds is offered ~226 lbs, not something else entirely',
    loadableInPounds(nextLbs) && Math.abs(nextLbs - wouldHaveBeen) <= 5.51,
    `offered ${nextLbs} lbs against ${wouldHaveBeen} lbs`
  );
}

// ─── 7. Within-session auto-regulation ───────────────────────────────────────
console.log('\n[7] The weight offered after every possible answer');
{
  const ex = mainLift('lower_body', 'fullgym', 'lbs', {}, (id) => ({
    lastLoggedWeights: { [id]: displayUnitToKg(145, 'lbs') },
  }));
  const plannedKg = boxTargetsKg(ex, 'lbs');
  const SETS = plannedKg.length;
  console.log('     planned ramp: ' + plannedKg.map((k) => kgToDisplayUnit(k, 'lbs')).join(' / ') + ' lbs');
  check('the ramp itself is loadable', plannedKg.every((k) => loadableInPounds(kgToDisplayUnit(k, 'lbs'))), '');

  const ANSWERS = ['easy', 'challenging', 'too_hard', null];
  const offGrid = [];
  const wrongWay = [];
  let combos = 0;
  let offersSeen = 0;

  const seq = new Array(SETS).fill(null);
  const walk = (idx) => {
    if (idx === SETS) {
      combos++;
      const outcomes = [];
      for (let i = 0; i < SETS; i++) {
        const plan = { isRamped: true, plannedKg, outcomes };
        const raw = suggestSetWeight(plan, i);
        const cameFrom = i > 0 ? outcomes[i - 1].loggedKg : 0;
        // Exactly what app/session.tsx puts in the box.
        const offered = snapToLoadable(raw.kg, cameFrom, 'lbs');
        offersSeen++;
        const lbs = kgToDisplayUnit(offered, 'lbs');
        if (offered > 0 && !loadableInPounds(lbs)) {
          offGrid.push(`${seq.slice(0, i).join('>')} → set ${i + 1} offered ${lbs} lbs`);
        }
        // Putting it on the grid must not undo the move the answer earned.
        if (cameFrom > 0) {
          if (raw.kg > cameFrom && offered <= cameFrom) {
            wrongWay.push(`up became not-up at set ${i + 1}: ${kgToDisplayUnit(cameFrom, 'lbs')} → ${lbs}`);
          }
          if (raw.kg < cameFrom && offered >= cameFrom) {
            wrongWay.push(`down became not-down at set ${i + 1}: ${kgToDisplayUnit(cameFrom, 'lbs')} → ${lbs}`);
          }
        }
        outcomes.push({ loggedKg: offered, feedback: seq[i] });
      }
      return;
    }
    for (const a of ANSWERS) {
      seq[idx] = a;
      walk(idx + 1);
    }
    seq[idx] = null;
  };
  walk(0);

  /**
   * The non-vacuity guard, stated exactly rather than as a floor.
   *
   * It used to be "more than 500 sequences and more than 2,000 weights", which
   * were the numbers a five-set ramp produces. The main lift of a lower body
   * session ramps over four sets, so those floors started failing on a walk that
   * had covered every single combination there is. A floor sized to one session
   * shape is a number that goes stale silently in both directions; the count is
   * arithmetic, so it can simply be asserted.
   */
  check(
    `the walk ran (${combos} answer sequences over a ${SETS}-set ramp, ${offersSeen} weights offered)`,
    SETS >= 3 && combos === ANSWERS.length ** SETS && offersSeen === combos * SETS,
    `${combos}/${offersSeen}, expected ${ANSWERS.length ** SETS}/${ANSWERS.length ** SETS * SETS}`
  );
  check(
    'every weight the app offers mid-session is loadable',
    offGrid.length === 0,
    offGrid.slice(0, 5).join(' | ')
  );
  check(
    'and putting it on the grid never reverses the adjustment',
    wrongWay.length === 0,
    wrongWay.slice(0, 5).join(' | ')
  );
}

/*
 * SECTION 8 WAS THE 1RM TEST WEEK, and it is retired with the feature.
 *
 * It built the test protocol in pounds and in kilograms and asserted that every
 * weight on the cards was a weight a gym can actually load, and that the cue a
 * pounds user follows never names kilograms. The protocol is gone: there is no
 * generate1RMWorkout to call.
 *
 * Nothing is lost from the pounds promise. Every other section of this file
 * covers the sessions people actually get, and section 9 still asserts that the
 * session screen hands the unit to the generator and to the per-set ramp. The
 * retirement itself is held by tests/test-weeks-retired.check.mjs.
 */

// ─── 9. The per-set guide text ───────────────────────────────────────────────
console.log('\n[9] The written per-set guide');
{
  // getWeightGuide takes a unit and used to print unconverted kilograms behind
  // it, so a pounds user was told to warm up at "50 lbs" when the number was
  // 50 kg.
  const lbs = getWeightGuide('main', 4, 'lbs', '65.77 kg');
  const kg = getWeightGuide('main', 4, 'kg', '65.77 kg');
  console.log('     lbs: ' + lbs.join(' | '));
  const nums = lbs.join(' ').match(/\d+(?:\.\d+)?/g).map(Number).filter((n) => n > 10);
  check('the pounds guide is in pounds', nums.some((n) => n > 100), nums.join());
  check('and every weight in it is loadable', nums.every(loadableInPounds), nums.join());
  check(
    'the kilogram guide is unchanged',
    kg.some((l) => /65\.8 kg/.test(l)) && !/lbs/.test(kg.join()),
    kg.join(' | ')
  );

  check(
    'and a working weight derived from a 1RM lands on the grid in both units',
    loadableInPounds(kgToDisplayUnit(workingWeightFromOrm(140, PROFILE, 'lbs'), 'lbs')) &&
      loadableInKilos(workingWeightFromOrm(140, PROFILE, 'kg')),
    `${kgToDisplayUnit(workingWeightFromOrm(140, PROFILE, 'lbs'), 'lbs')} lbs / ${workingWeightFromOrm(140, PROFILE, 'kg')} kg`
  );
}

// ─── 10. The screen has to actually ask ──────────────────────────────────────
console.log('\n[10] The session screen tells the engine which gym the user is in');
{
  const src = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');
  check(
    'the unit is captured once at session start, not read live',
    /const loadUnitAtStart = useRef<WeightUnit>\(weightUnit\)/.test(src),
    'reading it live makes it a dependency of the exercise list, and regenerating that list mid-session wipes every logged set'
  );
  check(
    'generateWorkout is told the unit',
    // Deliberately does NOT require the unit to be the final argument. It was
    // written that way — `loadUnitAtStart.current` followed by the closing
    // paren — and that pinned an incidental fact rather than the promise: the
    // day a parameter was appended after it (exerciseStuckStreak, for the
    // deload), this failed while the screen was still passing the unit
    // perfectly well. What matters is that it is passed at all.
    /generateWorkout\([\s\S]{0,900}?loadUnitAtStart\.current\b/.test(src),
    'without this the library is right and the screen still prescribes 143.3 lbs'
  );
  check(
    'and so is the per-set ramp the box prefills from',
    (src.match(/expandSetTargets\([\s\S]{0,200}?loadUnitAtStart\.current/g) ?? []).length >= 2 &&
      (src.match(/getWeightGuideKg\([\s\S]{0,200}?loadUnitAtStart\.current/g) ?? []).length >= 2,
    ''
  );
  check(
    'the auto-regulated weight is put back on the grid before it reaches the box',
    /snapToLoadable\(\s*r\.kg,/.test(src),
    ''
  );
  check(
    '"New Record!" is judged in the unit on screen',
    /isHeavierThan\(effectiveWeightKg, previousBest, weightUnit\)/.test(src) &&
      !/effectiveWeightKg > previousBest/.test(src),
    'comparing kilograms is what flashed a PB for repeating a weight'
  );
}

// ─── The summary's "vs last time" badge ──────────────────────────────────────
//
// Reported from use: "it said something like 'Goblet Squat Primer
// +0.009999999999999999999787 vs last time'".
//
// Two faults in one line. It printed the raw subtraction, and two weights a
// hundredth apart come out of binary floating point looking like that. And it
// hardcoded "kg" while the rest of the screen respected the user's choice, so
// somebody training in pounds was shown a kilogram number wearing their own
// unit. The second is the worse one: a long number looks broken, a wrong unit
// looks right.
//
// Rounding only the LABEL would have hidden the number and kept the wrong
// verdict, because a hundredth of a kilogram had also been ruled a personal
// best. The comparison itself is now made on what gets shown.
console.log('\n[8] The summary compares what it prints');

{
  const summary = readFileSync(new URL('../app/session-summary.tsx', import.meta.url), 'utf8');

  check(
    'the badge label goes through formatWeight like every other weight',
    /label: \(r, unit\) => `\+\$\{formatWeight\(r\.deltaWeight, unit\)\} vs last time`/.test(summary),
    'it interpolated r.deltaWeight straight into the string'
  );
  check(
    'the "lighter than last time" badge too',
    /label: \(r, unit\) => `\$\{formatWeight\(r\.deltaWeight, unit\)\} lighter than last time`/.test(
      summary
    ),
    ''
  );
  check(
    'neither one hardcodes a unit any more',
    !/\$\{r\.deltaWeight\} kg/.test(summary),
    'a pounds user was shown kilograms labelled kg, which is right about the label and wrong about the number'
  );
  check(
    'and the label is actually given the unit at the call site',
    /meta\.label\(r, weightUnit\)/.test(summary),
    'a label that takes a unit and is never handed one is the same bug with a type annotation'
  );
  check(
    'the gain or drop is decided at display precision, not full float',
    /const shownNow = kgToDisplayUnit\(thisBest\.weight, weightUnit\)/.test(summary) &&
      /shownNow > shownBefore/.test(summary),
    'two sets a hundredth of a kilogram apart are the same set: nothing in a gym can express the difference'
  );
  check(
    'and the unit is a dependency of the block that decides it',
    /\}, \[session, getExerciseHistory, categoryMap, weightUnit\]\);/.test(summary),
    'switching units would otherwise leave the old verdicts on screen'
  );

  // The arithmetic itself, run rather than read.
  const noisyDelta = 2.51 - 2.5;
  check(
    'the case from the report really is a float artefact',
    String(noisyDelta).length > 6,
    `2.51 - 2.5 = ${noisyDelta}`
  );
  check(
    'and formatWeight turns it into something a person can read',
    !/\d\.\d{4}/.test(formatWeight(noisyDelta, 'kg')) &&
      !/\d\.\d{4}/.test(formatWeight(noisyDelta, 'lbs')),
    `got "${formatWeight(noisyDelta, 'kg')}" and "${formatWeight(noisyDelta, 'lbs')}"`
  );
}

console.log('');
if (failures > 0) {
  console.error(`pounds-loadable: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`pounds-loadable: all ${total} checks passed\n`);
  process.exitCode = 0;
}
