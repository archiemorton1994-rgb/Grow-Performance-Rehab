/**
 * Contract test: the app has ONE definition of "this week".
 *
 * WHY THIS MATTERS
 * ────────────────
 * The Stats tab had three, and two of them sat on the same screen:
 *
 *   "This Week" pill      getThisWeekCount()  — Monday, UTC   (lib/store.ts)
 *   "This wk" bar         now.getDay()        — Sunday, local (the chart below it)
 *   History "This week"   now.getDay()        — Sunday, local (a third site)
 *
 * Mid-week the bar included Sunday's sessions and the pill did not. On a Sunday
 * the pill covered Mon–Sun while the bar covered that day alone, so the bar
 * could read far lower than the number printed directly above it. Nothing
 * announces a bug like that — the stats just look wrong, and once a user
 * notices, they stop trusting every other number on the screen.
 *
 * Monday was chosen because getStreakDays, the badge engine's isoWeek and the
 * calendar grid were all Monday-based already; only the charts were not.
 *
 * Run:  node tests/week-boundary.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(__dir, rel), 'utf8');
const stats = read('../app/(tabs)/workouts.tsx');
const utils = read('../lib/utils.ts');

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

// ─── 1. There is a shared helper, and it is Monday-based ─────────────────────
console.log('\n[1] One shared definition');

check('lib/utils exports startOfWeek', /export function startOfWeek\(/.test(utils), '');
check('lib/utils exports startOfWeeksAgo', /export function startOfWeeksAgo\(/.test(utils), '');
check(
  'it is Monday-based',
  /const dow = d\.getDay\(\) \|\| 7;[\s\S]{0,120}?d\.setDate\(d\.getDate\(\) - \(dow - 1\)\);/.test(
    utils
  ),
  'Sunday-based would disagree with getStreakDays, isoWeek and the calendar grid'
);

// ─── 2. Nothing rolls its own any more ───────────────────────────────────────
console.log('\n[2] The Stats tab no longer rolls its own');

const rolled = [...stats.matchAll(/now\.getDate\(\) - now\.getDay\(\)/g)].length;
check(
  'no hand-rolled Sunday-start week boundary remains',
  rolled === 0,
  `${rolled} site(s) still compute a week start from now.getDay()`
);
check('the charts use the shared helper', /startOfWeeksAgo\(i\)/.test(stats), '');
check('the History filter uses it too', /cutoff = startOfWeek\(now\);/.test(stats), '');

// ─── 3. Behaviour ────────────────────────────────────────────────────────────
console.log('\n[3] Behaviour');

const { startOfWeek, startOfWeeksAgo } = await import('../lib/utils.ts');

// Every day of one week must resolve to the same Monday.
const anchor = new Date(2026, 0, 5); // a Monday
let sameForAllDays = true;
for (let i = 0; i < 7; i++) {
  const d = new Date(anchor);
  d.setDate(anchor.getDate() + i);
  if (startOfWeek(d).getTime() !== anchor.getTime()) sameForAllDays = false;
}
check('every day Mon–Sun resolves to the same Monday', sameForAllDays, '');

const sunday = new Date(2026, 0, 11); // the Sunday of that week
check(
  'Sunday belongs to the week that started on Monday, not a new one',
  startOfWeek(sunday).getTime() === anchor.getTime(),
  'this is the exact case where the pill and the bar used to disagree'
);

check('startOfWeek returns midnight', startOfWeek(new Date()).getHours() === 0, '');
check(
  'startOfWeeksAgo(0) equals startOfWeek',
  startOfWeeksAgo(0, sunday).getTime() === startOfWeek(sunday).getTime(),
  ''
);
check(
  'startOfWeeksAgo(3) is exactly 21 days earlier',
  (startOfWeek(sunday).getTime() - startOfWeeksAgo(3, sunday).getTime()) / 86400000 === 21,
  ''
);

// ─── 4. The streak is labelled as what it counts ─────────────────────────────
console.log('\n[4] The streak label');

check(
  'the Stats tab no longer calls a week streak a "Day Streak"',
  !/Day Streak/.test(stats),
  'getStreakDays counts consecutive WEEKS that hit the weekly goal; Home and Profile both say "Week Streak"'
);

console.log('');
if (failures > 0) {
  console.error(`week-boundary: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`week-boundary: all ${total} checks passed\n`);
  process.exit(0);
}
