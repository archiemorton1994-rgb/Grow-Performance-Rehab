/**
 * Contract test: the swap button always has something to offer.
 *
 * WHY THIS MATTERS
 * ────────────────
 * "Tap the swap icon on any card to get an alternative for the same muscle
 * group. Useful if equipment is taken or something hurts." That is what the
 * in-session tutorial promises. What it delivered depended entirely on whether
 * someone had hand-written an alternative onto that particular template.
 *
 * Measured across the 447 pickable exercises before this change:
 *
 *   226  have both swapAlternative and comfortVariant  → two options
 *   103  have only swapAlternative                     → ONE option, forever
 *   118  have neither                                  → the button does nothing
 *
 * So for a quarter of the catalogue the swap button was inert, and for another
 * quarter it offered a single fixed answer — the same substitute today, next
 * week and next year. "The rack is taken" is not a problem one alternative
 * solves.
 *
 * These assertions run the REAL generator across session types, tiers and
 * complaints, because the fill happens at generation time and has to survive
 * everything layered on top of it — comfort variants, grip variants, kettlebell
 * renaming and the injury screen.
 *
 * Run:  npx tsx tests/swap-options.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { generateWorkout } from '../lib/workout-engine.ts';
import { restrictedTagsFor, restrictedTagsOn } from '../lib/exercise-safety.ts';
import { getRegionsByExerciseNameMap } from '../lib/exercise-db.ts';

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

const TYPES = ['lower_body', 'upper_body', 'full_body', 'squat', 'bench', 'conditioning'];
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

// Cooldowns and rehab work are deliberately left alone — see fillSwapAlternatives.
const SWAPPABLE = (e) => e.category !== 'cooldown' && e.category !== 'prehab';

// ─── 1. Coverage ─────────────────────────────────────────────────────────────
console.log('\n[1] Every swappable exercise has something to swap to');

const sessions = build();
const naked = [];
const single = [];
for (const { type, tier, ex } of sessions) {
  for (const e of ex.filter(SWAPPABLE)) {
    if (!e.swapName) naked.push(`${type}/${tier}: ${e.name}`);
    else if (!e.swap2Name) single.push(`${type}/${tier}: ${e.name}`);
  }
}
const swappable = sessions.flatMap(({ ex }) => ex.filter(SWAPPABLE)).length;
check(
  `no swappable exercise is left with nothing (${swappable} checked)`,
  naked.length === 0,
  naked.slice(0, 6).join(' | ')
);
check(
  `and almost none is left with only one (${single.length})`,
  single.length <= Math.ceil(swappable * 0.05),
  single.slice(0, 6).join(' | ')
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
console.log('\n[5] Rehab and cooldowns keep their hands off');

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

console.log('');
if (failures > 0) {
  console.error(`swap-options: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`swap-options: all ${total} checks passed\n`);
  process.exitCode = 0;
}
