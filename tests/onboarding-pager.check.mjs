/**
 * Contract test: the sign-up, driven rather than read.
 *
 * WHY THIS FILE IS WRITTEN THE WAY IT IS
 * ─────────────────────────────────────
 * There was an onboarding-pager check before, for the pager this restores, and
 * every one of its twenty-four assertions was a regular expression matched
 * against app/onboarding.tsx. It held the index constants in step, which was
 * worth doing, and it also said things like "canContinue covers every screen"
 * while the bodyweight question it was covering let a blank straight through.
 * That is this repo's commonest defect: a test that pins a spelling, stays
 * green, and guards nothing.
 *
 * So the rules moved into lib/sign-up.ts, which has no React in it, and this
 * file RUNS them. The page order, what counts as an answer to each page, what
 * is wrong with a typed one, the draft round trip and the finished profile are
 * all exercised for real, and the last section drives the real store through
 * the real `completeOnboarding`.
 *
 * WHAT IT IS PROTECTING
 * ─────────────────────
 *   EVERY PAGE IS PUT TO EVERYBODY. Ten pages, none conditional. In particular
 *   the clinical question, which is asked of people who have nothing sore,
 *   because an area somebody has been told to stay off does not hurt while they
 *   are staying off it.
 *
 *   BODYWEIGHT IS REQUIRED, IN WHICHEVER UNIT THEY CHOSE. It scales the opening
 *   load of everything the app prescribes before it has watched anybody lift. A
 *   blank one was assumed at 75 kg, which opens a 55 kg person about a third too
 *   heavy on the session where they are least able to tell.
 *
 *   AGE IS REQUIRED AND BOUNDED. Sixteen to ninety, Archie's range.
 *
 *   THE FOUR LEVELS ARE HIS WORDS. They decide which movements a person is ever
 *   offered, so the wording is the specification rather than copy.
 *
 *   SIGNING UP IS NOT ENROLLING. Finishing leaves `programme` null.
 *
 * The only section that reads source text is the last one, marked as such: a
 * React screen cannot be imported here, so the wiring between the screen and
 * these rules is the one thing that has to be asserted from the outside.
 *
 * Run:  npx tsx tests/onboarding-pager.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */
globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import './_persist-shim.mjs';
import { useAppStore, EXPERIENCE_LEVELS, PAIN_CATEGORIES } from '../lib/store.ts';
import { EXPERIENCE_OPTIONS, EXPERIENCE_LABELS } from '../lib/experience-options.ts';
import { MIN_AGE_YEARS, MAX_AGE_YEARS } from '../lib/one-rep-max-input.ts';
import {
  EMPTY_SIGN_UP,
  LAST_SIGN_UP_PAGE,
  SIGN_UP_PAGES,
  allowedTiersFor,
  answersToDraft,
  canContinue,
  draftToAnswers,
  pageIndex,
  pageIssue,
  pickExperience,
  resumePage,
  toSignUpAnswers,
  toggleRegion,
  toggleTier,
} from '../lib/sign-up.ts';

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

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const S = () => useAppStore.getState();

/** A finished set of answers. Sections override the one field they are about. */
const full = (extra = {}) => ({
  name: 'Jo Fielding',
  age: '34',
  sex: 'female',
  bodyweight: '68',
  experience: 'intermediate',
  goals: ['strength', 'rehab'],
  equipment: ['bodyweight', 'dumbbells'],
  sore: ['knee'],
  avoid: ['front_shoulder'],
  ...extra,
});

// ─── 1. Ten pages, in order, and not one of them conditional ─────────────────
console.log('\n[1] The same ten pages for everybody, in the same order');

check(
  'the pages are exactly the ten, in order',
  SIGN_UP_PAGES.join(',') ===
    'welcome,name,age,sex,bodyweight,experience,goals,equipment,around,ready',
  SIGN_UP_PAGES.join(',')
);
check(
  'bodyweight is asked before experience, and both before the kit',
  pageIndex('bodyweight') < pageIndex('experience') &&
    pageIndex('experience') < pageIndex('equipment'),
  'the kit page is drawn from the experience answer, so the experience answer has to exist'
);
check(
  'the finish is the last page',
  LAST_SIGN_UP_PAGE === 'ready' && pageIndex('ready') === SIGN_UP_PAGES.length - 1,
  `it is ${LAST_SIGN_UP_PAGE}`
);
check(
  // The tree this replaced branched, and the branch is what made it long for
  // exactly the people who had something wrong with them.
  'no answer anywhere changes which pages are asked',
  (() => {
    const before = SIGN_UP_PAGES.join(',');
    for (const sore of [undefined, [], ['knee']]) {
      for (const level of EXPERIENCE_LEVELS) {
        canContinue('around', full({ sore, experience: level }), 'kg');
        if (SIGN_UP_PAGES.join(',') !== before) return false;
      }
    }
    return true;
  })(),
  'the page list is a constant, so nobody can be asked a different set'
);
check(
  'there is no theme page, no strength test page and no best lifts page',
  !SIGN_UP_PAGES.some((p) => /theme|look|test|lift|programme|certificate|explore/.test(p)),
  `a new install opens dark and strength tests are retired. Got ${SIGN_UP_PAGES.join(',')}`
);

// ─── 2. Nothing can be skipped ───────────────────────────────────────────────
console.log('\n[2] Every question has to be answered before Continue lights up');

const QUESTION_PAGES = SIGN_UP_PAGES.filter((p) => p !== 'welcome' && p !== 'ready');
const stuck = QUESTION_PAGES.filter((p) => canContinue(p, { ...EMPTY_SIGN_UP }, 'kg'));
check(
  'an empty sign-up cannot get past a single question',
  stuck.length === 0,
  `these let a blank through: ${stuck.join(', ')}`
);
check(
  'the welcome and the finish are the only pages with nothing to answer',
  canContinue('welcome', { ...EMPTY_SIGN_UP }, 'kg') &&
    canContinue('ready', { ...EMPTY_SIGN_UP }, 'kg'),
  ''
);
const movable = QUESTION_PAGES.filter((p) => canContinue(p, full(), 'kg'));
check(
  'and a finished sign-up can get past every one of them',
  movable.length === QUESTION_PAGES.length,
  `blocked on: ${QUESTION_PAGES.filter((p) => !movable.includes(p)).join(', ')}`
);
check(
  'a name of nothing but spaces is not a name',
  !canContinue('name', full({ name: '   ' }), 'kg') && canContinue('name', full({ name: 'Al' }), 'kg'),
  ''
);
check(
  'at least one goal, and nothing is picked for them',
  !canContinue('goals', full({ goals: [] }), 'kg') &&
    canContinue('goals', full({ goals: ['fitness'] }), 'kg'),
  'the old pager fell back to general fitness, so the app prescribed for a goal nobody had named'
);
check(
  'at least one kit answer',
  !canContinue('equipment', full({ equipment: [] }), 'kg'),
  'an empty list tells the engine there is no kit at all, including the body they are standing in'
);
check(
  'and a sex has to be chosen, including "prefer not to say"',
  !canContinue('sex', full({ sex: null }), 'kg') && canContinue('sex', full({ sex: 'other' }), 'kg'),
  ''
);

// ─── 3. Bodyweight, required, and read in the unit they chose ────────────────
console.log('\n[3] Bodyweight is required, and 40 is a weight in one unit and not the other');

check(
  'a blank bodyweight stops the flow in kilograms',
  !canContinue('bodyweight', full({ bodyweight: '' }), 'kg'),
  'it is the number every opening load is worked out from'
);
check(
  'and in pounds',
  !canContinue('bodyweight', full({ bodyweight: '' }), 'lbs'),
  ''
);
check(
  'a blank one says nothing yet, rather than telling somebody off mid-type',
  pageIssue('bodyweight', full({ bodyweight: '' }), 'kg') === null,
  'the button is off; a red line under an empty box is a different thing'
);
check(
  'something that is not a number is refused, with a message',
  !canContinue('bodyweight', full({ bodyweight: 'eleven stone' }), 'kg') &&
    (pageIssue('bodyweight', full({ bodyweight: 'eleven stone' }), 'kg') ?? '').length > 10,
  ''
);
check(
  'zero is refused',
  !canContinue('bodyweight', full({ bodyweight: '0' }), 'kg') &&
    !canContinue('bodyweight', full({ bodyweight: '0' }), 'lbs'),
  ''
);
// The pair that proves the unit is genuinely consulted rather than assumed.
// 40 kg is a real bodyweight; 40 lb is 18 kg and is not. 650 lb is a real one;
// 650 kg is not. A gate that ignored the unit would get one of the four wrong.
check(
  '40 is a bodyweight in kilograms',
  canContinue('bodyweight', full({ bodyweight: '40' }), 'kg'),
  ''
);
check(
  'and 40 is not a bodyweight in pounds',
  !canContinue('bodyweight', full({ bodyweight: '40' }), 'lbs'),
  `18 kg. Said: "${pageIssue('bodyweight', full({ bodyweight: '40' }), 'lbs')}"`
);
check(
  '650 is a bodyweight in pounds',
  canContinue('bodyweight', full({ bodyweight: '650' }), 'lbs'),
  ''
);
check(
  'and 650 is not a bodyweight in kilograms',
  !canContinue('bodyweight', full({ bodyweight: '650' }), 'kg'),
  `Said: "${pageIssue('bodyweight', full({ bodyweight: '650' }), 'kg')}"`
);
check(
  'the message names the range in the unit they are typing in',
  (() => {
    const kg = pageIssue('bodyweight', full({ bodyweight: '650' }), 'kg') ?? '';
    const lb = pageIssue('bodyweight', full({ bodyweight: '20' }), 'lbs') ?? '';
    return kg.includes('kg') && lb.includes('lbs') && kg !== lb;
  })(),
  'quoting kilograms at somebody typing pounds is how "176" came to be refused as impossible'
);

// ─── 4. Age, required, sixteen to ninety ─────────────────────────────────────
console.log('\n[4] Age is required, in whole years, between 16 and 90');

check(
  'the range is the one Archie asked for',
  MIN_AGE_YEARS === 16 && MAX_AGE_YEARS === 90,
  `got ${MIN_AGE_YEARS} to ${MAX_AGE_YEARS}`
);
check('a blank age blocks', !canContinue('age', full({ age: '' }), 'kg'), '');
check(
  'fifteen blocks, and says why',
  !canContinue('age', full({ age: '15' }), 'kg') &&
    (pageIssue('age', full({ age: '15' }), 'kg') ?? '').includes('16'),
  `said: "${pageIssue('age', full({ age: '15' }), 'kg')}"`
);
check(
  'ninety-one blocks, and says why',
  !canContinue('age', full({ age: '91' }), 'kg') &&
    (pageIssue('age', full({ age: '91' }), 'kg') ?? '').includes('90'),
  `said: "${pageIssue('age', full({ age: '91' }), 'kg')}"`
);
check(
  'both ends of the range are allowed through',
  canContinue('age', full({ age: '16' }), 'kg') && canContinue('age', full({ age: '90' }), 'kg'),
  'a range nobody at the edge of it can use is a narrower range'
);
check(
  'half an age is not an age',
  !canContinue('age', full({ age: '34.5' }), 'kg') &&
    !canContinue('age', full({ age: 'thirty' }), 'kg'),
  ''
);

// ─── 5. The clinical question, put to everybody ──────────────────────────────
console.log('\n[5] Anything to work around, asked of everybody, both halves of it');

check(
  'the page is in the flow for everybody',
  SIGN_UP_PAGES.includes('around'),
  ''
);
check(
  'nothing said yet means the page is not answered',
  !canContinue('around', full({ sore: undefined, avoid: undefined }), 'kg'),
  ''
);
check(
  'saying what is sore does not answer the clinician question',
  !canContinue('around', full({ sore: ['knee'], avoid: undefined }), 'kg'),
  'an area somebody was told to stay off does not hurt while they are staying off it, so it answers no to "is anything sore"'
);
check(
  'and saying nothing is sore does not answer it either',
  !canContinue('around', full({ sore: [], avoid: undefined }), 'kg'),
  'that is the exact person the question exists for'
);
check(
  '"Nothing" is a real answer to both, and lets them through',
  canContinue('around', full({ sore: [], avoid: [] }), 'kg'),
  'a question nobody can say no to is a question that blocks the form'
);
check(
  'an area and "nothing" cannot both be true',
  (() => {
    // Ticking an area from the "nothing" state leaves the area and not the
    // nothing; the screen sets [] for nothing, and toggling adds to that list.
    const afterArea = toggleRegion([], 'knee');
    return afterArea.join(',') === 'knee' && toggleRegion(['knee'], 'knee').length === 0;
  })(),
  '"my knee, and nothing" is an answer the profile would have to guess about'
);
check(
  'every area the app can adapt around is offerable here',
  (() => {
    const all = Object.values(PAIN_CATEGORIES).flatMap((g) => g.regions.map((r) => r.id));
    return all.length >= 19 && new Set(all).size === all.length;
  })(),
  'the page draws from PAIN_CATEGORIES, which is the one list that owns them'
);

// ─── 6. The four levels, in Archie's words ───────────────────────────────────
console.log('\n[6] Four experience levels, with the descriptions Archie wrote');

check(
  'the four are the store own levels, in the store own order',
  EXPERIENCE_OPTIONS.map((o) => o.value).join(',') === EXPERIENCE_LEVELS.join(','),
  EXPERIENCE_OPTIONS.map((o) => o.value).join(',')
);
const WORDING = [
  ['beginner', 'Beginner', 'Brand new to working out'],
  ['intermediate', 'Intermediate', 'Regular exerciser (1-2 years)'],
  ['advanced', 'Advanced', 'Experienced lifter (3+ years)'],
  ['athlete', 'Athlete', 'Training for sport or peak performance'],
];
for (const [value, label, description] of WORDING) {
  const opt = EXPERIENCE_OPTIONS.find((o) => o.value === value);
  check(
    `${label} reads "${description}"`,
    opt?.label === label && opt?.description === description,
    `got ${JSON.stringify(opt)}`
  );
}
check(
  'the label map covers every level, so no picker can be missing one',
  EXPERIENCE_LEVELS.every((l) => (EXPERIENCE_LABELS[l] ?? '').length > 0),
  'a level a control cannot draw is a level somebody gets demoted out of by tapping the one next to it'
);
check(
  'the same list is what the Profile edit sheet and the programme hub read',
  /from '@\/lib\/experience-options'/.test(read('app/(tabs)/profile.tsx')) &&
    /from '@\/lib\/experience-options'/.test(read('components/ProgrammeHub.tsx')),
  'three copies of these words is three chances for them to disagree'
);

// ─── 7. Kit, and the beginner lock as it stands today ────────────────────────
console.log('\n[7] The kit page offers what the level allows');

check(
  'a beginner is offered their own bodyweight and bands',
  allowedTiersFor('beginner').join(',') === 'bodyweight,bands',
  allowedTiersFor('beginner').join(',')
);
check(
  'everybody else is offered all five',
  EXPERIENCE_LEVELS.filter((l) => l !== 'beginner').every(
    (l) => allowedTiersFor(l).length === 5
  ),
  ''
);
check(
  'a locked tile cannot be ticked even if something tries',
  toggleTier([], 'fullgym', 'beginner').length === 0,
  'the lock has to be in the rule, not only in the drawing of it'
);
check(
  'a full gym means everything, and picking something else means it is not one',
  toggleTier([], 'fullgym', 'advanced').length === 5 &&
    !toggleTier(['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'], 'dumbbells', 'advanced').includes(
      'fullgym'
    ),
  ''
);
check(
  'changing the experience answer clears the kit chosen under the old one',
  (() => {
    const advanced = full({ experience: 'advanced', equipment: ['fullgym'] });
    return pickExperience(advanced, 'beginner').equipment.length === 0;
  })(),
  'a beginner left holding "full gym" is offered exercises the page would not let them pick'
);
check(
  'but answering the same level again changes nothing',
  (() => {
    const same = full({ experience: 'advanced', equipment: ['dumbbells'] });
    return pickExperience(same, 'advanced').equipment.join(',') === 'dumbbells';
  })(),
  'clearing on a re-tap is how somebody loses an answer by pressing the button that was already on'
);

// ─── 8. A sign-up put down half way is picked up where it was ────────────────
console.log('\n[8] A half-finished sign-up resumes on the page it stopped on');

const halfWay = full({ goals: [], equipment: [], sore: undefined, avoid: undefined });
const draft = JSON.parse(JSON.stringify(answersToDraft(halfWay, 'goals')));
const restored = draftToAnswers(draft);
check(
  'every answer already given survives the app being killed',
  restored.name === 'Jo Fielding' &&
    restored.age === '34' &&
    restored.sex === 'female' &&
    restored.bodyweight === '68' &&
    restored.experience === 'intermediate',
  JSON.stringify(restored)
);
check(
  'and it comes back on the page it was left on',
  resumePage(draft) === 'goals',
  `got ${resumePage(draft)}`
);
check(
  'a draft from a build that never had these answers still opens',
  (() => {
    const old = draftToAnswers({ step: 2, name: 'Sam' });
    return old.name === 'Sam' && old.goals.length === 0 && old.sore === undefined;
  })(),
  'an older draft has to be ignorable rather than a crash'
);
check(
  'a step pointing past the end does not strand anybody on blank space',
  resumePage({ step: 99 }) !== undefined &&
    SIGN_UP_PAGES.includes(resumePage({ step: 99 })) &&
    resumePage({ step: -3 }) === 'welcome',
  `got ${resumePage({ step: 99 })}`
);
check(
  'and it never resumes ON the finish, which is a button rather than an answer',
  resumePage({ step: pageIndex('ready') }) !== 'ready',
  'landing there would let somebody finish a sign-up they had not finished answering'
);
check(
  '"nothing is sore" survives the round trip as an answer, not as silence',
  (() => {
    const said = JSON.parse(JSON.stringify(answersToDraft(full({ sore: [], avoid: [] }), 'around')));
    const back = draftToAnswers(said);
    return (
      Array.isArray(back.sore) &&
      back.sore.length === 0 &&
      Array.isArray(back.avoid) &&
      back.avoid.length === 0 &&
      canContinue('around', back, 'kg')
    );
  })(),
  'if it came back as undefined the person would be asked again, having already answered'
);

// ─── 9. Finishing writes the profile and enrols nobody ───────────────────────
console.log('\n[9] Finishing the sign-up, through the real store');

const FRESH = JSON.parse(JSON.stringify(S()));
const freshAccount = () => useAppStore.setState({ ...FRESH });
const NOW = '2026-09-18T10:00:00.000Z';

freshAccount();
S().completeOnboarding(toSignUpAnswers(full(), 'kg'), NOW);
let p = S().userProfile;

check(
  'a brand-new account finishes sign-up with no programme',
  S().programme === null,
  `programmes are optional and are chosen later. Got ${JSON.stringify(S().programme)}`
);
check(
  'and no certificate, no test week and no XP for filling in a form',
  S().testWeekFrequency === 'never' && S().xpTotal === 0 && S().earnedBadges.length === 0,
  `${S().testWeekFrequency} / ${S().xpTotal} / ${S().earnedBadges.length}`
);
check(
  'every answer they gave is on file',
  p.name === 'Jo Fielding' &&
    p.ageYears === 34 &&
    p.sex === 'female' &&
    p.bodyweightKg === 68 &&
    p.experienceLevel === 'intermediate' &&
    p.goals.join(',') === 'strength,rehab' &&
    S().equipmentTiers.join(',') === 'bodyweight,dumbbells',
  JSON.stringify({ p, tiers: S().equipmentTiers })
);
check(
  'the two lists of areas are kept apart from each other',
  p.standingSoreRegions.join(',') === 'knee' && p.clinicalAvoid.join(',') === 'front_shoulder',
  JSON.stringify({ sore: p.standingSoreRegions, avoid: p.clinicalAvoid })
);
check(
  'sign-up is marked done in the same breath, and the draft is thrown away',
  S().onboardingComplete === true && S().onboardingDraft === null,
  'a profile written without completing leaves somebody looping through sign-up for ever'
);

// The pounds fault, end to end from the typed box rather than from a number.
freshAccount();
S().completeOnboarding(toSignUpAnswers(full({ bodyweight: '176' }), 'lbs'), NOW);
check(
  '176 typed with pounds selected is stored as about 80 kg',
  Math.abs(S().userProfile.bodyweightKg - 79.83) < 0.05 && S().weightUnit === 'lbs',
  `got ${S().userProfile.bodyweightKg} kg`
);

// Nothing sore and nothing to avoid is a profile that says so.
freshAccount();
S().completeOnboarding(toSignUpAnswers(full({ sore: [], avoid: [] }), 'kg'), NOW);
check(
  'somebody with nothing wrong finishes with two empty lists rather than nothing',
  S().userProfile.standingSoreRegions.length === 0 && S().userProfile.clinicalAvoid.length === 0,
  JSON.stringify(S().userProfile.standingSoreRegions)
);

check(
  'the answers handed over are exactly what was typed, converted by nobody on the way',
  (() => {
    const out = toSignUpAnswers(full({ bodyweight: '176', goals: ['rehab'] }), 'lbs');
    return (
      out.bodyweight === 176 &&
      out.weightUnit === 'lbs' &&
      out.goals.join(',') === 'rehab' &&
      out.ageYears === 34
    );
  })(),
  'one conversion, in the store, is what stopped 176 pounds being stored as 176 kilograms'
);

// ─── 10. The screen is wired to these rules ──────────────────────────────────
//
// The one section that reads source. A React Native screen cannot be imported
// under tsx, so this is the seam: it says that the screen asks the functions
// above rather than keeping its own copy of the answers to them.
console.log('\n[10] The screen asks these rules rather than repeating them');

const screen = read('app/onboarding.tsx');
const screenCode = screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

check(
  'the Continue button is gated on the shared rule',
  /canContinue\(page, answers, weightUnit\)/.test(screenCode),
  'a screen with its own switch is a second set of rules, and it is the one that gets it wrong'
);
check(
  'and the message under a box is the shared one',
  /pageIssue\(page, answers, weightUnit\)/.test(screenCode),
  'a validator whose message never reaches the screen is a silent refusal'
);
check(
  'the pages are rendered from the shared list',
  /SIGN_UP_PAGES/.test(screenCode) && !/currentIndex/.test(screenCode),
  'a bare index referenced from five places is what dead-ended the first pager twice'
);
check(
  'the profile is written by the one action, called from exactly one place',
  (screenCode.match(/completeOnboarding\(/g) ?? []).length === 1 &&
    !/setUserProfile|setEquipmentTiers|setOnboardingComplete|addOneRepMax/.test(screenCode),
  'seven separate setters could half-succeed, and a crash between two of them left somebody with a profile and no equipment'
);
check(
  'nothing is written before the last page',
  (() => {
    const at = screenCode.indexOf('const handleFinish');
    const body = screenCode.slice(at, at + 400);
    return at > 0 && /completeOnboarding\(toSignUpAnswers\(answers, weightUnit\)/.test(body);
  })(),
  'an answer given after the save is an answer that gets ignored'
);
check(
  'the screen never navigates for itself',
  !/router\.(replace|push)/.test(screenCode),
  'the gate in app/_layout.tsx decides what comes next; routing from here skips auth and the paywall'
);
check(
  'the unit switch takes effect the moment it is tapped',
  /setWeightUnit\(opt\.value\)/.test(screenCode),
  'the box next to it is validated in that unit, so a switch that waited would refuse a real bodyweight'
);
check(
  'a half-finished sign-up is written down as it goes',
  /saveOnboardingDraft\(answersToDraft\(answers, page/.test(screenCode),
  'writing only at the end is what made closing the app on page nine throw away eight answers'
);
check(
  // The first screen in the app a new user sees, and the one that moves most.
  'the flow honours a reduced-motion setting',
  /useReducedMotion\(\)/.test(screenCode) &&
    /reduceMotion \? undefined : FadeInDown/.test(screenCode) &&
    /animated: Platform\.OS !== 'web' && !reduceMotion/.test(screenCode),
  'a page that slides itself every time you answer is exactly why somebody turns that setting on'
);
check(
  'and there is no certificate, no programme and no self-check left in it',
  !/ProgrammeCertificate|ExploreStart|ProfileTree|applyProfileTree|selectProgramme/.test(screenCode),
  'signing up produces a profile. It does not enrol anybody in anything'
);

// ─── Result ──────────────────────────────────────────────────────────────────
console.log(`\nonboarding-pager: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
