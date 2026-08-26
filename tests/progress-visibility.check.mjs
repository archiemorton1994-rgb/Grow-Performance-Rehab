/**
 * Contract test: the user can see that they are getting stronger.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. THE CHART HID HALF OF EVERY PROGRESSION
 * ─────────────────────────────────────────────────────────────────────────────
 * The app deliberately climbs reps before it adds weight: eight, then nine,
 * then ten at the same load, and only then a plate. The progression chart drew
 * the weight and nothing else, so the whole first half of every cycle was a
 * flat line - on the exact mechanic the app is built around. Somebody who went
 * from eight reps to twelve saw no movement at all and concluded, reasonably,
 * that they were not progressing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. AND PERSONAL BESTS WERE COMPUTED AND THROWN AWAY
 * ─────────────────────────────────────────────────────────────────────────────
 * A best was worked out on the summary screen immediately after a session,
 * counted in the headline, and then discarded. Nothing wrote it down and no
 * other screen recomputed it, so the one moment worth remembering in a training
 * week survived for exactly one screen. (The "Personal Bests" section on the
 * Overview tab is a different thing: those are tested one-rep maxes.)
 *
 * Both are recovered rather than newly recorded. Every appearance is already in
 * the history, so an old account gets its whole back catalogue the first time
 * it opens the tab.
 *
 * Run:  npx tsx tests/progress-visibility.check.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { allPersonalBests, plottedStrength } from '../lib/coach-insights.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

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

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const store = read('lib/store.ts');
const stats = read('app/(tabs)/workouts.tsx');

// ─── 1. The reps are recorded ────────────────────────────────────────────────
console.log('\n[1] Each appearance keeps the reps, not only the weight');

check(
  'the appearance type carries reps and an estimate',
  /bestSetReps\?: number;/.test(store) && /estimatedOrmKg\?: number;/.test(store),
  ''
);
check(
  'and the aggregator fills them in',
  /const bestSetReps = workingSets/.test(store) &&
    /estimateOrmFromAmrap\(bestSetWeight, bestSetReps\)/.test(store),
  ''
);
check(
  'the reps taken are the ones from the heaviest set',
  /\.filter\(\(s\) => s\.weight === bestSetWeight\)/.test(store),
  'reps from a lighter set describe a different set'
);
check(
  'and the appearance actually carries them',
  store.includes('bestSetReps: bestSetReps > 0 ? bestSetReps : undefined,') &&
    store.includes('estimatedOrmKg,'),
  'computing them and not pushing them is the same as not computing them'
);
check(
  'both fields are optional',
  /bestSetReps\?: number;/.test(store),
  'every appearance recorded before this change has no rep count, and an old chart must not break'
);

// ─── 2. And the chart plots strength ─────────────────────────────────────────
console.log('\n[2] The line moves when the reps move');

check(
  'an extra rep at the same weight raises the plotted value',
  plottedStrength({ bestSetWeight: 60, estimatedOrmKg: 60 * (1 + 8 / 30) }) <
    plottedStrength({ bestSetWeight: 60, estimatedOrmKg: 60 * (1 + 12 / 30) }),
  'this is the whole point: a rep-range climb used to draw a flat line'
);
check(
  'and so does an extra plate at the same reps',
  plottedStrength({ bestSetWeight: 60, estimatedOrmKg: 60 * (1 + 8 / 30) }) <
    plottedStrength({ bestSetWeight: 65, estimatedOrmKg: 65 * (1 + 8 / 30) }),
  ''
);
check(
  'an appearance with no reps falls back to the raw weight',
  plottedStrength({ bestSetWeight: 60 }) === 60,
  'a chart drawn purely from the estimate would start partway along for every existing account'
);
check(
  'the chart uses it',
  /const weights = appearances\.map\(plottedStrength\);/.test(stats) &&
    /toY\(plottedStrength\(a\)\)/.test(stats),
  ''
);
check(
  'and the tooltip names the pair it came from',
  /selectedPoint\.bestSetReps \? ` x \$\{selectedPoint\.bestSetReps\}` : ''/.test(stats),
  'a number with no reps beside it cannot be checked against a training diary'
);

// ─── 3. Personal bests come back ─────────────────────────────────────────────
console.log('\n[3] Every weight you have beaten, kept');

const lift = (name, weights) => ({
  exerciseId: name,
  exerciseName: name,
  sessionType: 'squat',
  appearances: weights.map((w, i) => ({
    date: new Date(1_700_000_000_000 + i * 86400000).toISOString(),
    bestSetWeight: typeof w === 'number' ? w : w.kg,
    avgWorkingWeight: typeof w === 'number' ? w : w.kg,
    bestSetReps: typeof w === 'number' ? undefined : w.reps,
  })),
});

check(
  'a weight that beat everything before it is a best',
  allPersonalBests([lift('Squat', [60, 65, 70])]).length === 2,
  ''
);
check(
  'the first appearance never is',
  allPersonalBests([lift('Squat', [60])]).length === 0,
  'beating nothing is not an achievement, and counting it hands somebody a wall of trophies for turning up'
);
check(
  'holding the weight is not a best',
  allPersonalBests([lift('Squat', [60, 60, 60, 60])]).length === 0,
  ''
);
check(
  'and neither is coming back to a weight already beaten',
  allPersonalBests([lift('Squat', [60, 80, 70, 75])]).length === 1,
  'a ceiling, not a comparison with last time - otherwise every wave up after a deload reads as a record'
);
check(
  'each best says what it beat',
  (() => {
    const b = allPersonalBests([lift('Squat', [60, 70])])[0];
    return b.previousKg === 60 && b.kg === 70;
  })(),
  ''
);
check(
  'newest first',
  (() => {
    const b = allPersonalBests([lift('Squat', [60, 65, 70])]);
    return new Date(b[0].date).getTime() > new Date(b[1].date).getTime();
  })(),
  ''
);
check(
  'the reps come with it where they were recorded',
  allPersonalBests([lift('Squat', [{ kg: 60, reps: 8 }, { kg: 70, reps: 9 }])])[0].reps === 9,
  ''
);
check(
  'and it is capped',
  allPersonalBests([lift('Squat', Array.from({ length: 60 }, (_, i) => 50 + i))], 8).length === 8,
  'a two-year account has hundreds, and a list nobody can reach the bottom of is not a list'
);

console.log('\n[4] And it is on the tab, first');

check(
  'the section is rendered',
  /<RecentBestsSection/.test(stats) && /testID="recent-bests"/.test(stats),
  ''
);
check(
  'above Volume, which is the tab\'s previous first section',
  stats.indexOf('Recent bests') < stats.indexOf('>Volume<'),
  'this is the one section that answers "am I getting stronger" with a yes and a number'
);
check(
  'derived on the fly rather than stored',
  /allPersonalBests\(getAllExerciseProgress\(\), 8\)/.test(stats),
  'nothing new is recorded, so an existing account gets its whole back catalogue immediately'
);
check(
  'and it says something useful when there are none yet',
  /Beat a weight you have lifted before and it lands here/.test(stats),
  'an empty panel with no explanation teaches people not to come back to it'
);

console.log(`\nprogress-visibility: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
