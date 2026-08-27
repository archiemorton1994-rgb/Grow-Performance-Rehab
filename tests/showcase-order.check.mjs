/**
 * Contract test: the app is shown before it is sold, and the paywall keeps its
 * reach while that happens.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The order used to be twelve onboarding screens, sign in, PAY, and only then
 * the guided tour and the practice session. Every download invested ten minutes
 * and handed over card details before experiencing a single thing the app does.
 * The practice session, built so that logging a real one feels familiar, was
 * seen only by people who had already converted.
 *
 * THE RISK IN FIXING IT
 * ─────────────────────
 * The obvious move is to run the existing tab tour before the gate. That would
 * put (tabs) in front of the paywall, and anyone who skipped the tour would
 * simply be inside the app. So the showcase and the offer live OUTSIDE the tabs,
 * and the practice session they end on is a root-level route in demo mode which
 * cannot write to the store.
 *
 * These checks exist to keep both halves true: that the app is shown first, and
 * that showing it did not open a door.
 *
 * Run:  npx tsx tests/showcase-order.check.mjs
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
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const layout = read('app/_layout.tsx');
const layoutCode = stripComments(layout);
const showcase = read('app/showcase.tsx');
const showcaseCode = stripComments(showcase);
const offer = read('app/offer.tsx');
const offerCode = stripComments(offer);
const session = read('app/session.tsx');
const sessionCode = stripComments(session);
const store = read('lib/store.ts');

// ─── 1. The order ────────────────────────────────────────────────────────────
console.log('\n[1] Nobody is asked to pay for something they have not seen');

const gate = layoutCode.slice(
  layoutCode.indexOf('if (!onboardingComplete) {'),
  layoutCode.indexOf('return () => {', layoutCode.indexOf('if (!onboardingComplete) {'))
);
check(
  'the gate was found',
  gate.length > 100,
  'everything below this proves nothing otherwise'
);
const at = (needle) => gate.indexOf(needle);
check(
  'onboarding still comes first, then sign in',
  at("router.replace('/onboarding')") < at("router.replace('/auth')") &&
    at("router.replace('/auth')") > 0,
  ''
);
check(
  'the showcase comes before the paywall',
  at("router.replace('/showcase')") > 0 &&
    at("router.replace('/showcase')") < at("router.replace('/subscription')"),
  'this is the whole change: see the app, then decide'
);
check(
  'and the paywall is still reached afterwards',
  at("router.replace('/subscription')") > 0,
  'a showcase that swallows the paywall is not a fix'
);
check(
  'the showcase is shown once, not on every launch',
  /!hasActiveSubscription && !showcaseComplete/.test(gate),
  'a pitch you cannot get past is worse than no pitch'
);
check(
  'somebody already subscribed is pushed off it',
  /currentPath === 'showcase' \|\|[\s\S]{0,40}currentPath === 'offer'/.test(gate),
  'otherwise a paying user who deep links here is stuck looking at an advert'
);

// ─── 2. Showing the app did not open a door ──────────────────────────────────
console.log('\n[2] The paywall keeps exactly the reach it had');

check(
  'access is still decided by the subscription alone',
  /} else if \(!hasActiveSubscription\) \{/.test(gate) &&
    !/showcaseComplete[\s\S]{0,60}router\.replace\('\/\(tabs\)'\)/.test(gate),
  'showcaseComplete gates a SCREEN. The moment it decides who gets into the tabs it is a hole in the paywall'
);
check(
  'the showcase lives outside the tabs',
  // stripComments, because the docblock explaining WHY it is outside the tabs
  // has to name them. Third time this file pattern has bitten in one week.
  !showcaseCode.includes('(tabs)'),
  'running the tab tour before the gate would mean anyone who skipped it was simply inside the app'
);
check(
  'so does the offer',
  !offerCode.includes('(tabs)'),
  ''
);
check(
  'the practice session it ends on is a demo',
  /session\?demo=true&showcase=true/.test(showcaseCode),
  'demo mode is what stops it writing to the store, see tests/demo-session-no-persist.check.mjs'
);
check(
  'and the showcase route never opens a real session',
  !/router\.(push|replace|navigate)\('\/readiness/.test(showcaseCode),
  'a real session would need a readiness check and would log against an account that has not paid'
);

// ─── 3. The practice session knows which flow it is in ───────────────────────
console.log('\n[3] One practice session, two endings, no crossed wires');

check(
  'it reads the showcase flag',
  /const isShowcase = params\.showcase === 'true';/.test(sessionCode),
  ''
);
check(
  'finishing it from the showcase goes to the offer, not the tabs',
  /isShowcase \? '\/offer' : '\/\(tabs\)'/.test(sessionCode),
  'the tabs are behind a paywall this person has not passed yet'
);
check(
  'and skipping it from the showcase does too',
  /if \(isShowcase\) \{[\s\S]{0,120}router\.replace\('\/offer'/.test(sessionCode),
  'a skip that lands nowhere strands somebody mid-flow'
);
check(
  'it does not mark the guided tour complete',
  /if \(isShowcase\) \{[\s\S]{0,120}setShowDemoComplete\(true\);[\s\S]{0,40}return null;/.test(
    sessionCode
  ),
  'the tab tour has not happened yet and still has to run once they subscribe'
);

// ─── 4. The offer names only what the store confirms ─────────────────────────
console.log('\n[4] The offer screen asks before it promises');

check(
  'it asks whether THIS Apple ID is eligible',
  /checkTrialOrIntroductoryPriceEligibility/.test(offerCode),
  'the offer is granted once per Apple ID, not once per Grow account'
);
check(
  'only a clear ELIGIBLE counts',
  /INTRO_ELIGIBILITY_STATUS_ELIGIBLE/.test(offerCode),
  ''
);
check(
  'it defaults to not eligible',
  /useState\(false\)/.test(offerCode) && /setEligible\(false\)/.test(offerCode),
  'assuming a gift until told otherwise is the expensive way round'
);
check(
  'it uses the same wording function as the paywall',
  /getTrialText\(pkg, eligible\)/.test(offerCode),
  'two implementations of what we may say about a free period is the bug this app spent a week removing'
);
check(
  'it invents no number of days',
  !/\b\d+\s*(?:-|\s)?days?\b/i.test(offerCode.replace(/periodNumberOfUnits/g, '')),
  'the length has to come from the store, or a seven-day product is advertised as fourteen'
);
check(
  'and no price of its own',
  !/[£$€]\s?\d/.test(offerCode),
  'same rule as everywhere else: the price belongs to the store'
);
check(
  'somebody with no trial available is not shown an empty promise',
  /hasTrial \?/.test(offerCode),
  'the screen has to have a second thing to say, or it says the first thing to everyone'
);

// ─── 5. Nobody is trapped in a pitch ─────────────────────────────────────────
console.log('\n[5] It can be left');

check(
  'the showcase can be skipped',
  /testID="showcase-skip"/.test(showcase),
  'a walkthrough with no way out is the thing that gets an app deleted'
);
check(
  'and skipping still lands on the offer',
  /handleSkip[\s\S]{0,220}router\.replace\('\/offer'/.test(showcaseCode),
  'skipping the pitch is not skipping the decision'
);
/**
 * ON THE BUTTON, NOT ON MOUNT, AND THIS IS THE ASSERTION THAT SAYS WHY.
 *
 * On mount looked tidier and broke the screen outright. The gate exempts the
 * offer route only while the showcase is unseen, so setting the flag as it
 * opened made the exemption stop applying in the same tick, and the gate
 * replaced the offer with the paywall before anybody read a word of it. It was
 * found by screenshotting the exported bundle, not by reading the code, and
 * nothing in the suite would have caught it.
 */
check(
  'the showcase is marked seen by the button, not on mount',
  /setShowcaseComplete\(true\);[\s\S]{0,60}router\.replace\('\/subscription'/.test(offerCode) &&
    !/useEffect\(\(\) => \{\s*setShowcaseComplete\(true\);/.test(offerCode),
  'on mount, the gate replaces this screen with the paywall in the same tick'
);
check(
  'the flag is persisted and migrated',
  /showcaseComplete: boolean;/.test(store) && /persistedState\.showcaseComplete = false;/.test(store),
  'without the migration an existing user gets an undefined flag and the gate reads it as not seen'
);

// ─── 6. House style ──────────────────────────────────────────────────────────
console.log('\n[6] The copy follows the same rules as the rest of the app');

const copyOf = (src) =>
  [...src.matchAll(/(?:title|body|proof|eyebrow):\s*[`'"]([^`'"]{10,})[`'"]/g)].map((m) => m[1]);
const showcaseCopy = copyOf(showcaseCode);
check(
  `the showcase copy was found (${showcaseCopy.length} strings)`,
  showcaseCopy.length >= 8,
  'the card shape has changed and the rules below have gone blind'
);
check(
  'no long dash, and no spaced hyphen doing a dash job',
  !showcaseCopy.some((v) => /—|–|―| - /.test(v)),
  showcaseCopy.filter((v) => /—|–|―| - /.test(v)).join(' | ')
);
check(
  'no emoji',
  !showcaseCopy.some((v) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(v)),
  ''
);
check(
  'the numbers it quotes are measured, not typed',
  /PAIN_ADAPTATION_REGION_COUNT/.test(showcaseCode) && /SESSION_TYPE_COUNT/.test(showcaseCode),
  'a marketing screen is exactly where an invented number would go unnoticed'
);
check(
  'it promises no trial of its own',
  !/free trial|days are on us|days free/i.test(showcaseCode),
  'only the offer screen has asked the store, so only the offer screen may say it'
);

console.log('');
if (failures > 0) {
  console.error(`showcase-order: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`showcase-order: all ${total} checks passed\n`);
  process.exitCode = 0;
}
