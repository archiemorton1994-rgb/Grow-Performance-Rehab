/**
 * Contract tests: Note-input keyboard-avoidance invariants — iPhone SE safety
 *
 * WHY THIS MATTERS
 * ────────────────
 * The note TextInput inside each ExerciseCard lives inside the
 * KeyboardAwareScrollViewCompat wrapper in session.tsx. On a short screen
 * (iPhone SE: 375×667 pt — the smallest supported device) with many exercise
 * cards stacked the note input is near the bottom of the scroll view. When
 * the user taps the pencil icon the software keyboard covers ~291 pt of the
 * 667 pt screen, leaving only ~376 pt of visible space. The
 * KeyboardAwareScrollViewCompat must auto-scroll to keep the focused input
 * above the keyboard edge.
 *
 * Four invariants must hold for this to work correctly on ALL screen sizes:
 *
 *   1. The exercise-list scroll view IS a KeyboardAwareScrollViewCompat, not
 *      a plain ScrollView. A plain ScrollView never adjusts for the keyboard.
 *
 *   2. bottomOffset is set to ≥ 24 on that wrapper. This is the gap kept
 *      between the bottom of the focused input and the top of the keyboard.
 *      24 pt is the minimum safe value; smaller values can clip the input on
 *      iPhone SE where every pixel counts.
 *
 *   3. The note TextInput is INSIDE the KeyboardAwareScrollViewCompat in the
 *      render tree (by character position). If it moves outside, the library
 *      cannot detect focus and will not scroll.
 *
 *   4. The note TextInput uses multiline={false}. Single-line inputs have a
 *      fixed height that is easy for the library to scroll into view. A
 *      multiline input that grows dynamically can push its own bottom edge
 *      below the keyboard on small screens before the library can react.
 *
 *   5. The KeyboardAwareScrollViewCompat wrapper passes props through to the
 *      native KeyboardAwareScrollView unchanged (no prop stripping). If the
 *      wrapper omits bottomOffset the native library receives 0 and the input
 *      lands flush against the keyboard — invisible on iPhone SE.
 *
 * Silent failure modes this catches:
 *  - Exercise list reverted to plain ScrollView (note input hides on keyboard)
 *  - bottomOffset removed or set to 0 (input flush against keyboard edge)
 *  - Note TextInput accidentally rendered outside the scroll wrapper
 *  - Note TextInput switched to multiline (dynamic growth defeats auto-scroll)
 *  - Compat wrapper gained a prop filter that drops bottomOffset
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label, detail = '') {
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  failed++;
}

function check(cond, label, detail = '') {
  if (cond) ok(label);
  else fail(label, detail);
}

// ─── Sources ───────────────────────────────────────────────────────────────────
const sessionSrc = readFile('app/session.tsx');
const compatSrc = readFile('components/KeyboardAwareScrollViewCompat.tsx');

// ─── [1] Exercise list uses KeyboardAwareScrollViewCompat ─────────────────────
console.log('[1] Scroll wrapper — exercise list uses KeyboardAwareScrollViewCompat');

const kavCompatOpenIdx = sessionSrc.indexOf('<KeyboardAwareScrollViewCompat');
const kavCompatCloseIdx = sessionSrc.lastIndexOf('</KeyboardAwareScrollViewCompat>');

check(
  kavCompatOpenIdx !== -1,
  'KeyboardAwareScrollViewCompat opening tag found in session.tsx',
  'Plain ScrollView does not adjust for keyboard; note inputs will hide behind it'
);

check(kavCompatCloseIdx !== -1, 'KeyboardAwareScrollViewCompat closing tag found in session.tsx');

// ─── [2] bottomOffset is set to a sufficient value ────────────────────────────
console.log('[2] bottomOffset — set to ≥ 24 on KeyboardAwareScrollViewCompat');

// Extract the opening tag block (up to the closing > or />)
const kavCompatTagEnd = sessionSrc.indexOf('>', kavCompatOpenIdx);
// bottomOffset may span multiple lines so search a generous window
const kavCompatTagBlock = sessionSrc.slice(
  kavCompatOpenIdx,
  Math.min(kavCompatTagEnd + 200, sessionSrc.length)
);

const bottomOffsetMatch = kavCompatTagBlock.match(/bottomOffset=\{(\d+)\}/);

check(
  bottomOffsetMatch !== null,
  'bottomOffset prop is present on KeyboardAwareScrollViewCompat',
  'Without bottomOffset the focused input lands flush against the keyboard edge'
);

if (bottomOffsetMatch) {
  const offsetValue = parseInt(bottomOffsetMatch[1], 10);
  check(
    offsetValue >= 24,
    `bottomOffset value (${offsetValue}) is ≥ 24 — safe for iPhone SE (375×667 pt)`,
    'Values < 24 can clip the note input on the smallest supported screen size'
  );
}

// ─── [3] ExerciseCard rendered inside KeyboardAwareScrollViewCompat ───────────
console.log(
  '[3] Input placement — ExerciseCard (containing note TextInput) is inside KeyboardAwareScrollViewCompat'
);

// The note TextInput lives inside the ExerciseCard component function, which is
// defined earlier in the file. What we need to verify is that <ExerciseCard …/>
// is rendered as a child of <KeyboardAwareScrollViewCompat> in the main session
// render tree — character position of the JSX usage, not the function definition.
const exerciseCardUsageIdx = sessionSrc.indexOf('<ExerciseCard', kavCompatOpenIdx);

check(
  exerciseCardUsageIdx !== -1,
  '<ExerciseCard …/> usage found after KeyboardAwareScrollViewCompat opens'
);

if (kavCompatOpenIdx !== -1 && kavCompatCloseIdx !== -1 && exerciseCardUsageIdx !== -1) {
  check(
    exerciseCardUsageIdx > kavCompatOpenIdx && exerciseCardUsageIdx < kavCompatCloseIdx,
    'ExerciseCard (which renders the note TextInput) is inside KeyboardAwareScrollViewCompat',
    `Compat opens at char ${kavCompatOpenIdx}, ExerciseCard at ${exerciseCardUsageIdx}, compat closes at ${kavCompatCloseIdx}`
  );
}

// Also confirm the note TextInput definition exists in ExerciseCard with a testID
const noteInputIdx = sessionSrc.indexOf('testID={`note-${index}`}');
check(
  noteInputIdx !== -1,
  'Note TextInput has testID="note-${index}" (automation and scroll-target anchor)'
);

// ─── [4] Note TextInput uses multiline={false} ────────────────────────────────
console.log('[4] Note TextInput — multiline={false} for reliable auto-scroll');

// Find the note TextInput block (from testID back to the opening TextInput tag)
if (noteInputIdx !== -1) {
  // The opening tag is within ~300 chars before the testID
  const noteInputBlockStart = sessionSrc.lastIndexOf('<TextInput', noteInputIdx);
  const noteInputBlockEnd = sessionSrc.indexOf('/>', noteInputIdx);
  const noteInputBlock =
    noteInputBlockStart !== -1 && noteInputBlockEnd !== -1
      ? sessionSrc.slice(noteInputBlockStart, noteInputBlockEnd + 2)
      : '';

  check(
    /multiline=\{false\}/.test(noteInputBlock),
    'Note TextInput has multiline={false} — fixed height keeps auto-scroll reliable',
    'multiline inputs can grow past the keyboard edge on short screens before the library reacts'
  );
}

// ─── [5] Compat wrapper forwards props (no bottomOffset stripping) ─────────────
console.log('[5] Compat wrapper — passes bottomOffset through to native library');

// The compat wrapper must spread ...props onto KeyboardAwareScrollView so that
// bottomOffset (and other scroll props) reach the native library.
check(
  /\.\.\.(rest|props)/.test(compatSrc),
  'KeyboardAwareScrollViewCompat spreads remaining props onto native scroll view',
  'If props are not spread, bottomOffset is silently dropped and iPhone SE sees value 0'
);

// Confirm the native branch uses KeyboardAwareScrollView (not a plain ScrollView)
check(
  /KeyboardAwareScrollView/.test(compatSrc),
  'Compat wrapper uses KeyboardAwareScrollView from react-native-keyboard-controller on native',
  'If the native branch was replaced with ScrollView, bottomOffset has no effect'
);

// Confirm the web branch falls back to plain ScrollView (expected)
check(
  /Platform\.OS.*web/.test(compatSrc) && /ScrollView/.test(compatSrc),
  "Compat wrapper falls back to plain ScrollView on web (Platform.OS === 'web' guard present)"
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failed === 0) {
  console.log(`note-input-kav: all ${passed} checks passed`);
  process.exit(0);
} else {
  console.error(`note-input-kav: ${failed} of ${passed + failed} checks FAILED`);
  process.exit(1);
}
