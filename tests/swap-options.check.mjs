/**
 * Contract test: the swap button offers two labelled choices.
 *
 * WHY THIS MATTERS
 * ────────────────
 * "Tap the swap icon on any card to get an alternative for the same muscle
 * group." That is what the in-session tutorial used to promise, and what it
 * delivered depended entirely on whether somebody had hand-written an
 * alternative onto that particular template. Measured across the pickable
 * catalogue before the fill was added: a quarter had two, a quarter had one
 * forever, and a quarter had none at all - for those the button did nothing.
 *
 * Sections [1] to [5] hold that fill in place. Sections [6] to [8] are the
 * second half of the problem, which the fill did not solve: the two slots came
 * out of one ranking, so the sheet showed two alternatives and could not say
 * why either was there. A user taps swap for one of exactly two reasons -
 *
 *   "the cable station is taken"   → this movement, different kit
 *   "my shoulder has had enough"   → different movement, same muscles
 *
 * - and the sheet answered neither. Slot one is now the equipment answer and
 * slot two the muscle answer, both on screen at once and both labelled, with a
 * way back to the original. See lib/exercise-swaps.ts.
 *
 * WHAT THESE ASSERTIONS ARE FOR
 * ─────────────────────────────
 * A label nobody checks is a label that drifts, so an option called "the same
 * movement with different kit" is verified to be one - against kitOf directly
 * rather than against the rule under test, which will happily agree with
 * itself.
 *
 * They run the REAL generator across session types, tiers, complaints and
 * seeds, because the fill happens at generation time and has to survive
 * everything layered on top of it - comfort variants, grip variants, kettlebell
 * renaming and the injury screen - and because which alternative comes up
 * rotates with the session count, so a rule that leaks on the third session
 * leaks past a test that only builds the first.
 *
 * Run:  npx tsx tests/swap-options.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateWorkout } from '../lib/workout-engine.ts';
import { restrictedTagsFor, restrictedTagsOn } from '../lib/exercise-safety.ts';
import { getRegionsByExerciseNameMap, getAllPickableExercises } from '../lib/exercise-db.ts';
import {
  isEquipmentVariant,
  isSameMuscleAlternative,
  muscleGroupOf,
  movementCoreOf,
  kitOf,
  MUSCLE_GROUP_LABELS,
  SWAP_KIND_HEADINGS,
} from '../lib/exercise-swaps.ts';

const __dir = dirname(fileURLToPath(import.meta.url));

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
  name: 'T',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['muscle'],
  bodyweightKg: 80,
};

// 'deadlift' earns its place here: it is the session whose main lift shares a
// muscle group with half the cooldown catalogue, so it is where a same-muscle
// alternative first reaches for a floor stretch.
const TYPES = [
  'lower_body',
  'upper_body',
  'full_body',
  'squat',
  'bench',
  'deadlift',
  'conditioning',
];
const TIERS = ['bodyweight', 'dumbbells', 'fullgym'];

function build(painRegion = undefined, prof = profile, seed = 0) {
  const out = [];
  for (const type of TYPES) {
    for (const tier of TIERS) {
      const ex = generateWorkout(
        type,
        tier,
        { hasAches: !!painRegion, painRegion, energy: 'normal', timeAvailable: '60' },
        prof,
        undefined,
        undefined,
        seed
      );
      out.push({ type, tier, ex });
    }
  }
  return out;
}

/**
 * The LIFTING blocks, which is what sections 6 and 7 are about.
 *
 * Not the same set as "things that can be swapped" any more. A cooldown and a
 * rehab drill are now swappable too, within their own job, but they do not take
 * part in the kit-versus-muscle labelling those sections check: a stretch has no
 * equipment variant and offering one would be nonsense.
 */
const LIFTING = (e) => e.category !== 'cooldown' && e.category !== 'prehab';

// ─── 1. Coverage ─────────────────────────────────────────────────────────────
console.log('\n[1] Every exercise has something to swap to');

const sessions = build();

/**
 * EVERYTHING, not just the lifting.
 *
 * Archie's words: "not giving swap options for everything which is frustrating.
 * EVERYthing should be swappable at least once. sometimes twice." Measured
 * before the change, across 3,152 generated exercises, 810 of them had nothing
 * behind the button - every cooldown and 522 of 558 rehab drills - because the
 * fill returned those two categories untouched.
 *
 * The only exercise still allowed to have nothing is one the injury screen has
 * already substituted. Its swap slot holds the exercise it REPLACED, which is
 * the revert, so it is swappable once by a different route.
 */
const naked = [];
const single = [];
for (const { type, tier, ex } of sessions) {
  for (const e of ex) {
    if (e.safetyNote) continue;
    if (!e.swapName) naked.push(`${type}/${tier}: ${e.name} [${e.category}]`);
    else if (!e.swap2Name) single.push(`${type}/${tier}: ${e.name} [${e.category}]`);
  }
}
const swappable = sessions.flatMap(({ ex }) => ex.filter((e) => !e.safetyNote)).length;
check(
  `nothing is left with nothing, whatever kind of work it is (${swappable} checked)`,
  naked.length === 0,
  naked.slice(0, 6).join(' | ')
);
check(
  `and most get the second option too (${single.length} with one)`,
  single.length <= Math.ceil(swappable * 0.15),
  single.slice(0, 6).join(' | ')
);
check(
  // The guarantee, stated as the two categories that used to be exempt, so
  // reinstating the exemption fails here rather than only in the count above.
  'a cooldown and a rehab drill are no longer exempt',
  sessions.some(({ ex }) => ex.some((e) => e.category === 'cooldown' && !!e.swapName)) &&
    sessions.some(({ ex }) => ex.some((e) => e.category === 'prehab' && !!e.swapName)),
  'these two were 810 of the 3,152 exercises with no swap button at all'
);
check(
  'hasSwap agrees with actually having a swap',
  sessions.every(({ ex }) => ex.every((e) => !e.hasSwap || !!e.swapName)),
  'a swap button that opens a sheet with no alternative in it'
);

// ─── 2. The alternatives are real ────────────────────────────────────────────
console.log('\n[2] An alternative is a different exercise');

const selfSwaps = [];
const dupSwaps = [];
for (const { type, tier, ex } of sessions) {
  for (const e of ex) {
    if (e.swapName && e.swapName === e.name) selfSwaps.push(`${type}/${tier}: ${e.name}`);
    if (e.swap2Name && e.swap2Name === e.swapName) dupSwaps.push(`${type}/${tier}: ${e.name}`);
    if (e.swap2Name && e.swap2Name === e.name) selfSwaps.push(`${type}/${tier}: ${e.name}`);
  }
}
check('nothing swaps to itself', selfSwaps.length === 0, selfSwaps.slice(0, 5).join(' | '));
check(
  'the two options are not the same option',
  dupSwaps.length === 0,
  dupSwaps.slice(0, 5).join(' | ')
);

const collisions = [];
for (const { type, tier, ex } of sessions) {
  const inSession = new Set(ex.map((e) => e.name.toLowerCase()));
  for (const e of ex) {
    for (const alt of [e.swapName, e.swap2Name]) {
      if (!alt) continue;
      if (alt.toLowerCase() === e.name.toLowerCase()) continue;
      // A derived alternative should not be something already programmed today.
      // Hand-authored ones are exempt: someone chose them deliberately, and the
      // database is not aware of what else is in the session.
      if (inSession.has(alt.toLowerCase())) collisions.push(`${type}/${tier}: ${e.name} → ${alt}`);
    }
  }
}
check(
  `alternatives rarely duplicate something already in the session (${collisions.length})`,
  collisions.length <= 12,
  collisions.slice(0, 6).join(' | ')
);

// ─── 3. Safety carries into the swap ─────────────────────────────────────────
console.log('\n[3] You cannot swap into something your injury rules out');

// This is the one that would be genuinely harmful. Screening the session and
// then offering a banned exercise behind the swap button hands the user the
// thing the app just removed.
const unsafeOffers = [];
for (const region of ['knee', 'lower_back', 'front_shoulder', 'wrist']) {
  const banned = restrictedTagsFor([region], 'beginner');
  for (const { type, tier, ex } of build([region], { ...profile, experienceLevel: 'beginner' })) {
    for (const e of ex) {
      if (e.category === 'prehab') continue;
      for (const alt of [e.swapName, e.swap2Name]) {
        if (!alt) continue;
        // The injury screen sets swapName to the ORIGINAL exercise so the user
        // can put back something it removed. That is a deliberate override, not
        // a leak — it is labelled, and reverting is the user's call.
        if (e.safetyNote) continue;
        if (restrictedTagsOn(alt, banned).length > 0) {
          unsafeOffers.push(`${region} ${type}/${tier}: ${e.name} → ${alt}`);
        }
      }
    }
  }
}
check(
  'no swap offers an exercise the complaint rules out',
  unsafeOffers.length === 0,
  unsafeOffers.slice(0, 8).join(' | ')
);

// ─── 4. They move between sessions ───────────────────────────────────────────
console.log('\n[4] The same two options do not come round forever');

const a = build(undefined, profile, 0);
const b = build(undefined, profile, 7);
let compared = 0;
let differed = 0;
for (let i = 0; i < a.length; i++) {
  for (let j = 0; j < a[i].ex.length && j < b[i].ex.length; j++) {
    const x = a[i].ex[j];
    const y = b[i].ex[j];
    if (x.name !== y.name || !x.swapName || !y.swapName) continue;
    compared++;
    if (x.swapName !== y.swapName || x.swap2Name !== y.swap2Name) differed++;
  }
}
check(
  `a different session offers different alternatives (${differed}/${compared} moved)`,
  compared > 0 && differed > 0,
  'seeded on the session count, so the offered swaps rotate rather than being fixed forever'
);

// ─── 5. What is deliberately left alone ──────────────────────────────────────
console.log('\n[5] A rehab drill trades within its own job, never out of it');

const rehab = generateWorkout(
  'prehab',
  'fullgym',
  { hasAches: true, painRegion: ['knee'], energy: 'normal', timeAvailable: '45' },
  profile
);
// A rehab exercise may not be traded away — it was chosen for the sore joint,
// and swapping it for something else undoes the session. It MAY be traded down:
// an eccentric hamstring curl offering a floor slide is the regression a
// physio would give you, not an escape from the work. The line between the two
// is the regions: a permitted swap trains the same ones.
const regionsByName = getRegionsByExerciseNameMap();
const escapes = rehab
  .filter((e) => e.category === 'prehab' && e.swapName)
  .flatMap((e) => {
    const own = regionsByName[e.name] ?? [];
    return [e.swapName, e.swap2Name].filter(Boolean).map((alt) => {
      const altRegions = regionsByName[alt] ?? [];
      const staysOnTarget =
        own.length > 0 && altRegions.length > 0 && altRegions.every((r) => own.includes(r));
      return { from: e.name, to: alt, own, altRegions, staysOnTarget };
    });
  })
  .filter((s) => !s.staysOnTarget);

check(
  'a rehab session only offers swaps that stay on the injured area',
  escapes.length === 0,
  escapes
    .map(
      (s) =>
        `${s.from} [${s.own.join(', ') || 'untagged'}] → ${s.to} [${s.altRegions.join(', ') || 'untagged'}]`
    )
    .join('; ')
);

// ─── 6. Each option says what it is, and is what it says ─────────────────────
console.log('\n[6] The two options mean two different things');

/**
 * The point of the change. Both slots used to come out of one ranking, so the
 * sheet showed two alternatives and could not say why either was there. Slot
 * one is now "the same movement, different kit" and slot two is "a different
 * movement, same muscles" — and a label that is not checked is a label that
 * drifts.
 */
const templates = new Map(
  getAllPickableExercises().map((p) => [p.template.name.toLowerCase(), p.template])
);

const unlabelled = [];
const misKind = [];
const misMuscle = [];
const noReason = [];
let equipmentOffers = 0;
let movementOffers = 0;

for (const { type, tier, ex } of sessions) {
  for (const e of ex.filter(LIFTING)) {
    const source = templates.get(e.name.toLowerCase());
    const self = {
      name: e.name,
      equipmentRequired: source?.equipmentRequired,
      movementPattern: source?.movementPattern,
      primaryMuscle: e.primaryMuscle ?? source?.primaryMuscle,
    };
    for (const [name, kind, reason] of [
      [e.swapName, e.swapKind, e.swapReason],
      [e.swap2Name, e.swap2Kind, e.swap2Reason],
    ]) {
      if (!name) continue;
      if (!kind) unlabelled.push(`${type}/${tier}: ${e.name} → ${name}`);
      if (!reason) noReason.push(`${type}/${tier}: ${e.name} → ${name}`);
      if (kind === 'equipment') equipmentOffers++;
      if (kind === 'movement') movementOffers++;

      const candidate = templates.get(String(name).toLowerCase());
      if (!candidate || !source) continue;

      // An equipment option must actually be one.
      if (kind === 'equipment' && !isEquipmentVariant(self, candidate)) {
        misKind.push(`${type}/${tier}: ${e.name} → ${name}`);
      }
      // A movement option that NAMES a muscle group must share it. The generic
      // fallback wording is allowed not to: 63 of the 689 templates record no
      // muscle group at all, and saying "for the same job" is the honest answer
      // there.
      if (kind === 'movement' && reason && /same (.+) work\./.test(reason)) {
        const named = /same (.+) work\./.exec(reason)[1];
        const group = muscleGroupOf(candidate.primaryMuscle);
        if (!group || MUSCLE_GROUP_LABELS[group] !== named) {
          misMuscle.push(`${type}/${tier}: ${e.name} → ${name} (says "${named}")`);
        }
      }
    }
  }
}

check(
  `every option offered says which of the two it is (${equipmentOffers} kit, ${movementOffers} muscle)`,
  unlabelled.length === 0,
  unlabelled.slice(0, 6).join(' | ')
);
check(
  'and carries the line explaining it',
  noReason.length === 0,
  noReason.slice(0, 6).join(' | ')
);
check(
  'an option labelled "same exercise, different kit" is one',
  misKind.length === 0,
  misKind.slice(0, 6).join(' | ')
);
check(
  'and one that names a muscle group trains it',
  misMuscle.length === 0,
  misMuscle.slice(0, 6).join(' | ')
);

/**
 * Coverage, stated rather than assumed. Only about a third of working-block
 * exercises HAVE an equipment variant — a push-up and a Nordic curl have no
 * other way to be loaded — so the promise is "two labelled options", not "one
 * of each". This asserts the equipment slot is genuinely working, without
 * pretending it can always be filled.
 */
const working = sessions
  .flatMap(({ ex }) => ex)
  .filter((e) => ['main', 'accessory', 'explosive', 'finisher', 'core'].includes(e.category));
const withKit = working.filter(
  (e) => e.swapKind === 'equipment' || e.swap2Kind === 'equipment'
).length;
check(
  `a meaningful share of the lifting gets a kit alternative (${withKit}/${working.length})`,
  working.length > 0 && withKit >= Math.floor(working.length * 0.2),
  'if this drops, the equipment rule has stopped matching anything'
);

/**
 * Checked against kitOf directly rather than against isEquipmentVariant, which
 * is the function under test and will happily agree with itself. Delete the
 * "the kit must differ" line from the rule and every check that asks the rule
 * whether it was obeyed still passes.
 */
const sameKitOffers = [];
for (const { type, tier, ex } of sessions) {
  for (const e of ex.filter(LIFTING)) {
    const source = templates.get(e.name.toLowerCase());
    if (!source) continue;
    for (const [name, kind] of [
      [e.swapName, e.swapKind],
      [e.swap2Name, e.swap2Kind],
    ]) {
      if (kind !== 'equipment' || !name) continue;
      const candidate = templates.get(String(name).toLowerCase());
      if (!candidate) continue;
      const from = kitOf(e.name, source.equipmentRequired);
      const to = kitOf(candidate.name, candidate.equipmentRequired);
      if (!from || !to || from === to) {
        sameKitOffers.push(`${type}/${tier}: ${e.name} [${from}] → ${name} [${to}]`);
      }
    }
  }
}
check(
  'a kit alternative genuinely uses different kit',
  sameKitOffers.length === 0,
  sameKitOffers.slice(0, 6).join(' | ')
);

/** The alternatives a physiotherapist wrote onto the template itself. Those are
 *  a considered choice and are exempt below - a Band Pull-Apart is filed as
 *  prehab and is still the right regression for an inverted row somebody cannot
 *  yet do. The rule is for what the app derives on its own. */
const authoredFor = (t) =>
  new Set([
    ...(t.injuryFriendlyAlternatives ?? []),
    t.swapAlternative?.name,
    t.comfortVariant?.name,
  ].filter(Boolean));

/**
 * A main lift's alternative has to be able to carry the main lift's sets and
 * reps, because a swap keeps the slot's prescription. Without the
 * same-category rule a barbell deadlift was offered a Supine Spinal Twist -
 * both are lower-back work, one of them is a stretch you hold on the floor.
 */
const wrongBlock = [];
for (const { type, tier, ex } of [...sessions, ...b]) {
  for (const e of ex.filter((x) =>
    ['main', 'accessory', 'explosive', 'finisher', 'core'].includes(x.category)
  )) {
    const from = templates.get(e.name.toLowerCase());
    const authored = from ? authoredFor(from) : new Set();
    for (const name of [e.swapName, e.swap2Name]) {
      if (!name) continue;
      const candidate = templates.get(String(name).toLowerCase());
      if (!candidate) continue;
      if (authored.has(candidate.name)) continue;
      if (candidate.category === 'cooldown' || candidate.category === 'prehab') {
        wrongBlock.push(`${type}/${tier}: ${e.name} (${e.category}) → ${name} (${candidate.category})`);
      }
    }
  }
}
check(
  'no lifting block is offered a stretch or a rehab drill instead',
  wrongBlock.length === 0,
  wrongBlock.slice(0, 6).join(' | ')
);

/**
 * And across the rotations the sessions above do not reach.
 *
 * Which same-muscle alternative comes up is seeded on the session count, so a
 * rule that leaks on the third session leaks past a test that only builds the
 * first. Sweeping the seed on the bodyweight tier is where it shows: that tier
 * has the fewest loaded alternatives, so the search runs furthest down the
 * list and reaches the stretches soonest.
 */
const seedSweep = [];
for (let seed = 0; seed < 12; seed++) {
  for (const type of ['upper_body', 'bench', 'deadlift']) {
    const ex = generateWorkout(
      type,
      'bodyweight',
      { hasAches: false, energy: 'normal', timeAvailable: '60' },
      profile,
      undefined,
      undefined,
      seed
    );
    for (const e of ex) {
      if (!['main', 'accessory', 'explosive', 'finisher', 'core'].includes(e.category)) continue;
      const from = templates.get(e.name.toLowerCase());
      const authored = from ? authoredFor(from) : new Set();
      for (const name of [e.swapName, e.swap2Name]) {
        if (!name || authored.has(name)) continue;
        const candidate = templates.get(String(name).toLowerCase());
        if (!candidate) continue;
        if (candidate.category === 'cooldown' || candidate.category === 'prehab') {
          seedSweep.push(
            `seed ${seed} ${type}: ${e.name} → ${name} (${candidate.category})`
          );
        }
      }
    }
  }
}
check(
  'and not on any of the first twelve rotations either',
  seedSweep.length === 0,
  [...new Set(seedSweep)].slice(0, 6).join(' | ')
);

// ─── 7. The two cases that were asked for ────────────────────────────────────
console.log('\n[7] The examples the change was specified with');

const T = (name) => templates.get(name.toLowerCase());

check(
  'a cable Pallof press offers the banded one as the same movement',
  isEquipmentVariant(T('Pallof Press'), T('Banded Pallof Press')),
  'the exact case: one movement, two pieces of kit'
);
check(
  'and NOT as a different exercise, because it is the same exercise',
  !isSameMuscleAlternative(T('Pallof Press'), T('Banded Pallof Press')),
  'an alternative that satisfies both belongs in the kit slot, or it is offered twice'
);
check(
  'a shoulder press offers a lateral raise as different work for the same muscles',
  isSameMuscleAlternative(T('DB Shoulder Press'), T('DB Lateral Raise')),
  'Anterior deltoid and Lateral deltoid are two strings for one muscle group'
);
check(
  'and NOT as the same movement with other kit',
  !isEquipmentVariant(T('DB Shoulder Press'), T('DB Lateral Raise')),
  'pressing and raising are not the same movement'
);
check(
  'standing and seated versions of a lift are the same lift',
  isEquipmentVariant(T('Calf Raise'), T('Standing Calf Raise')) &&
    isEquipmentVariant(T('Overhead Press'), T('Standing Overhead Press')) &&
    isEquipmentVariant(T('Cable Lateral Raise'), T('Seated DB Lateral Raise')),
  'the position you are in is not the exercise - these differ only by a setup word and the kit'
);
check(
  'but an incline is not a setup word, it is a different exercise',
  !isEquipmentVariant(T('Barbell Bench Press'), T('Incline DB Press')) &&
    !isEquipmentVariant(T('Push-Up'), T('Incline Push-Up')) &&
    !isEquipmentVariant(T('Push-Up'), T('Deficit Push-Up')),
  'incline, decline and deficit change what the lift trains; seated and standing do not'
);
check(
  'but not a Spanish squat, which is a different exercise ending in the same word',
  !isEquipmentVariant(T('Back Squat'), T('Spanish Squat')) &&
    !isEquipmentVariant(T('Back Squat'), T('Sissy Squat')),
  'same pattern, same muscle, same last word - and a band-loaded knee rehab movement is not a barbell squat with different kit'
);
check(
  'a barbell back squat offers a goblet squat when the rack is taken',
  isEquipmentVariant(T('Back Squat'), T('Goblet Squat')),
  'the catalogue names squat variations after where the weight sits, not after the kit, so the exact-name rule cannot see this one'
);

/**
 * The near rule compares the last word of two names, which is the movement
 * right up until a name ends in Warm-Up, Intervals or Drill. Left open it
 * offered a Rowing Machine Warm-Up as "the same movement with dumbbells" as a
 * goblet squat warm-up.
 */
check(
  'a rowing warm-up is not the same movement as a squat warm-up',
  !isEquipmentVariant(T('Rowing Machine Warm-Up'), T('Goblet Squat + Arm Swing Warm-Up')),
  'both names end in "Up", and that is all they have in common'
);
check(
  'nor is one three-movement round the same movement as another',
  !isEquipmentVariant(
    T('Sled Push + Fast Bear Crawl + Assault Bike'),
    T('Prowler Push/Pull + Bike')
  ),
  'same pattern, same muscle, both ending in "Bike", different kit - and still two different circuits'
);
check(
  'and leg press intervals are not dumbbell lunge intervals',
  !isEquipmentVariant(T('Leg Press Intervals'), T('DB Lunge Intervals')),
  'a round of something is not one movement'
);
check(
  'the kit comes from the name when the equipment field disagrees with it',
  kitOf('Cable Bicep Curl', 'barbell') === 'cable machine' &&
    kitOf('Banded Pallof Press', 'bodyweight') === 'resistance band',
  '51 of the 689 templates have an equipmentRequired that describes the tier rather than the tool'
);
check(
  'and "full gym" is treated as no answer, because nobody picks up a full gym',
  kitOf('Sled Row', 'full gym') === 'sled' && kitOf('Some Unnamed Lift', 'full gym') === null,
  'a tier is not a piece of equipment'
);
check(
  'a variation in brackets is not an equipment variant of the plain movement',
  movementCoreOf('Pallof Press (Isometric Hold)') !== movementCoreOf('Pallof Press'),
  'same tool, different exercise — exactly the confusion the split is meant to remove'
);

// ─── 8. The sheet is a choice, not a queue ───────────────────────────────────
console.log('\n[8] Both options are on screen at once');

const sessionSrc = readFileSync(join(__dir, '../app/session.tsx'), 'utf8');
// Comments quote the old copy in order to explain what replaced it, so the
// assertions below read the source with them taken out.
const sessionCode = sessionSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

check(
  'both alternatives are rendered together',
  /testID={\`swap-option-/.test(sessionSrc) &&
    sessionSrc.includes('options.map((option) =>'),
  'the old sheet showed one at a time, so seeing the second meant accepting the first'
);
check(
  'picking one sets the choice rather than incrementing it',
  /handleSwapChoice = useCallback\(\(index: number, choice: 0 \| 1 \| 2\)/.test(sessionSrc) &&
    !sessionCode.includes('handleSwapConfirm'),
  'a cycle cannot be gone back through'
);
check(
  'and there is a way back to the original',
  sessionSrc.includes('testID="swap-revert"') &&
    sessionSrc.includes('handleSwapChoice(swapModal.index, 0)'),
  'once swapped, the old sheet had no route back to what the app had programmed'
);
check(
  'the dead end is gone',
  !sessionCode.includes('No further alternatives are available for this exercise'),
  'that message was the third tap of a three-tap cycle'
);
check(
  'each option is headed by what it is',
  sessionSrc.includes('SWAP_KIND_HEADINGS[option.kind]') &&
    SWAP_KIND_HEADINGS.equipment === 'Same exercise, different kit' &&
    SWAP_KIND_HEADINGS.movement === 'Different exercise, same muscles',
  'two options with no labels is the problem this replaced'
);
// Both IDEAS, not one exact sentence. The tour was reworded when the session
// screen became one exercise at a time, and pinning the spelling failed a
// rewrite that still described both options - which is the defect this repo
// keeps producing, in the check rather than in the app.
check(
  'and the tutorial promises what the sheet now does',
  /same exercise with different equipment/i.test(sessionSrc) &&
    /different exercise for the same muscles/i.test(sessionSrc),
  'the tour said "an alternative for the same muscle group", which was half of it: it has to name both kinds'
);

console.log('');
if (failures > 0) {
  console.error(`swap-options: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`swap-options: all ${total} checks passed\n`);
  process.exitCode = 0;
}
