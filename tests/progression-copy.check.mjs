/**
 * Contract test: what the app SAYS about progression matches what it DOES.
 *
 * WHY THIS MATTERS
 * ────────────────
 * The "What's driving your numbers" panel used to read: "A clean session nudges
 * it up, a tough one holds it, and a run of clean sessions earns a bigger jump."
 *
 * Two things wrong with that, both reported by the user. It never mentioned the
 * set ratings, so it read as though rating an exercise had no effect — when the
 * rating is in fact the STRONGEST lever, overriding everything else. And
 * "clean session" was jargon the UI never defined anywhere.
 *
 * Explanatory copy drifts away from the logic it describes because nothing
 * fails when it does. This pins the numbers: the increments quoted to the user
 * must be the increments getNextHint actually applies.
 *
 * Run:  node tests/progression-copy.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const summary = readFileSync(join(__dir, '../app/session-summary.tsx'), 'utf8');
const store = readFileSync(join(__dir, '../lib/store.ts'), 'utf8');

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

// ─── 1. The increments the engine applies ────────────────────────────────────
console.log('\n[1] The numbers getNextHint actually uses');

const hint = summary.slice(summary.indexOf('function getNextHint'), summary.indexOf('/** One "proud fact"'));
const increments = [...hint.matchAll(/bestWeightKg \+ ([\d.]+)/g)].map((m) => m[1]);
check(
  `three distinct increments are applied (${increments.join(', ')})`,
  new Set(increments).size === 3,
  `found ${JSON.stringify(increments)}`
);

const rules = summary.slice(summary.indexOf('function ProgressionRules'), summary.indexOf('* This lift\'s top set'));
for (const n of new Set(increments)) {
  check(`the explainer quotes ${n} kg`, rules.includes(n), `"${n}" appears in getNextHint but not in the copy shown to the user`);
}

// ─── 2. The rating must be described as a driver ─────────────────────────────
console.log('\n[2] The copy credits the set ratings');

check(
  'the explainer says the rating moves the weight',
  /rated it|you rated|rated a set/i.test(rules),
  'the panel must not imply that only completing sets matters — the rating overrides it'
);
check(
  'the hold case names both causes',
  /too hard/i.test(rules) && /incomplete/i.test(rules),
  'a hold comes from EITHER a Too Hard rating OR an unfinished set (lib/store.ts) — both must be stated'
);
// The buttons are the user's whole vocabulary for this. If the panel explains
// progression in words that are not on any button, it is describing a different
// app than the one they just used.
for (const label of ['Easy', 'Too Hard']) {
  check(
    `the explainer uses the button's own word "${label}"`,
    rules.includes(label),
    'the copy must name the actual buttons, not a paraphrase of them'
  );
}
check(
  'no leftover rep-counting language',
  !/reps were left|5\+ left|2-3 left|missed reps/i.test(rules),
  'those were the old four-button labels and no longer exist in the session UI'
);

// ─── 3. "Clean session" is not used as undefined jargon ──────────────────────
console.log('\n[3] No undefined jargon');

check(
  'the phrase "clean session" is gone from the user-facing copy',
  !/clean session/i.test(rules) && !/'.{0,40}[Cc]lean session/.test(summary.replace(/\/\*[\s\S]*?\*\//g, '')),
  'it was never defined anywhere in the UI'
);

// ─── 4. The three branches still exist in the store ──────────────────────────
console.log('\n[4] The engine still has the shape the copy describes');

check(
  'a very_easy rating still upgrades performance',
  /feedbackRating === 'very_easy'\) perfWithFeedback = 'very_easy'/.test(store),
  ''
);
check(
  'a hard rating still forces a hold',
  /feedbackRating === 'hard'\) perfWithFeedback = 'failed'/.test(store),
  ''
);
check(
  'an incomplete set still forces a hold',
  /hadFailure \? 'failed' : 'normal'/.test(store),
  ''
);
check(
  'the streak still counts consecutive fully-completed sessions',
  /perfWithFeedback !== 'normal'\) \{\s*\n\s*newStreak\[log\.exerciseId\] = 0;/.test(store),
  'the "three in a row" claim depends on this'
);

console.log('');
if (failures > 0) {
  console.error(`progression-copy: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`progression-copy: all ${total} checks passed\n`);
  process.exitCode = 0;
}
