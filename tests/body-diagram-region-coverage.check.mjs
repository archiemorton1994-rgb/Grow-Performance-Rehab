/**
 * Contract test: every PainRegion declared in lib/store.ts is covered by
 * both MUSCLE_SET and BODY_DIAGRAM_LABELS in components/BodyDiagram.tsx.
 *
 * The existing tests/body-diagram.check.mjs verifies the diagram against a
 * HARDCODED list of 18 regions.  That list will not automatically grow when
 * a developer adds a new PainRegion to lib/store.ts.  The result:
 *
 *   • BODY_DIAGRAM_LABELS entry missing  →  label chip shows nothing after tap
 *   • MUSCLE_SET not updated             →  new region gets wrong colour category
 *                                            (silently shown as a joint instead
 *                                             of a muscle, or vice-versa)
 *   • h() hotspot missing                →  region can never be tapped on the
 *                                            diagram (already caught by the
 *                                            hardcoded body-diagram.check.mjs,
 *                                            but only for its fixed 18 regions)
 *
 * These checks guard against that regression by dynamically sourcing the
 * ground truth from the PainRegion type declaration:
 *
 *   1. REGION PARSING        — extract all PainRegion literals from lib/store.ts
 *   2. BODY_DIAGRAM_LABELS   — every PainRegion has a key in BODY_DIAGRAM_LABELS
 *                              (parsed from BodyDiagram.tsx); bidirectionality
 *                              check ensures no stale keys remain either
 *   3. MUSCLE_SET coverage   — bidirectional:
 *        Forward: every PainRegion is explicitly classified as either a
 *                 muscle (present in MUSCLE_SET) or a joint (present in
 *                 KNOWN_JOINTS below).  Adding a new PainRegion without
 *                 placing it in one of these two buckets fails the test.
 *        Reverse: every value listed in MUSCLE_SET is still a valid
 *                 PainRegion (catches renames that leave stale entries)
 *   4. h() hotspot coverage  — REGION_VIEWS is now DERIVED by parsing which
 *                              h() calls live in renderFrontHotspots vs
 *                              renderBackHotspots.  No hardcoded map to maintain.
 *                              Adding a new PainRegion only requires h() calls
 *                              in the appropriate render function(s).
 *
 * ── Classification contract ───────────────────────────────────────────────────
 * BodyDiagram.tsx classifies each PainRegion into one of two visual categories:
 *
 *   • MUSCLE  — explicitly listed in MUSCLE_SET (emerald green fill)
 *   • JOINT   — everything else; implicitly !MUSCLE_SET.has(r) (slate-blue fill)
 *
 * KNOWN_JOINTS is derived at runtime as (PainRegion − MUSCLE_SET), so there is
 * no manually maintained list to keep in sync.  When a new PainRegion is added:
 *   • If it is a MUSCLE region → add it to MUSCLE_SET in BodyDiagram.tsx
 *   • If it is a JOINT region  → no change needed here; it becomes a joint
 *                                 automatically.  Still add it to
 *                                 BODY_DIAGRAM_LABELS and REGION_VIEWS.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Run:  node tests/body-diagram-region-coverage.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const storeSrc = readFileSync(join(__dir, '../lib/store.ts'), 'utf8');
const diagramSrc = readFileSync(join(__dir, '../components/BodyDiagram.tsx'), 'utf8');

let failures = 0;
let total = 0;

function check(label, condition, detail) {
  total++;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

// ─── 1. Parse PainRegion literals from lib/store.ts ───────────────────────────
console.log('\n[1] Parse PainRegion type from lib/store.ts');

// The type declaration ends at the first semicolon after the '=' sign.
const typeStart = storeSrc.indexOf('export type PainRegion =');
check(
  'PainRegion type declaration found in lib/store.ts',
  typeStart !== -1,
  'declaration not found — check lib/store.ts'
);

let painRegions = [];

if (typeStart !== -1) {
  const eqPos = storeSrc.indexOf('=', typeStart);
  const semi = storeSrc.indexOf(';', eqPos);
  // Strip // comments first: the union is documented inline, and a comment
  // naming a retired region would otherwise be read as a live member.
  const typeBlock = storeSrc
    .slice(eqPos, semi + 1)
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');

  const regionMatches = [...typeBlock.matchAll(/'([a-z_]+)'/g)];
  painRegions = regionMatches.map((m) => m[1]);

  check(
    `PainRegion type contains at least 1 value (found ${painRegions.length})`,
    painRegions.length >= 1,
    'no quoted identifiers found in PainRegion type block'
  );

  for (const r of painRegions) {
    console.log(`  · PainRegion: '${r}'`);
  }
}

const painRegionSet = new Set(painRegions);

// ─── Classification contract — derived joint set ───────────────────────────────
// KNOWN_JOINTS is computed at the end of section [3] as (PainRegion − MUSCLE_SET).
// There is no manually maintained list: every PainRegion not in MUSCLE_SET is
// automatically a joint.  If a new joint PainRegion is added to lib/store.ts it
// will be classified correctly without any change to this file.
//
// The only manual step when adding a new PainRegion is:
//   • MUSCLE region → add to MUSCLE_SET in components/BodyDiagram.tsx
//   • JOINT region  → no change here; still update BODY_DIAGRAM_LABELS (section 2)
//                     and REGION_VIEWS (section 4)

// ─── 2. BODY_DIAGRAM_LABELS — every PainRegion has an entry ───────────────────
console.log('\n[2] BODY_DIAGRAM_LABELS — every PainRegion has an entry in BodyDiagram.tsx');

// Parse the BODY_DIAGRAM_LABELS object using brace-depth tracking.
// The object starts at the '{' immediately following the 'BODY_DIAGRAM_LABELS' declaration.

const labelsDecl = diagramSrc.indexOf('BODY_DIAGRAM_LABELS');
check(
  'BODY_DIAGRAM_LABELS declaration found in BodyDiagram.tsx',
  labelsDecl !== -1,
  'BODY_DIAGRAM_LABELS not found — check components/BodyDiagram.tsx'
);

let labelsKeys = [];

if (labelsDecl !== -1) {
  const labelsOpen = diagramSrc.indexOf('{', labelsDecl);
  let depth = 0;
  let labelsEnd = -1;
  for (let i = labelsOpen; i < diagramSrc.length; i++) {
    if (diagramSrc[i] === '{') depth++;
    else if (diagramSrc[i] === '}') {
      depth--;
      if (depth === 0) {
        labelsEnd = i;
        break;
      }
    }
  }

  if (labelsEnd !== -1) {
    const labelsBlock = diagramSrc.slice(labelsOpen + 1, labelsEnd);
    // Keys are bare identifiers followed by ':' on their own or at line start,
    // not inside string values.  Match word-start identifiers before ':'.
    const keyMatches = [...labelsBlock.matchAll(/\b([a-z_]+)\s*:/g)];
    labelsKeys = keyMatches.map((m) => m[1]);
  }

  check(
    `BODY_DIAGRAM_LABELS block parsed successfully (found ${labelsKeys.length} key(s))`,
    labelsKeys.length >= 1,
    'could not extract keys from BODY_DIAGRAM_LABELS block'
  );
}

const labelsKeySet = new Set(labelsKeys);

// Forward: every PainRegion has a BODY_DIAGRAM_LABELS entry
console.log('\n  Forward: every PainRegion → BODY_DIAGRAM_LABELS');
for (const region of painRegions) {
  check(
    `BODY_DIAGRAM_LABELS has key '${region}'`,
    labelsKeySet.has(region),
    `missing entry — label chip will show nothing when '${region}' is tapped; ` +
      `add  ${region}:  '<Human Label>',  to BODY_DIAGRAM_LABELS in BodyDiagram.tsx`
  );
}

// Reverse: every BODY_DIAGRAM_LABELS key is a valid PainRegion
console.log('\n  Reverse: every BODY_DIAGRAM_LABELS key is a valid PainRegion');
for (const key of labelsKeys) {
  check(
    `BODY_DIAGRAM_LABELS key '${key}' is a declared PainRegion`,
    painRegionSet.has(key),
    `stale or unknown key '${key}' in BODY_DIAGRAM_LABELS — remove it or add it to PainRegion in lib/store.ts`
  );
}

// ─── 3. MUSCLE_SET coverage — bidirectional classification check ───────────────
console.log('\n[3] MUSCLE_SET coverage — every PainRegion is explicitly classified');

// Parse the MUSCLE_SET array contents using bracket-depth tracking.
const muscleSetDecl = diagramSrc.indexOf('const MUSCLE_SET');
check(
  'MUSCLE_SET declaration found in BodyDiagram.tsx',
  muscleSetDecl !== -1,
  'MUSCLE_SET not found — check components/BodyDiagram.tsx'
);

let muscleSetValues = [];

if (muscleSetDecl !== -1) {
  // MUSCLE_SET = new Set<PainRegion>([...])  — find the '[' array literal
  const arrOpen = diagramSrc.indexOf('[', muscleSetDecl);
  const arrClose = diagramSrc.indexOf(']', arrOpen);

  if (arrOpen !== -1 && arrClose !== -1) {
    const arrBlock = diagramSrc.slice(arrOpen + 1, arrClose);
    const valMatches = [...arrBlock.matchAll(/'([a-z_]+)'/g)];
    muscleSetValues = valMatches.map((m) => m[1]);
  }

  check(
    `MUSCLE_SET array parsed successfully (found ${muscleSetValues.length} value(s))`,
    muscleSetValues.length >= 1,
    'could not extract values from MUSCLE_SET — check BodyDiagram.tsx'
  );
}

const muscleSetValueSet = new Set(muscleSetValues);

// Derive KNOWN_JOINTS at runtime — no manually maintained list required.
// Any PainRegion not in MUSCLE_SET is automatically treated as a joint here,
// mirroring exactly the runtime behaviour of BodyDiagram.tsx.
const KNOWN_JOINTS = new Set(painRegions.filter((r) => !muscleSetValueSet.has(r)));

// Sanity: every PainRegion must be in exactly one of the two sets.
check(
  `MUSCLE_SET (${muscleSetValues.length}) + KNOWN_JOINTS (${KNOWN_JOINTS.size}) = PainRegion total (${painRegions.length})`,
  muscleSetValues.length + KNOWN_JOINTS.size === painRegions.length,
  'classification count mismatch — a PainRegion may appear in both MUSCLE_SET and KNOWN_JOINTS, or the parser failed'
);

if (KNOWN_JOINTS.size > 0) {
  console.log(`  · Derived joint region(s): ${[...KNOWN_JOINTS].join(', ')}`);
}

/**
 * AN INDEPENDENT LIST, BECAUSE THE DERIVED ONE CANNOT DISAGREE WITH ITSELF.
 *
 * This loop used to read `check(label, true)` - the literal true - once per
 * region, and the partition check above it is an identity for the same reason:
 * KNOWN_JOINTS is DERIVED as everything not in MUSCLE_SET, so the two sets add
 * up by construction whatever MUSCLE_SET contains.
 *
 * That is not a hypothetical gap. Removing 'chest' from MUSCLE_SET in
 * components/BodyDiagram.tsx makes the chest disappear from the diagram's
 * Muscles filter and appear under Joints instead - the filter is literally
 * `category === 'muscles' ? MUSCLE_SET.has(r) : !MUSCLE_SET.has(r)` - and every
 * check in this file still passed.
 *
 * So the answer has to be written down somewhere the code cannot supply. A new
 * PainRegion fails here until somebody says which half it belongs to, which is
 * the point: that is a decision, not a derivation.
 */
const EXPECTED_KIND = {
  chest: 'muscle',
  bicep: 'muscle',
  tricep: 'muscle',
  core_ribs: 'muscle',
  quads: 'muscle',
  hamstrings: 'muscle',
  glutes: 'muscle',
  lat_mid_back: 'muscle',
  upper_back: 'muscle',
  lower_back: 'muscle',
  calf_shin: 'muscle',
  knee: 'joint',
  ankle_achilles: 'joint',
  hip_groin: 'joint',
  neck: 'joint',
  front_shoulder: 'joint',
  rear_shoulder: 'joint',
  elbow: 'joint',
  wrist: 'joint',
};

console.log('\n  Forward: every PainRegion is on the side the diagram files it under');
for (const region of painRegions) {
  const actual = muscleSetValueSet.has(region) ? 'muscle' : 'joint';
  const expected = EXPECTED_KIND[region];
  check(
    `PainRegion '${region}' is a ${expected ?? '???'}`,
    expected !== undefined && actual === expected,
    expected === undefined
      ? 'new region: add it to EXPECTED_KIND above and say which filter it belongs under'
      : `MUSCLE_SET files it as a ${actual}`
  );
}
check(
  'and EXPECTED_KIND has no stale entries',
  Object.keys(EXPECTED_KIND).every((r) => painRegions.includes(r)),
  Object.keys(EXPECTED_KIND).filter((r) => !painRegions.includes(r)).join(', ')
);

// Reverse: every MUSCLE_SET value is a valid PainRegion (catches stale entries after a rename)
console.log('\n  Reverse: every MUSCLE_SET value is a declared PainRegion');
for (const val of muscleSetValues) {
  check(
    `MUSCLE_SET value '${val}' is a declared PainRegion`,
    painRegionSet.has(val),
    `'${val}' in MUSCLE_SET is not in PainRegion type — was it renamed or removed? ` +
      `Update MUSCLE_SET in BodyDiagram.tsx to match.`
  );
}

// ─── 4. h() hotspot coverage — per-view check ────────────────────────────────
//
// A region placed only in one view is tappable from that view but invisible
// from the other.  This section verifies that each PainRegion has at least one
// h() call in either view, and that no h() call references a region that is
// not a declared PainRegion.
//
// REGION_VIEWS is now DERIVED from BodyDiagram.tsx by parsing which h('region')
// calls live in renderFrontHotspots vs renderBackHotspots.  There is no hardcoded
// map to maintain.  When a new PainRegion is added, placing h() calls in the
// appropriate render function(s) is sufficient — no change to this test file.
//
// BodyDiagram.tsx hotspot render functions:
//   • renderFrontHotspots  →  front body view
//   • renderBackHotspots   →  back body view

console.log('\n[4] h() hotspot coverage — per-view (front / back)');

// ── Helper: extract the source text of a named arrow-function block ──────────
// Finds  const <funcName> = () => ( … );  and returns the slice from the
// const keyword to the closing ')' of the function body.
function extractFunctionBlock(src, funcName) {
  const declStart = src.indexOf(`const ${funcName}`);
  if (declStart === -1) return null;
  const arrowIdx = src.indexOf('=>', declStart);
  if (arrowIdx === -1) return null;
  const parenOpen = src.indexOf('(', arrowIdx);
  if (parenOpen === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = parenOpen; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return end !== -1 ? src.slice(declStart, end + 1) : null;
}

const frontHotspotsBlock = extractFunctionBlock(diagramSrc, 'renderFrontHotspots');
const backHotspotsBlock = extractFunctionBlock(diagramSrc, 'renderBackHotspots');

check(
  'renderFrontHotspots function found in BodyDiagram.tsx',
  frontHotspotsBlock !== null,
  'renderFrontHotspots not found — check components/BodyDiagram.tsx'
);
check(
  'renderBackHotspots function found in BodyDiagram.tsx',
  backHotspotsBlock !== null,
  'renderBackHotspots not found — check components/BodyDiagram.tsx'
);

// ── Parse h() calls from each view block ──────────────────────────────────────
function parseHCalls(block) {
  if (block === null) return new Set();
  return new Set([...block.matchAll(/h\('([a-z_]+)'\)/g)].map((m) => m[1]));
}

const frontRegions = parseHCalls(frontHotspotsBlock);
const backRegions = parseHCalls(backHotspotsBlock);

// Build the derived region-views map from the parsed h() calls.
// Each region maps to the list of views it appears in.
const derivedRegionViews = new Map();
for (const r of frontRegions) {
  derivedRegionViews.set(r, ['front']);
}
for (const r of backRegions) {
  if (derivedRegionViews.has(r)) {
    derivedRegionViews.get(r).push('back');
  } else {
    derivedRegionViews.set(r, ['back']);
  }
}

console.log(
  `  · Derived region→view mapping (${derivedRegionViews.size} unique region(s) with hotspots):`
);
for (const [region, views] of [...derivedRegionViews.entries()].sort()) {
  console.log(`    '${region}' → [${views.map((v) => `'${v}'`).join(', ')}]`);
}

// ── Forward: every PainRegion has at least one h() call in either view ────────
console.log(`\n  Forward: every PainRegion has an h() hotspot in at least one view`);
for (const region of painRegions) {
  const views = derivedRegionViews.get(region);
  check(
    `'${region}' hotspot found in [${views ? views.map((v) => `'${v}'`).join(', ') : '—'}]`,
    views !== undefined,
    `no h('${region}') found in renderFrontHotspots or renderBackHotspots — ` +
      `add a hotspot shape via h('${region}') in the appropriate render function in BodyDiagram.tsx`
  );
}

// ── Reverse: every h()-covered region is a valid PainRegion ──────────────────
console.log('\n  Reverse: every h()-covered region is a declared PainRegion');
const allCoveredRegions = new Set([...frontRegions, ...backRegions]);
for (const region of [...allCoveredRegions].sort()) {
  check(
    `h()-covered region '${region}' is a declared PainRegion`,
    painRegionSet.has(region),
    `stale h('${region}') call in a render function — ` +
      `'${region}' is not in PainRegion type (renamed or removed?); ` +
      `update the hotspot in renderFrontHotspots / renderBackHotspots in BodyDiagram.tsx`
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`body-diagram-region-coverage: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`body-diagram-region-coverage: all ${total} checks passed\n`);
  process.exitCode = 0;
}
