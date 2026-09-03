/**
 * Contract test: the Strength Score, and the things it must never become.
 *
 * WHAT IT IS. The three tracked lifts against bodyweight, as one number out of
 * a hundred, sex-adjusted. It answers "how strong am I, really" in the only way
 * that is answerable across body sizes: a 60 kg person benching 90 is
 * proportionally far stronger than a 100 kg person benching the same, and raw
 * kilos cannot say that.
 *
 * WHAT IT MUST NOT BECOME, which is most of what this file guards:
 *
 *   NOT A LEVEL. The app already has an XP level, six exercise ladders and four
 *   badge tiers. The brief was explicit about not burying people in scores, so
 *   this lives in one card on the profile and nowhere else - and above all not
 *   on the profile picture, which belongs to the XP level.
 *
 *   NOT A PRESCRIPTION. It reads bodyweight and one-rep maxes and returns a
 *   number. Nothing about what somebody is given may ever depend on it; that is
 *   the exercise ladders' job and it stays clinical.
 *
 *   NOT A JUDGEMENT ON MISSING DATA. Somebody who has only tested their squat
 *   is scored on their squat, not on a third of themselves.
 *
 *   AND NOT ONE TABLE FOR EVERYBODY. Upper-body pressing relative to bodyweight
 *   differs enough by sex that a single scale would tell every woman she was
 *   weaker than she is, the bench most of all.
 *
 * Run:  npx tsx tests/strength-score.check.mjs
 */
globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import {
  strengthScore,
  strengthScoreLabel,
  eliteMultipleFor,
  ELITE_MULTIPLE,
  SCORED_LIFTS,
} from '../lib/strength-score.ts';

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
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stripComments = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const score = (over = {}) =>
  strengthScore({
    bodyweightKg: 80,
    sex: 'male',
    bestKgByLift: { squat: 120, bench: 80, deadlift: 160 },
    ...over,
  });

console.log('\n[1] It measures strength relative to size');

check(
  'the same lifts score higher for a lighter person',
  (() => {
    const light = score({ bodyweightKg: 60 })?.score ?? 0;
    const heavy = score({ bodyweightKg: 100 })?.score ?? 0;
    return light > heavy;
  })(),
  `${score({ bodyweightKg: 60 })?.score} vs ${score({ bodyweightKg: 100 })?.score}`
);
check(
  'and lifting more at the same bodyweight scores higher',
  (() => {
    const a = score()?.score ?? 0;
    const b = score({ bestKgByLift: { squat: 160, bench: 100, deadlift: 200 } })?.score ?? 0;
    return b > a;
  })(),
  ''
);
check(
  'hitting every elite multiple is exactly 100',
  (() => {
    const elite = Object.fromEntries(
      SCORED_LIFTS.map((l) => [l, eliteMultipleFor(l, 'male') * 80])
    );
    return score({ bestKgByLift: elite })?.score === 100;
  })(),
  `${score({ bestKgByLift: Object.fromEntries(SCORED_LIFTS.map((l) => [l, eliteMultipleFor(l, 'male') * 80])) })?.score}`
);
check(
  // Past elite the number stops being a scale, and 140/100 invites the question
  // of what the hundred meant.
  'and going past it is capped rather than overflowing',
  score({ bestKgByLift: { squat: 400, bench: 300, deadlift: 500 } })?.score === 100,
  ''
);

console.log('\n[2] One table for everybody would be the wrong table');

check(
  'the elite bench multiple is lower for females than males',
  ELITE_MULTIPLE.bench.female < ELITE_MULTIPLE.bench.male,
  JSON.stringify(ELITE_MULTIPLE.bench)
);
check(
  'and every lift is adjusted, not just the bench',
  SCORED_LIFTS.every((l) => ELITE_MULTIPLE[l].female < ELITE_MULTIPLE[l].male),
  JSON.stringify(ELITE_MULTIPLE)
);
check(
  'so identical lifts score differently by sex',
  (() => {
    const asMale = score({ bodyweightKg: 60, sex: 'male' })?.score ?? 0;
    const asFemale = score({ bodyweightKg: 60, sex: 'female' })?.score ?? 0;
    return asFemale > asMale;
  })(),
  `${score({ bodyweightKg: 60, sex: 'male' })?.score} vs ${score({ bodyweightKg: 60, sex: 'female' })?.score}`
);
check(
  // "Prefer not to say" is an answer the app offers, so it needs a fair reading
  // rather than a default to either column.
  'somebody who did not say gets the midpoint of the two',
  (() => {
    const other = eliteMultipleFor('bench', 'other');
    const mid = (ELITE_MULTIPLE.bench.male + ELITE_MULTIPLE.bench.female) / 2;
    return other === mid && eliteMultipleFor('bench', undefined) === mid;
  })(),
  ''
);

console.log('\n[3] It never judges what it has not measured');

check(
  'somebody with one lift is scored on that lift, not on a third of themselves',
  (() => {
    const one = strengthScore({
      bodyweightKg: 80,
      sex: 'male',
      bestKgByLift: { squat: 180 },
    });
    return one !== null && one.score === 100 && one.missing === 2 && one.lifts.length === 1;
  })(),
  JSON.stringify(strengthScore({ bodyweightKg: 80, sex: 'male', bestKgByLift: { squat: 180 } }))
);
check(
  // Null rather than zero. A zero is a claim about somebody's strength; "we have
  // not measured you" is not that claim.
  'nothing logged produces no score at all, rather than a zero',
  strengthScore({ bodyweightKg: 80, sex: 'male', bestKgByLift: {} }) === null,
  ''
);
check(
  'and neither does a missing or impossible bodyweight',
  strengthScore({ bodyweightKg: 0, sex: 'male', bestKgByLift: { squat: 120 } }) === null &&
    strengthScore({ bodyweightKg: NaN, sex: 'male', bestKgByLift: { squat: 120 } }) === null,
  ''
);
check(
  'a lift logged as zero is treated as not logged',
  strengthScore({ bodyweightKg: 80, sex: 'male', bestKgByLift: { squat: 0, bench: 80 } })
    ?.lifts.length === 1,
  ''
);
check(
  'every score has a word for it',
  [0, 19, 20, 37, 38, 54, 55, 71, 72, 89, 90, 100].every((n) => strengthScoreLabel(n).length > 3),
  ''
);

console.log('\n[4] It is not a level, and it changes nothing');

check(
  'the module never reaches the exercise ladders or the XP level',
  (() => {
    const src = stripComments(read('lib/strength-score.ts'));
    return (
      !/exercise-levels/.test(src) &&
      !/patternCeiling/.test(src) &&
      !/xpStanding/.test(src) &&
      !/earnedLevelBonus/.test(src)
    );
  })(),
  'what somebody is prescribed must never depend on a score they can chase'
);
check(
  'and nothing that builds a session reads it',
  (() => {
    const engine = read('lib/workout-engine.ts');
    const programme = read('lib/programme.ts');
    return !/strengthScore/.test(engine) && !/strengthScore/.test(programme);
  })(),
  ''
);
check(
  'its labels are not the ladder names, so it cannot be mistaken for one',
  (() => {
    const src = stripComments(read('lib/strength-score.ts'));
    return !/Foundations/.test(src);
  })(),
  '"Foundations" describes what you are prescribed, not how strong you are'
);
check(
  // The brief: "we dont want them overwhelmed with scores and levels".
  'it appears on the profile and nowhere else',
  (() => {
    const files = [
      'app/(tabs)/index.tsx',
      'app/(tabs)/train.tsx',
      'app/session.tsx',
      'app/session-summary.tsx',
      'components/LevelRing.tsx',
    ];
    return files.every((f) => !/strengthScore|Strength Score/.test(read(f)));
  })(),
  'the profile picture belongs to the XP level; two numbers there is the thing to avoid'
);
check(
  'and the profile does show it',
  /strengthScore/.test(read('app/(tabs)/profile.tsx')),
  ''
);

console.log(`\nstrength-score: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
