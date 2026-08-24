/**
 * Contract test: the app's writing does not read as though a machine wrote it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE LONG DASH
 * ─────────────────────────────────────────────────────────────────────────────
 * Reported from use: "throughout the app I am noticing loads of the double
 * dashes again, the tell tale sign of AI". There were 37 of them in text a user
 * can read, eight of those in the guided tour, which is the first writing anyone
 * meets.
 *
 * The fix is not to swap them for hyphens. A spaced hyphen doing a dash's job is
 * the same tic wearing a different hat, so every one of the 37 was rewritten:
 * split into two sentences, turned into a colon, or joined with a conjunction,
 * whichever the sentence actually wanted.
 *
 * WHAT THIS DOES AND DOES NOT LOOK AT
 * ───────────────────────────────────
 * Only strings and JSX text. Comments are excluded deliberately, and they are
 * full of these: the person who reported it cannot read code, and neither can
 * anyone using the app. Enforcing prose style on comments would be noise with a
 * pass rate.
 *
 * Also excluded, and not by accident:
 *   - regex literals, which need the dash characters to PARSE user data. The
 *     rep-label rule in app/session.tsx and the load-range converter in
 *     lib/utils.ts both match en and em dashes on purpose.
 *   - a lone dash standing in for a missing value. Those were changed to a plain
 *     hyphen, which the rule below allows.
 *
 * Run:  npx tsx tests/writing-voice.check.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['app', 'components', 'lib', 'constants'];

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

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

/** Blank comments out, preserving newlines so line numbers still line up. */
function blankComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n\r]/g, ' ');
      i = stop;
    } else if (src[i] === '/' && src[i + 1] === '/') {
      let end = i;
      while (end < src.length && src[end] !== '\n') end++;
      out += ' '.repeat(end - i);
      i = end;
    } else {
      out += src[i];
      i++;
    }
  }
  return out;
}

const LONG_DASH = /[–—―]/;
const files = DIRS.flatMap((d) => walk(join(ROOT, d)));

console.log('\n[1] There is something to check');

check(
  'the source tree was actually found',
  files.length > 50,
  `only ${files.length} files - the walk above has drifted from the repo layout`
);

console.log('\n[2] No long dash in anything a user can read');

const offenders = [];
for (const f of files) {
  const code = blankComments(readFileSync(f, 'utf8'));
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  const found = [];

  for (const rx of [/'((?:[^'\\\n]|\\.)*)'/g, /"((?:[^"\\\n]|\\.)*)"/g, /`((?:[^`\\]|\\.)*)`/g]) {
    for (const m of code.matchAll(rx)) if (LONG_DASH.test(m[1])) found.push(m[1]);
  }
  // JSX text nodes: plain prose sitting between tags.
  for (const m of code.matchAll(/>([^<>{}]*[–—―][^<>{}]*)</g)) {
    const t = m[1].trim();
    if (t) found.push(t);
  }

  for (const t of found) offenders.push(`${rel}: "${t.replace(/\s+/g, ' ').slice(0, 90)}"`);
}

check(
  'no string or JSX text contains an en dash, em dash or horizontal bar',
  offenders.length === 0,
  `${offenders.length} found:\n      ` + offenders.slice(0, 8).join('\n      ')
);

console.log('\n[3] And no double hyphen standing in for one');

const doubles = [];
for (const f of files) {
  const code = blankComments(readFileSync(f, 'utf8'));
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  for (const rx of [/'((?:[^'\\\n]|\\.)*)'/g, /"((?:[^"\\\n]|\\.)*)"/g, /`((?:[^`\\]|\\.)*)`/g]) {
    for (const m of code.matchAll(rx)) {
      // A run of two or more hyphens surrounded by spaces, or between words.
      if (/\s--+\s|\w--+\w/.test(m[1]))
        doubles.push(`${rel}: "${m[1].replace(/\s+/g, ' ').slice(0, 90)}"`);
    }
  }
}

check(
  'nothing writes a dash as two hyphens either',
  doubles.length === 0,
  doubles.slice(0, 6).join('\n      ')
);

console.log('\n[4] The tour in particular, since that is where it was noticed');

/** Every guided-tour and coach-mark body in the app. */
const TOUR_FILES = [
  'app/(tabs)/index.tsx',
  'app/(tabs)/train.tsx',
  'app/(tabs)/profile.tsx',
  'app/(tabs)/recover.tsx',
  'app/(tabs)/workouts.tsx',
  'app/session.tsx',
  'app/readiness.tsx',
  'app/onboarding.tsx',
  'app/subscription.tsx',
];

let tourBodies = 0;
const tourOffenders = [];
for (const rel of TOUR_FILES) {
  let src;
  try {
    src = blankComments(readFileSync(join(ROOT, rel), 'utf8'));
  } catch {
    continue;
  }
  for (const m of src.matchAll(/\bbody:\s*(['"`])((?:[^\\]|\\.)*?)\1/g)) {
    tourBodies++;
    if (LONG_DASH.test(m[2]) || /\s--+\s/.test(m[2]))
      tourOffenders.push(`${rel}: "${m[2].slice(0, 80)}"`);
  }
}

check(
  'the tour bodies were found, so this section is testing something',
  tourBodies >= 10,
  `only ${tourBodies} found - the tour copy has moved and this check has gone blind`
);
check(
  'and not one of them uses a dash',
  tourOffenders.length === 0,
  tourOffenders.join('\n      ')
);

console.log(`\nwriting-voice: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
