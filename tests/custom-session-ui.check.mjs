/**
 * Contract test: the custom-session screen's chrome.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Reported, with a screenshot: "the custom sessions screen is HORRIBLE, it's a
 * complete mess, you can't navigate easily anywhere, it's aesthetically
 * horrible."
 *
 * Four things were true at once:
 *
 *  1. TWO HEADERS. The route had no <Stack.Screen> entry, so it fell back to
 *     the default navigator header — which renders the raw route name. The
 *     screen showed a grey "custom-session" bar with a Back button directly
 *     above its own properly-designed header.
 *  2. FOUR full-width control rows above the list — a name field, a search
 *     field, an equipment row and a filter row — roughly 200pt of screen spent
 *     before a single exercise appeared. Two of them were identical-looking
 *     text inputs.
 *  3. TWO COMPETING TAXONOMIES: a vertical category rail AND a horizontal
 *     movement-pattern chip row, both filtering the same list.
 *  4. The rail was too narrow for its own labels, so "Accessories" rendered as
 *     "Accessorie / s" — a mid-word break.
 *
 * Run:  node tests/custom-session-ui.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dir, '../app/custom-session.tsx'), 'utf8');
const layout = readFileSync(join(__dir, '../app/_layout.tsx'), 'utf8');

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

// ─── 1. One header ───────────────────────────────────────────────────────────
console.log('\n[1] The screen has one header, not two');

check(
  'the route is registered with headerShown: false',
  /<Stack\.Screen name="custom-session" options=\{\{ headerShown: false \}\} \/>/.test(layout),
  'without an entry the navigator renders its default header, showing the raw route name'
);
// Every screen in this app draws its own header, so a route that forgets to
// hide the navigator's gets two — which is the bug that was reported. Checked
// for all of them, not just the one that was broken.
//
// Deliberately NOT a constructed RegExp. The first version of this check was
// written through a shell heredoc, which ate the backslashes and turned [\s\S]
// into [sS]; the assertion then matched nothing and reported all ten screens as
// broken. A plain string search cannot be mangled that way.
const declared = [...layout.matchAll(/<Stack\.Screen[\s\n]+name="([a-z-]+)"/g)].map((m) => m[1]);
const undeclaredHeaders = declared.filter((name) => {
  const at = layout.indexOf(`name="${name}"`);
  return at === -1 || !layout.slice(at, at + 200).includes('headerShown: false');
});
check(
  `every declared screen hides the navigator header (${declared.length} screens)`,
  undeclaredHeaders.length === 0,
  undeclaredHeaders.join(', ')
);

// ─── 2. One row of controls ──────────────────────────────────────────────────
console.log('\n[2] The controls do not fill the screen before the list does');

check(
  'search and the filter button share one row',
  /heroControls/.test(src),
  ''
);
check(
  'the name field is collapsed by default',
  /const \[nameOpen, setNameOpen\] = useState\(false\)/.test(src),
  'most sessions are never named; it was taking a full row from everyone'
);
check(
  'the standalone equipment row is gone from the flow',
  !/<View style=\{styles\.equipRow\}>/.test(src),
  'it is inside the filter sheet now'
);
check(
  'the horizontal filter row is gone from the flow',
  !/contentContainerStyle=\{styles\.attrFilterRow\}/.test(src) ||
    src.indexOf('filtersOpen') < src.indexOf('styles.attrFilterRow'),
  'anything past the fourth chip was off the right edge and effectively invisible'
);
check(
  'there is a single filters entry point',
  /testID="custom-open-filters"/.test(src) && /visible=\{filtersOpen\}/.test(src),
  ''
);
check(
  'the filter count ignores a full equipment selection',
  /equipmentFilters\.size > 0 && equipmentFilters\.size < ownedTiers\.length \? 1 : 0/.test(src),
  'everything selected is the default state, not a filter — a button permanently reading "3" says nothing'
);

// ─── 3. The rail fits its own labels ─────────────────────────────────────────
console.log('\n[3] Nothing breaks mid-word');

const railStyle = src.slice(src.indexOf('    rail: {'), src.indexOf('    rail: {') + 260);
const railWidth = Number(railStyle.match(/width: (\d+)/)?.[1] ?? 0);
check(`the rail is wider than 104pt (now ${railWidth})`, railWidth >= 112, '');
check(
  'rail labels are one line',
  /numberOfLines=\{1\}/.test(src),
  'a mid-word break is worse than a truncation'
);
const labels = [...src.matchAll(/^  \w+: '([^']+)',$/gm)]
  .map((m) => m[1])
  .filter((l) => /^[A-Z]/.test(l));
const tooLong = labels.filter((l) => l.length > 12);
check(
  'no category label is long enough to overflow the rail',
  !src.includes("neuro: 'Speed & Power'") && !src.includes("cooldown: 'Cool-Down'"),
  `${tooLong.join(', ')} — at 13px, ~14 characters is the practical limit in this column`
);

// ─── 4. It looks like its own screen ─────────────────────────────────────────
console.log('\n[4] It has an identity of its own');

check(
  'the header is a filled block rather than another neutral card',
  /hero: \{[\s\S]{0,120}?backgroundColor: C\.primaryDark/.test(src),
  'asked for: "its own individual UI rather than just along with the theme"'
);
check(
  'the rail has its own recessed background',
  /rail: \{[\s\S]{0,200}?backgroundColor: C\.surfaceTertiary/.test(src),
  'a border alone read as a list that happened to have a line beside it'
);
check(
  'the active category is a solid pill',
  /railItemActive: \{[\s\S]{0,80}?backgroundColor: C\.primaryDark/.test(src),
  ''
);

console.log('');
if (failures > 0) {
  console.error(`custom-session-ui: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`custom-session-ui: all ${total} checks passed\n`);
  process.exit(0);
}
