/**
 * Contract test: every exercise in a targeted rehab session is aimed at the
 * region the user picked.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Reported against a real elbow session: it contained "Thread the Needle
 * (Thoracic Rotation)", "Band Pull-Apart" and, last of all, a "Supine Hip 90/90
 * Stretch". Three of nine exercises had nothing to do with an elbow. Two causes,
 * both structural:
 *
 *   1. The two rotating supplement exercises were drawn from the standalone
 *      joint-health pool with NO relevance filter — only a de-dupe against the
 *      region's own work. Whatever the shuffle turned up went in.
 *   2. The cooldown was a single shared constant appended to every region, so
 *      knee, elbow, wrist and neck sessions all ended with a hip stretch.
 *
 * It also made the session summary card lie: with the elbow work tagged to a
 * joint the muscle map does not shade, the only regions left to light up came
 * from the irrelevant exercises, and the card reported traps and lower back.
 *
 * WHAT "RELEVANT" MEANS HERE
 * ──────────────────────────
 * An exercise is relevant to a region if its own targetRegions name that region,
 * or name a region PREHAB_RELATED_REGIONS declares a neighbour of it. Neighbours
 * exist because several regions have almost no exercises of their own — the
 * forearm work that serves an elbow is filed under the wrist and vice versa —
 * and a session that never changes is one nobody finishes six weeks of. The
 * warm-up is exempt: it is an easy walk or bike with no region at all.
 *
 * Checks:
 *   1. REGION SOURCE     — regions come from the picker in recover.tsx, so this
 *                          covers exactly what a user can tap.
 *   2. NEIGHBOUR SANITY  — the related-region map is symmetric and no region is
 *                          its own neighbour.
 *   3. RELEVANCE         — for every region, over several rotations, every
 *                          exercise is relevant to that region.
 *   4. NAMED REGRESSIONS — the three exercises actually reported never appear
 *                          in an elbow or wrist session again.
 *   5. COOLDOWN          — every region ends on a cooldown aimed at it, and no
 *                          two regions' sessions end the same way by accident
 *                          of a shared default.
 *   6. STILL VARIES      — relevance must not be bought by making the session
 *                          static again, and the region's own work must survive.
 *
 * Run:  npx tsx tests/prehab-region-relevance.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

globalThis.__DEV__ = false;

import { generateWorkout } from '../lib/workout-engine.ts';
import {
  PREHAB_RELATED_REGIONS,
  getRegionPrehabWorkout,
  getExerciseTargetRegionsMap,
} from '../lib/exercise-db.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const recoverSrc = readFileSync(join(__dir, '../app/(tabs)/recover.tsx'), 'utf8');

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

/** Pull the string literals out of a `new Set<PainRegion>([...])` declaration. */
function parseSetLiteral(src, constName) {
  const start = src.indexOf(`const ${constName}`);
  if (start === -1) return null;
  const open = src.indexOf('[', start);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']' && --depth === 0) {
      return [...src.slice(open, i + 1).matchAll(/'([^']+)'/g)].map((m) => m[1]);
    }
  }
  return null;
}

// ─── 1. The regions a user can actually pick ─────────────────────────────────
console.log('\n[1] Regions come from the picker, not a list kept in this file');

const front = parseSetLiteral(recoverSrc, 'REGION_FRONT') ?? [];
const back = parseSetLiteral(recoverSrc, 'REGION_BACK') ?? [];
const regions = [...new Set([...front, ...back])];

check(
  `REGION_FRONT ∪ REGION_BACK parsed from recover.tsx (${regions.length} regions)`,
  regions.length > 0,
  'the picker constants could not be read — this test would otherwise pass vacuously'
);
check(
  'every pickable region has a neighbour list',
  regions.every((r) => Array.isArray(PREHAB_RELATED_REGIONS[r])),
  regions.filter((r) => !PREHAB_RELATED_REGIONS[r]).join(', ')
);

// ─── 2. The neighbour map is coherent ────────────────────────────────────────
console.log('\n[2] Related regions are declared both ways round');

const asymmetric = [];
const selfReferential = [];
for (const [region, neighbours] of Object.entries(PREHAB_RELATED_REGIONS)) {
  for (const n of neighbours) {
    if (n === region) selfReferential.push(region);
    if (!(PREHAB_RELATED_REGIONS[n] ?? []).includes(region)) asymmetric.push(`${region}→${n}`);
  }
}
check(
  'no region lists itself as its own neighbour',
  selfReferential.length === 0,
  selfReferential.join(', ')
);
check(
  'every neighbour relationship is symmetric',
  asymmetric.length === 0,
  `one-way links: ${asymmetric.join(', ')} — a shared muscle is shared in both directions`
);

// ─── 3. Every exercise, every region, every rotation ─────────────────────────
console.log('\n[3] Nothing irrelevant survives into a generated session');

const targetRegionsOf = getExerciseTargetRegionsMap();
const profile = {
  name: 'A',
  sex: 'other',
  experienceLevel: 'intermediate',
  goals: ['rehab'],
  bodyweightKg: 80,
};
const ROTATIONS = 8;

const sessionsFor = (region) => {
  const out = [];
  for (let n = 0; n < ROTATIONS; n++) {
    out.push(
      generateWorkout(
        'prehab',
        'bodyweight',
        { energy: 'normal', timeAvailable: '45', hasAches: true, painRegion: region },
        profile,
        {},
        undefined,
        n
      )
    );
  }
  return out;
};

const relevantTo = (exercise, region) => {
  const tags = targetRegionsOf[exercise.id] ?? [];
  // The warm-up is an easy walk or bike — no region, and right for all of them.
  if (exercise.category === 'prep' && tags.length === 0) return true;
  if (tags.includes(region)) return true;
  return (PREHAB_RELATED_REGIONS[region] ?? []).some((r) => tags.includes(r));
};

const allSessions = new Map(regions.map((r) => [r, sessionsFor(r)]));

for (const region of regions) {
  const offenders = new Set();
  for (const session of allSessions.get(region)) {
    for (const ex of session) {
      if (!relevantTo(ex, region)) {
        offenders.add(`${ex.name} {${(targetRegionsOf[ex.id] ?? []).join(', ') || 'untagged'}}`);
      }
    }
  }
  check(
    `'${region}' — every exercise across ${ROTATIONS} rotations is aimed at the region`,
    offenders.size === 0,
    [...offenders].join(' · ')
  );
}

// ─── 4. The exercises that were actually reported ────────────────────────────
console.log('\n[4] The three reported exercises stay out of arm sessions');

const REPORTED = [
  'Thread the Needle (Thoracic Rotation)',
  'Band Pull-Apart',
  'Supine Hip 90/90 Stretch',
];
for (const region of ['elbow', 'wrist']) {
  const names = new Set(allSessions.get(region).flat().map((e) => e.name));
  for (const reported of REPORTED) {
    check(
      `'${reported}' never appears in a ${region} session`,
      !names.has(reported),
      'this is the exact complaint that started this — it must not come back'
    );
  }
}

// ─── 5. The session ends on something for the region ─────────────────────────
console.log('\n[5] Every region ends on its own cooldown');

for (const region of regions) {
  const plan = getRegionPrehabWorkout(region);
  const last = plan[plan.length - 1];
  check(
    `'${region}' ends on '${last?.name ?? 'nothing'}', which is aimed at it`,
    !!last && last.category === 'cooldown' && relevantTo(last, region),
    'a cooldown that does not reach what was worked is only making the session longer'
  );
}

// A single default appended to all of them is exactly the bug that was fixed;
// the count is deliberately loose, since regions that share a joint should share
// a stretch.
const distinctCooldowns = new Set(
  regions.map((r) => getRegionPrehabWorkout(r).slice(-1)[0]?.name)
);
check(
  `regions do not share one blanket cooldown (${distinctCooldowns.size} distinct across ${regions.length} regions)`,
  distinctCooldowns.size >= Math.ceil(regions.length / 2),
  [...distinctCooldowns].join(' · ')
);

// ─── 6. Relevance was not bought with a static session ───────────────────────
console.log('\n[6] Sessions still rotate, and still contain the region work');

for (const region of regions) {
  const sessions = allSessions.get(region);
  const core = getRegionPrehabWorkout(region)
    .filter((e) => e.category === 'prehab')
    .map((e) => e.name);

  // Both halves of the variation are pinned separately. Checking only that the
  // whole session differs would let the rotation of the region's own work be
  // dropped and go unnoticed, because a changing supplement alone makes every
  // session look different.
  const coreSet = new Set(core);
  const orders = new Set(
    sessions.map((s) =>
      s
        .filter((e) => coreSet.has(e.name))
        .map((e) => e.name)
        .join('|')
    )
  );
  const shapes = new Set(sessions.map((s) => s.map((e) => e.name).join('|')));
  check(
    `'${region}' still varies between sessions (${shapes.size}/${ROTATIONS} distinct)`,
    shapes.size > 1,
    'six weeks of the identical session is what the rotation was added to prevent'
  );
  check(
    `'${region}' still works its own exercises in a rotating order (${orders.size}/${ROTATIONS} orders)`,
    orders.size > 1,
    'the same five exercises in the same order every time is the session nobody finishes'
  );

  check(
    `'${region}' keeps all ${core.length} of its own exercises in every session`,
    sessions.every((s) => core.every((name) => s.some((e) => e.name === name))),
    'the region-specific work is the point of the session'
  );
}

console.log('');
if (failures > 0) {
  console.error(`prehab-region-relevance: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`prehab-region-relevance: all ${total} checks passed\n`);
  process.exit(0);
}
