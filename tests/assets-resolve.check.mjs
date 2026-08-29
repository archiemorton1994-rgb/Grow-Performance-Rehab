/**
 * Contract test: every asset the app imports actually exists.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Four PNGs were deleted when Home's summary tiles moved to the icon set. One
 * of them, achievements.png, was ALSO required by
 * components/AchievementUnlockedSheet.tsx. `npm run check` exited 0 with the
 * broken import sitting in the tree - typecheck does not resolve require() of
 * an image, and none of the other scripts build a bundle. It took an
 * `npx expo export` to find it, which is not something the gate runs.
 *
 * A missing image is a hard crash on the screen that uses it, so this is the
 * cheapest possible insurance: resolve every path, fail on the first that is
 * not on disk.
 *
 * It also catches the quieter half of the same mistake - an asset nothing
 * imports any more. Those are only reported, not failed: a file can be
 * legitimately unreferenced while it waits for the screen that will use it,
 * and failing on that would be the test having an opinion about housekeeping
 * rather than about correctness.
 *
 * Run:  node tests/assets-resolve.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

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

function walk(dir, match, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, match, out);
    else if (match.test(entry)) out.push(p);
  }
  return out;
}

const sourceFiles = ['app', 'components', 'lib'].flatMap((d) =>
  existsSync(join(ROOT, d)) ? walk(join(ROOT, d), /\.(tsx?|jsx?)$/) : []
);

console.log(`\n[1] Every asset import resolves (${sourceFiles.length} source files)`);

// Both spellings the codebase uses: require('@/assets/...') and a bare
// relative require, plus the ES import form for fonts.
const PATTERNS = [
  /require\(\s*['"]@\/(assets\/[^'"]+)['"]\s*\)/g,
  /from\s+['"]@\/(assets\/[^'"]+)['"]/g,
];

const referenced = new Set();
const broken = [];

for (const file of sourceFiles) {
  const src = readFileSync(file, 'utf8');
  for (const pattern of PATTERNS) {
    for (const m of src.matchAll(pattern)) {
      const rel = m[1];
      referenced.add(rel.replace(/\\/g, '/'));
      if (!existsSync(join(ROOT, rel))) {
        broken.push(`${rel}  <- ${relative(ROOT, file).replace(/\\/g, '/')}`);
      }
    }
  }
}

check(
  `${referenced.size} asset imports found and checked`,
  referenced.size > 10,
  'finding almost none means the patterns have gone stale, not that the app has no assets'
);
check(
  'every imported asset is on disk',
  broken.length === 0,
  broken.slice(0, 6).join(' | ')
);

// ─── 2. app.json's own asset paths ──────────────────────────────────────────
console.log('\n[2] The paths app.json hands to the build');

const appJson = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'));
const configPaths = [];
(function collect(node) {
  if (typeof node === 'string') {
    if (/^\.\/assets\/.+\.(png|jpg|jpeg|svg|ttf|otf)$/i.test(node)) configPaths.push(node.slice(2));
    return;
  }
  if (Array.isArray(node)) return node.forEach(collect);
  if (node && typeof node === 'object') return Object.values(node).forEach(collect);
})(appJson);

const missingConfig = configPaths.filter((p) => !existsSync(join(ROOT, p)));
check(
  `${configPaths.length} asset paths in app.json`,
  configPaths.length >= 5,
  'the icon, splash and the three Android layers should all be here'
);
check(
  'every app.json asset is on disk',
  missingConfig.length === 0,
  missingConfig.join(', ')
);

// ─── 3. Unreferenced assets, reported only ──────────────────────────────────
console.log('\n[3] Assets nothing imports (reported, not failed)');

const onDisk = existsSync(join(ROOT, 'assets'))
  ? walk(join(ROOT, 'assets'), /\.(png|jpg|jpeg|svg)$/).map((p) =>
      relative(ROOT, p).replace(/\\/g, '/')
    )
  : [];
const configSet = new Set(configPaths.map((p) => p.replace(/\\/g, '/')));
const orphans = onDisk.filter((p) => !referenced.has(p) && !configSet.has(p));
console.log(
  orphans.length === 0
    ? '  every asset on disk is referenced'
    : `  ${orphans.length} unreferenced: ${orphans.slice(0, 8).join(', ')}${orphans.length > 8 ? ' ...' : ''}`
);

console.log('');
if (failures > 0) {
  console.error(`assets-resolve: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`assets-resolve: all ${total} checks passed\n`);
  process.exitCode = 0;
}
