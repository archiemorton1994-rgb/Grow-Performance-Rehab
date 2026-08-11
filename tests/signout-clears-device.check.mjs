/**
 * Contract test: signing out must leave nothing of the previous user behind.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The auth token and the persisted app store are two different things. Clearing
 * only the token signs the user out of the API while leaving their whole
 * training history — name, completed sessions, badges, one-rep maxes and body
 * weight — sitting in AsyncStorage. The next person to sign in on that device
 * is then greeted by the previous person's name, sees their sessions, and is
 * prescribed working weights derived from their one-rep maxes. Worse, when the
 * new account has nothing on the server (exactly the case for a brand new
 * account) the sign-in path uploads whatever is on the device into it, which
 * makes one person's data permanently part of another person's account.
 *
 * Everything below is about that pair of hazards staying closed:
 *
 *  - signOut must wipe the persisted store and reload, not just drop the token.
 *    Wiping without reloading is not enough: clearStorage() only empties the
 *    stored copy, the previous user's data is still live in memory and the next
 *    write puts it straight back.
 *  - verifyCode must decide whether the data already on the device belongs to
 *    the account signing in BEFORE it can be uploaded into that account.
 *  - the ownership tag has to survive an app restart, so it must be persisted.
 *  - a wiped device resets onboardingComplete, so the gate must have somewhere
 *    coherent to send the user (onboarding) rather than stranding them.
 *
 * Run:  node tests/signout-clears-device.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const authSrc = readFileSync(join(__dir, '../lib/auth-context.tsx'), 'utf8');
const storeSrc = readFileSync(join(__dir, '../lib/store.ts'), 'utf8');
const layoutSrc = readFileSync(join(__dir, '../app/_layout.tsx'), 'utf8');

let failures = 0;
let total = 0;

function check(label, condition, detail) {
  total++;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

/**
 * Body of the callback declared as `const <name> = useCallback(`, found by
 * matching braces so the checks below cannot be fooled by another function
 * being added between the ones we care about.
 */
function callbackBody(src, name) {
  const start = src.indexOf(`const ${name} = useCallback(`);
  if (start === -1) return '';
  const open = src.indexOf('{', start);
  if (open === -1) return '';
  let depth = 0;
  let quote = '';
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    const prev = src[i - 1];
    if (quote) {
      if (c === quote && prev !== '\\') quote = '';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      i = src.indexOf('\n', i);
      if (i === -1) break;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return '';
}

const signOut = callbackBody(authSrc, 'signOut');
const verifyCode = callbackBody(authSrc, 'verifyCode');

// ─── 1. signOut wipes the device ──────────────────────────────────────────────
console.log('\n[1] signOut — the persisted store is wiped, not just the token');

check('signOut callback found', signOut !== '', 'it may have been renamed or restructured');

check(
  'signOut clears the auth token',
  /clearToken\(\)/.test(signOut),
  'the session is not actually ended'
);

const wipeIdx = signOut.indexOf('useAppStore.persist.clearStorage()');
const reloadIdx = signOut.indexOf('reloadAppAsync(');

check(
  'signOut clears the persisted app store',
  wipeIdx !== -1,
  "the previous user's sessions, badges, one-rep maxes and name stay on the device for whoever signs in next"
);

check(
  'signOut reloads the app afterwards',
  reloadIdx !== -1,
  'clearStorage() only empties the stored copy — the data is still live in memory and the next write restores it'
);

check(
  'the wipe happens before the reload',
  wipeIdx !== -1 && reloadIdx !== -1 && wipeIdx < reloadIdx,
  'reloading first means the wipe never runs'
);

check(
  'the wipe is unconditional',
  wipeIdx !== -1 && !/if\s*\([^)]*\)\s*\{?[^}]*useAppStore\.persist\.clearStorage/.test(signOut),
  'a conditional wipe leaves cases where one user\'s data survives into the next sign-in'
);

// ─── 2. signOut does not throw away unsynced work ─────────────────────────────
console.log('\n[2] signOut — the device is backed up before it is wiped');

check(
  'signOut uploads the current data before clearing it',
  signOut.indexOf('uploadUserData(') !== -1 && signOut.indexOf('uploadUserData(') < wipeIdx,
  'anything logged since the last sync would be destroyed by the wipe with no copy anywhere'
);

// ─── 3. a sign-in cannot absorb another account's data ────────────────────────
console.log("\n[3] verifyCode — a new account cannot absorb the previous user's data");

check('verifyCode callback found', verifyCode !== '', 'it may have been renamed or restructured');

const ownerIdx = verifyCode.indexOf('dataOwnerId');
const uploadIdx = verifyCode.indexOf('uploadUserData(');
const verifyWipeIdx = verifyCode.indexOf('useAppStore.persist.clearStorage()');

check(
  'verifyCode checks which account the data on the device belongs to',
  ownerIdx !== -1,
  'nothing distinguishes the signing-in user\'s own recovered history from the previous user\'s'
);

check(
  'the ownership check runs before any upload',
  ownerIdx !== -1 && uploadIdx !== -1 && ownerIdx < uploadIdx,
  "the upload into an empty account happens first, so another user's history is already in it"
);

check(
  "a device holding another account's history is wiped",
  verifyWipeIdx !== -1 && /reloadAppAsync\(/.test(verifyCode),
  'leaving it in place means the next background sync uploads it into the wrong account anyway'
);

check(
  'the check compares against the id of the account signing in',
  /dataOwnerId\s*!==\s*data\.user\.id/.test(verifyCode),
  'comparing against anything else does not establish ownership'
);

check(
  'the check only applies to real training history',
  /completedSessions\.length\s*>\s*0/.test(verifyCode),
  'a freshly onboarded device has no history to protect and must not be wiped on a normal sign-in'
);

// ─── 4. the ownership tag survives a restart ──────────────────────────────────
console.log('\n[4] store — the ownership tag is persisted and starts empty');

check(
  'the store declares dataOwnerId',
  /dataOwnerId:\s*string\s*\|\s*null;/.test(storeSrc),
  'the tag verifyCode depends on does not exist'
);

check(
  'dataOwnerId starts as null',
  /dataOwnerId:\s*null,/.test(storeSrc),
  'a fresh install must not claim to belong to anybody'
);

const partialize = storeSrc.slice(
  storeSrc.indexOf('partialize:'),
  storeSrc.indexOf('onRehydrateStorage:')
);
check(
  'dataOwnerId is not stripped out of the persisted state',
  partialize !== '' && !partialize.includes('dataOwnerId'),
  'a tag that does not survive a restart cannot tell the two cases apart on the next launch'
);

// ─── 5. a wiped device lands somewhere coherent ───────────────────────────────
console.log('\n[5] gate — a wiped device has somewhere to go');

check(
  'the gate sends a device with no onboarding to /onboarding',
  /if\s*\(!onboardingComplete\)\s*\{[\s\S]{0,200}?router\.replace\('\/onboarding'\)/.test(layoutSrc),
  'wiping the store resets onboardingComplete, so without this branch the user is left on a dead screen'
);

check(
  'the gate still requires a signed-in user before the tabs',
  /else if \(!isAuthenticated\)\s*\{[\s\S]{0,200}?router\.replace\('\/auth'\)/.test(layoutSrc),
  'a signed-out device would walk straight back into the app'
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`signout-clears-device: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`signout-clears-device: all ${total} checks passed\n`);
  process.exit(0);
}
