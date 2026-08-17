/**
 * Contract test: every door into a prehab session says whether the area is sore.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The session route infers the acute flag when nobody states it:
 *
 *     const isAcute = params.acute ? params.acute === 'true' : !!params.painRegion;
 *
 * So "a region was named" silently means "this is a fresh injury", and the
 * session becomes the acute protocol: floor-based isometrics, no cool-down, and
 * no rotation at all — byte-identical every single time it is opened.
 *
 * That was fixed once, in the two entry points that were in front of me at the
 * time (the Restore tab and the readiness prehab step). There was a THIRD: the
 * Pain Insight sheet reached by tapping a region on the Stats "Pain Patterns"
 * heatmap. It kept building injury-phase work while its own copy promised
 * prevention — and it is the worst one to have missed, because that heatmap only
 * offers areas the user has flagged REPEATEDLY. The long-term "looking after it"
 * population were the exact people stuck on it.
 *
 * Fixing the two I could see and not searching for the rest is the mistake this
 * file exists to stop repeating. It asserts the RULE, not the three known sites:
 * any push to /session with sessionType 'prehab' must carry an `acute` param.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

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

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Every .tsx under app/ and components/, recursively. */
function sources(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) sources(rel, out);
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) out.push(rel);
  }
  return out;
}

const files = [...sources('app'), ...sources('components')];

console.log('\n[1] Every prehab launch states the acute flag');

// Comments are stripped first. The block explaining WHY the flag is passed uses
// the word "acute" repeatedly, so scanning raw source finds it in the prose and
// passes even when the parameter itself has gone — which is exactly what the
// mutation test caught this assertion doing.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const offenders = [];
for (const rel of files) {
  const src = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
  // Each params object that names a prehab session type.
  const blocks = src.match(/params:\s*\{[\s\S]{0,900}?\}/g) ?? [];
  for (const block of blocks) {
    if (!/sessionType:\s*'prehab'/.test(block)) continue;
    // A launch that names no region is the full-body circuit, which is not
    // region-specific and cannot be acute.
    if (!/painRegion/.test(block)) continue;
    if (!/\bacute\b/.test(block)) offenders.push(rel);
  }
}

check(
  'no prehab launch relies on the route inferring it',
  offenders.length === 0,
  offenders.length
    ? `missing an acute param: ${[...new Set(offenders)].join(', ')} - without it the route defaults to the fresh-injury protocol`
    : ''
);

console.log('\n[2] The three known doors each answer it');

const readiness = readFileSync(join(ROOT, 'app/readiness.tsx'), 'utf8');
const recover = readFileSync(join(ROOT, 'app/(tabs)/recover.tsx'), 'utf8');
const stats = readFileSync(join(ROOT, 'app/(tabs)/workouts.tsx'), 'utf8');

check(
  'the readiness prehab step asks the user',
  /acute: region !== 'fullbody' && prehabSore \? 'true' : 'false'/.test(readiness),
  'it shows a sore / feels-fine question and passes the answer'
);

check(
  'the Restore tab asks the user',
  /acute: String\(/.test(recover),
  'its own sore / looking-after-it toggle feeds this'
);

check(
  'the Stats pain-patterns sheet states prevention outright',
  /acute: 'false'/.test(stats),
  'this sheet is reached from repeated-pain history and its copy promises prevention, so it must not build injury-phase work'
);

console.log('\n[3] The inference itself is still the safe way round');

const session = readFileSync(join(ROOT, 'app/session.tsx'), 'utf8');
check(
  'an unstated flag still defaults to the gentler protocol',
  /params\.acute \? params\.acute === 'true' : !!params\.painRegion/.test(session),
  'if a fourth entry point is ever added and forgets, too gentle is the right way to be wrong'
);

console.log(`\nprehab-entry-points: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
