/**
 * Contract test: the profile screen's settings rows go where they say.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Settings used to be ONE row. Six destinations — Account, Profile,
 * Preferences, Subscription, App, Legal — behind a single tap, named only in a
 * bullet list crammed into that row's 12px subtitle. Roughly everything
 * configurable in the app was one undifferentiated door.
 *
 * They are rows now, and each opens the sheet scrolled to its own section. The
 * link between a row and its section is a STRING that has to match the section
 * heading rendered inside the sheet, and if it does not match, nothing breaks
 * loudly — the sheet just opens at the top, exactly as if the feature had never
 * been built. That is the failure this file exists to catch.
 *
 * Run:  node tests/profile-settings.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dir, '../app/(tabs)/profile.tsx'), 'utf8');

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

// ─── 1. Every row points at a section that exists ────────────────────────────
console.log('\n[1] Row names and section headings agree');

const destBlock = src.slice(
  src.indexOf('const SETTINGS_DESTINATIONS'),
  src.indexOf('interface ProfileTutorialStep')
);
const rowNames = [...destBlock.matchAll(/section: '([^']+)'/g)].map((m) => m[1]);
// The onLayout recorder is what actually registers a section's position.
const registered = [...src.matchAll(/settingsSectionY\.current\['([^']+)'\]/g)].map((m) => m[1]);

check(`there are settings rows at all (${rowNames.length})`, rowNames.length >= 4, '');
check(
  `every section heading records its position (${registered.length})`,
  registered.length >= rowNames.length,
  'a heading with no onLayout has no y, so its row opens the sheet at the top'
);

const unmatched = rowNames.filter((n) => !registered.includes(n));
check(
  'every row name matches a real section heading',
  unmatched.length === 0,
  `${unmatched.join(', ')} — these rows would silently open the sheet at the top`
);

const unreachable = registered.filter((n) => !rowNames.includes(n));
check(
  'every section is reachable from a row',
  unreachable.length === 0,
  `${unreachable.join(', ')} — reachable only by scrolling, which is what this replaced`
);

/**
 * No section heading may be conditionally rendered.
 *
 * This is here because it already happened. The "App" heading sat inside
 * `{tourComplete && (...)}` along with the Replay Guided Tour row — so for
 * anyone who had not finished the tour, the heading never rendered, its
 * position was never recorded, and the App row on the profile screen opened the
 * sheet at the top with no error anywhere. (It also meant "Rate Grow" and
 * "Version" appeared under no heading at all, which was a pre-existing bug the
 * jump feature simply made visible.)
 *
 * Brace-matched rather than windowed: measuring distance in characters is how
 * the sibling check in replay-tour.check.mjs came to fail on an unrelated edit.
 */
function blockFrom(s, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) return s.slice(openIdx, i + 1);
  }
  return s.slice(openIdx);
}
const conditionallyRendered = [];
for (const m of src.matchAll(/\{[a-zA-Z][\w.?]* && \(/g)) {
  const block = blockFrom(src, m.index);
  for (const hit of block.matchAll(/settingsSectionY\.current\['([^']+)'\]/g)) {
    conditionallyRendered.push(`${hit[1]} (inside ${m[0].trim()})`);
  }
}
check(
  'no section heading is conditionally rendered',
  conditionallyRendered.length === 0,
  `${conditionallyRendered.join(', ')} — a heading that sometimes does not render records no position, so its row silently opens the sheet at the top`
);

// ─── 2. The scroll actually happens ──────────────────────────────────────────
console.log('\n[2] The jump is wired end to end');

check(
  'tapping a row records which section was wanted',
  /setPendingSettingsSection\(dest\.section\)/.test(src),
  ''
);
check(
  'and opens the sheet',
  /setPendingSettingsSection\(dest\.section\);[\s\S]{0,80}setActiveModal\('settings'\)/.test(src),
  'the two calls must be in the same handler — apart, the target is set for a sheet that never opens'
);
check(
  'the sheet scroll view is addressable',
  /ref=\{settingsScrollRef\}/.test(src),
  'without the ref there is nothing to scroll'
);
check(
  'the scroll waits for layout',
  /setTimeout\(\(\) => \{[\s\S]{0,400}?settingsScrollRef\.current\?\.scrollTo/.test(src),
  'scrolling on the frame the modal mounts scrolls a list whose sections are all still at y=0'
);
check(
  'a missing section leaves the sheet at the top rather than throwing',
  /if \(y !== undefined\)/.test(src),
  'scrollTo({ y: undefined }) is not a safe default'
);
check(
  'the pending target is cleared after use',
  /setPendingSettingsSection\(null\)/.test(src),
  'left set, reopening the sheet from anywhere else would jump to a stale section'
);

// ─── 3. Card titles are headings, not shouting ───────────────────────────────
console.log('\n[3] Type reads as type');

// Scoped to the screen body, not the settings sheet. An 11px tertiary label
// above a group of rows inside a settings sheet is the standard grouped-list
// idiom and is fine; a CARD TITLE in tracked-out 13px capitals is not — it
// reads as a form-field label, and it made every card's SUBTITLE the most
// readable line in the card.
const screenBody = src.slice(0, src.indexOf('    settingSectionLabel: {'));
check(
  'no card title is set in tracked-out capitals',
  !/textTransform: 'uppercase'/.test(screenBody),
  'the one legitimate use is the settings sheet group labels, which are excluded here'
);
check(
  'no title is hardcoded in caps either',
  !/>(?:SUBSCRIBE TO GROW|SETTINGS|YOUR STRENGTH PROGRESS|STRENGTH PROGRESS)</.test(src),
  'the style can be fixed and the string still shout'
);

// ─── 4. One stat card, shared with the Stats tab ─────────────────────────────
console.log('\n[4] The summary card is not hand-built here');

check(
  'the profile uses the shared StatStrip',
  /<StatStrip/.test(src) && /from '@\/components\/StatStrip'/.test(src),
  ''
);
check(
  'and its private copy is gone',
  !/styles\.statsCard|styles\.statVal|styles\.statLbl|styles\.statNumRow/.test(src),
  'this was the fifth copy of one card in the app'
);

// ─── 5. The page has a structure ─────────────────────────────────────────────
console.log('\n[5] The stack is grouped');

check(
  'there are section headings',
  (src.match(/styles\.sectionTitle/g) ?? []).length >= 2,
  'five unrelated cards separated only by equal margins is a list with no way in'
);
const titleStyle = src.slice(src.indexOf('    sectionTitle: {'), src.indexOf('    sectionTitle: {') + 200);
check(
  'they use the same 17px level as the Stats tab',
  /fontSize: 17/.test(titleStyle),
  'two screens in one app should not disagree about what a section heading looks like'
);

// ─── 6. Corner radii are a scale, not a habit ────────────────────────────────
console.log('\n[6] Corners come from a small set');

const radii = [...src.matchAll(/borderRadius: (\d+)/g)].map((m) => Number(m[1]));
const distinct = [...new Set(radii)].sort((a, b) => a - b);
// 2 is a 4px-tall progress bar; 11, 13 and 50 are exactly half of a fixed
// square and therefore circles. Those are shape, not style.
const SHAPE_DEFINED = new Set([2, 11, 13, 50]);
const scale = distinct.filter((r) => !SHAPE_DEFINED.has(r));
check(
  `the radius scale has few steps (${scale.join(', ')})`,
  scale.length <= 4,
  `was 4, 8, 10, 11, 12, 13, 14, 16, 20 — nine values chosen one card at a time`
);

console.log('');
if (failures > 0) {
  console.error(`profile-settings: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`profile-settings: all ${total} checks passed\n`);
  process.exit(0);
}
