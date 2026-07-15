/**
 * Contract tests: SessionActiveBar keyboard avoidance invariants in session.tsx
 *
 * WHY THIS MATTERS
 * ────────────────
 * The SessionActiveBar (weight/reps inputs + Complete button) lives inside the
 * session screen's KeyboardAvoidingView. For the bar to stay above the software
 * keyboard on every device, three structural invariants must hold:
 *
 *   1. The bar is a CHILD of the KAV, not rendered after it.  If it moves
 *      outside the KAV, it will slide behind the keyboard when inputs are focused.
 *
 *   2. The KAV uses the correct platform behavior: "padding" on iOS (adjusts inner
 *      padding so the bar lifts), "height" on Android (shrinks the container).
 *      Using a fixed string like "padding" on Android causes janky layout.
 *
 *   3. The session stack screen declares headerShown:false so the KAV starts at
 *      y=0. If a native header appears later, keyboardVerticalOffset must be
 *      updated to match the header height — otherwise the bar ends up partially
 *      hidden behind the keyboard.
 *
 *   4. bottomInset passed to SessionActiveBar accounts for the safe-area bottom
 *      inset (home indicator / Android nav bar) so the bar's content never
 *      overlaps the home indicator.
 *
 * Silent failure modes this catches:
 *  - SessionActiveBar accidentally moved outside the KAV (bar hides behind keyboard)
 *  - KAV behavior changed to a fixed string (broken on one platform)
 *  - keyboardVerticalOffset removed (keyboard crops content on tall phones)
 *  - bottomInset no longer uses insets.bottom (bar overlaps home indicator)
 *  - Stack header re-enabled without updating KAV offset (partial keyboard overlap)
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
const layoutSrc = readFile('app/_layout.tsx');

// ─── [1] KAV structural placement: bar is inside the KAV ─────────────────────
console.log('[1] Bar placement — SessionActiveBar is a child of KeyboardAvoidingView');

const kavOpenIdx = sessionSrc.indexOf('<KeyboardAvoidingView');
const kavCloseIdx = sessionSrc.lastIndexOf('</KeyboardAvoidingView>');
const barIdx = sessionSrc.indexOf('<SessionActiveBar');

check(kavOpenIdx !== -1, 'KeyboardAvoidingView opening tag found in session.tsx');
check(kavCloseIdx !== -1, 'KeyboardAvoidingView closing tag found in session.tsx');
check(barIdx !== -1, 'SessionActiveBar usage found in session.tsx');

if (kavOpenIdx !== -1 && kavCloseIdx !== -1 && barIdx !== -1) {
  check(
    barIdx > kavOpenIdx && barIdx < kavCloseIdx,
    'SessionActiveBar renders INSIDE the KeyboardAvoidingView (not after it)',
    `KAV opens at char ${kavOpenIdx}, bar at ${barIdx}, KAV closes at ${kavCloseIdx}`
  );
}

// ─── [2] KAV behavior — platform-conditional ──────────────────────────────────
console.log('[2] KAV behavior — platform-conditional (not a fixed string)');

// Match the behavior prop assignment in the KAV opening tag block
const kavTagEnd = sessionSrc.indexOf('>', kavOpenIdx);
const kavTag = sessionSrc.slice(kavOpenIdx, kavTagEnd + 100); // a bit beyond for multi-line

const hasBehaviorProp = /behavior=\{/.test(kavTag) || /behavior=\{/.test(sessionSrc);
check(hasBehaviorProp, 'behavior prop uses a JSX expression (not a hardcoded string)');

const hasPlatformConditional =
  /Platform\.OS.*['"]ios['"].*padding.*height|['"]padding['"].*['"]height['"]/s.test(sessionSrc);
check(
  hasPlatformConditional,
  'behavior uses a Platform.OS conditional (padding for iOS, height for Android)'
);

const keyboardBehaviorDecl =
  /const keyboardBehavior\s*=\s*Platform\.OS\s*===\s*['"]ios['"]\s*\?\s*['"]padding['"]\s*:\s*['"]height['"]/;
check(
  keyboardBehaviorDecl.test(sessionSrc),
  "keyboardBehavior constant declared as Platform.OS === 'ios' ? 'padding' : 'height'"
);

// ─── [3] keyboardVerticalOffset is set ────────────────────────────────────────
console.log('[3] keyboardVerticalOffset — set on the KAV');

check(
  /keyboardVerticalOffset=\{/.test(sessionSrc),
  'keyboardVerticalOffset prop is present on KeyboardAvoidingView'
);

// The offset must reference insets.top or webTopInset (accounts for status bar)
check(
  /keyboardVerticalOffset=\{[^}]*(insets\.top|webTopInset)[^}]*\}/.test(sessionSrc),
  'keyboardVerticalOffset references insets.top or webTopInset'
);

// ─── [4] bottomInset safe-area awareness ─────────────────────────────────────
console.log('[4] bottomInset — SessionActiveBar receives safe-area-aware value');

// Search the full source — the prop list for SessionActiveBar is long and
// spread across many lines, so a fixed-length slice from the opening tag is
// too short to reach bottomInset which appears near the end of the prop list.
check(/bottomInset=\{/.test(sessionSrc), 'SessionActiveBar receives a bottomInset prop');

check(
  /bottomInset=\{[^}]*insets\.bottom[^}]*\}/.test(sessionSrc),
  'bottomInset value references insets.bottom (safe area aware)'
);

// Web-specific inset is also added
check(
  /bottomInset=\{[^}]*Platform\.OS[^}]*\}/.test(sessionSrc) ||
    /bottomInset=\{[^}]*(web|34)[^}]*\}/.test(sessionSrc),
  'bottomInset adds extra web padding (Platform.OS or 34px web guard)'
);

// ─── [5] Stack screen: headerShown false (KAV starts at y=0) ──────────────────
console.log('[5] Stack config — session screen has headerShown: false');

// Find the Stack.Screen for "session" in _layout.tsx
const sessionScreenMatch = layoutSrc.match(
  /Stack\.Screen\s+name="session"[^/]*options=\{\{[^}]*headerShown:\s*false/s
);
check(
  sessionScreenMatch !== null,
  'Stack.Screen name="session" declares headerShown: false in _layout.tsx',
  'If a native header is added, keyboardVerticalOffset must be updated to match header height'
);

// ─── [6] KAV wraps ScrollView AND bar (order check) ──────────────────────────
console.log('[6] KAV child order — ScrollView appears before SessionActiveBar');

const scrollViewIdx = sessionSrc.indexOf('<ScrollView', kavOpenIdx);
check(scrollViewIdx !== -1, 'ScrollView found inside session KAV');
if (scrollViewIdx !== -1 && barIdx !== -1) {
  check(
    scrollViewIdx < barIdx,
    'ScrollView (exercise cards) renders before SessionActiveBar (natural stacking order)'
  );
}

// ─── [7] No absolute positioning on bar ──────────────────────────────────────
console.log('[7] Bar layout — SessionActiveBar is NOT absolutely positioned');

// Check that barContainer style does NOT use position: 'absolute'
const barContainerStyleMatch = sessionSrc.match(/barContainer:\s*\{([^}]+)\}/);
if (barContainerStyleMatch) {
  const barContainerBody = barContainerStyleMatch[1];
  check(
    !/position\s*:\s*['"]absolute['"]/.test(barContainerBody),
    "barContainer style does not use position: 'absolute' (must be in layout flow for KAV)"
  );
} else {
  fail('barContainer style definition found in session.tsx');
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failed === 0) {
  console.log(`session-kav: all ${passed} checks passed`);
  process.exit(0);
} else {
  console.error(`session-kav: ${failed} of ${passed + failed} checks FAILED`);
  process.exit(1);
}
