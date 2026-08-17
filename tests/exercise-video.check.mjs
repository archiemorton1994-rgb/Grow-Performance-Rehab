/**
 * Contract test: an exercise's own video is used when it exists.
 *
 * WHY THIS MATTERS
 * ────────────────
 * ExerciseTemplate has carried a `videoId` field all along, and every single one
 * of them is an empty string — 661 of 661. Nothing read the field either: the
 * session screen opened a YouTube SEARCH on the exercise name and ignored
 * videoId entirely. So the field looked wired up and was not.
 *
 * Real recordings are being made. When a videoId is filled in it must just
 * work — data only, no code change and no release. This pins that:
 *
 *   1. the handler prefers videoId and falls back to search
 *   2. videoId survives the whole generation pipeline, including the
 *      pain-adaptation path that rebuilds exercise objects
 *
 * (2) is the one that would fail silently. A comfort swap or a grip variant that
 * dropped the field would mean the right video simply never opened, with nothing
 * to indicate why.
 *
 * Run:  npx tsx tests/exercise-video.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

globalThis.__DEV__ = false;

const __dir = dirname(fileURLToPath(import.meta.url));
const sessionSrc = readFileSync(join(__dir, '../app/session.tsx'), 'utf8');

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

// ─── 1. The handler prefers a real video ─────────────────────────────────────
console.log('\n[1] The video button uses videoId when there is one');

check(
  'the handler takes the exercise, not just its name',
  /const openExerciseVideo = \(exercise: \{\s*name: string;\s*videoId\?: string;\s*youtubeUrl\?: string;\s*\}\) =>/.test(
    sessionSrc
  ),
  'it used to take a bare name, which is why videoId could never be used'
);
check(
  'the exact video is resolved before any fallback',
  /const url = videoUrlFor\(exercise\);[\s\S]{0,120}?Linking\.openURL\(url\)/.test(sessionSrc),
  'videoUrlFor is the one place that knows which video belongs to which movement'
);
check(
  'an absent videoId still falls back to a search',
  /youtube\.com\/results\?search_query=/.test(sessionSrc),
  'with no footage recorded yet, the search is what every exercise relies on'
);
check(
  'the button passes the exercise object through',
  /onVideoPress=\{\(\) => openExerciseVideo\(displayExercise\)\}/.test(sessionSrc),
  ''
);

// ─── 2. videoId survives generation ──────────────────────────────────────────
console.log('\n[2] videoId survives the whole pipeline');

const { generateWorkout } = await import('../lib/workout-engine.ts');
const profile = {
  name: 'A',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['muscle'],
  bodyweightKg: 80,
};

const scenarios = [
  ['plain session', { energy: 'normal', timeAvailable: '60', hasAches: false }],
  // Rebuilds exercise objects to swap in comfort variants — the path most
  // likely to drop a field.
  [
    'pain-adapted session',
    { energy: 'normal', timeAvailable: '60', hasAches: true, painRegion: 'front_shoulder' },
  ],
  ['short low-energy session', { energy: 'low', timeAvailable: '30', hasAches: false }],
];

for (const [label, readiness] of scenarios) {
  const dropped = [];
  for (const type of ['upper_body', 'lower_body', 'full_body']) {
    for (const tier of ['bodyweight', 'dumbbells', 'fullgym']) {
      for (let n = 0; n < 4; n++) {
        const w = generateWorkout(type, tier, readiness, profile, {}, undefined, n);
        for (const e of w) if (!('videoId' in e)) dropped.push(`${type}/${tier}: ${e.name}`);
      }
    }
  }
  check(
    `${label}: every exercise carries a videoId field`,
    dropped.length === 0,
    dropped.slice(0, 3).join(', ')
  );
}

// A grip variant must keep the base's video — that was a condition of accepting
// the variant in the first place.
const { applyGripVariant, GRIP_VARIANTS } = await import('../lib/grip-variants.ts');
const base = {
  id: 'x',
  name: Object.keys(GRIP_VARIANTS)[0],
  cue: 'c',
  sets: 3,
  reps: '8',
  suggestedLoad: 'Bodyweight',
  videoId: 'abc123',
};
check(
  'a grip variant keeps the base video',
  applyGripVariant(base, 1).videoId === 'abc123',
  'variants were only accepted where the base footage still teaches the movement'
);

console.log('');
if (failures > 0) {
  console.error(`exercise-video: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`exercise-video: all ${total} checks passed\n`);
  process.exitCode = 0;
}
