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

const src = readFileSync(new URL('../app/subscription.tsx', import.meta.url), 'utf8');
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

check(
  'the CTA is disabled when there is nothing to buy',
  /disabled=\{purchasing \|\| \(!!RC_API_KEY && !__DEV__ && \(loadingOffering \|\| !offering\)\)\}/.test(
    code
  ),
  'it looked fully live with no offering loaded; pressing it only printed an error'
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

console.log(`\npaywall-honesty: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
