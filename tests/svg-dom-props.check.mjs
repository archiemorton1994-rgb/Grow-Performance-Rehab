/**
 * Contract test: react-native-svg does not hand React Native props to the DOM.
 *
 * WHAT WAS WRONG
 * ──────────────
 * Seven React warnings on the Stats tab — six touch-handler props and an
 * `accessible` flag — all from SVG shapes that carry a press handler. On the web
 * build react-native-svg renders a raw <path> or <svg> and passes the React
 * Native responder props straight through to it; React's own message is "It will
 * be ignored", which is the point. `accessible` arrives the same way, off the
 * body figure in react-native-body-highlighter.
 *
 * React reports each property NAME once, globally, so this was never fixable one
 * call site at a time: our own body diagram and the third-party figure produce
 * the same names, and silencing either alone changes nothing on screen. One
 * patch, where the props are assembled, removes all seven — and leaves presses
 * working, because on the web they are delivered by `onClick`, which the same
 * function still sets.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * The fix is a patch-package patch. It is one `npm install --ignore-scripts`
 * away from being silently gone, and the symptom of losing it is seven console
 * warnings nobody reads. The patched module cannot be imported here — it pulls
 * in react-native, which needs the Metro transform — so this reads the files the
 * app actually bundles.
 *
 * Run:  node tests/svg-dom-props.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

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

/** The props React named in each of the seven warnings. */
const RESPONDER_PROPS = [
  'onStartShouldSetResponder',
  'onResponderTerminationRequest',
  'onResponderGrant',
  'onResponderMove',
  'onResponderRelease',
  'onResponderTerminate',
];

// Three builds ship in the package and which one is bundled depends on the
// platform and the resolver, so all three have to agree.
const BUILDS = [
  'node_modules/react-native-svg/src/web/utils/prepare.ts',
  'node_modules/react-native-svg/lib/module/web/utils/prepare.js',
  'node_modules/react-native-svg/lib/commonjs/web/utils/prepare.js',
];

console.log('\n[1] The patch is applied to every build of the web prop cleaner');

for (const rel of BUILDS) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    check(`${rel} exists`, false, 'react-native-svg has moved its web build');
    continue;
  }
  const src = readFileSync(path, 'utf8');

  // The mixin handlers are still attached to the instance — that is untouched.
  // What must not happen is them being copied onto the element's props.
  const assigned = RESPONDER_PROPS.filter((p) =>
    new RegExp(`${p}:\\s*\\n?\\s*self\\.touchableHandle`).test(src)
  );
  check(
    `${rel.split('/web/')[0].split('/').pop()}: no responder handler is put on the element`,
    assigned.length === 0,
    assigned.join(', ')
  );
  check(
    `${rel.split('/web/')[0].split('/').pop()}: \`accessible\` is stripped before the rest spread`,
    /\n\s*accessible,\n[\s\S]{0,40}\.\.\.rest/.test(src),
    'a React Native boolean written onto an SVG node'
  );
  check(
    `${rel.split('/web/')[0].split('/').pop()}: the press is still delivered as a click`,
    /clean\.onClick = props\.onPress/.test(src),
    'without this the patch would take tapping with it'
  );
  check(
    `${rel.split('/web/')[0].split('/').pop()}: the accessible NAME is left alone`,
    !/\n\s*accessibilityLabel,/.test(src),
    'react-native-web turns it into aria-label; dropping it would be a real loss'
  );
}

console.log('\n[2] And it is recorded where postinstall will find it');

const patch = join(root, 'patches/react-native-svg+15.12.1.patch');
check(
  'patches/react-native-svg+15.12.1.patch is committed',
  existsSync(patch),
  'node_modules is not the source of truth — a fresh install would undo this'
);
if (existsSync(patch)) {
  const src = readFileSync(patch, 'utf8');
  check(
    'and it is the patch for this fix',
    /^\+\s*accessible,$/m.test(src) && /^-\s*onResponderGrant/m.test(src),
    'the file name matches but the contents do not'
  );
}

console.log('');
if (failures > 0) {
  console.error(`svg-dom-props: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`svg-dom-props: all ${total} checks passed\n`);
  process.exit(0);
}
