/**
 * Contract test: the summary card names MUSCLES, and names all of them.
 *
 * WHAT WENT WRONG
 * ───────────────
 * The share card prints a row of chips under two body figures. It is the key to
 * those figures — the only thing on the card that says what the shading means.
 * A real session came out as
 *
 *     AREAS 11
 *     Quads · Hamstrings · Glutes · Knee · Hip · Lower Back · +5 more
 *
 * Two separate faults in one row:
 *
 *   1. Knee and Hip are JOINTS. Nobody trains a knee. The list was built from
 *      `targetRegions`, which is the "where does it hurt" vocabulary — correct
 *      for the pain screen, wrong for "what did I just train".
 *   2. "+5 more". Eleven regions were shaded on the figures and six were named.
 *      A key that stops halfway leaves the reader unable to identify five of
 *      the shaded areas, which is the one job it has.
 *
 * HOW THIS TEST IS WRITTEN
 * ────────────────────────
 * It judges the OUTPUT the way a reader does, not the table the bug lived in.
 * The joint check is a vocabulary of joint words applied to whatever comes out,
 * so it stays red if a new region is added with a joint name, or if the mapping
 * is bypassed — it does not ask the mapping whether the mapping is correct.
 *
 * Run:  npx tsx tests/muscles-worked.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import {
  musclesWorked,
  ALL_MUSCLE_NAMES,
  JOINT_REGIONS,
  MUSCLE_MAP_FOR_TEST,
} from '../lib/muscles-worked.ts';

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

// ── The full PainRegion union, read from the type itself ─────────────────────
const storeSrc = readFileSync(new URL('../lib/store.ts', import.meta.url), 'utf8');
const typeStart = storeSrc.indexOf('export type PainRegion =');
check('PainRegion type declaration found in lib/store.ts', typeStart !== -1);

const eqPos = storeSrc.indexOf('=', typeStart);
const semi = storeSrc.indexOf(';', eqPos);
const typeBlock = storeSrc
  .slice(eqPos, semi + 1)
  .split(/\r?\n/)
  // The union documents a retired region ('elbow_wrist') in a comment; reading
  // that as live would demand a mapping for something that no longer exists.
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');
const ALL_REGIONS = [...new Set([...typeBlock.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))];

check(
  `PainRegion union parsed (${ALL_REGIONS.length} regions)`,
  ALL_REGIONS.length >= 15,
  ALL_REGIONS.join(', ')
);

// ── 1. Every region names at least one muscle ────────────────────────────────
// An elbow session used to name nothing at all, because every exercise in it is
// tagged with a joint. A card that shades the arm and captions it with an empty
// row is worse than one that says nothing.
const nameless = ALL_REGIONS.filter((r) => musclesWorked({ [r]: 1 }).length === 0);
check(
  'every body region resolves to at least one muscle',
  nameless.length === 0,
  nameless.join(', ')
);

check(
  'every region has an entry in the mapping table',
  ALL_REGIONS.every((r) => Array.isArray(MUSCLE_MAP_FOR_TEST[r])),
  ALL_REGIONS.filter((r) => !MUSCLE_MAP_FOR_TEST[r]).join(', ')
);

// ── 2. Nothing a joint ───────────────────────────────────────────────────────
// Vocabulary, not a list of the five current joints: a region added later with a
// joint name has to fail this too.
const JOINT_WORDS =
  /\b(knee|knees|hip|hips|groin|elbow|elbows|wrist|wrists|ankle|ankles|achilles|joint|shoulder joint|spine|patella|tendon|ligament)\b/i;

const jointNames = ALL_MUSCLE_NAMES.filter((n) => JOINT_WORDS.test(n));
check(
  'no muscle name is actually a joint',
  jointNames.length === 0,
  jointNames.join(', ')
);

// And from the other end: feed EVERY region in at once, the worst case a full
// body session produces, and read the result the way the card prints it.
const everything = Object.fromEntries(ALL_REGIONS.map((r) => [r, 1]));
const allOut = musclesWorked(everything);
check(
  'a session touching every region still names only muscles',
  allOut.every((n) => !JOINT_WORDS.test(n)),
  allOut.filter((n) => JOINT_WORDS.test(n)).join(', ')
);
console.log(`    · full-body output: ${allOut.join(' · ')}`);

// ── 3. Nothing is dropped ────────────────────────────────────────────────────
// Every distinct muscle any input region maps to must appear in the output. The
// failure this guards is a cap being reintroduced anywhere in the chain.
const expected = new Set(ALL_REGIONS.flatMap((r) => MUSCLE_MAP_FOR_TEST[r] ?? []));
const missing = [...expected].filter((m) => !allOut.includes(m));
check(
  `all ${expected.size} reachable muscles are named, none summarised away`,
  missing.length === 0,
  missing.join(', ')
);

// ── 4. Joints rank below the muscles named outright ──────────────────────────
// A joint contributes at half weight so three knee drills cannot outrank the
// squat that was the point of the session.
const ordered = musclesWorked({ chest: 2, knee: 3 });
check(
  'a region named outright outranks a joint with more entries',
  ordered[0] === 'Chest',
  ordered.join(', ')
);
check(
  'joint regions are discounted, not ignored',
  JOINT_REGIONS.length > 0 && ordered.includes('Quads'),
  ordered.join(', ')
);

// ── 5. The card itself prints all of them ────────────────────────────────────
// The mapping being right is no use if the screen still slices the list.
const cardSrc = readFileSync(new URL('../app/session-summary.tsx', import.meta.url), 'utf8');

check(
  'the summary card builds its chips from musclesWorked',
  /const\s+workedLabels\s*=\s*musclesWorked\(/.test(cardSrc),
  'workedLabels is not derived from musclesWorked()'
);
check(
  'the chip row has no "+N more" overflow',
  !/more<\/Text>/.test(cardSrc.replace(/personal best/g, '')) &&
    !/workedOverflow/.test(cardSrc),
  'an overflow counter is back on the card'
);
check(
  'the chip list is not sliced or capped',
  !/workedLabels[\s\S]{0,80}\.slice\(/.test(cardSrc) && !/WORKED_LABEL_LIMIT/.test(cardSrc),
  'workedLabels is being truncated before render'
);
check(
  'the chip row wraps rather than clipping',
  /workedRow:\s*\{[^}]*flexWrap:\s*'wrap'/.test(cardSrc),
  'workedRow must wrap, or a long list runs off the card'
);
check(
  'the stat rail counts the same muscles the chips name',
  /label:\s*'Muscles',\s*value:\s*String\(workedLabels\.length\)/.test(cardSrc),
  'the headline count and the chip row must not be able to disagree'
);

console.log('');
if (failures > 0) {
  console.error(`muscles-worked: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`muscles-worked: all ${total} checks passed\n`);
  process.exitCode = 0;
}
