/**
 * Contract test: the summary a user hands to whoever is treating them.
 *
 * WHY THIS MATTERS
 * ────────────────
 * This is the one thing the app produces that leaves the app. It goes to a
 * clinician, who will read it as a record, and it carries the user's name on it.
 * Two ways it could do harm:
 *
 *   By INTERPRETING. The moment it says "this suggests patellar tendinopathy"
 *   it is a training app offering a diagnosis to a professional who did not ask
 *   for one, and the user is carrying it into the room as if the app knew. Every
 *   line has to be a count, a date or a weight the user themselves entered.
 *
 *   By being WRONG. A summary that under-reports how often something was flagged,
 *   or reports mild when severe was entered, is worse than no summary, because
 *   somebody is making a decision on it.
 *
 * So this runs the builder over real histories and reads what came out.
 *
 * Run:  npx tsx tests/physio-summary.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { buildPhysioSummary } from '../lib/physio-summary.ts';

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

const DAY = 86400000;
const NOW = Date.parse('2026-08-27T10:00:00Z');
const PROFILE = {
  name: 'Archie',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['muscle'],
  bodyweightKg: 80,
};
let seq = 0;
const sess = (daysAgo, over = {}) => ({
  id: 'p' + seq++,
  sessionType: 'squat',
  date: new Date(NOW - daysAgo * DAY).toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  painRegions: [],
  energy: 'good',
  timeAvailable: '60',
  exerciseCount: 6,
  durationSeconds: 2700,
  exerciseLogs: [
    {
      exerciseId: 'bs',
      exerciseName: 'Barbell Back Squat',
      targetReps: '8-12',
      category: 'main',
      sets: [{ weight: 100, reps: 8, completed: true, skipped: false }],
    },
  ],
  ...over,
});
const build = (sessions, over = {}) =>
  buildPhysioSummary({
    profile: PROFILE,
    sessions,
    oneRepMaxes: [],
    weightUnit: 'kg',
    now: NOW,
    ...over,
  });

// ─── 1. It reports, it does not interpret ────────────────────────────────────
console.log('\n[1] It is a record, not an opinion');

// The NEWEST flag is the mildest on purpose. A builder that reports the most
// recent severity instead of the worst passes a fixture where they are the same
// session, and that is exactly the bug worth catching: a summary saying mild
// when severe was entered is the dangerous direction to be wrong in.
const painful = [
  sess(2, { hadAches: true, painRegions: ['knee'], painSeverity: 'mild' }),
  sess(9, { hadAches: true, painRegions: ['knee'], painSeverity: 'severe' }),
  sess(16, { hadAches: true, painRegions: ['knee'], painSeverity: 'moderate' }),
];
const report = build(painful);

/**
 * Clinical language, not a style list. Each of these turns a count into a claim,
 * and the reader is the one qualified to make claims.
 */
const DIAGNOSTIC = [
  'suggests',
  'indicates',
  'consistent with',
  'likely',
  'probable',
  'diagnos',
  'tendinopathy',
  'tendinitis',
  'strain',
  'tear',
  'impingement',
  'recommend',
  'you should',
  'we advise',
  'appears to be',
  'chronic',
  'acute',
];
const offenders = DIAGNOSTIC.filter((w) => new RegExp(`\\b${w}`, 'i').test(report));
check(
  'it offers no diagnosis, grade or recommendation',
  offenders.length === 0,
  `found: ${offenders.join(', ')} - the reader is the professional; this is their intake notes, not a competing opinion`
);
check(
  'it says what it is at the end',
  /not a clinical assessment/i.test(report),
  'somebody reading it needs to know it is self-reported app data'
);
check(
  'and it says the pain was reported by the user',
  /Reported by the user/i.test(report),
  'the difference between "the user said their knee hurt" and "the knee hurt" is the whole document'
);

// ─── 2. The counts are the real counts ───────────────────────────────────────
console.log('\n[2] Nothing is under-reported');

check(
  'every flagged session is counted, not just the latest',
  /reported 3 times/.test(report),
  report.split('\n').find((l) => l.includes('Knee')) ?? '(no knee line)'
);
check(
  'the worst severity is reported, not the most recent',
  /Worst reported as severe/.test(report),
  'the newest entry was mild; a summary that says mild is the dangerous kind of wrong'
);
check(
  'the span is given, so a reader can see how long it has run',
  /span of 2 weeks/.test(report),
  'two weeks between the first and last flag'
);

const multi = build([
  sess(1, { hadAches: true, painRegions: ['knee', 'lower_back'], painSeverity: 'moderate' }),
]);
check(
  'a session with two areas reports both',
  /Knee/.test(multi) && /Lower Back/i.test(multi),
  multi
);

const legacy = build([sess(1, { hadAches: true, painRegions: undefined, painRegion: 'knee' })]);
check(
  'a session saved before multi-select still reports its area',
  /Knee/.test(legacy),
  'painRegions supersedes painRegion, but old sessions on the device only have the singular one'
);

const noPain = build([sess(1), sess(3)]);
check(
  'no pain reported says exactly that',
  /No pain or soreness was reported/i.test(noPain),
  'silence would read as "not asked"'
);

// ─── 3. It never invents ─────────────────────────────────────────────────────
console.log('\n[3] It says nothing it was not told');

const empty = buildPhysioSummary({
  profile: null,
  sessions: [],
  oneRepMaxes: [],
  weightUnit: 'kg',
  now: NOW,
});
check(
  'an empty history produces an honest short report',
  /nothing to report/i.test(empty) && !/REPORTED PAIN/.test(empty),
  'headed sections over no data is how a summary starts looking authoritative about nothing'
);
check(
  'and it does not put a name on it that it does not have',
  !/undefined|null/.test(empty),
  empty
);
check(
  'a skipped set is not counted as work done',
  !/heaviest/i.test(
    build([
      sess(1, {
        exerciseLogs: [
          {
            exerciseId: 'bs',
            exerciseName: 'Barbell Back Squat',
            targetReps: '8-12',
            category: 'main',
            sets: [{ weight: 100, reps: 8, completed: false, skipped: true }],
          },
        ],
      }),
    ])
  ),
  'a set that was not done is not a weight this person lifted'
);

const lbs = build(painful, { weightUnit: 'lbs' });
check(
  'a pounds user reads pounds',
  /lbs/.test(lbs) && !/\d+ kg/.test(lbs),
  'a physio reading kilos for somebody who trains in pounds will misjudge the load'
);

// ─── 4. House style, because this one has the user's name on it ──────────────
console.log('\n[4] It reads like the rest of the app');

check(
  'no long dash, and no spaced hyphen doing a dash job',
  !/—|–|―/.test(report) && !/\S - \S/.test(report.replace(/^- /gm, '')),
  report
);
check(
  'no emoji',
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(report),
  ''
);
check(
  'it is plain text, not markup',
  !/<[a-z]+>|\*\*/.test(report),
  'it goes into a mail app, a notes app, or a message; markup would arrive as literal characters'
);

console.log('');
if (failures > 0) {
  console.error(`physio-summary: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`physio-summary: all ${total} checks passed\n`);
  process.exitCode = 0;
}
