/**
 * Contract test: the controls that decide clinical behaviour are usable by
 * everyone, not only by someone with good eyes and a default-configured phone.
 *
 * Four faults, all on controls that matter:
 *
 * 1. THE SELECTED TAB WAS THE UNREADABLE ONE. The Muscles / Joints switch under
 *    the body map painted the SELECTED tab in the figure's own bright mint green
 *    — a colour picked to sit on the dark panel the figure is drawn on. On a
 *    white chip in light mode it came out fainter than the UNSELECTED tab next
 *    to it, which is plain dark grey. The one piece of text telling you which
 *    mode you are in was the one you could not read.
 *
 * 2. THE SEVERITY PICKER WAS INVISIBLE TO VOICEOVER. Mild / Moderate / Severe
 *    read as three words with no indication they were buttons, no indication
 *    that one was already chosen (Moderate is), and no confirmation on tapping
 *    another — on the control that decides whether the session is scaled down.
 *
 * 3. THE LOGGING BOXES WERE UNLABELLED AND CLIPPED. Two identical boxes with a
 *    small "x" between them, announced as nothing. And at a large system text
 *    size the digits grow while a fixed-height box does not, so the number being
 *    typed was cut off top and bottom — in the one place in the app where
 *    reading back what you entered matters most.
 *
 * 4. THE HEATMAP WAS COLOUR-ONLY. Green means "progressing" and red means "too
 *    much" — opposite advice — and to a red-green colour-blind reader those two
 *    fills are near identical, with amber between them. Roughly one man in
 *    twelve, which is this app's core audience. The legend was no help: it is
 *    coloured dots too.
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

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const diagram = read('components/BodyDiagram.tsx');
const readiness = read('app/readiness.tsx');
const session = read('app/session.tsx');
const stats = read('app/(tabs)/workouts.tsx');

console.log('\n[1] The selected tab is the readable one');

check(
  'the selected Muscles tab follows the theme in light mode',
  /catMuscleActive: \{ color: darkPanel \? VOCAB_WORKED : C\.primaryText \}/.test(diagram),
  'the fixed figure green is fainter on white than the unselected tab beside it'
);

check(
  'the selected Joints tab does too',
  /catJointActive: \{ color: darkPanel \? JOINT_CLR : C\.cardAccentMobility \}/.test(diagram),
  ''
);

check(
  'the figure itself keeps the fixed vocabulary colours',
  /const VOCAB_WORKED = '#4ade80'/.test(diagram),
  'those were always legible where they belong - on the dark panel'
);

console.log('\n[2] The severity picker announces itself');

check(
  'it is a radio group',
  /accessibilityRole="radiogroup"/.test(readiness),
  'three words with no roles read as body text, not a choice'
);

check(
  'each option is a radio',
  /accessibilityRole="radio"[\s\S]{0,200}?accessibilityState=\{\{ selected: active \}\}/.test(
    readiness
  ),
  'without selected state, the user cannot tell which one is already chosen for them'
);

/**
 * THE STYLE THE RADIOS WEAR, AND A NUMBER RATHER THAN A LITERAL.
 *
 * This was `/minHeight: 44,/.test(readiness)` - true if ANY style anywhere in
 * the file said 44. Setting the severity picker itself to 36, which is exactly
 * the regression this assertion's own message describes, left it green because
 * a decorative style elsewhere still carried the number.
 *
 * Two consequences of matching a literal rather than a value: raising the
 * target to 48 would have FAILED, and lowering it to 43 would have passed.
 */
const pillBlock = readiness.match(/\n    pill: \{[\s\S]*?\n    \},/);
check(
  'the pill style the severity options wear was found',
  !!pillBlock,
  'the assertion below is measuring nothing without it'
);
const pillMinHeight = pillBlock ? Number(pillBlock[0].match(/minHeight: (\d+)/)?.[1] ?? 0) : 0;
check(
  `the options meet the minimum touch target (${pillMinHeight}pt)`,
  pillMinHeight >= 44,
  'these were about 36pt tall, and 44 is the smallest reliably tappable target'
);
check(
  'and the radios are actually styled with it',
  /accessibilityRole="radio"[\s\S]{0,400}?styles\.pill/.test(readiness) ||
    /styles\.pill[\s\S]{0,400}?accessibilityRole="radio"/.test(readiness),
  'otherwise the picker can be restyled onto something smaller and this keeps passing'
);

console.log('\n[3] The logging boxes are labelled and can grow');

check(
  'the weight box says what it is, including the unit',
  /accessibilityLabel=\{`Weight in \$\{weightUnit\}`\}/.test(session),
  'two identical boxes with an "x" between them announce as nothing'
);

check(
  'the reps box says what it is',
  /accessibilityLabel="Reps"/.test(session),
  ''
);

// Scoped to barInput. A blanket "no height: 56 anywhere" also condemns
// barCompleteBtn, which is a 56x56 icon button and legitimately fixed — an icon
// does not scale with the system text size, so it has nothing to grow for.
check(
  'the box can grow with the text',
  /barInput: \{[\s\S]{0,500}?minHeight: 56,/.test(session) &&
    !/barInput: \{[\s\S]{0,500}?^\s*height: 56,/m.test(session),
  'a fixed height clips the digits at a large system text size'
);

console.log('\n[4] The heatmap can be read without colour');

check(
  'a text summary is built from the same counts',
  /const heatmapSummary = useMemo\(/.test(stats),
  'deriving it separately would let the words and the figure disagree'
);

check(
  'it names the states that need a decision',
  /Watch: \$\{attention\.join\(', '\)\}/.test(stats) &&
    /Too much: \$\{tooMuch\.join\(', '\)\}/.test(stats),
  'listing everything that is merely progressing would bury them'
);

check(
  'it uses the same thresholds as the colours',
  /if \(n >= 4\) tooMuch\.push\(label\);\s*\r?\n?\s*else if \(n >= 2\) attention\.push\(label\);/.test(
    stats
  ),
  'heatmapColor: 1 is progressing, 2-3 attention, 4+ too much'
);

check(
  'it is rendered',
  /testID="muscle-heatmap-summary"/.test(stats),
  'computing it and not showing it is the same bug with extra steps'
);

check(
  'and it stays quiet when there is nothing to say',
  /heatmapSummary\.length > 0 &&/.test(stats),
  'an empty line under the figures on a fresh account is noise'
);

console.log(`\naccessibility-basics: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
