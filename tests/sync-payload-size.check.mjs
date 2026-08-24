/**
 * Contract test: a user's whole training history still fits in one sync.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * PUT /api/user/data carries a user's ENTIRE history in a single request, and
 * express.json() defaults to a 100 kb body. Measured against the real payload
 * shape, one logged session weighs about 3.2 kb, so the default runs out at
 * roughly thirty-one sessions - about ten weeks of training three times a week.
 *
 * The failure is silent by design. lib/sync.ts swallows upload errors on
 * purpose, because local data is the source of truth and the next foreground
 * retries; a 413 therefore surfaces nowhere. Cloud backup just stops. The app
 * keeps working perfectly and nothing looks wrong until the user signs out or
 * moves to a new phone - and sign-out deliberately wipes the device, so at that
 * moment everything since the last successful upload is gone.
 *
 * It would also have passed every test and every day of real use by anybody who
 * had not yet trained for ten weeks, which at launch is everybody.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS CHECKED
 * ─────────────────────────────────────────────────────────────────────────────
 * Not "is a limit configured" alone - a limit that is merely present can still
 * be too small. This builds a payload the shape the app really sends and asserts
 * the configured limit clears years of it.
 *
 * Run:  npx tsx tests/sync-payload-size.check.mjs
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

const server = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');

console.log('\n[1] A limit is set, and it is set on the parser that receives the sync');

const limitMatch = server.match(/const MAX_SYNC_BODY = '(\d+)(kb|mb)';/i);
check(
  'the limit is declared as a named constant',
  !!limitMatch,
  'express.json() with no limit silently means 100 kb'
);
check(
  'express.json uses it',
  /express\.json\(\{\s*\r?\n?\s*limit: MAX_SYNC_BODY,/.test(server),
  ''
);
check(
  'and so does the urlencoded parser',
  /express\.urlencoded\(\{ extended: false, limit: MAX_SYNC_BODY \}\)/.test(server),
  'a second parser with the default limit is the same bug wearing a different hat'
);

if (!limitMatch) {
  console.log(`\nsync-payload-size: ${passed} passed, ${failed} failed\n`);
  process.exit(1);
}

const limitBytes =
  parseInt(limitMatch[1], 10) * (limitMatch[2].toLowerCase() === 'mb' ? 1048576 : 1024);

console.log('\n[2] It clears a realistic history by a wide margin');

/** One completed session, the shape lib/sync.ts actually sends. */
const session = (i) => ({
  id: 'abcdef' + i + 'kj3h4kj3h4k',
  sessionType: 'squat',
  date: new Date(0).toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  painRegions: [],
  energy: 'good',
  timeAvailable: '45',
  exerciseCount: 8,
  durationSeconds: 2700,
  exerciseLogs: Array.from({ length: 8 }, (_, e) => ({
    exerciseId: 'barbell-back-squat-variation-' + e,
    exerciseName: 'Barbell Back Squat Variation ' + e,
    targetReps: '8-12',
    category: 'accessory',
    note: '',
    sets: Array.from({ length: 4 }, (_, s) => ({
      setNumber: s + 1,
      weight: 82.5,
      reps: 8,
      completed: true,
    })),
  })),
});

const payloadBytes = (n) =>
  Buffer.byteLength(
    JSON.stringify({
      userProfile: { name: 'A', sex: 'male', experienceLevel: 'intermediate', goals: ['strength'], bodyweightKg: 82 },
      equipmentTiers: ['fullgym'],
      completedSessions: Array.from({ length: n }, (_, i) => session(i)),
      oneRepMaxes: Array.from({ length: 24 }, (_, i) => ({ lift: 'squat', weight: 100 + i, date: new Date(0).toISOString(), unit: 'kg' })),
      exerciseFeedback: {},
      weightUnit: 'kg',
      testWeekFrequency: 12,
      testWeekDeferred: false,
      cycleStartOffset: 0,
      lastLoggedWeights: {},
      lastSessionPerformance: {},
      exerciseNormalStreak: {},
      exerciseStuckStreak: {},
      savedTemplates: [],
      bodyweightLog: Array.from({ length: n }, () => ({ date: new Date(0).toISOString(), kg: 82 })),
      earnedBadges: Array.from({ length: 60 }, (_, i) => 'badge_' + i),
    })
  );

const perSession = (payloadBytes(200) - payloadBytes(100)) / 100;
const THREE_A_WEEK = 156;

console.log(`      one session weighs about ${(perSession / 1024).toFixed(1)} kb`);
console.log(`      the old 100 kb default ran out at about ${Math.floor(102400 / perSession)} sessions`);
console.log(`      the configured limit clears about ${Math.floor(limitBytes / perSession)} sessions`);

check(
  'one year of training three times a week fits',
  payloadBytes(THREE_A_WEEK) < limitBytes,
  `${(payloadBytes(THREE_A_WEEK) / 1024).toFixed(0)} kb vs a ${(limitBytes / 1024).toFixed(0)} kb limit`
);
check(
  'and so does five years of it',
  payloadBytes(THREE_A_WEEK * 5) < limitBytes,
  `${(payloadBytes(THREE_A_WEEK * 5) / 1024).toFixed(0)} kb vs a ${(limitBytes / 1024).toFixed(0)} kb limit`
);
check(
  'the old default would NOT have survived ten weeks',
  payloadBytes(31) > 102400,
  'if this stops being true the numbers above have drifted and the comment is lying'
);
check(
  'but the limit is not so large that a runaway body is accepted',
  limitBytes <= 20 * 1048576,
  `${(limitBytes / 1048576).toFixed(0)} mb`
);

console.log('\n[3] The upload is still deliberately silent, which is why size matters');

const sync = readFileSync(new URL('../lib/sync.ts', import.meta.url), 'utf8');
check(
  'uploadUserData still swallows failures',
  /catch \{/.test(sync) && /return false;/.test(sync),
  'this is correct behaviour, and it is exactly why a size ceiling can never be allowed to be reachable'
);

console.log(`\nsync-payload-size: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
