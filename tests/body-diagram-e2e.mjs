/**
 * body-diagram-e2e.mjs
 *
 * 52 behavioral contract tests for the BodyDiagram component.
 * Ported from body-diagram.spec.ts (Playwright) to plain Node.js.
 *
 * No browser, no React renderer, no native modules required.
 * Tests verify the same behaviors through source-code analysis:
 *   tap-to-select, category toggle, Front/Back view switching,
 *   label chip text, and the parent-screen UX (Start Session / Confirm Region).
 *
 * ── Section layout ─────────────────────────────────────────────────────────
 *   [1] Source-code static guards   (5 tests)  — identical to body-diagram.spec.ts §1
 *   [2] Flex tab — Targeted Prehab (22 tests)  — BodyDiagram prehab context
 *   [3] Readiness — pain-region    (15 tests)  — BodyDiagram readiness context
 *   [4] Modal selection-state reset  (6 tests) — assertModalResetPattern convention
 *   [5] Category filter toggle       (4 tests) — Muscles / Joints toggle behavior
 *
 * ── Modal reset convention (enforced by assertModalResetPattern in §4) ───
 *   Any modal in flex.tsx that owns a selection/state variable MUST follow
 *   this two-reset pattern so re-opening always starts from a clean state:
 *
 *     openModal (type-guarded):
 *       if (type === '<modalType>') setState(undefined);
 *       — resets BEFORE the modal opens, scoped to that modal type only.
 *
 *     closeModal (unconditional):
 *       setState(undefined);
 *       — resets on EVERY close regardless of which modal was open.
 *
 *   To guard a new modal state: call assertModalResetPattern() in §4.
 *   Currently guarded: prehabDiagramRegion (prehab modal).
 *
 * Run:  node tests/body-diagram-e2e.mjs
 * Exit: 0 = all 52 pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const bdSrc       = readFileSync(join(__dir, '../components/BodyDiagram.tsx'), 'utf8');
const flexSrc     = readFileSync(join(__dir, '../app/(tabs)/flex.tsx'),       'utf8');
const readySrc    = readFileSync(join(__dir, '../app/readiness.tsx'),         'utf8');

let failures = 0;
let total    = 0;

function check(label, condition, detail) {
  total++;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

// ─── Helpers — extract view-specific hotspot function bodies ──────────────────

/**
 * Extract source text between two marker strings.
 * Used to isolate renderFrontHotspots / renderBackHotspots / handleViewChange
 * without a full JS parser (which would be brittle against JSX syntax).
 */
function sliceBetween(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s === -1) return '';
  const e = src.indexOf(endMarker, s + startMarker.length);
  return e === -1 ? src.slice(s) : src.slice(s, e);
}

/**
 * assertModalResetPattern — reusable convention guard for modal selection state.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PROJECT CONVENTION (flex.tsx modal reset pattern)
 * ═══════════════════════════════════════════════════════════════════════════
 * Any modal that owns a selection / state variable (e.g. prehabDiagramRegion)
 * MUST reset it in TWO places:
 *
 *   1. openModal — type-guarded reset BEFORE the modal opens:
 *        if (type === '<modalType>') set<State>(undefined);
 *      Scoped to that modal type so other modals are not affected.
 *
 *   2. closeModal — unconditional reset on EVERY close:
 *        set<State>(undefined);
 *      Ensures re-opening always starts from a clean state, regardless
 *      of which modal was previously open.
 *
 * Both resets are required for a clean round-trip.  Removing either causes
 * the prior selection to persist on the next open (stale-state UX bug).
 *
 * ── To guard a NEW modal state ────────────────────────────────────────────
 * Add a call to assertModalResetPattern() in section [4] of THIS file with:
 *   @param {string}  src            — source text to analyse (flex.tsx)
 *   @param {string}  stateName      — human-readable state name for labels
 *   @param {string}  setter         — exact setter call, e.g. 'setMyState'
 *   @param {string}  openBodyMarker — start marker for sliceBetween on openModal
 *   @param {string}  openBodyEnd    — end   marker for sliceBetween on openModal
 *   @param {string}  closeBodyMarker— start marker for sliceBetween on closeModal
 *   @param {string}  closeBodyEnd   — end   marker for sliceBetween on closeModal
 *   @param {string}  modalType      — the ModalType string literal, e.g. 'prehab'
 *
 * Also add a matching `describeModalLifecycle()` call in section [4] of
 * `tests/body-diagram-component.test.tsx` — the runtime counterpart that
 * verifies the same open→select→close→re-open behaviour through actual React
 * rendering rather than source-code analysis.
 * ─────────────────────────────────────────────────────────────────────────
 */
function assertModalResetPattern(src, {
  stateName, setter, openBodyMarker, openBodyEnd,
  closeBodyMarker, closeBodyEnd, modalType,
}) {
  const openBody  = sliceBetween(src, openBodyMarker,  openBodyEnd);
  const closeBody = sliceBetween(src, closeBodyMarker, closeBodyEnd);
  const setCall   = `${setter}(undefined)`;
  const typeGuard = `type === '${modalType}'`;

  check(
    `${stateName}: state initialised to undefined in flex.tsx`,
    src.includes(setter) && src.includes('(undefined)'),
    `useState for ${stateName} must initialise to undefined so every re-open starts clean`,
  );

  check(
    `${stateName}: openModal resets state when type === '${modalType}'`,
    openBody.includes(typeGuard) && openBody.includes(setCall),
    `openModal must contain: if (${typeGuard}) ${setCall}`,
  );

  check(
    `${stateName}: openModal reset is guarded by type — not applied to all modals`,
    (() => {
      const lines = openBody.split('\n');
      const inlineGuard = lines.some(l => l.includes(typeGuard) && l.includes(setter));
      if (inlineGuard) return true;
      const guardIdx = lines.findIndex(l => l.includes(typeGuard));
      const resetIdx = lines.findIndex(l => l.includes(setCall));
      return guardIdx !== -1 && resetIdx !== -1 && guardIdx <= resetIdx;
    })(),
    `reset must only run for '${modalType}' modals, not conditioning/flexibility/etc`,
  );

  check(
    `${stateName}: closeModal unconditionally resets to undefined`,
    closeBody.includes(setCall),
    `closeModal must always call ${setCall} — no type guard allowed`,
  );

  check(
    `${stateName}: closeModal reset has no type guard (applies to every close)`,
    closeBody.includes(setCall) && !closeBody.includes(typeGuard),
    `closeModal takes no args and must not check modal type — it always resets`,
  );

  check(
    `${stateName}: round-trip guard — both openModal and closeModal reset state`,
    openBody.includes(setCall) && closeBody.includes(setCall),
    `both the open-path guard and the close-path reset must be present for clean round-trip UX`,
  );
}

// Front hotspots: from renderFrontHotspots up to renderBackHotspots
const frontHotspots = sliceBetween(bdSrc, 'const renderFrontHotspots', 'const renderBackHotspots');
// Back hotspots: from renderBackHotspots up to "const label = "
const backHotspots  = sliceBetween(bdSrc, 'const renderBackHotspots', 'const label = ');
// handleViewChange body: from handleViewChange up to handleCategoryChange
const hViewChange   = sliceBetween(bdSrc, 'const handleViewChange', 'const handleCategoryChange');
// handleCategoryChange body: from handleCategoryChange up to "return ("
const hCatChange    = sliceBetween(bdSrc, 'const handleCategoryChange', 'return (');

// BODY_DIAGRAM_LABELS as expected by the test suite
const EXPECTED_LABELS = {
  neck:           'Neck',
  front_shoulder: 'Front Shoulder',
  rear_shoulder:  'Rear Shoulder',
  elbow_wrist:    'Elbow / Wrist',
  upper_back:     'Upper Back',
  lower_back:     'Lower Back',
  core_ribs:      'Core / Ribs',
  hip_groin:      'Hip / Groin',
  knee:           'Knee',
  calf_shin:      'Calf / Shin',
  ankle_achilles: 'Ankle / Achilles',
  chest:          'Chest',
  bicep:          'Biceps',
  tricep:         'Triceps',
  quads:          'Quads',
  hamstrings:     'Hamstrings',
  glutes:         'Glutes',
  lat_mid_back:   'Lats / Mid Back',
};

// ─── [1] Source-code static guards ───────────────────────────────────────────

console.log('\n[1] Source-code static guards');

check(
  'fill guard: h() uses rgba(0,0,0,0.001) not transparent',
  (() => {
    if (!bdSrc.includes('rgba(0,0,0,0.001)')) return false;
    const hBlock = bdSrc.match(/const h = \(r: PainRegion\) => \(\{[\s\S]*?\}\);/)?.[0] ?? '';
    if (!hBlock) return false;
    if (hBlock.match(/fill:\s*['"]transparent['"]/)) return false;
    if (hBlock.match(/fill:\s*['"]none['"]/)) return false;
    return true;
  })(),
  'rgba(0,0,0,0.001) must be the h() fill — transparent/none breaks iOS/Android touch',
);

check(
  'testID guard: h() spreads body-diagram-region-${r} on every hotspot',
  bdSrc.includes('testID: `body-diagram-region-${r}`'),
  'testID must be inside h() so every region gets it',
);

check(
  "h() coverage: all 18 PainRegion values appear as h('region') calls",
  Object.keys(EXPECTED_LABELS).every(r => new RegExp(`h\\('${r}'\\)`).test(bdSrc)),
  'one or more regions missing from h() calls',
);

check(
  'label completeness: BODY_DIAGRAM_LABELS has entries for all 18 regions',
  Object.entries(EXPECTED_LABELS).every(([r, l]) => bdSrc.includes(`${r}:`) && bdSrc.includes(l)),
  'one or more label entries missing',
);

check(
  'toggle testIDs: body-diagram-front and body-diagram-back present',
  bdSrc.includes('testID="body-diagram-front"') && bdSrc.includes('testID="body-diagram-back"'),
  'toggle button testIDs are needed for view-switch automation',
);

// ─── [2] Flex tab — Targeted Prehab modal ─────────────────────────────────────

console.log('\n[2] Flex tab — Targeted Prehab modal');

check(
  'body diagram renders with Front and Back toggle buttons',
  bdSrc.includes('testID="body-diagram-front"') && bdSrc.includes('testID="body-diagram-back"'),
  'toggle testIDs must be present for the Flex tab prehab modal',
);

// Front-view regions used in the prehab context
const FRONT_PREHAB_REGIONS = [
  ['neck',           'Neck'],
  ['front_shoulder', 'Front Shoulder'],
  ['elbow_wrist',    'Elbow / Wrist'],
  ['core_ribs',      'Core / Ribs'],
  ['hip_groin',      'Hip / Groin'],
  ['knee',           'Knee'],
  ['calf_shin',      'Calf / Shin'],
  ['ankle_achilles', 'Ankle / Achilles'],
];

for (const [region, label] of FRONT_PREHAB_REGIONS) {
  check(
    `Front: tapping ${region} shows "${label}" label chip`,
    EXPECTED_LABELS[region] === label &&
    frontHotspots.includes(`h('${region}')`) &&
    bdSrc.includes(label),
    `BODY_DIAGRAM_LABELS['${region}'] must equal '${label}' and h('${region}') must be in renderFrontHotspots`,
  );
}

check(
  'Back: switching to Back clears selection and shows hint',
  hViewChange.includes('onSelect(undefined)') &&
  bdSrc.includes('Tap a region on the diagram'),
  'handleViewChange must call onSelect(undefined) on view switch; hint text must be present',
);

const BACK_PREHAB_REGIONS = [
  ['rear_shoulder', 'Rear Shoulder'],
  ['upper_back',    'Upper Back'],
  ['lower_back',    'Lower Back'],
];

for (const [region, label] of BACK_PREHAB_REGIONS) {
  check(
    `Back: tapping ${region} shows "${label}" label chip`,
    EXPECTED_LABELS[region] === label &&
    backHotspots.includes(`h('${region}')`) &&
    bdSrc.includes(label),
    `BODY_DIAGRAM_LABELS['${region}'] must equal '${label}' and h('${region}') must be in renderBackHotspots`,
  );
}

check(
  'Front→Back→Front toggle: each switch clears selection',
  hViewChange.includes('onSelect(undefined)') &&
  /if\s*\(v\s*!==\s*view\)/.test(hViewChange),
  'handleViewChange must guard with (v !== view) before calling onSelect(undefined)',
);

// New front regions added after the original 11
const NEW_FRONT_REGIONS = [
  ['chest',  'Chest'],
  ['bicep',  'Biceps'],
  ['quads',  'Quads'],
];

for (const [region, label] of NEW_FRONT_REGIONS) {
  check(
    `Front: tapping ${region} shows "${label}" label chip`,
    EXPECTED_LABELS[region] === label &&
    frontHotspots.includes(`h('${region}')`) &&
    bdSrc.includes(label),
    `BODY_DIAGRAM_LABELS['${region}'] must equal '${label}' and h('${region}') must be in renderFrontHotspots`,
  );
}

// New back regions
const NEW_BACK_REGIONS = [
  ['tricep',      'Triceps'],
  ['lat_mid_back','Lats / Mid Back'],
  ['glutes',      'Glutes'],
  ['hamstrings',  'Hamstrings'],
];

for (const [region, label] of NEW_BACK_REGIONS) {
  check(
    `Back: tapping ${region} shows "${label}" label chip`,
    EXPECTED_LABELS[region] === label &&
    backHotspots.includes(`h('${region}')`) &&
    bdSrc.includes(label),
    `BODY_DIAGRAM_LABELS['${region}'] must equal '${label}' and h('${region}') must be in renderBackHotspots`,
  );
}

// "Start Session" button revealed when a region is selected
// flex.tsx: {prehabDiagramRegion && (<View ... testID="prehab-region-start" ... >Start Session</View>)}
check(
  'selecting a region reveals the Start Session button',
  flexSrc.includes('prehabDiagramRegion') &&
  flexSrc.includes('Start Session') &&
  flexSrc.includes('testID="prehab-region-start"') &&
  // The button is conditionally rendered when prehabDiagramRegion is truthy
  /prehabDiagramRegion\s*&&/.test(flexSrc),
  'flex.tsx must conditionally render the Start Session button when prehabDiagramRegion is set',
);

// ─── [3] Readiness screen — pain-region step ─────────────────────────────────

console.log('\n[3] Readiness screen — pain-region step');

check(
  'body diagram renders with Front and Back toggle on pain-region step',
  // readiness.tsx uses BodyDiagram and it has the toggle testIDs
  readySrc.includes('BodyDiagram') &&
  bdSrc.includes('testID="body-diagram-front"') &&
  bdSrc.includes('testID="body-diagram-back"'),
  'readiness.tsx must import BodyDiagram and BodyDiagram must have toggle testIDs',
);

// Front regions in readiness context (same labels as prehab, different accent)
for (const [region, label] of FRONT_PREHAB_REGIONS) {
  check(
    `Front: tapping ${region} shows "${label}" label chip`,
    EXPECTED_LABELS[region] === label &&
    frontHotspots.includes(`h('${region}')`) &&
    bdSrc.includes(label),
    `label and front hotspot presence check for readiness context`,
  );
}

check(
  'Back: switching to Back clears selection',
  hViewChange.includes('onSelect(undefined)') &&
  /if\s*\(v\s*!==\s*view\)/.test(hViewChange),
  'handleViewChange guard and onSelect(undefined) call required',
);

for (const [region, label] of BACK_PREHAB_REGIONS) {
  check(
    `Back: tapping ${region} shows "${label}" label chip`,
    EXPECTED_LABELS[region] === label &&
    backHotspots.includes(`h('${region}')`) &&
    bdSrc.includes(label),
    `label and back hotspot presence check for readiness context`,
  );
}

// "Confirm Region" button revealed when a region is selected
// readiness.tsx: {painRegion && <Pressable testID="pain-region-confirm" ...>}
check(
  'selecting a region reveals the Confirm Region button',
  readySrc.includes('painRegion') &&
  readySrc.includes('testID="pain-region-confirm"') &&
  // The confirm button is inside a conditional block gated on painRegion
  /painRegion\b/.test(readySrc) &&
  readySrc.includes('"pain-region-confirm"'),
  'readiness.tsx must render testID="pain-region-confirm" when painRegion is set',
);

// Tapping Confirm Region navigates to /session
check(
  'tapping Confirm Region with core_ribs navigates to session',
  // readiness.tsx must push/replace to pathname: '/session' in the confirm handler
  readySrc.includes("pathname: '/session'") &&
  readySrc.includes('painRegion'),
  "readiness.tsx confirm handler must navigate to pathname: '/session' with painRegion param",
);

// ─── [4] Modal selection-state reset guard ────────────────────────────────────
//
// Uses assertModalResetPattern() (defined above) to verify every modal that owns
// a selection state follows the project convention:  type-guarded open reset +
// unconditional close reset.
//
// Currently guarded state: prehabDiagramRegion (prehab modal).
//
// To guard a NEW modal state when conditioning/flexibility gain their own
// selection variables, add another assertModalResetPattern() call here with
// the appropriate markers and modalType.  The helper's JSDoc above explains
// each parameter.

console.log('\n[4] Modal selection-state reset guard — assertModalResetPattern convention');

assertModalResetPattern(flexSrc, {
  stateName:        'prehabDiagramRegion',
  setter:           'setPrehabDiagramRegion',
  openBodyMarker:   'const openModal = (',
  openBodyEnd:      'const closeModal = (',
  closeBodyMarker:  'const closeModal = (',
  closeBodyEnd:     'const openEquipmentSheet = (',
  modalType:        'prehab',
});

// ─── [5] Category filter toggle ──────────────────────────────────────────────

console.log('\n[5] Category filter toggle');

// The 11 muscle regions in MUSCLE_SET
const MUSCLE_REGIONS = [
  'chest', 'bicep', 'tricep', 'core_ribs',
  'quads', 'hamstrings', 'glutes', 'lat_mid_back',
  'upper_back', 'lower_back', 'calf_shin',
];

// The 7 joint regions (not in MUSCLE_SET)
const JOINT_REGIONS = [
  'neck', 'front_shoulder', 'rear_shoulder', 'elbow_wrist',
  'hip_groin', 'knee', 'ankle_achilles',
];

check(
  'category toggle testIDs: body-diagram-muscles and body-diagram-joints present',
  bdSrc.includes('testID="body-diagram-muscles"') && bdSrc.includes('testID="body-diagram-joints"'),
  'category toggle buttons must have testID="body-diagram-muscles" and testID="body-diagram-joints" for automation',
);

check(
  'handleCategoryChange calls onSelect(undefined) to reset selection on every category switch',
  hCatChange.includes('onSelect(undefined)'),
  'handleCategoryChange must call onSelect(undefined) — missing this silently preserves a stale selection when the user switches category',
);

check(
  'MUSCLE_SET contains all 11 muscle regions and excludes all 7 joint regions',
  (() => {
    // Extract the MUSCLE_SET literal from source — it lives between "new Set<PainRegion>([" and "]);"
    const setBlock = sliceBetween(bdSrc, 'new Set<PainRegion>([', ']);');
    if (!setBlock) return false;
    const allMusclesPresent = MUSCLE_REGIONS.every(r => setBlock.includes(`'${r}'`));
    const noJointsPresent   = JOINT_REGIONS.every(r => !setBlock.includes(`'${r}'`));
    return allMusclesPresent && noJointsPresent;
  })(),
  `MUSCLE_SET must include all 11 muscle regions (${MUSCLE_REGIONS.join(', ')}) and exclude all 7 joint regions`,
);

check(
  'Both "Muscles" and "Joints" button labels are present in the source',
  bdSrc.includes('>Muscles<') && bdSrc.includes('>Joints<'),
  'category toggle buttons must render the text labels "Muscles" and "Joints"',
);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
  console.error(`body-diagram-e2e: ${failures}/${total} test(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`body-diagram-e2e: all ${total} tests passed\n`);
  process.exit(0);
}
