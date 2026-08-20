/**
 * Contract test: the app never rewards pushing through pain, and never
 * prescribes a near-maximal lift to somebody who told it they are rehabbing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BADGES REWARDED THE RIGHT THING AND SAID THE WRONG THING
 * ─────────────────────────────────────────────────────────────────────────────
 * The pain_warrior criterion is `hadAches`: the user reported a niggle at the
 * readiness screen and trained the session the app adapted for them. That is
 * exactly what a physiotherapist wants - say something hurts, then train around
 * it - and the criteria were never in question.
 *
 * The names were. "Pain Warrior", "Adapts & Overcomes" and, at twenty sessions,
 * "Unbreakable" are the vocabulary of pushing through pain, which is the single
 * behaviour this app exists to talk people out of. A rehab product handing
 * somebody a trophy called Unbreakable on their twentieth painful session is
 * teaching the wrong lesson at the worst possible moment.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AND REHAB PLUS STRENGTH WAS PRESCRIBING TRIPLES
 * ─────────────────────────────────────────────────────────────────────────────
 * intentFor resolved ties toward strength, which is right almost everywhere: a
 * 5-rep prescription trained as 15 is a different session. It is not right when
 * one of the tied goals is rehab. Someone who ticked both was getting 3-5 rep
 * main lifts - near-maximal triples - with a softened effort target bolted on
 * top telling them to leave 2-3 reps back on a set of three, which is unsafe and
 * incoherent at the same time.
 *
 * Run:  npx tsx tests/clinical-voice.check.mjs
 */
import { readFileSync } from 'fs';
import { BADGE_CATALOG as BADGES, BADGE_CATEGORY_LABELS } from '../lib/badges.ts';
import { intentFor, prescriptionFor, REP_SCHEME } from '../lib/rep-scheme.ts';

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

console.log('\n[1] No badge glorifies enduring pain');

/**
 * Words that frame pain as an opponent to beat rather than information to act
 * on. Checked against every badge in the app, not just the pain category - the
 * failure mode is someone adding a cheerful new badge somewhere else.
 */
const GLORIFYING = [
  /\bpain warrior\b/i,
  /\bunbreakable\b/i,
  /\bovercomes?\b/i,
  /\bpush(?:ing)? through\b/i,
  /\bno pain\b/i,
  /\bthrough the pain\b/i,
  /\bfight(?:er|ing)? (?:the|through)\b/i,
  /\btough it out\b/i,
  /\bpain is\b/i,
];

const offenders = [];
for (const b of BADGES) {
  const text = `${b.name} ${b.description}`;
  for (const rx of GLORIFYING) if (rx.test(text)) offenders.push(`${b.id}: "${b.name}"`);
}
check(
  'no badge name or description tells anyone to push through pain',
  offenders.length === 0,
  offenders.join(' | ')
);

const painBadges = BADGES.filter((b) => b.category === 'pain_warrior');
check(
  'the pain-adaptation family is still there and still has five rungs',
  painBadges.length === 5,
  `found ${painBadges.length} - the criteria were never the problem, only the words`
);

/**
 * IDS ARE LOAD-BEARING. Earned badges are persisted by id, so renaming one
 * silently un-earns it for everybody who already holds it. The rename moved
 * `name` and `description` and nothing else, and this is what holds it there.
 */
const EARNED_IDS = [
  'pain_warrior_1',
  'pain_warrior_3',
  'pain_warrior_5',
  'pain_warrior_10',
  'pain_warrior_20',
];
check(
  'and every id survived the rename',
  EARNED_IDS.every((id) => BADGES.some((b) => b.id === id)),
  'earned badges are stored by id: changing one un-earns it for everyone who has it'
);

check(
  'the category is named after adapting, not enduring',
  !/warrior/i.test(BADGE_CATEGORY_LABELS.pain_warrior),
  `the Achievements screen prints this as a section heading: "${BADGE_CATEGORY_LABELS.pain_warrior}"`
);

check(
  'the twentieth one says the thing the app should be saying by then',
  /get it looked at|see (?:a|someone)|checked/i.test(
    BADGES.find((b) => b.id === 'pain_warrior_20')?.description ?? ''
  ),
  'twenty sessions of reported pain is a reason to send someone to a clinician, not a reason for a trophy'
);

check(
  'and it is no longer handed out as a trophy',
  BADGES.find((b) => b.id === 'pain_warrior_20')?.icon !== 'trophy-outline',
  ''
);

console.log('\n[2] Rehab outranks strength when both were ticked');

check(
  'rehab alone is programmed gently',
  intentFor(['rehab']) === 'hypertrophy',
  ''
);
check(
  'rehab plus strength is too',
  intentFor(['rehab', 'strength']) === 'hypertrophy',
  'this resolved to strength, which prescribes 3-5 rep main lifts to someone rehabbing an injury'
);
check(
  'and rehab plus power, which is the same mistake by another name',
  intentFor(['rehab', 'power']) === 'hypertrophy',
  ''
);
check(
  'strength still wins every tie that does not involve rehab',
  intentFor(['muscle', 'strength']) === 'strength' &&
    intentFor(['fat_loss', 'strength']) === 'strength',
  'a 5-rep prescription trained as 15 is a different session; erring toward the specific answer is the safer mistake everywhere else'
);

for (const goals of [['rehab'], ['rehab', 'strength'], ['rehab', 'power'], ['rehab', 'muscle']]) {
  const p = prescriptionFor(goals, 'main');
  check(
    `${goals.join(' + ')}: main lift is at least 6 reps, never to failure, 2+ in reserve`,
    p.reps.min >= 6 && p.lastSetToFailure === false && p.rir.min >= 2,
    `got ${p.reps.min}-${p.reps.max} reps, failure=${p.lastSetToFailure}, rir=${p.rir.min}-${p.rir.max}`
  );
}

check(
  'a plain strength user is untouched and still gets their triples',
  REP_SCHEME.strength.tier1.reps.min === 3 && prescriptionFor(['strength'], 'main').reps.min === 3,
  'the softening must be about rehab, not a quiet flattening of the whole table'
);

console.log('\n[3] The readiness screen still records what all of this keys off');

const readiness = readFileSync(new URL('../app/readiness.tsx', import.meta.url), 'utf8');
check(
  'reporting an ache is still a thing the user can do',
  /aches-no|aches-yes|hasAches/.test(readiness),
  'the pain badges reward reporting; if reporting goes away they reward nothing'
);

console.log(`\nclinical-voice: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
