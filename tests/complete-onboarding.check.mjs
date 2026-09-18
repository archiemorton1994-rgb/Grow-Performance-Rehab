/**
 * Contract test: one action saves the whole sign-up, and enrols nobody.
 *
 * WHAT THIS GUARDS
 * ────────────────
 * Signing up is the only moment the app is told almost everything it knows
 * about a person, and until now that moment was spread over seven setters on
 * the last screen of a pager. Three separate faults came out of that shape, and
 * every section below is one of them.
 *
 *   IT CANNOT LAND HALFWAY. Seven writes could half-succeed, and a crash between
 *   two of them left somebody with a profile and no equipment, which generates a
 *   bodyweight-only session for a person standing in a gym. One set() either
 *   writes every answer or writes none, and the half-finished draft is still
 *   there to resume from.
 *
 *   IT CONVERTS THE BODYWEIGHT. The builder validated a typed weight in the unit
 *   the person had chosen and then stored the raw number as kilograms. Somebody
 *   who picked pounds and typed 176 had 176 KILOGRAMS written to their profile,
 *   which more than doubled every weight the app went on to prescribe. The stamp
 *   that goes with the conversion is also what stops lib/unit-correction.ts
 *   asking a brand-new pounds account whether it meant pounds, about a number
 *   that was right all along.
 *
 *   IT ENROLS NOBODY. Programmes are optional now. Finishing sign-up leaves
 *   `programme` untouched, so a new account starts with null and an existing one
 *   taken back through sign-up keeps the block it is part way through.
 *
 * And it awards nothing, because nobody should be congratulated for filling in a
 * form.
 *
 * HOW IT TESTS
 * ────────────
 * By driving the real store through the real action and reading the state it
 * leaves behind. Nothing here reads the source of anything.
 *
 * Run:  npx tsx tests/complete-onboarding.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { useAppStore, EXPERIENCE_LEVELS } from '../lib/store.ts';

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

const S = () => useAppStore.getState();

/**
 * The store's OWN defaults, captured before anything has touched them, so a
 * "fresh account" here is the same fresh account the app creates rather than a
 * hand-written guess at one that could drift away from it.
 *
 * The JSON round trip drops the actions and keeps the data, and setState merges,
 * so the actions survive.
 */
const FRESH = JSON.parse(JSON.stringify(S()));
const freshAccount = (patch = {}) => useAppStore.setState({ ...FRESH, ...patch });

const NOW = '2026-09-18T09:30:00.000Z';

/** A complete set of answers. Sections override the one field they are about. */
const answers = (extra = {}) => ({
  name: 'Jo Fielding',
  sex: 'female',
  ageYears: 34,
  bodyweight: 68,
  weightUnit: 'kg',
  experienceLevel: 'intermediate',
  goals: ['strength', 'rehab'],
  equipmentTiers: ['bodyweight', 'dumbbells'],
  soreRegions: ['low_back'],
  clinicalAvoid: ['front_shoulder'],
  ...extra,
});

/** A completed session, for the sections that need a badge to be pending. */
const session = (id) => ({
  id,
  sessionType: 'squat',
  date: '2026-09-01T08:00:00.000Z',
  equipmentTier: 'dumbbells',
  hadAches: false,
  energy: 'normal',
  timeAvailable: '45',
  exercises: [],
});

// ─── 1. Every answer lands, and it lands together ────────────────────────────
console.log('\n[1] Every answer a person gives is on file afterwards');

freshAccount();
S().completeOnboarding(answers(), NOW);
let p = S().userProfile;

check('their name is kept', p.name === 'Jo Fielding', `got ${JSON.stringify(p.name)}`);
check('their sex is kept', p.sex === 'female', `got ${p.sex}`);
check('their age is kept', p.ageYears === 34, `got ${p.ageYears}`);
check('their bodyweight is kept', p.bodyweightKg === 68, `got ${p.bodyweightKg}`);
check(
  'their experience level is kept',
  p.experienceLevel === 'intermediate',
  `got ${p.experienceLevel}`
);
check(
  'the areas they said are sore become standing ones',
  JSON.stringify(p.standingSoreRegions) === JSON.stringify(['low_back']),
  `got ${JSON.stringify(p.standingSoreRegions)}`
);
check(
  'the areas a clinician told them to avoid are kept apart from those',
  JSON.stringify(p.clinicalAvoid) === JSON.stringify(['front_shoulder']),
  `got ${JSON.stringify(p.clinicalAvoid)}`
);
check('the unit they answered in is kept', S().weightUnit === 'kg', `got ${S().weightUnit}`);
check(
  'the kit they have is kept',
  JSON.stringify(S().equipmentTiers) === JSON.stringify(['bodyweight', 'dumbbells']),
  `got ${JSON.stringify(S().equipmentTiers)}`
);
check(
  'nobody signs up into a strength test week',
  S().testWeekFrequency === 'never',
  `Archie's decision 3: test weeks are retired. Got ${S().testWeekFrequency}`
);
check('sign-up is recorded as finished', S().onboardingComplete === true, '');
check(
  'the half-finished answer sheet is thrown away',
  S().onboardingDraft === null,
  'a leftover draft would restore stale answers over a finished profile'
);
check(
  'the weigh-in is stamped with the moment they gave it',
  S().bodyweightUpdatedAt === NOW,
  `got ${S().bodyweightUpdatedAt}`
);
check(
  'their first weigh-in is written to the weight log',
  S().bodyweightLog.length === 1 &&
    S().bodyweightLog[0].kg === 68 &&
    S().bodyweightLog[0].date === NOW,
  `got ${JSON.stringify(S().bodyweightLog)}`
);

// The whole of it, or none of it. A person who finished the form and has no kit
// is handed a bodyweight session while standing in a gym.
freshAccount();
S().completeOnboarding(answers({ equipmentTiers: ['fullgym'] }), NOW);
check(
  'a finished sign-up never leaves a profile with no equipment behind it',
  S().onboardingComplete === true && S().equipmentTiers.length > 0,
  `got ${JSON.stringify(S().equipmentTiers)}`
);
check(
  'a person who picked nothing still has their own bodyweight',
  (() => {
    freshAccount();
    S().completeOnboarding(answers({ equipmentTiers: [] }), NOW);
    return JSON.stringify(S().equipmentTiers) === JSON.stringify(['bodyweight']);
  })(),
  'an empty list tells the engine there is no kit at all, including their body'
);

// ─── 2. Signing up is not enrolling ──────────────────────────────────────────
console.log('\n[2] Nobody is put on a programme by signing up');

freshAccount();
S().completeOnboarding(answers(), NOW);
check(
  'a brand-new account finishes sign-up with no programme',
  S().programme === null,
  `programmes are optional. Got ${JSON.stringify(S().programme)}`
);

const existing = {
  templateId: 'lean',
  days: 3,
  sessions: 12,
  minutes: 45,
  startedAt: '2026-08-01T00:00:00.000Z',
  startedAtSessionCount: 0,
};
freshAccount({ programme: existing });
S().completeOnboarding(answers(), NOW);
check(
  'somebody part way through a block is not thrown off it',
  S().programme === existing,
  'the key is absent from the set() rather than written as null, so it is not touched at all'
);

// ─── 3. Filling in a form earns nothing ──────────────────────────────────────
console.log('\n[3] No XP and no badge for answering questions');

// A badge is genuinely pending here: one logged session earns the first
// milestone. If the action awarded anything, this is where it would show.
freshAccount({ completedSessions: [session('a')], completedCount: 1 });
S().completeOnboarding(answers(), NOW);
check('no XP is awarded for signing up', S().xpTotal === 0, `got ${S().xpTotal}`);
check(
  'no badge is awarded for signing up',
  S().earnedBadges.length === 0 && S().newlyUnlockedBadges.length === 0,
  `got ${JSON.stringify(S().earnedBadges)}`
);
// And the assertion above is not vacuous: something really was waiting.
S().awardNewBadges();
check(
  'a badge really was pending, so withholding it was a decision',
  S().earnedBadges.length > 0 && S().xpTotal > 0,
  'if nothing was earnable the two assertions above would prove nothing'
);

// ─── 4. Pounds are converted, once, here ─────────────────────────────────────
console.log('\n[4] A bodyweight typed in pounds is stored in kilograms');

freshAccount();
S().completeOnboarding(answers({ bodyweight: 176, weightUnit: 'lbs' }), NOW);
const lbKg = S().userProfile.bodyweightKg;
check(
  '176 lb is stored as about 79.8 kg',
  Math.abs(lbKg - 79.83) < 0.05,
  `the builder stored the raw number. Got ${lbKg}`
);
check(
  '176 lb is never stored as 176 kg',
  lbKg !== 176,
  'that is the pounds fault: it more than doubled every weight the app prescribed'
);
check('they still read the app in pounds', S().weightUnit === 'lbs', `got ${S().weightUnit}`);
check(
  'the weight log records the converted figure, not the typed one',
  S().bodyweightLog.length === 1 && S().bodyweightLog[0].kg === lbKg,
  `got ${JSON.stringify(S().bodyweightLog)}`
);
check(
  'a fresh pounds account is not asked whether it meant pounds',
  S().getUnitCorrection() === null,
  'the card exists for accounts the builder broke, and this one was never broken'
);

// The same question, asked of a figure big enough that only the stamp can
// silence it. At 260 lb the stored 117.9 kg is above the card's own threshold.
freshAccount();
S().completeOnboarding(answers({ bodyweight: 260, weightUnit: 'lbs' }), NOW);
check(
  'a heavy pounds account is not asked either',
  S().getUnitCorrection() === null,
  `stored ${S().userProfile.bodyweightKg} kg, which is above the card's threshold`
);
check(
  'and it is the stamp doing that, not luck',
  (() => {
    useAppStore.setState({ bodyweightUpdatedAt: null });
    return S().getUnitCorrection() !== null;
  })(),
  'without a stamp the detector fires on this account, so the assertion above has teeth'
);

// ─── 5. An experience level nobody recognises ────────────────────────────────
console.log('\n[5] The movement ceiling is never set from a value nobody knows');

for (const level of EXPERIENCE_LEVELS) {
  freshAccount();
  S().completeOnboarding(answers({ experienceLevel: level }), NOW);
  check(
    `${level} is kept exactly as answered`,
    S().userProfile.experienceLevel === level,
    `got ${S().userProfile.experienceLevel}`
  );
}

freshAccount();
S().completeOnboarding(answers({ experienceLevel: 'expert' }), NOW);
check(
  'an experience level nobody recognises becomes beginner',
  S().userProfile.experienceLevel === 'beginner',
  `the tables that read it fall back to intermediate, which would offer movements above the ceiling. Got ${S().userProfile.experienceLevel}`
);
check(
  'and it is never stored as the unknown word itself',
  EXPERIENCE_LEVELS.includes(S().userProfile.experienceLevel),
  `got ${S().userProfile.experienceLevel}`
);

// ─── 6. Goals are what they picked, and nothing else ─────────────────────────
console.log('\n[6] Nothing is added to what somebody asked for');

freshAccount();
S().completeOnboarding(answers({ goals: ['strength', 'rehab'] }), NOW);
check(
  'both goals are kept, in the order picked',
  JSON.stringify(S().userProfile.goals) === JSON.stringify(['strength', 'rehab']),
  `got ${JSON.stringify(S().userProfile.goals)}`
);
check(
  'general fitness is not added for them',
  !S().userProfile.goals.includes('fitness'),
  'the pager fell back to fitness, so the app prescribed for a goal nobody had named'
);

freshAccount();
S().completeOnboarding(answers({ goals: ['rehab'] }), NOW);
check(
  'one goal stays one goal',
  JSON.stringify(S().userProfile.goals) === JSON.stringify(['rehab']),
  `got ${JSON.stringify(S().userProfile.goals)}`
);

// ─── 7. A bodyweight that cannot be right ────────────────────────────────────
console.log('\n[7] An impossible bodyweight is refused rather than stored');

freshAccount();
const before = S().userProfile.bodyweightKg;
S().completeOnboarding(answers({ bodyweight: 9999 }), NOW);
check(
  '9999 kg is not written to the profile',
  S().userProfile.bodyweightKg === before,
  `it multiplies the whole load heuristic, and the session bar then refuses to log what it prescribes. Got ${S().userProfile.bodyweightKg}`
);
check(
  'and no weigh-in is left behind saying the app believed it',
  S().bodyweightUpdatedAt === null && S().bodyweightLog.length === 0,
  `got ${S().bodyweightUpdatedAt} / ${JSON.stringify(S().bodyweightLog)}`
);
check(
  'the rest of their answers still land',
  S().onboardingComplete === true && S().userProfile.name === 'Jo Fielding',
  'one set() writes all of it or none of it'
);

// ─── 8. A sign-up abandoned half way can be finished later ───────────────────
console.log('\n[8] A half-finished sign-up carries every answer it needs');

freshAccount();
const live = answers({ bodyweight: 176, weightUnit: 'lbs' });
S().saveOnboardingDraft({
  name: live.name,
  sex: live.sex,
  ageYears: live.ageYears,
  bodyweight: String(live.bodyweight),
  experienceLevel: live.experienceLevel,
  goals: live.goals,
  equipmentTiers: live.equipmentTiers,
  soreRegions: live.soreRegions,
  clinicalAvoid: live.clinicalAvoid,
});
// The app is killed and comes back. A draft only helps if it survives storage.
const restored = JSON.parse(JSON.stringify(S().onboardingDraft));
useAppStore.setState({ onboardingDraft: restored });

S().completeOnboarding(
  {
    name: restored.name,
    sex: restored.sex,
    ageYears: restored.ageYears,
    bodyweight: Number(restored.bodyweight),
    weightUnit: 'lbs',
    experienceLevel: restored.experienceLevel,
    goals: restored.goals,
    equipmentTiers: restored.equipmentTiers,
    soreRegions: restored.soreRegions,
    clinicalAvoid: restored.clinicalAvoid,
  },
  NOW
);
const resumed = JSON.stringify({ profile: S().userProfile, tiers: S().equipmentTiers });

freshAccount();
S().completeOnboarding(live, NOW);
const straightThrough = JSON.stringify({ profile: S().userProfile, tiers: S().equipmentTiers });

check(
  'finishing from a restored draft gives the same profile as never stopping',
  resumed === straightThrough,
  `resumed ${resumed}\n      straight through ${straightThrough}`
);
check(
  'the age survives being put down and picked up again',
  JSON.parse(resumed).profile.ageYears === 34,
  'it was the answer the old draft dropped, and the one that costs most to give again'
);
check(
  'so do both lists of areas to work around',
  JSON.stringify(JSON.parse(resumed).profile.standingSoreRegions) === JSON.stringify(['low_back']) &&
    JSON.stringify(JSON.parse(resumed).profile.clinicalAvoid) === JSON.stringify(['front_shoulder']),
  ''
);

// ─── Result ──────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
