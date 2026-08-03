/**
 * Export session-card artwork into the app bundle at a consistent size.
 *
 *   node scripts/prepare-session-assets.mjs <source-dir> [--female] [--dry]
 *
 * Source art arrives full-resolution (~1-2MB per file). Shipping that as-is
 * would add ~15MB to the bundle for a set of cards that render about 110pt
 * tall, so everything is re-exported at 600px on the longest side with
 * palette-quantised PNG — roughly 50-80KB each, still ~2.5x the pixel density
 * those cards need at @3x.
 *
 * Aspect ratios are preserved per-image on purpose. The cards use
 * resizeMode="contain", so each figure letterboxes inside its box; forcing a
 * uniform ratio would crop limbs off the taller poses.
 *
 * Source files must have an alpha channel — the cards sit on themed
 * backgrounds, so an opaque asset ships as a visible white block. That is the
 * one failure this script refuses to let through silently.
 */
import sharp from 'sharp';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { basename, join, resolve } from 'path';

const LONGEST_SIDE = 600;

/** Accepted destination slugs. Source filenames are matched against these. */
const SLUGS = [
  'squat',
  'bench',
  'deadlift',
  'lower-body',
  'upper-body',
  'full-body',
  'conditioning',
  'recovery',
  'mobility',
  'targeted-prehab',
  'custom',
];

/** Tolerates "Lower Body Female.png", "FemaleLowerBody.png", "lower_body.png". */
function slugFor(filename) {
  const norm = basename(filename, '.png').toLowerCase().replace(/[^a-z]/g, '');
  const candidates = SLUGS.filter((s) => norm.includes(s.replace(/-/g, '')));
  // Prefer the longest match so "full-body" wins over a stray "body" partial.
  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
}

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const female = args.includes('--female');
const srcDir = args.find((a) => !a.startsWith('--'));

if (!srcDir) {
  console.error('usage: node scripts/prepare-session-assets.mjs <source-dir> [--female] [--dry]');
  process.exit(1);
}
if (!existsSync(srcDir)) {
  console.error(`source directory not found: ${srcDir}`);
  process.exit(1);
}

const outDir = resolve('assets/images/sessions', female ? 'female' : '.');
if (!dry) mkdirSync(outDir, { recursive: true });

const sources = readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith('.png'));

console.log(`source : ${resolve(srcDir)}`);
console.log(`target : ${outDir}${dry ? '   (dry run - nothing written)' : ''}\n`);

// Resolve every filename to a slug FIRST, then refuse any slug claimed by more
// than one file. Picking a winner here is not safe: a folder holding both male
// and female art matches each slug twice, and an arbitrary choice silently
// exports the wrong figure over a good asset.
const candidates = new Map();
for (const file of sources.sort()) {
  const slug = slugFor(file);
  if (!slug) continue;
  if (!candidates.has(slug)) candidates.set(slug, []);
  candidates.get(slug).push(file);
}

let failures = 0;
let exported = 0;
let totalKb = 0;
const seen = new Map();

for (const [slug, files] of [...candidates].sort()) {
  if (files.length > 1) {
    console.error(
      `  ✗ ${slug.padEnd(16)} ambiguous - ${files.length} files match: ${files.join(', ')}. ` +
        `Nothing exported for this slug; point at a folder with one file per session.`
    );
    failures++;
    continue;
  }

  const file = files[0];
  seen.set(slug, file);
  const srcPath = join(srcDir, file);
  const meta = await sharp(srcPath).metadata();

  // metadata().hasAlpha only says an alpha CHANNEL exists — it is true for an
  // image whose alpha is entirely 255. stats().isOpaque is the real test, and
  // the distinction matters: some exports of this art carry a fully-opaque
  // alpha channel over a baked-in background and would ship as solid blocks.
  if ((await sharp(srcPath).stats()).isOpaque) {
    console.error(
      `  ✗ ${slug.padEnd(16)} ${file} is fully opaque (no actual transparency) - ` +
        `it would ship as a solid block over the card background. Skipped.`
    );
    failures++;
    continue;
  }

  const resize = meta.width >= meta.height ? { width: LONGEST_SIDE } : { height: LONGEST_SIDE };
  const destPath = join(outDir, `${slug}.png`);

  if (dry) {
    console.log(`  · ${slug.padEnd(16)} ${meta.width}x${meta.height} <- ${file}`);
    continue;
  }

  const out = await sharp(srcPath)
    .resize({ ...resize, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(destPath);

  // Quantisation writes a paletted PNG; transparency then lives in a tRNS
  // chunk rather than an alpha channel, so re-test with stats() here too.
  const stillTransparent = !(await sharp(destPath).stats()).isOpaque;
  const kb = Math.round(statSync(destPath).size / 1024);
  totalKb += kb;

  if (!stillTransparent) {
    // Remove it: leaving a known-bad file on disk is how it ends up committed.
    unlinkSync(destPath);
    totalKb -= kb;
    console.error(
      `  ✗ ${slug.padEnd(16)} lost its alpha during export - discarded, nothing written.`
    );
    failures++;
    continue;
  }

  exported++;
  console.log(
    `  ✓ ${slug.padEnd(16)} ${String(meta.width).padStart(4)}x${String(meta.height).padEnd(4)} -> ` +
      `${String(out.width).padStart(3)}x${String(out.height).padEnd(4)} ${String(kb).padStart(3)}KB`
  );
}

const missing = SLUGS.filter((s) => !seen.has(s));
if (missing.length) {
  console.log(`\nno source matched: ${missing.join(', ')}`);
  console.log('(existing files for these slugs are left untouched)');
}

console.log(`\n${dry ? seen.size : exported} exported, ${(totalKb / 1024).toFixed(2)}MB total`);
if (failures) {
  console.error(`${failures} problem(s) above.`);
  process.exit(1);
}
