/**
 * Contract test: every badge has a distinct, distinguishable name.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The achievements grid shows badges by name. Two badges sharing a name are
 * indistinguishable there and in the unlock sheet — the user earns "Body
 * Mechanic", then later earns "Body Mechanic" again, with no way to tell what
 * the second one was for.
 *
 * Three real collisions existed before this test:
 *   - 'Body Mechanic'  — goal_rehab_50 (50 prehab sessions)
 *                        vs exercise_recovery_10 (10 recovery sessions)
 *   - 'Full Spectrum'  — variety_5_in_week (5 types in a week)
 *                        vs exercise_full_spectrum (every type, all time)
 *   - 'First Step' vs 'First Steps' — the first-session milestone and the
 *                        guided-tour badge, one letter apart, same grid.
 *
 * Checks:
 *  1. IDS      — no duplicate badge ids
 *  2. NAMES    — no two badges share a name
 *  3. PLURALS  — no two names differ only by a trailing "s"
 *
 * Run:  node tests/badge-name-uniqueness.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dir, '../lib/badges.ts'), 'utf8');

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

// Badge names come from two shapes in this file: object literals with
// `name: '...'`, and MILESTONE_DATA tuples `[n, 'Name', 'Description']`.
const objectNames = [...src.matchAll(/name: '((?:[^'\\]|\\.)+)'/g)].map((m) => m[1]);
const tupleNames = [...src.matchAll(/\[\s*\d+\s*,\s*'((?:[^'\\]|\\.)+)'\s*,/g)].map((m) => m[1]);
const names = [...objectNames, ...tupleNames];

const ids = [...src.matchAll(/id: '((?:[^'\\]|\\.)+)'/g)].map((m) => m[1]);

console.log(`\n[0] Parsed ${names.length} badge names and ${ids.length} ids from lib/badges.ts`);
check('found a plausible number of badge names', names.length > 100, `only ${names.length} parsed`);

// ─── 1. Ids ───────────────────────────────────────────────────────────────────
console.log('\n[1] Ids — no duplicates');
const dupIds = ids.filter((v, i, a) => a.indexOf(v) !== i);
check(
  'all badge ids are unique',
  dupIds.length === 0,
  dupIds.length ? `duplicated: ${[...new Set(dupIds)].join(', ')}` : ''
);

// ─── 2. Names ─────────────────────────────────────────────────────────────────
console.log('\n[2] Names — no two badges share a name');
const dupNames = names.filter((v, i, a) => a.indexOf(v) !== i);
check(
  'all badge names are unique',
  dupNames.length === 0,
  dupNames.length
    ? `duplicated: ${[...new Set(dupNames)].map((n) => `"${n}"`).join(', ')} — indistinguishable in the achievements grid`
    : ''
);

// ─── 3. Plurals ───────────────────────────────────────────────────────────────
console.log('\n[3] Plurals — no name differs from another only by a trailing "s"');
const set = new Set(names);
const plural = [];
for (const n of set) {
  if (n.length > 3 && set.has(`${n}s`)) plural.push(`"${n}" / "${n}s"`);
}
check(
  'no singular/plural name pairs',
  plural.length === 0,
  plural.length ? `${plural.join(', ')} — one letter apart is not distinguishable in a grid` : ''
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`badge-name-uniqueness: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`badge-name-uniqueness: all ${total} checks passed\n`);
  process.exit(0);
}
