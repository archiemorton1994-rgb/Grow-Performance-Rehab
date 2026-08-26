/**
 * Contract test: the assistant looks like itself, and its badge means something.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT HAS ITS OWN COLOUR
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything else on the home screen is the app talking about your session.
 * The assistant is something talking to you ABOUT your training, and painted in
 * the brand green it read as one more panel among panels. A colour used nowhere
 * else means the button is findable without hunting for it and the panel says
 * what it is before a word of it has been read.
 *
 * That only works while it stays exclusive, which is what the first section
 * below is for. The moment a second surface borrows sapphire, the assistant
 * stops being recognisable and the whole reason for the palette is gone.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AND WHY THE BADGE IS A GLYPH, NOT A DOT
 * ─────────────────────────────────────────────────────────────────────────────
 * A coloured dot on a 38pt circle is close to invisible at arm's length in a
 * gym. A different symbol reads at a glance. It also has to mean the right
 * thing: not "there is something in here" - there always is - but "something in
 * here has changed since you last looked". That distinction is why the seen
 * record is keyed by SIGNATURE rather than by id: 'personal-best' is the same
 * id whether it is reporting a deadlift from six weeks ago or one from an hour
 * ago, and only one of those is worth a badge.
 *
 * Run:  npx tsx tests/assistant-identity.check.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { messageSignature, getCoachSnapshot } from '../lib/coach.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

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

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const colors = read('constants/colors.ts');
const bubble = read('components/CoachBubble.tsx');
const home = read('app/(tabs)/index.tsx');
const store = read('lib/store.ts');

// ─── 1. The palette exists, in both themes ───────────────────────────────────
console.log('\n[1] Sapphire is a real token set, not a hex literal');

const TOKENS = [
  'assistantFill',
  'assistantOnFill',
  'assistantInk',
  'assistantSurface',
  'assistantMuted',
];
for (const t of TOKENS) {
  check(
    `${t} is defined in both themes`,
    (colors.match(new RegExp(`\\b${t}:`, 'g')) ?? []).length >= 2,
    'a token defined in one theme only is a screen that is unreadable in the other'
  );
}

// ─── 2. And nothing else in the app uses it ──────────────────────────────────
console.log('\n[2] It stays exclusive to the assistant');

/** Every .ts/.tsx file under app/, components/ and lib/. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}
const sourceFiles = [
  ...walk(join(ROOT, 'app')),
  ...walk(join(ROOT, 'components')),
  ...walk(join(ROOT, 'lib')),
];
/**
 * The assistant has two surfaces and both wear the colour: the home-screen
 * panel, and the full screen behind it. Anything else is a borrower, and this
 * list is the whole point of the section - it is what keeps sapphire meaning
 * "assistant" rather than meaning "somebody liked blue".
 */
const ASSISTANT_FILES = ['CoachBubble.tsx', 'assistant.tsx'];
const borrowers = sourceFiles.filter((f) => {
  if (ASSISTANT_FILES.some((name) => f.endsWith(name))) return false;
  return /C\.assistant[A-Z]/.test(readFileSync(f, 'utf8'));
});
check(
  'only the assistant paints with the assistant palette',
  borrowers.length === 0,
  `borrowed by: ${borrowers.map((f) => f.replace(ROOT, '')).join(', ')} - the colour only identifies the assistant while nothing else wears it`
);

// ─── 3. Contrast, held to the same floor as everything else ─────────────────
console.log('\n[3] It is readable, in both themes');

const luminance = (hex) => {
  const c = hex.replace('#', '');
  const v = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/**
 * A token's value, read out of the right theme.
 *
 * Split at the DarkColors declaration rather than counting occurrences. Several
 * token names appear more than once per theme because nested objects reuse
 * them, so "the second background" is the second LIGHT one, not the dark one.
 * That mistake made this test report 2.30:1 for a pair that is really 8.80:1 -
 * a false alarm, which is the more expensive kind of wrong for a contrast test
 * to be.
 */
const LIGHT_BLOCK = colors.slice(0, colors.indexOf('const DarkColors'));
const DARK_BLOCK = colors.slice(colors.indexOf('const DarkColors'));
const valueOf = (token, which) => {
  const block = which === 0 ? LIGHT_BLOCK : DARK_BLOCK;
  const m = block.match(new RegExp(`^  ${token}: '(#[0-9a-fA-F]{6})'`, 'm'));
  if (!m) throw new Error(`no top-level ${token} in the ${which === 0 ? 'light' : 'dark'} theme`);
  return m[1];
};
const AA = 4.5;
for (const [themeName, i, bg] of [
  ['light', 0, valueOf('background', 0)],
  ['dark', 1, valueOf('background', 1)],
]) {
  const fill = valueOf('assistantFill', i);
  const onFill = valueOf('assistantOnFill', i);
  const ink = valueOf('assistantInk', i);
  const surface = valueOf('assistantSurface', i);
  check(
    `${themeName}: text on the sapphire block clears AA (${ratio(onFill, fill).toFixed(2)}:1)`,
    ratio(onFill, fill) >= AA,
    ''
  );
  check(
    `${themeName}: sapphire ink on the panel clears AA (${ratio(ink, surface).toFixed(2)}:1)`,
    ratio(ink, surface) >= AA,
    ''
  );
  check(
    `${themeName}: and on the ordinary background (${ratio(ink, bg).toFixed(2)}:1)`,
    ratio(ink, bg) >= AA,
    'the button sits on the home screen background, not on the panel'
  );
}

// ─── 4. The badge is a glyph, and it means "new" ─────────────────────────────
console.log('\n[4] The button changes shape, and only for something new');

check(
  'the glyph changes rather than a dot appearing',
  /name=\{hasNews && !open \? 'sparkles' : '[^']+'\}/.test(bubble),
  'a coloured dot on a 38pt circle is close to invisible at arm\'s length in a gym'
);
check(
  'there is no dot left behind',
  !/styles\.dot/.test(bubble),
  'a glyph and a dot saying the same thing is two badges'
);
check(
  'the badge asks whether anything is NEW, not whether anything is wrong',
  /coachMessages\.some\(\(m\) => coachSeen\[messageSignature\(m\)\] === undefined\)/.test(home),
  'hasActionableAdvice is the right question for an alarm and the wrong one for an invitation'
);
check(
  'a signature is the id AND the title',
  /return `\$\{m\.id\}\|\$\{m\.title\}`/.test(read('lib/coach.ts')),
  'the id alone never changes, so a personal best set an hour ago would look identical to one from six weeks ago'
);
check(
  'the same message with a new number counts as new',
  messageSignature({ id: 'personal-best', title: 'Back Squat: 100 kg' }) !==
    messageSignature({ id: 'personal-best', title: 'Back Squat: 105 kg' }),
  ''
);
check(
  'and the same message with the same number does not',
  messageSignature({ id: 'personal-best', title: 'Back Squat: 100 kg' }) ===
    messageSignature({ id: 'personal-best', title: 'Back Squat: 100 kg' }),
  ''
);

console.log('\n[5] The NEW markers survive the visit they belong to');

check(
  'the seen map is frozen when the panel opens',
  /seenAtOpen\.current = coachSeen;/.test(home) && /seen=\{seenAtOpen\.current\}/.test(home),
  'opening marks everything seen, so rendering against the live map cleared every marker in the same tick it would have drawn it'
);
check(
  'and marking happens on open, so the glyph settles once looked at',
  /markCoachSeen\(coachMessages\.map\(messageSignature\), Date\.now\(\)\)/.test(home),
  ''
);
check(
  'the seen record is capped',
  /keys\.length > 200/.test(store),
  'a signature carries a number, so every personal best a user ever sets adds one and nothing would remove them'
);

// ─── 6. The hub shows more than a list ───────────────────────────────────────
console.log('\n[6] It is a hub, not a list of notices');

check(
  'the panel carries a header with the three numbers',
  /testID="coach-glance"/.test(bubble) &&
    /THIS WEEK/.test(bubble) &&
    /WEEK STREAK/.test(bubble) &&
    /VS LAST MONTH/.test(bubble),
  'three facts a user checks every time, which as messages would be three things nobody needed told'
);
check(
  'and a recommendation with a reason',
  /testID="coach-next-session"/.test(bubble) && /SUGGESTED NEXT/.test(bubble),
  ''
);

const NOW = 1_700_000_000_000;
const DAY = 86400000;
const session = (daysAgo, type) => ({
  id: 's' + daysAgo + type,
  sessionType: type,
  date: new Date(NOW - daysAgo * DAY).toISOString(),
  equipmentTier: 'fullgym',
  hadAches: false,
  painRegions: [],
  energy: 'normal',
  timeAvailable: '60',
  exerciseCount: 5,
  exerciseLogs: [],
});
const baseInput = {
  sessionCount: 12,
  weekCount: 2,
  weeklyGoal: 3,
  streak: 4,
  consecutiveActiveWeeks: 4,
  daysSinceLast: 1,
  weekday: 4,
  bodyweightStale: false,
  balance: { sessionTypes: [], everTrained: [], dismissedAt: null, now: NOW },
  sessions: [],
  progress: [],
  stuckStreak: {},
  hasOneRepMax: true,
  weightUnit: 'kg',
  dismissedAt: {},
  now: NOW,
};

check(
  'the snapshot reports the week exactly as the messages do',
  (() => {
    const s = getCoachSnapshot(baseInput);
    return s.weekCount === 2 && s.weeklyGoal === 3 && s.streak === 4;
  })(),
  'a strip that disagrees with the message underneath it is worse than no strip'
);
check(
  'it recommends the session type left longest',
  (() => {
    const s = getCoachSnapshot({
      ...baseInput,
      sessions: [session(1, 'bench'), session(3, 'bench'), session(20, 'squat')],
    });
    return s.nextSession?.type === 'squat';
  })(),
  ''
);
check(
  'and says why',
  (() => {
    const s = getCoachSnapshot({
      ...baseInput,
      sessions: [session(1, 'bench'), session(3, 'bench'), session(20, 'squat')],
    });
    return !!s.nextSession?.reason && s.nextSession.reason.length > 0;
  })(),
  'a recommendation without a reason is an instruction, and this app does not give those'
);
check(
  'and nothing when every session has been the same type',
  getCoachSnapshot({
    ...baseInput,
    sessions: [session(1, 'bench'), session(3, 'bench'), session(6, 'bench')],
  }).nextSession === null,
  'the least-recent rule needs something to be least recent THAN; with one type it just names the type they always do'
);
check(
  'it recommends nothing at all on a history too thin to read',
  getCoachSnapshot({ ...baseInput, sessions: [session(1, 'bench')] }).nextSession === null,
  'guessing from one session is how an assistant loses its authority'
);
check(
  'and the trend is null until there are two months to compare',
  getCoachSnapshot(baseInput).volumeDeltaPct === null,
  ''
);

// ─── 7. Three in the panel, all of them one tap away ─────────────────────────
console.log('\n[7] The panel is a summary of something you can open in full');

/**
 * THE DESIGN QUESTION THIS ANSWERS.
 *
 * Three at once is a briefing and six is a to-do list nobody reads, so the
 * panel stays at three. But the app now has a dozen observations it can make,
 * and a user who only ever sees the top three has no way of knowing the other
 * nine were considered at all. That is the difference between an app that nags
 * and one that has actually looked.
 *
 * The answer is not a longer bubble. It is a panel that says how much it is
 * summarising, and a screen behind it that shows the lot - both reading from
 * the same buckets, which is the only reason they can never contradict.
 */
const assistantScreen = read('app/assistant.tsx');
const layout = read('app/_layout.tsx');

check(
  'the panel says how many it is not showing',
  /testID="coach-see-all"/.test(bubble) && /moreCount > 0/.test(bubble),
  'saying the number is what turns the panel from "here is some advice" into "here is the top of what I found"'
);
check(
  'and the count comes from the same buckets the three came from',
  /getCoachBriefing\(coachInput\)\.total/.test(home),
  'two sources would eventually disagree, and the panel would be promising a screen that shows something else'
);
check(
  'the full screen groups by what you would do about each thing',
  /Needs you/.test(assistantScreen) &&
    /Going well/.test(assistantScreen) &&
    /Your training/.test(assistantScreen),
  '"what needs me" and "what is going well" are two different visits and should not be interleaved'
);
check(
  'it shows every how-it-works note, including ones dismissed on the home screen',
  /howItWorks: CoachMessage\[\] = EXPLAINERS\.map/.test(read('lib/coach.ts')),
  'on the panel they compete for a slot; here somebody has navigated to a reference on purpose, and a reference that hides the page you dismissed three weeks ago is a bad reference'
);
check(
  'and it can act and dismiss, not only list',
  /assistant-dismiss-/.test(assistantScreen) && /assistant-action-/.test(assistantScreen),
  'a read-only list is a report, not an assistant'
);
check(
  'the route is presented as a sheet',
  /name="assistant"/.test(layout) && /presentation: 'modal'/.test(layout),
  'it is the panel getting bigger, not a place you navigate to and lose your place from'
);
check(
  'both surfaces wear the same colour',
  /C\.assistantFill/.test(assistantScreen) && /C\.assistantFill/.test(bubble),
  'arriving at the full screen has to read as the same thing getting bigger'
);

console.log(`\nassistant-identity: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
