/**
 * Contract test: the Restore tab is left alone, and its swap button stays
 * inside Restore.
 *
 * WHAT THIS FILE USED TO DO, AND WHY IT HAD TO STOP
 * ────────────────────────────────────────────────
 * It read lib/exercise-db.ts as text, found every `category: 'main'` and
 * `category: 'accessory'` block by counting braces, and asserted that each one
 * contained the characters `swapAlternative:`. Then it asserted that
 * lib/workout-engine.ts contained the string `swapAlternative ?? t.comfortVariant`.
 *
 * Every Train session is built from Archie's library now, and the swap sheet is
 * FILLED rather than hand-authored - see fillSwapAlternatives, and
 * tests/swap-options.check.mjs, which holds that promise over generated
 * sessions. So the old assertions were counting annotations on templates that
 * no session reaches, in a file that is being retired, while saying nothing
 * about the button anybody actually taps.
 *
 * WHAT IT HOLDS INSTEAD
 * ─────────────────────
 * The half of the swap promise swap-options does not cover: the Restore tab.
 *
 * Archie's instruction about Restore is one line - leave it alone - and the
 * sessions themselves always obeyed it. The button did not. The sheet is filled
 * from the whole pickable catalogue, which deep-walks every Train pool, so a
 * fifth of the filled swap slots on a Restore session offered something Restore
 * does not prescribe: measured over 2,800 sessions, 7,392 of 37,366 slots, 62
 * distinct names. The Mobility session's Diaphragmatic Breathing card offered a
 * Med Ball Slam and a Hanging Leg Raise. A rehab drill offered an Assault Bike
 * warm-up. An acute protocol offered a Tib Raise out of the Train prehab pool.
 *
 *   [1] the CARDS are byte for byte what they were before the boundary landed
 *   [2] every alternative offered on a Restore card has a Restore row
 *   [3] the button is there where Restore has something to offer, and honestly
 *       absent where it has not
 *   [4] the boundary is Restore's alone - a Train session still reaches the
 *       whole catalogue, so this cannot be "fixed" by restricting everything
 *   [5] the session screen still gates the button on hasSwap
 *
 * THE FIXTURE, AND HOW TO REGENERATE IT
 * ─────────────────────────────────────
 * tests/helpers/restore-session-content.json holds one digest per session over
 * the card content only - name, category, sets, reps, cue, load - with the swap
 * slots deliberately left out, because those are what this phase changed. It
 * was generated from the code as it stood at 14d8feb, before any of it. Run
 * `npx tsx tests/swap-alternative-coverage.check.mjs --write` to rebuild it,
 * and only do that when Restore content is MEANT to change.
 *
 * Run:  npx tsx tests/swap-alternative-coverage.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

/**
 * TODAY IS PINNED BEFORE THE ENGINE IS LOADED.
 *
 * Restore rotates its middle block on a local day index, and the Mobility
 * session alternates between two halves of the stretch pool on even and odd
 * days, so the same inputs give different sessions tomorrow. A fixture of real
 * content cannot be compared without fixing that.
 *
 * Only a zero-argument `new Date()` is redirected - which is exactly what
 * getLocalDayIndex calls - and its three calendar getters are answered with a
 * fixed day, so the index is the same in every timezone rather than the same on
 * this machine. Everything else about Date is untouched.
 */
const FIXED_YEAR = 2026;
const FIXED_MONTH = 0;
const FIXED_DAY = 15;
{
  const RealDate = Date;
  const fixed = () => {
    const d = new RealDate(RealDate.UTC(FIXED_YEAR, FIXED_MONTH, FIXED_DAY, 12, 0, 0));
    d.getFullYear = () => FIXED_YEAR;
    d.getMonth = () => FIXED_MONTH;
    d.getDate = () => FIXED_DAY;
    return d;
  };
  globalThis.Date = new Proxy(RealDate, {
    construct(target, args) {
      return args.length === 0 ? fixed() : new target(...args);
    },
  });
}

import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { generateWorkout, fillSwapAlternatives, RESTORE_SESSION_TYPES } = await import(
  '../lib/workout-engine.ts'
);
const { getRestoreExercises } = await import('../lib/exercise-db.ts');
const { RESTRICTED_BY_REGION, SCREEN_EXEMPT_SESSION_TYPES } = await import(
  '../lib/exercise-safety.ts'
);

const __dir = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dir, 'helpers/restore-session-content.json');
const WRITE = process.argv.includes('--write');

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

const REGIONS = Object.keys(RESTRICTED_BY_REGION);
const TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
const SEEDS = [0, 3];
const profile = {
  name: 'T',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['muscle'],
  bodyweightKg: 80,
};

/** Every Restore session the tab can build, at fixed seeds and a fixed day. */
const flows = [];
for (const seed of SEEDS) {
  flows.push({ id: `recovery/s${seed}`, type: 'prehab', readiness: { hasAches: false } , seed });
  flows.push({ id: `mobility/s${seed}`, type: 'flexibility', readiness: { hasAches: false }, seed });
  for (const region of REGIONS) {
    flows.push({
      id: `targeted-${region}/s${seed}`,
      type: 'prehab',
      readiness: { hasAches: true, painRegion: region },
      seed,
    });
    flows.push({
      id: `acute-${region}/s${seed}`,
      type: 'prehab',
      readiness: { hasAches: true, painRegion: region, acute: true },
      seed,
    });
  }
}

const built = [];
for (const flow of flows) {
  for (const tier of TIERS) {
    const exercises = generateWorkout(
      flow.type,
      tier,
      { energy: 'normal', timeAvailable: '30', ...flow.readiness },
      profile,
      undefined,
      undefined,
      flow.seed,
      undefined,
      undefined,
      undefined,
      null
    );
    built.push({ key: `${flow.id}/${tier}`, exercises });
  }
}

/**
 * The card, with the swap slots left out on purpose.
 *
 * What the user is prescribed is what must not have moved. What is offered
 * behind the button is what this phase set out to change, so folding it into
 * the same digest would make the fixture fail for the right reason and say the
 * wrong thing.
 */
const cardContent = (exercises) =>
  exercises
    .map(
      (e) =>
        `${e.category}|${e.id}|${e.name}|${e.sets}|${e.reps}|${e.cue}|${e.suggestedLoad}|${e.badge ?? ''}|${e.safetyNote ?? ''}`
    )
    .join('\n');
const digest = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

if (WRITE) {
  const out = {
    note: 'Generated by tests/swap-alternative-coverage.check.mjs --write. Card content only, swap slots excluded. Regenerate ONLY when Restore content is meant to change.',
    day: `${FIXED_YEAR}-${String(FIXED_MONTH + 1).padStart(2, '0')}-${FIXED_DAY}`,
    sample: built[0].exercises.map((e) => ({
      category: e.category,
      id: e.id,
      name: e.name,
      sets: e.sets,
      reps: e.reps,
    })),
    sessions: Object.fromEntries(built.map((b) => [b.key, digest(cardContent(b.exercises))])),
  };
  writeFileSync(FIXTURE, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nwrote ${Object.keys(out.sessions).length} session digests to ${FIXTURE}\n`);
  process.exit(0);
}

// ─── 1. The cards have not moved ─────────────────────────────────────────────
console.log('\n[1] Restore session content is byte for byte what it was');

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
check(
  `the fixture holds a digest for every session built (${built.length})`,
  built.length > 300 && Object.keys(fixture.sessions).length === built.length,
  `${Object.keys(fixture.sessions).length} in the fixture against ${built.length} built - a sweep and a fixture that disagree on which sessions exist prove nothing`
);
const moved = built.filter((b) => fixture.sessions[b.key] !== digest(cardContent(b.exercises)));
check(
  'not one Restore card changed name, sets, reps, cue or load',
  moved.length === 0,
  moved
    .slice(0, 5)
    .map((b) => b.key)
    .join(', ')
);
check(
  'and the sample session in the fixture is still the session it names',
  cardContent(built[0].exercises).startsWith(
    `${fixture.sample[0].category}|${fixture.sample[0].id}|${fixture.sample[0].name}|`
  ),
  'a fixture regenerated against broken code would agree with itself; this is the one card written out in full so a human can read it'
);

// ─── 2. The alternatives stay inside Restore ─────────────────────────────────
console.log('\n[2] Every alternative on a Restore card is work Restore prescribes');

const restoreNames = new Set(getRestoreExercises().map((t) => t.name.toLowerCase()));
check(
  `Restore holds enough of its own work to draw on (${restoreNames.size} movements)`,
  restoreNames.size > 100,
  'if this list is thin the boundary below would be doing something else'
);
check(
  'and the two lists of "which sessions are Restore" agree with each other',
  [...RESTORE_SESSION_TYPES].sort().join(',') ===
    [...SCREEN_EXEMPT_SESSION_TYPES].sort().join(','),
  `the swap boundary reads ${RESTORE_SESSION_TYPES.join('/')} and the injury screen exempts ${SCREEN_EXEMPT_SESSION_TYPES.join('/')} - a session in one list and not the other is half looked after`
);

const leaked = [];
let filled = 0;
let cards = 0;
for (const { key, exercises } of built) {
  for (const ex of exercises) {
    cards++;
    for (const name of [ex.swapName, ex.swap2Name]) {
      if (!name) continue;
      filled++;
      if (!restoreNames.has(name.toLowerCase())) leaked.push(`${key}: ${ex.name} offers ${name}`);
    }
  }
}
/**
 * The floor is tied to the CARDS rather than to a number that was true once.
 *
 * It read "more than 5,000 slots" and measured 4,843 after the purge - not
 * because Restore lost anything, but because a Restore session no longer draws
 * its alternatives from a seven-hundred-entry catalogue it should never have
 * been reaching into. What matters to the rule underneath is that the sheet is
 * actually being filled, and the honest way to say that is per card: Archie's
 * rule is that everything is swappable at least once, so a sweep in which the
 * slots outnumber the cards is a sweep with something to look at.
 */
check(
  `the sweep really filled swap slots (${filled} across ${cards} cards)`,
  cards > 0 && filled > cards,
  'nothing was offered, so the rule below proves nothing'
);
check(
  'no Restore card offers an exercise Restore does not prescribe',
  leaked.length === 0,
  `${leaked.length} slots, for example: ${leaked.slice(0, 3).join(' | ')}`
);

const cardsOffList = built.flatMap(({ key, exercises }) =>
  exercises.filter((e) => !restoreNames.has(e.name.toLowerCase())).map((e) => `${key}: ${e.name}`)
);
check(
  'and no Restore card is one either, which was always true and has to stay true',
  cardsOffList.length === 0,
  cardsOffList.slice(0, 3).join(' | ')
);

/**
 * AND THE SAME BOUNDARY ON WHAT SOMEBODY WROTE ONTO THE TEMPLATE BY HAND.
 *
 * An authored alternative is a name, a cue and a load with frequently no
 * catalogue entry of its own, so it does not go through the pool the sweep
 * above measures - it is read straight off the card. No Restore warm-up
 * carries one today, which is exactly why this is asked directly rather than
 * left to the sweep: it would be silently unguarded until the day somebody adds
 * one. One Restore drill already carries an off-Restore authored alternative
 * (the Nordic curl negative offers a Sliding Leg Curl), and it is only out of
 * reach because a rehab drill takes a different path through the fill.
 *
 * Asked BOTH ways round, so this cannot pass by the boundary being applied to
 * everything: the same card outside Restore keeps the offer.
 */
const handAuthored = (sessionType) =>
  fillSwapAlternatives(
    [
      {
        id: 'ph-s-1',
        name: 'Cardio Warm-Up (Easy Walk / Bike)',
        category: 'prep',
        sets: 1,
        reps: '3 min',
        cue: 'Easy pace, nose breathing',
        suggestedLoad: 'Bodyweight',
        hasSwap: true,
        swapName: 'Bear Crawl',
        swapCue: 'Knees an inch off the floor',
      },
    ],
    { hasAches: false, energy: 'normal', timeAvailable: '30' },
    'bodyweight',
    profile,
    0,
    sessionType
  )[0];
const insideRestore = handAuthored('prehab');
const outsideRestore = handAuthored(undefined);
check(
  'a hand-written alternative on a Restore card is held to Restore as well',
  ![insideRestore.swapName, insideRestore.swap2Name].includes('Bear Crawl'),
  `offered ${insideRestore.swapName} and ${insideRestore.swap2Name}`
);
check(
  'and the same card outside Restore still gets it, so the rule is the tab and not the fill',
  [outsideRestore.swapName, outsideRestore.swap2Name].includes('Bear Crawl'),
  `offered ${outsideRestore.swapName} and ${outsideRestore.swap2Name} - if this fails the two halves cannot tell each other apart`
);

// ─── 3. The button is there, or honestly absent ──────────────────────────────
console.log('\n[3] The button is there where Restore has something to offer');

const allCards = built.flatMap(({ key, exercises }) => exercises.map((e) => ({ key, e })));
const openingAndClosing = allCards.filter(
  ({ e }) => e.category === 'prep' || e.category === 'cooldown'
);
const emptyBookends = openingAndClosing.filter(({ e }) => !e.hasSwap);
check(
  `every warm-up and cool-down card keeps an alternative (${openingAndClosing.length} cards)`,
  openingAndClosing.length > 500 && emptyBookends.length === 0,
  emptyBookends
    .slice(0, 5)
    .map(({ key, e }) => `${key}: ${e.name}`)
    .join(' | ')
);

const drills = allCards.filter(({ e }) => e.category === 'prehab');
const withButton = drills.filter(({ e }) => e.hasSwap).length;
check(
  `most rehab drills still have somewhere to go (${withButton} of ${drills.length})`,
  drills.length > 500 && withButton / drills.length > 0.7,
  'a drill is held to the regions it is tagged with, so some have nothing - but if most have nothing the tagging has broken'
);

const lying = allCards.filter(({ e }) => e.hasSwap !== !!e.swapName);
check(
  'and no card claims a button it has nothing behind',
  lying.length === 0,
  lying
    .slice(0, 5)
    .map(({ key, e }) => `${key}: ${e.name}`)
    .join(' | ')
);

// ─── 4. The boundary belongs to Restore alone ────────────────────────────────
console.log('\n[4] Train is not quietly restricted by the same rule');

const trainOffers = new Set();
for (const type of ['lower_body', 'upper_body', 'full_body']) {
  for (const tier of TIERS) {
    const session = generateWorkout(
      type,
      tier,
      { hasAches: false, energy: 'normal', timeAvailable: '60' },
      profile,
      undefined,
      undefined,
      0,
      undefined,
      undefined,
      undefined,
      null,
      'kg',
      undefined,
      undefined,
      0,
      { equipment: [tier], sessionTypeCount: 0 }
    );
    for (const ex of session) {
      for (const name of [ex.swapName, ex.swap2Name]) {
        if (name && !restoreNames.has(name.toLowerCase())) trainOffers.add(name);
      }
    }
  }
}
check(
  `a Train session still offers work from outside Restore (${trainOffers.size} distinct)`,
  trainOffers.size > 20,
  'the boundary is meant to apply to the Restore tab only; applied everywhere it would empty the Train swap sheet'
);

// ─── 5. The screen still gates on it ─────────────────────────────────────────
console.log('\n[5] The screen still gates the button on hasSwap');

const sessionSrc = readFileSync(join(__dir, '../app/session.tsx'), 'utf8');
check(
  'the swap control is gated on exercise.hasSwap in app/session.tsx',
  sessionSrc.includes('exercise.hasSwap'),
  'without the gate a card with nothing behind the button still shows one'
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`swap-alternative-coverage: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`swap-alternative-coverage: all ${total} checks passed\n`);
  process.exitCode = 0;
}
