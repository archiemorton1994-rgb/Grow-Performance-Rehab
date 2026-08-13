/**
 * Contract test: a mapped video actually opens, and opens the right movement.
 *
 * WHAT THIS PREVENTS
 * ──────────────────
 * lib/exercise-videos.ts is written by hand, one line per recording, by someone
 * adding videos as they are filmed. Every failure mode of that file is silent:
 *
 *   a misspelt exercise name  -> the line does nothing, the button still runs a
 *                                search, and nothing anywhere says so
 *   a malformed link          -> the button opens YouTube's home page
 *   a channel page pasted in  -> the button opens the channel, not the demo
 *
 * None of those crash and none show an error. The person who added the line has
 * no way to find out it did not work, so this is the thing that tells them.
 *
 * The file is expected to be empty or near-empty for a long while: there are 595
 * distinct exercises and footage is being made a few at a time. An empty table
 * is a pass — every unmapped exercise keeps the YouTube search it has always
 * had. What must never happen is an entry that looks mapped and is not.
 *
 * Run:  npx tsx tests/exercise-videos.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { getAllPickableExercises } from '../lib/exercise-db.ts';
import { allAcuteExercises } from '../lib/acute-rehab.ts';
import {
  EXERCISE_VIDEOS,
  CHANNEL_URL,
  isValidVideoUrl,
  videoUrlFor,
} from '../lib/exercise-videos.ts';

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

const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// The acute-rehab exercises are unioned in: they are not on the builder's menu,
// but a user doing one sees the video button on every card, so a video may be
// mapped to them and that mapping must not be reported as a typo.
const names = new Set();
for (const { template } of getAllPickableExercises()) names.add(norm(template.name));
for (const t of allAcuteExercises()) names.add(norm(t.name));

const mapped = Object.entries(EXERCISE_VIDEOS);
console.log(`\n[1] ${mapped.length} exercise(s) mapped to a video, of ${names.size} in the app`);

// ─── Every key names a real exercise ─────────────────────────────────────────
const orphans = mapped.map(([k]) => k).filter((k) => !names.has(norm(k)));
check(
  'every mapped name matches an exercise in the app',
  orphans.length === 0,
  `${orphans.join(', ')} — check the spelling against the name shown on the card`
);

// ─── Every value is a video link ─────────────────────────────────────────────
const malformed = mapped.filter(([, url]) => !isValidVideoUrl(url));
check(
  'every link is a YouTube video address',
  malformed.length === 0,
  malformed.map(([k, v]) => `${k} -> ${v}`).join(' | ')
);

const channelPages = mapped.filter(([, url]) => url.includes('/@') || url.includes('/channel/'));
check(
  'no link points at the channel instead of a video',
  channelPages.length === 0,
  channelPages.map(([k]) => k).join(', ')
);

// ─── Two exercises pointing at one video ─────────────────────────────────────
// Legitimate occasionally — one recording can cover a movement and its close
// variant — but far more often it is a paste that did not get updated, so it is
// reported rather than failed.
const byUrl = new Map();
for (const [name, url] of mapped) byUrl.set(url, [...(byUrl.get(url) ?? []), name]);
const shared = [...byUrl.entries()].filter(([, list]) => list.length > 1);
if (shared.length > 0) {
  console.log('    · note — one video is used by more than one exercise:');
  for (const [url, list] of shared) console.log(`      ${list.join(', ')} -> ${url}`);
}

// ─── Resolution order ────────────────────────────────────────────────────────
console.log('\n[2] The right video wins');

check(
  'a link written on the exercise itself beats the table',
  videoUrlFor({
    name: mapped[0]?.[0] ?? 'Back Squat',
    youtubeUrl: 'https://www.youtube.com/watch?v=OVERRIDE01',
  }) === 'https://www.youtube.com/watch?v=OVERRIDE01',
  ''
);
check(
  'an unmapped exercise resolves to nothing, so the caller can fall back',
  videoUrlFor({ name: 'An Exercise That Does Not Exist' }) === undefined,
  'returning a wrong link is worse than returning none'
);
check(
  'a bare videoId still works, so the original field is not orphaned',
  videoUrlFor({ name: 'An Exercise That Does Not Exist', videoId: 'abc123' }) ===
    'https://www.youtube.com/watch?v=abc123',
  ''
);
check(
  'name matching ignores case and extra spaces',
  videoUrlFor({ name: '  an EXERCISE that does NOT   exist  ' }) === undefined &&
    (mapped.length === 0 ||
      videoUrlFor({ name: mapped[0][0].toUpperCase() }) === mapped[0][1]),
  'a name typed with different capitalisation should still find its video'
);
check(
  'the channel address is the handle, not a guessed channel id',
  /^https:\/\/www\.youtube\.com\/@GrowPerformanceRehabilitation$/.test(CHANNEL_URL),
  CHANNEL_URL
);

// ─── The generated status report ─────────────────────────────────────────────
console.log('\n[3] The shooting list is current');

import { readFileSync } from 'fs';
let status = '';
try {
  status = readFileSync(new URL('../EXERCISE-VIDEO-STATUS.md', import.meta.url), 'utf8');
} catch {
  // reported below
}
check('EXERCISE-VIDEO-STATUS.md exists', status.length > 0, 'run `npm run video-status`');

if (status) {
  const claimed = status.match(/\*\*(\d+) of (\d+) recorded/);
  check('it states how many are done', claimed !== null, 'the headline count is missing');
  if (claimed) {
    check(
      `it counts the same ${names.size} exercises the app has`,
      Number(claimed[2]) === names.size,
      `report says ${claimed[2]} — run \`npm run video-status\``
    );
    check(
      `and the same ${mapped.length} recorded`,
      Number(claimed[1]) === mapped.length,
      `report says ${claimed[1]} — run \`npm run video-status\``
    );
  }
}

console.log('');
if (failures > 0) {
  console.error(`exercise-videos: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`exercise-videos: all ${total} checks passed\n`);
  process.exitCode = 0;
}
