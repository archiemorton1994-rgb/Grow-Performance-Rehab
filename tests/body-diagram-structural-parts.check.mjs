/**
 * Contract test: no part of the body map is left for the library to colour.
 *
 * WHAT WENT WRONG
 * ───────────────
 * react-native-body-highlighter bakes a colour into every path it ships. The
 * diagram only names the parts it maps to a PainRegion, so anything unmapped
 * kept the library's own value. Five parts were never named:
 *
 *     female head    #454545   a solid black face
 *     male head      #bebebe   a light grey face
 *     feet           #454545 / #3f3f3f   black feet on both figures
 *     triceps        dark      two dark blobs on the upper arms, front view
 *     adductors      dark      a dark blob on the inner thigh, back view
 *
 * The face is the one that got reported. It is also the one this repo caused:
 * patches/react-native-body-highlighter+3.2.0.patch removes the FEMALE figure's
 * hair, so that every woman using the app is not given the same hairstyle. That
 * left her bare head silhouette painted dark grey with nothing drawn over it.
 * The male figure kept his hair, so his lighter head read as a face and the same
 * fault went unnoticed on that side for as long as it existed.
 *
 * WHAT THIS ASSERTS
 * ─────────────────
 * It reads the library's OWN asset files — the four path lists it actually
 * renders from — and requires every slug in them to be accounted for by the
 * diagram, either as a mapped body region or as a structural part the diagram
 * paints with the silhouette fill. A package upgrade that adds a part, or a
 * region map edit that drops one, fails here rather than shipping a black face.
 *
 * Deliberately reads node_modules rather than a copy: a list of slugs
 * transcribed into the test would agree with a stale idea of the package.
 *
 * Run:  npx tsx tests/body-diagram-structural-parts.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

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

const src = readFileSync(new URL('../components/BodyDiagram.tsx', import.meta.url), 'utf8');

/** Pull the quoted slugs out of a named const block in the component. */
function slugsIn(constName) {
  const i = src.indexOf(`const ${constName}`);
  if (i === -1) return null;
  const end = src.indexOf('\n};', i);
  const block = src.slice(i, end === -1 ? undefined : end);
  return new Set([...block.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]));
}

const front = slugsIn('FRONT_REGION_SLUGS');
const back = slugsIn('BACK_REGION_SLUGS');
const structural = slugsIn('STRUCTURAL_SLUGS');

check('FRONT_REGION_SLUGS found', front !== null);
check('BACK_REGION_SLUGS found', back !== null);
check('STRUCTURAL_SLUGS found', structural !== null, 'the silhouette seed list is gone');

// The seed must actually be applied, not merely declared.
check(
  'every structural part is seeded with the silhouette fill',
  /for \(const slug of STRUCTURAL_SLUGS\)[\s\S]{0,160}?fill: defaultFill/.test(src),
  'STRUCTURAL_SLUGS is declared but never pushed into bodyData'
);

// …and it must not emit a second entry for a slug this view already maps.
// Triceps and adductors are real regions on the back and scenery on the front.
// The library takes the last entry per slug, so a duplicate renders correctly
// and reads wrongly: anything looking a slug up finds the silhouette instead of
// the highlight. That is not hypothetical — it broke two heatmap tests.
check(
  'a slug the view already maps is skipped, not seeded twice',
  /if \(mappedHere\.has\(slug\)\) continue;/.test(src),
  'the seed can shadow a real highlight for anything reading bodyData'
);

const ASSETS = [
  ['male front', 'bodyFront', 'front'],
  ['male back', 'bodyBack', 'back'],
  ['female front', 'bodyFemaleFront', 'front'],
  ['female back', 'bodyFemaleBack', 'back'],
];

if (front && back && structural) {
  for (const [label, mod, side] of ASSETS) {
    let parts;
    try {
      const a = require(`react-native-body-highlighter/dist/assets/${mod}.js`);
      parts = a[mod];
    } catch (e) {
      check(`${label}: asset file readable`, false, String(e.message));
      continue;
    }
    const mapped = side === 'front' ? front : back;
    const orphans = parts
      .map((p) => p.slug)
      .filter((slug) => !mapped.has(slug) && !structural.has(slug));
    check(
      `${label}: all ${parts.length} parts are coloured by the app`,
      orphans.length === 0,
      `left to the library: ${orphans.join(', ')}`
    );

    // The package ships the female BACK figure with no head path at all — 13
    // parts against the male's 16 — so turning to the back view gave a woman a
    // headless body. patches/react-native-body-highlighter+3.2.0.patch adds one,
    // scaled and positioned from her own front-view head. This fails if the
    // patch stops applying, which is exactly the day it would otherwise ship.
    check(
      `${label}: the figure has a head`,
      parts.some((p) => p.slug === 'head'),
      'no head path — check that the patch applied (npx patch-package)'
    );
  }
}

console.log('');
if (failures > 0) {
  console.error(`body-diagram-structural-parts: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`body-diagram-structural-parts: all ${total} checks passed\n`);
  process.exitCode = 0;
}
