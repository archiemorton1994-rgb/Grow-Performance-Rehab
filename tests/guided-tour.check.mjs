/**
 * Contract test: the guided tour is a chain, it is short, and every step points
 * at something real.
 *
 * WHAT WAS WRONG
 * ──────────────
 * The first-run tour ran to EIGHTEEN cards across five tabs before the user had
 * done anything. Length was the whole problem — nobody reads eighteen, so the
 * steps that mattered were never reached — and the cuts were not arbitrary:
 *
 *   Five steps described data a first-run user does not have. A training block
 *   with no sessions in it, a program rotation that has not started, badges
 *   nobody has earned, and two panels whose own copy said they would "fill in
 *   as you log sessions".
 *
 *   The streak was explained three times: Home, then Profile, then Stats.
 *
 *   One step spotlighted a section headed ADDITIONAL SESSIONS, containing four
 *   cards named Lower Body, Upper Body, Full Body and Conditioning, in order to
 *   say they were four ways to train.
 *
 * It is twelve now, and the tour ends on Profile rather than starting there —
 * you learn to train before you learn where the settings live.
 *
 * WHAT THIS ASSERTS
 * ─────────────────
 * The structural facts that break silently. A step whose spotlightRef has no
 * matching ref spotlights nothing and the card floats over a dimmed screen with
 * no explanation. A broken hand-off strands the user mid-tour on a tab with no
 * way forward. Neither shows up in a typecheck, and neither is visible unless
 * somebody walks the whole tour by hand on a fresh install.
 *
 * Run:  npx tsx tests/guided-tour.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';

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

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Tab indices are fixed by the tab bar: Home 0, Profile 1, Train 2, Restore 3, Stats 4. */
const TOURS = [
  { name: 'Home', file: 'app/(tabs)/index.tsx', constName: 'HOME_TUTORIAL', tab: 0, handsOffTo: 2 },
  { name: 'Train', file: 'app/(tabs)/train.tsx', constName: 'TRAIN_TUTORIAL', tab: 2, handsOffTo: 3 },
  { name: 'Restore', file: 'app/(tabs)/recover.tsx', constName: 'RESTORE_TUTORIAL', tab: 3, handsOffTo: 4 },
  { name: 'Stats', file: 'app/(tabs)/workouts.tsx', constName: 'STATS_TUTORIAL', tab: 4, handsOffTo: 1 },
  { name: 'Profile', file: 'app/(tabs)/profile.tsx', constName: 'PROFILE_TUTORIAL', tab: 1, handsOffTo: null },
];

/** The block of a named const array, up to its closing `] as const;`. */
function blockOf(src, constName) {
  const i = src.indexOf(`const ${constName}`);
  if (i === -1) return null;
  const end = src.indexOf('] as const;', i);
  return end === -1 ? null : src.slice(i, end);
}

/**
 * Only the words the USER reads — the title and body strings.
 *
 * Every copy assertion below has to go through this. Scanning raw source
 * matches the comments that explain the copy, and those comments quote the
 * very phrases being checked for: a first version of this file passed a
 * "the pain step mentions its pain limit" check against a comment saying the
 * step comes with a pain limit, while the sentence the user reads had been
 * deleted. A test that reads source has to be told which part of it is the
 * product.
 */
function userFacingCopy(block) {
  return [...block.matchAll(/\b(?:title|body):\s*(['"`])((?:\\.|(?!\1).)*)\1/g)]
    .map((m) => m[2])
    .join(' \n ');
}

// ── 1. Every step points at a ref the screen actually creates ────────────────
console.log('\n[1] Every step spotlights something that exists');
let grandTotal = 0;
for (const t of TOURS) {
  const src = read(t.file);
  const block = blockOf(src, t.constName);
  if (!block) {
    check(`${t.name}: ${t.constName} found`, false, 'the tour array could not be located');
    continue;
  }
  const refs = [...block.matchAll(/spotlightRef:\s*'([a-zA-Z]+)'/g)].map((m) => m[1]);
  const steps = [...block.matchAll(/\btitle:\s*/g)].length;
  grandTotal += steps;

  check(`${t.name}: ${steps} step(s), all with a spotlight`, steps > 0 && refs.length === steps,
    `${steps} titles but ${refs.length} spotlightRefs`);

  /**
   * Every name a step asks for has to resolve to a real React ref, or the
   * spotlight silently does nothing and the card floats over a dimmed screen.
   *
   * Two shapes in the codebase, and neither is checked by TypeScript:
   *   a `refLookup` object literal mapping name -> ref (Home, Train, Stats,
   *   Profile), and Restore's `navRefs.current[key]`, a
   *   Record<string, View|null> populated from the `key:` of each card it
   *   renders. `string` keys mean a typo compiles perfectly.
   */
  const lookupAt = src.indexOf('refLookup');
  const registered =
    lookupAt !== -1
      ? src.slice(lookupAt, lookupAt + 400)
      : // Fall back to the keys of the rows the screen renders.
        [...src.matchAll(/key:\s*'([a-zA-Z_]+)'/g)].map((m) => m[1]).join(' : ') + ' :';
  const missing = [...new Set(refs)].filter((r) => !new RegExp(`\\b${r}\\s*:`).test(registered));
  check(`${t.name}: every ref resolves to a real element`, missing.length === 0, missing.join(', '));
}

// ── 2. The chain is unbroken ─────────────────────────────────────────────────
// A wrong hand-off strands the user on a tab with the tour half finished.
console.log('\n[2] Each tab hands off to the next, and the last one ends it');
for (const t of TOURS) {
  const src = read(t.file);
  const expected =
    t.handsOffTo === null ? /setTourActiveTab\(null\)/ : new RegExp(`setTourActiveTab\\(${t.handsOffTo}\\)`);
  check(
    `${t.name} -> ${t.handsOffTo === null ? 'end' : TOURS.find((x) => x.tab === t.handsOffTo)?.name}`,
    expected.test(src),
    'the hand-off target is wrong or missing'
  );
}

// Every tab is reached exactly once, and nothing points back into the chain.
const targets = TOURS.map((t) => t.handsOffTo).filter((n) => n !== null);
check(
  'the chain visits every tab once and only once',
  new Set(targets).size === targets.length && targets.length === TOURS.length - 1,
  `hand-off targets: ${targets.join(' -> ')}`
);

// ── 3. It is short enough to be read ─────────────────────────────────────────
console.log('\n[3] The first-run tour stays short');
const CEILING = 14;
check(
  `${grandTotal} steps across five tabs (was 18, ceiling ${CEILING})`,
  grandTotal <= CEILING,
  'a tour nobody finishes teaches nobody anything'
);

// ── 4. The streak is explained once ──────────────────────────────────────────
// It used to appear on Home, Profile and Stats. Saying the same thing three
// times in one tour is how the steps that matter get skipped.
console.log('\n[4] Nothing is explained twice');
const streakMentions = TOURS.filter((t) => {
  const block = blockOf(read(t.file), t.constName);
  return block ? /streak/i.test(userFacingCopy(block)) : false;
});
check(
  'the streak is explained on exactly one tab',
  streakMentions.length === 1,
  `mentioned on: ${streakMentions.map((t) => t.name).join(', ') || 'nowhere'}`
);

// ── 5. The safety copy says what the app actually does ───────────────────────
// Naming a sore area does two things, and the tour used to describe one. The
// half it left out is the half a user needs to recognise their own session.
console.log('\n[5] The pain step describes both halves of what happens');
const readiness = read('app/readiness.tsx');
const painStep = userFacingCopy(
  readiness.slice(
    readiness.indexOf('const READINESS_TUTORIAL'),
    readiness.indexOf("iconLabel: 'Energy'")
  )
);
check(
  'it says the aggravating work is taken out',
  /take[sn]? the exercises|swap|out of your session/i.test(painStep),
  painStep.slice(0, 120)
);
check(
  'and that gentle work for the area is put in',
  /gentle/i.test(painStep),
  'the rehab half is still unmentioned'
);
check(
  'and that there is a pain limit',
  /pain limit|pain-free|0-2|2 out of 10/i.test(painStep),
  'the limit that makes the protocol safe is unmentioned'
);

console.log('');
if (failures > 0) {
  console.error(`guided-tour: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`guided-tour: all ${total} checks passed\n`);
  process.exitCode = 0;
}
