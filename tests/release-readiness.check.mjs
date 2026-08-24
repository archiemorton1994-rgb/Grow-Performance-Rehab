/**
 * Contract test: nothing developer-facing ships, and the build can be shipped twice.
 *
 * ── THE CRASH PANEL ────────────────────────────────────────────────────────
 * After any crash, the next launch opened on a black full-screen panel headed
 * "Last Crash Log" in red, containing a timestamp, a `fatal` flag, the internal
 * error message and up to 1200 characters of JavaScript stack trace.
 *
 * The vicious part is who could see it. The handler that WRITES __last_crash__
 * is gated to production builds, so the panel was invisible in Expo Go and in
 * every dev build — the only people who could ever reach it were paying
 * customers and App Review. It reads as a catastrophically broken app and is a
 * straight Guideline 2.1 rejection for shipping diagnostic content.
 *
 * It was also a third uncoordinated root Modal, able to present alongside the
 * weekly weigh-in prompt and freeze the app on launch — which would have been
 * freeze incident number five.
 *
 * Deleted, not hidden. The crash is still POSTed to /api/crash-log on the next
 * launch, which is where it belongs and where the owner can actually read it.
 *
 * ── SIGNING OUT ON A BAD CONNECTION ────────────────────────────────────────
 * One try/catch wrapped the identity check, the subscription refresh AND the
 * data sync, with clearToken() in the catch. Any failure signed the user out:
 * no signal, a plane, a gym basement, or one cold start of a sleeping server
 * returning 502 — which would have signed out every user who opened the app
 * during it, simultaneously. Getting back in then needs working internet AND an
 * email code, neither of which the user has in the situation that caused it.
 *
 * ── BUILD NUMBERS ─────────────────────────────────────────────────────────
 * Pinned at 1, so the first submission works and every one after it is refused
 * as a duplicate. No user-visible symptom; it appears at upload time, at
 * exactly the wrong moment.
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

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// The comment explaining WHY the crash panel was removed quotes its own
// heading, so an assertion against the raw file is satisfied by the prose that
// documents the fix. Strip comments for the "is it gone" checks and keep the
// raw text for the "is it still reported" ones, which look at real code.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const rootLayoutRaw = read('app/_layout.tsx');
const rootLayout = stripComments(rootLayoutRaw);
const auth = read('lib/auth-context.tsx');
const profile = read('app/(tabs)/profile.tsx');
const appJson = JSON.parse(read('app.json'));
const easJson = JSON.parse(read('eas.json'));

console.log('\n[1] No crash diagnostics reach a customer');

check(
  'the crash-log Modal is gone',
  !/Last Crash Log/.test(rootLayout),
  'a stack trace on a black screen is what App Review would see after any crash'
);

check(
  'the pre-fonts crash dump is gone too',
  !/Previous Launch Crash/.test(rootLayout),
  'the same content, shown before the fonts load'
);

check(
  'no component renders the stored crash text',
  !/lastCrash/.test(rootLayout),
  'the state, its loader and the scroll view all go with it'
);

check(
  'the crash is still recorded',
  /AsyncStorage\.setItem\('__last_crash__', entry\)/.test(rootLayout),
  'removing the SCREEN must not remove the reporting'
);

check(
  'the crash is still uploaded to the server',
  /\/api\/crash-log/.test(rootLayoutRaw),
  'this is where the owner reads crashes; it is the reason the on-device panel is unnecessary'
);

console.log('\n[2] Only the server may end a session');

check(
  'the token is cleared on 401/403 and nothing else',
  /if \(status === 401 \|\| status === 403\)/.test(auth),
  'any other failure is a network problem, not a rejected credential'
);

check(
  'the status comes off the error rather than a parsed string',
  /\(err as ApiError \| null\)\?\.status/.test(auth),
  'apiRequest attaches res.status so callers do not have to re-parse the message'
);

check(
  'the data sync cannot sign anyone out',
  /downloadUserData\(\)[\s\S]{0,400}?\} catch \{\}/.test(auth),
  'sync lives outside the credential try/catch - a sync hiccup is not evidence about a token'
);

check(
  'an unreachable server falls back to the cached identity',
  /const cached = await loadCachedUser\(\)/.test(auth),
  'isAuthenticated is !!user, so keeping the token alone still shows the sign-in screen'
);

check(
  'the cached identity is cleared with the token',
  /setAuthToken\(null\);\s*\r?\n\s*await AsyncStorage\.removeItem\(CACHED_USER_KEY\)/.test(auth),
  'signing out must leave nothing behind'
);

check(
  'the cache is only ever written after the server confirms it',
  /confirmedUserId = data\.user\.id;\s*\r?\n\s*void cacheUser\(data\.user\)/.test(auth),
  'it is a cache of a server answer, never a substitute for one'
);

console.log('\n[3] No raw server output in front of a user');

check(
  'account deletion failures go through friendlyError',
  /friendlyError\(err, 'Could not delete your account/.test(profile),
  "Apple's reviewers are required to test account deletion; an HTML 502 page in an alert is what they would find"
);

check(
  'friendlyError is shared rather than duplicated',
  /export function friendlyError/.test(read('lib/utils.ts')),
  'it was solved once on the sign-in screen and left there'
);

check(
  'the sign-in screen uses the shared copy',
  /import \{ friendlyError \} from '@\/lib\/utils'/.test(read('app/auth/index.tsx')),
  'two copies drift'
);

console.log('\n[4] A second build can be uploaded');

check(
  'EAS owns the build number',
  easJson.cli?.appVersionSource === 'remote',
  'without this the number is read from app.json and never moves'
);

check(
  'production builds auto-increment',
  easJson.build?.production?.autoIncrement === true,
  'this is what makes the second submission possible'
);

check(
  'Android has an explicit starting point',
  typeof appJson.expo?.android?.versionCode === 'number',
  'Play Console needs a versionCode to increment from'
);

check(
  'the marketing version is still hand-managed',
  appJson.expo?.version === '1.0.0',
  'this one is meant to be bumped deliberately per release, unlike the build number'
);

check(
  'the production env block is untouched',
  easJson.build?.production?.env?.EXPO_PUBLIC_DOMAIN != null,
  'the build config change must not have disturbed the environment'
);

// ─── The offline fallback has to exist before it is needed ───────────────────
//
// Not signing people out on a network failure is only half of it. The launch
// path recovers the identity from loadCachedUser(), and that cache was written
// in exactly ONE place: a successful /api/auth/me at startup. Signing in did not
// write it.
//
// So the protection began working on the SECOND launch, which is the wrong way
// round. Measured in the browser: sign in, then cold start with no network, and
// the app opened on "Welcome to Grow" holding a valid token and a full local
// store. One successful launch first and it opened on the user's own home
// screen. The person it locked out is a new user with no signal, who is exactly
// the person most likely to decide the app has lost their account.
console.log('\n[Offline recognition]');

check(
  'signing in writes the cached identity, not just the token',
  /setUser\(data\.user\);[\s\S]{0,900}?void cacheUser\(data\.user\);[\s\S]{0,120}?setHasSignedOut\(false\);/.test(
    auth
  ),
  'the offline launch path reads this cache, and it did not exist yet for somebody who had only just signed in'
);
check(
  'and the launch check still writes it too',
  (auth.match(/cacheUser\(data\.user\)/g) ?? []).length >= 2,
  'both routes into the app have to leave the same thing behind'
);
check(
  'the offline path still reads it',
  /const cached = await loadCachedUser\(\)/.test(auth) && /setUser\(cached\)/.test(auth),
  ''
);

console.log(`\nrelease-readiness: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
