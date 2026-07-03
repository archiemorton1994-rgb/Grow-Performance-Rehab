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
 *   3. MUSCLE_SET validity   — every value listed in MUSCLE_SET is still a valid
 *                              PainRegion (catches renames that leave stale entries)
 *   4. h() hotspot coverage  — every PainRegion has an h('region') call in the
 *                              SVG body, confirming it is tappable on the diagram
 *
 * Run:  node tests/body-diagram-region-coverage.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const storeSrc   = readFileSync(join(__dir, '../lib/store.ts'), 'utf8');
const diagramSrc = readFileSync(join(__dir, '../components/BodyDiagram.tsx'), 'utf8');

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

// ─── 1. Parse PainRegion literals from lib/store.ts ───────────────────────────
console.log('\n[1] Parse PainRegion type from lib/store.ts');

// The type declaration ends at the first semicolon after the '=' sign.
const typeStart = storeSrc.indexOf('export type PainRegion =');
check(
  'PainRegion type declaration found in lib/store.ts',
  typeStart !== -1,
  'declaration not found — check lib/store.ts',
);

let painRegions = [];

if (typeStart !== -1) {
  const eqPos     = storeSrc.indexOf('=', typeStart);
  const semi      = storeSrc.indexOf(';', eqPos);
  const typeBlock = storeSrc.slice(eqPos, semi + 1);

  const regionMatches = [...typeBlock.matchAll(/'([a-z_]+)'/g)];
  painRegions = regionMatches.map(m => m[1]);

  check(
    `PainRegion type contains at least 1 value (found ${painRegions.length})`,
    painRegions.length >= 1,
    'no quoted identifiers found in PainRegion type block',
  );

  for (const r of painRegions) {
    console.log(`  · PainRegion: '${r}'`);
  }
}

const painRegionSet = new Set(painRegions);

// ─── 2. BODY_DIAGRAM_LABELS — every PainRegion has an entry ───────────────────
console.log('\n[2] BODY_DIAGRAM_LABELS — every PainRegion has an entry in BodyDiagram.tsx');

// Parse the BODY_DIAGRAM_LABELS object using brace-depth tracking.
// The object starts at the '{' immediately following the 'BODY_DIAGRAM_LABELS' declaration.

const labelsDecl = diagramSrc.indexOf('BODY_DIAGRAM_LABELS');
check(
  'BODY_DIAGRAM_LABELS declaration found in BodyDiagram.tsx',
  labelsDecl !== -1,
  'BODY_DIAGRAM_LABELS not found — check components/BodyDiagram.tsx',
);

let labelsKeys = [];

if (labelsDecl !== -1) {
  const labelsOpen = diagramSrc.indexOf('{', labelsDecl);
  let depth   = 0;
  let labelsEnd = -1;
  for (let i = labelsOpen; i < diagramSrc.length; i++) {
    if (diagramSrc[i] === '{') depth++;
    else if (diagramSrc[i] === '}') {
      depth--;
      if (depth === 0) { labelsEnd = i; break; }
    }
  }

  if (labelsEnd !== -1) {
    const labelsBlock = diagramSrc.slice(labelsOpen + 1, labelsEnd);
    // Keys are bare identifiers followed by ':' on their own or at line start,
    // not inside string values.  Match word-start identifiers before ':'.
    const keyMatches = [...labelsBlock.matchAll(/\b([a-z_]+)\s*:/g)];
    labelsKeys = keyMatches.map(m => m[1]);
  }

  check(
    `BODY_DIAGRAM_LABELS block parsed successfully (found ${labelsKeys.length} key(s))`,
    labelsKeys.length >= 1,
    'could not extract keys from BODY_DIAGRAM_LABELS block',
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
    `add  ${region}:  '<Human Label>',  to BODY_DIAGRAM_LABELS in BodyDiagram.tsx`,
  );
}

// Reverse: every BODY_DIAGRAM_LABELS key is a valid PainRegion
console.log('\n  Reverse: every BODY_DIAGRAM_LABELS key is a valid PainRegion');
for (const key of labelsKeys) {
  check(
    `BODY_DIAGRAM_LABELS key '${key}' is a declared PainRegion`,
    painRegionSet.has(key),
    `stale or unknown key '${key}' in BODY_DIAGRAM_LABELS — remove it or add it to PainRegion in lib/store.ts`,
  );
}

// ─── 3. MUSCLE_SET — every value is a valid PainRegion ────────────────────────
console.log('\n[3] MUSCLE_SET validity — every listed value is a declared PainRegion');

// Parse the MUSCLE_SET array contents using bracket-depth tracking.
const muscleSetDecl = diagramSrc.indexOf('const MUSCLE_SET');
check(
  'MUSCLE_SET declaration found in BodyDiagram.tsx',
  muscleSetDecl !== -1,
  'MUSCLE_SET not found — check components/BodyDiagram.tsx',
);

let muscleSetValues = [];

if (muscleSetDecl !== -1) {
  // MUSCLE_SET = new Set<PainRegion>([...])  — find the '[' array literal
  const arrOpen = diagramSrc.indexOf('[', muscleSetDecl);
  const arrClose = diagramSrc.indexOf(']', arrOpen);

  if (arrOpen !== -1 && arrClose !== -1) {
    const arrBlock = diagramSrc.slice(arrOpen + 1, arrClose);
    const valMatches = [...arrBlock.matchAll(/'([a-z_]+)'/g)];
    muscleSetValues = valMatches.map(m => m[1]);
  }

  check(
    `MUSCLE_SET array parsed successfully (found ${muscleSetValues.length} value(s))`,
    muscleSetValues.length >= 1,
    'could not extract values from MUSCLE_SET — check BodyDiagram.tsx',
  );

  for (const val of muscleSetValues) {
    check(
      `MUSCLE_SET value '${val}' is a declared PainRegion`,
      painRegionSet.has(val),
      `'${val}' in MUSCLE_SET is not in PainRegion type — was it renamed or removed? ` +
      `Update MUSCLE_SET in BodyDiagram.tsx to match.`,
    );
  }
}

// ─── 4. h() hotspot coverage — every PainRegion has a tappable hotspot ─────────
console.log("\n[4] h() hotspot coverage — every PainRegion appears as h('region') in the SVG body");

for (const region of painRegions) {
  const pattern = new RegExp(`h\\('${region}'\\)`);
  check(
    `h('${region}') call exists in BodyDiagram.tsx`,
    pattern.test(diagramSrc),
    `no h('${region}') call found — the region cannot be tapped on the diagram; ` +
    `add a hotspot Rect via h('${region}') in the SVG body`,
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`body-diagram-region-coverage: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`body-diagram-region-coverage: all ${total} checks passed\n`);
  process.exit(0);
}
