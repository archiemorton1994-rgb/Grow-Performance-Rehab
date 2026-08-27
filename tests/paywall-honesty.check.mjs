/**
 * Contract test: the paywall promises only what it can deliver, and can be left.
 *
 * ── IT PROMISED A FREE TRIAL TO EVERYONE ───────────────────────────────────
 * The card read "Start 14-Day Free Trial" regardless of who was looking at it.
 * Apple grants an introductory offer once per Apple ID, so a returning customer
 * — trial already used, subscription cancelled, or simply reinstalling on a new
 * phone — tapped a button promising 14 days free and was charged the full month
 * immediately by Apple's own payment sheet. Same day. That is a refund request,
 * a one-star review, and a fair accusation of a misleading claim.
 *
 * The fallback made it worse: with no package loaded at all, the text was
 * hardcoded to claim a trial that nothing in the store backed.
 *
 * ── AND THERE WAS NO WAY OFF IT ────────────────────────────────────────────
 * Signed in but not subscribed, this was the only reachable screen: no back, no
 * close, no way to change account. Sign in with the wrong email and Restore
 * correctly answers "nothing to restore", leaving nothing to try. Deleting and
 * reinstalling does not help either — the login lives in the keychain and
 * survives it. The only escape was to contact support.
 *
 * ── AND RESTORE RACED THE GUIDED TOUR ──────────────────────────────────────
 * A successful restore raised a native Alert and navigated into the tabs, where
 * a first run presents the tour card. Two native pop-ups in the same instant, on
 * the get-a-new-phone path — the collision that reads as "the app is frozen".
 */
import { readFileSync } from 'fs';

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
const src = read('app/subscription.tsx');
const profileSrc = read('app/(tabs)/profile.tsx');
const onboardingSrc = read('app/onboarding.tsx');
const serverSrc = read('server/routes.ts');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const code = stripComments(src);

console.log('\n[1] A trial is only promised to someone who can have one');

check(
  'the store is asked about eligibility',
  /checkTrialOrIntroductoryPriceEligibility/.test(code),
  'without asking, every returning customer is promised a trial Apple will not grant'
);

check(
  'only a clear ELIGIBLE counts',
  /INTRO_ELIGIBILITY_STATUS\.INTRO_ELIGIBILITY_STATUS_ELIGIBLE/.test(code),
  'unknown and ineligible must both fall through to the honest wording'
);

check(
  'it defaults to not eligible',
  /useState\(false\);?\s*$/m.test(code.split('trialEligible')[1]?.split('\n')[0] ?? '') ||
    /const \[trialEligible, setTrialEligible\] = useState\(false\)/.test(code),
  'assuming eligible until told otherwise is the expensive way round'
);

check(
  'a failed eligibility check does not promise a trial',
  /catch \{\s*\r?\n?\s*setTrialEligible\(false\);/.test(code),
  'if the store cannot be asked, do not make the claim'
);

check(
  'no hardcoded trial claim survives',
  !/14-Day Free Trial|14-day free trial/.test(code),
  'the fallback used to assert a trial that nothing in the store backed'
);

check(
  'an ineligible user is offered a plain Subscribe',
  /cta: 'Subscribe'/.test(code),
  ''
);

check(
  'the copy is gated on eligibility before anything else',
  /if \(!trialEligible\) \{\s*\r?\n?\s*return \{ badge: '', cta: 'Subscribe', sub: '' \};/.test(code),
  'the eligibility answer has to reach the wording, not just be fetched'
);

check(
  'and the wording function is called with it',
  /getTrialText\(offering, trialEligible\)/.test(code),
  'computing eligibility and then ignoring it is the same bug with extra steps'
);

console.log('\n[2] The card states only what it knows');

check(
  'no price means no claim about price',
  !/the standard rate/.test(code),
  'a subscription pitch whose price line reads "the standard rate" is both useless and a review risk'
);

check(
  'the empty trial badge is not rendered',
  /trialText\.badge \?/.test(code),
  'an empty pill is worse than no pill'
);

/**
 * The disable rule is LIFTED OUT AND RUN, rather than matched as a string.
 *
 * Matching the text meant the check passed for whatever the expression happened
 * to say, and the expression said the wrong thing for over a year: it began
 * with !!RC_API_KEY, so a build with no key at all left the button fully
 * enabled. Every user on the paywall, pressing a live-looking button that did
 * nothing, with no price and no error, because offeringError only goes true
 * when a real fetch throws and without a key there is never a fetch.
 *
 * Running it means the three states are checked, not the wording.
 */
const disabledExpr = (() => {
  const at = code.indexOf('disabled={purchasing');
  if (at === -1) return null;
  const open = code.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  return null;
})();
check(
  'the CTA disable rule could be read off the source',
  disabledExpr != null,
  'the button has moved and the three checks below prove nothing'
);
const isDisabled = (state) =>
  Function(
    'purchasing',
    'storeUnavailable',
    'RC_API_KEY',
    '__DEV__',
    'loadingOffering',
    'offering',
    'return !!(' + (disabledExpr ?? 'false') + ');'
  )(
    state.purchasing ?? false,
    state.storeUnavailable ?? false,
    state.RC_API_KEY ?? 'appl_test',
    state.__DEV__ ?? false,
    state.loadingOffering ?? false,
    state.offering ?? {}
  );
check(
  'it is disabled while the offering is still loading',
  isDisabled({ loadingOffering: true, offering: null }),
  'it looked fully live with no offering loaded; pressing it only printed an error'
);
check(
  'it is disabled when this build cannot reach the store at all',
  isDisabled({ storeUnavailable: true, RC_API_KEY: '', offering: null }),
  'without a key there is no price, no error and no purchase, so an enabled button is a lie the size of the whole app'
);
check(
  'and it is live when there is something to buy',
  !isDisabled({}),
  'a paywall that can never be bought from is worse than the bug it was fixing'
);
check(
  'storeUnavailable means exactly "no key, and not a dev build"',
  /const storeUnavailable = !RC_API_KEY && !__DEV__;/.test(code),
  'in dev the purchase is deliberately faked, so the button has to stay live there'
);
check(
  'and the screen says so rather than showing a blank price',
  /testID="store-unavailable"/.test(code) && /cannot reach the App Store/.test(code),
  'silence here is indistinguishable from a broken app, and it would be every user at once'
);

console.log('\n[3] There is a way off the screen');

check(
  'a sign-out control exists',
  /testID="subscription-sign-out"/.test(code),
  'signed in to the wrong account, this screen was inescapable - reinstalling does not clear the keychain'
);

check(
  'it confirms first',
  /Sign out\?/.test(src),
  'signing out clears local data; that should not be discovered by accident'
);

check(
  'it uses the existing auth action rather than its own',
  /signOut \} = useAuth\(\)/.test(code) && /void signOut\(\)/.test(code),
  'the gate in _layout already routes a signed-out user to sign-in'
);

console.log('\n[4] Restore cannot collide with the guided tour');

check(
  'a successful restore does not raise a native alert',
  !/Alert\.alert\('Subscription restored'/.test(code),
  'it presented in the same instant as the first-run tour card - two native modals, which reads as a freeze'
);

check(
  'it reports success in the page instead',
  /setInfoMsg\('Subscription restored\.'\)/.test(code),
  ''
);

check(
  'the nothing-to-restore alert is kept',
  /Nothing to restore/.test(code),
  'that one does NOT navigate, so it cannot collide - and silence there leaves the user guessing'
);

console.log('\n[5] Apple’s required links are still present');

check(
  'terms and privacy are both linked',
  /testID="legal-terms"/.test(code) && /testID="legal-privacy"/.test(code),
  'a paywall without both is rejected'
);

check(
  'restore purchases is still offered',
  /testID="restore-purchases"/.test(code),
  'also required'
);

// ─── 6. Nothing invents a price, and nothing assumes a billing period ───────
console.log('\n[6] No screen states a price or a period it has not been told');

/**
 * The paywall was already careful: it renders offering.product.priceString and,
 * when the price has not loaded, says nothing about money at all. Two other
 * places were not.
 *
 * app/(tabs)/profile.tsx printed "£4.99/month · cancel anytime" in two spots,
 * hardcoded. A user in Ohio read pounds on one screen and dollars on the App
 * Store sheet, and a price change would have left both lying.
 *
 * The paywall itself hardcoded "month" in four places while buying
 * `offerings.current?.monthly ?? offerings.current?.availablePackages[0]` -
 * so an offering without a monthly package would have sold an annual product
 * as "£X / month".
 */
const MONEY = /[£$€]\s?\d|\d+\.\d{2}\s*(?:per|\/)\s*(?:month|year|week)/;
const codeOf = (t) => stripComments(t);
check(
  'the profile screen states no price of its own',
  !MONEY.test(codeOf(profileSrc)),
  'it hardcoded a pound price twice, on a screen that never asks the store anything'
);
check(
  'and neither does the paywall',
  !MONEY.test(code),
  'every number on it has to come from priceString'
);
check(
  'the paywall reads the billing period from the package',
  /periodWordsFor\(offering\)/.test(code),
  'it hardcoded "month" while buying whatever package the offering happens to list first'
);
check(
  'and no longer writes the period into the copy by hand',
  !/\/ month|Grow Monthly|Auto-renews monthly/.test(code),
  'one of the four hardcoded "month"s is still there'
);

// periodWordsFor lives in lib/ precisely so this can run it.
const { periodWordsFor } = await import('../lib/subscription-period.ts');
check(
  'an annual package is described as annual',
  periodWordsFor({ product: { subscriptionPeriod: 'P1Y' }, packageType: 'ANNUAL' }).per === 'year',
  'this is the case the four hardcoded "month"s got wrong'
);
check(
  'a monthly package is still described as monthly',
  periodWordsFor({ product: { subscriptionPeriod: 'P1M' }, packageType: 'MONTHLY' }).per === 'month',
  ''
);
check(
  'a package with no period at all is described as nothing',
  periodWordsFor({ product: {}, packageType: 'CUSTOM' }).per === '' &&
    periodWordsFor(null).planWord === '',
  'guessing "month" is exactly the bug; silence is the correct answer'
);
// Scoped to the rendered HTML rather than the whole file: a SQL placeholder
// like $1 looks exactly like a dollar price to the regex above.
const legalHtml = serverSrc.slice(serverSrc.indexOf('legalPageHtml'));
check(
  'the Terms page names no price of its own',
  !MONEY.test(legalHtml),
  'a hand-maintained price in the legal text cannot track the store'
);

// ─── 7. No trial is promised before the store has been asked ────────────────
console.log('\n[7] Only the paywall talks about a trial, because only it has asked');

/**
 * getTrialText refuses to name a trial unless the store returns a zero-price
 * introductory offer AND Apple says this Apple ID is still eligible. Apple
 * grants that offer once per Apple ID, not once per Grow account.
 *
 * The celebration screen at the end of onboarding said "The first 14 days are
 * on us", by name, two screens before the paywall and before sign-in. For a
 * returning user, or anyone reinstalling, the paywall then said "Subscribe"
 * with the full price and no badge.
 */
const TRIAL_CLAIM = /\bfree trial\b|days are on us|\b\d+\s*(?:-|\s)?day(?:s)? free\b/i;
check(
  'onboarding promises no free period',
  !TRIAL_CLAIM.test(stripComments(onboardingSrc)),
  'it cannot know: eligibility is per Apple ID and the app has not asked the store yet'
);
check(
  'and it invents no trial length',
  // stripComments, because the comment explaining why the line went quotes it.
  !/first 14 days|14 days are on us/i.test(stripComments(onboardingSrc)),
  'the number 14 appeared nowhere else in the app, including the store'
);
check(
  'the Terms page does not state a fixed trial length',
  !/\b\d+-day free trial\b/i.test(serverSrc),
  'it promised every new subscriber 14 free days, which Apple will not grant to a reused Apple ID'
);

// ─── 8. The three stats count what their labels say ─────────────────────────
console.log('\n[8] Every number on the paywall counts what it claims to count');

const db = await import('../lib/exercise-db.ts');
check(
  `distinct movements (${db.distinctExerciseCount()}) is fewer than catalogue rows (${db.exerciseCount()})`,
  db.distinctExerciseCount() > 0 && db.distinctExerciseCount() < db.exerciseCount(),
  'the same movement is filed under several ids so it can appear in several pools'
);
check(
  'the exercises stat counts movements, not catalogue rows',
  /distinctExerciseCount\(\)\}\+`, label: 'exercises'/.test(code),
  'EXERCISE_COUNT counted the same exercise once per pool it appears in'
);

const store = await import('../lib/store.ts');
// Every region the body diagram can actually put in front of a user, read off
// the picker rather than hand-listed here.
const recoverSrc = read('app/(tabs)/recover.tsx');
const reachable = new Set();
for (const name of ['REGION_FRONT', 'REGION_BACK']) {
  const at = recoverSrc.indexOf('export const ' + name);
  if (at < 0) continue;
  const block = recoverSrc.slice(at, recoverSrc.indexOf(']', at));
  for (const m of block.matchAll(/'([a-z_]+)'/g)) reachable.add(m[1]);
}
check(
  `the diagram offers ${reachable.size} regions and the test can see them`,
  reachable.size > 10,
  'the region lists have moved and this check has gone blind'
);
check(
  `the pain-zones stat matches them (${store.PAIN_ADAPTATION_REGION_COUNT})`,
  store.PAIN_ADAPTATION_REGION_COUNT === reachable.size,
  'it summed three of the five region groups, so the paywall advertised 12 of the 19 zones the app actually adapts around'
);

// ─── 9. The subscription card says only what the entitlement knows ──────────
console.log('\n[9] The profile card claims nothing the store has not told it');

const profileCode = stripComments(profileSrc);
/**
 * The card may say "Renews" now, but only when the store has said it will.
 *
 * expirationDate comes back whether or not auto-renew is on, so the old card
 * told somebody who had cancelled the day before that their subscription
 * renewed on the very date it ran out. willRenew is the field that separates
 * those, and it is READ ONLY: the gate in app/_layout.tsx consults
 * hasActiveSubscription and nothing else, which the last check in this block
 * exists to keep true.
 */
const { subscriptionDateLabel } = await import('../lib/subscription-period.ts');
check(
  'a cancelled subscription is said to END, not to renew',
  subscriptionDateLabel(false, false) === 'Ends',
  'this is the case that was wrong: the date is when access stops'
);
check(
  'a renewing subscription is still said to renew',
  subscriptionDateLabel(false, true) === 'Renews',
  ''
);
check(
  'a trial that will convert names the charge, not an expiry',
  subscriptionDateLabel(true, true) === 'First charge',
  'a trial about to start billing does not "expire", and that is the date worth knowing'
);
check(
  'a trial that will not convert says so',
  subscriptionDateLabel(true, false) === 'Free trial ends',
  ''
);
check(
  'the card gets the wording from that one function',
  /subscriptionDateLabel\(isOnTrial, willRenew\)/.test(profileCode),
  'a second copy of these four cases is a second copy to get wrong'
);

const authSrc = read('lib/auth-context.tsx');
check(
  'willRenew is read off the entitlement and defaults to false',
  /const willRenew = entitlement\?\.willRenew \?\? false;/.test(authSrc),
  'an unknown answer has to produce the cautious wording, not a promise to bill again'
);
check(
  'and the gate still reads nothing but isActive',
  !/willRenew/.test(read('app/_layout.tsx')),
  'this field is for display. The moment it reaches the gate it is deciding who gets in, which is a different change entirely'
);
check(
  'it does not count down days from a rounded-up gap',
  !/Math\.ceil\([\s\S]{0,120}?1000 \* 60 \* 60 \* 24/.test(profileCode),
  'Math.ceil rounded UP, so six days and five hours printed as seven, and the last day printed "1 days"'
);
check(
  'and it does not name a billing period',
  !/Grow Monthly/.test(profileCode),
  'this screen never asks the store anything, so it cannot know the period'
);

// ─── 10. House style, in the copy around the money ──────────────────────────
console.log('\n[10] The subscription copy follows the same writing rules as the app');

const userStrings = (t) =>
  [...stripComments(t).matchAll(/'([^'\n]{12,})'|"([^"\n]{12,})"/g)]
    .map((m) => m[1] ?? m[2])
    .filter((v) => !/^[a-z-]+$|^https?:|^itms-|^@\/|\.tsx?$/.test(v));
const dashed = [
  ...userStrings(src).map((v) => ['subscription.tsx', v]),
  ...userStrings(profileSrc).map((v) => ['profile.tsx', v]),
].filter(([, v]) => / - |—|–/.test(v));
check(
  'no spaced hyphen doing a dash job in paywall or profile copy',
  dashed.length === 0,
  dashed.map(([f, v]) => `${f}: "${v}"`).join(' | ')
);
check(
  'nor in the legal pages',
  !/<\/strong> - |damages - |interruption - /.test(legalHtml),
  'both pages used a spaced hyphen as a dash throughout the list items'
);
check(
  'the legal pages stamp a date each page owns',
  /legalPageHtml = \(title: string, updated: string, body: string\)/.test(serverSrc),
  'the date was a literal in the shared shell, so editing the terms could never move it'
);

console.log(`\npaywall-honesty: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
