/**
 * Colour-token audit — app/ and components/
 *
 * Scans every .ts/.tsx file under app/ and components/ for bare hex colour
 * literals (e.g. #2f6b46, #fff, #CC0000FF) and fails if any appear outside the
 * allowed sets below.  The goal is to prevent hardcoded hex values from sneaking
 * back in after the colour-token cleanup — all colours should flow through
 * constants/colors.ts and be consumed via useColors().
 *
 * HOW EXCEPTIONS WORK
 * ────────────────────
 * Three tiers of exceptions, applied in order:
 *
 *  1. EXEMPT_FILES  — entire file is skipped (intentional fixed palettes or
 *                     crash-overlay that cannot import the colour system).
 *
 *  2. GLOBAL_ALLOWED_VALUES — specific hex strings always OK in any file:
 *                     pure black/white (shadows, on-colour icons) and hard
 *                     brand colours that are not design-system tokens.
 *
 *  3. KNOWN_VIOLATIONS — per-file sets of values that are accepted for now
 *                     while dedicated colour-token cleanup tasks are in flight.
 *                     Shrink these as tokens are added; remove the entry once
 *                     the file is clean.
 *
 * Run:  node tests/color-tokens.check.mjs
 * Exit: 0 = all pass, 1 = one or more new violations found
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

// Matches bare hex colour literals: #RGB, #RRGGBB, #RRGGBBAA (3–8 hex chars).
// Word-boundary \b keeps it from matching inside larger identifiers.
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

// ─── 1. Files exempt from the audit ──────────────────────────────────────────
// These own intentional fixed-palette constants that cannot or should not be
// expressed as shared design tokens.
const EXEMPT_FILES = new Set([
  'constants/colors.ts', // source-of-truth for all tokens
  'components/ErrorFallback.tsx', // crash overlay — cannot import the colour system
  'components/BodyDiagram.tsx', // SVG semantic vocabulary: worked / attention / overloaded
  'components/WorkoutShareCard.tsx', // shareable image card — brand palette baked in
  'app/session-summary.tsx', // shareable image card — brand palette baked in
  'app/achievements.tsx', // badge-type → hue map (30+ intentionally distinct colours)
]);

// ─── 2. Values always allowed regardless of file ──────────────────────────────
// #000 / #000000 — React Native shadowColor convention + pure-black icon/text on
//                  light/coloured backgrounds.  No design token needed.
// #fff / #ffffff  — pure-white icon/text on dark or coloured backgrounds.
// #CC0000 / #FF0000 — YouTube brand red (session.tsx).  Not a design-system colour.
// #007AFF           — iOS system blue used in the ErrorFallback link.
const GLOBAL_ALLOWED = new Set([
  '#000',
  '#000000',
  '#fff',
  '#ffffff',
  '#FFFFFF',
  '#CC0000',
  '#FF0000',
  '#007AFF',
]);

// ─── 3. Per-file known violations (pending colour-token cleanup tasks) ─────────
// Each entry lists the hex values currently accepted in that file.  When a
// cleanup task removes a value from a file, delete it from the set here.  When
// a set becomes empty, remove the file entry entirely.
//
// TODO: the values below correspond to open colour-token cleanup tasks.
//       Trim this map as those tasks land.
const KNOWN_VIOLATIONS = {
  // Recover tab — session-type accent colours not yet in the token set
  'app/(tabs)/recover.tsx': new Set(['#0d9488', '#6366f1', '#f59e0b']),

  // Home tab — primary shadow colour + energy-badge purple (tracked by
  // "Replace the energy-badge hex-alpha trick with proper colour tokens" task)
  'app/(tabs)/index.tsx': new Set(['#2f6b46', '#7C6EF0']),

  // Stats/workouts tab — training-frequency trend-indicator palette
  'app/(tabs)/workouts.tsx': new Set([
    '#6b7280',
    '#2f6b46',
    '#d97706',
    '#dc2626',
    '#3a3a3a',
    '#666',
    '#c0392b',
    '#e8f5ee',
    '#fdecea',
    '#b7deca',
    '#f5bdb8',
  ]),

  // 404 screen — link blue not yet tokenised
  'app/+not-found.tsx': new Set(['#2e78b7']),

  // Custom-session screen — validation-state background/text colours
  'app/custom-session.tsx': new Set([
    '#fde8e8',
    '#fff8e1',
    '#e8f5e9',
    '#c0392b',
    '#f39c12',
    '#27ae60',
  ]),

  // Readiness screen — trophy amber (already exists as C.trophy in the token set;
  // pending substitution)
  'app/readiness.tsx': new Set(['#F5A623']),

  // Root layout — debug/error-overlay colours used before the colour system loads
  'app/_layout.tsx': new Set(['#ff4444', '#ccc']),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function walkFiles(dir, exts, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, exts, results);
    } else if (exts.some((e) => entry.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

function relPath(absPath) {
  return relative(ROOT, absPath).replace(/\\/g, '/');
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

const SCAN_DIRS = [join(ROOT, 'app'), join(ROOT, 'components')];
const EXTENSIONS = ['.ts', '.tsx'];

let failures = 0;
let total = 0;
let filesScanned = 0;
let filesSkipped = 0;

const allViolations = []; // { file, line, col, value }

for (const dir of SCAN_DIRS) {
  for (const absPath of walkFiles(dir, EXTENSIONS)) {
    const rel = relPath(absPath);

    if (EXEMPT_FILES.has(rel)) {
      filesSkipped++;
      continue;
    }

    const src = readFileSync(absPath, 'utf8');
    const lines = src.split('\n');
    const fileAllowed = KNOWN_VIOLATIONS[rel] ?? new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;
      HEX_RE.lastIndex = 0;

      while ((match = HEX_RE.exec(line)) !== null) {
        const raw = match[0]; // e.g. '#2f6b46'
        const lower = raw.toLowerCase();

        // Normalise for case-insensitive global comparison
        const inGlobal =
          GLOBAL_ALLOWED.has(raw) ||
          GLOBAL_ALLOWED.has(lower) ||
          GLOBAL_ALLOWED.has(raw.toUpperCase());

        if (inGlobal) continue;

        // Per-file known violation (case-sensitive to match actual source)
        if (fileAllowed.has(raw)) continue;

        allViolations.push({ file: rel, line: i + 1, col: match.index + 1, value: raw });
      }
    }

    filesScanned++;
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

console.log(
  `\n[colour-tokens] scanned ${filesScanned} file(s), skipped ${filesSkipped} exempt file(s)\n`
);

total = filesScanned;

if (allViolations.length === 0) {
  console.log('  ✓ No unallowlisted hex colour literals found');
  failures = 0;
} else {
  // Group by file for readability
  const byFile = {};
  for (const v of allViolations) {
    (byFile[v.file] ??= []).push(v);
  }

  for (const [file, hits] of Object.entries(byFile)) {
    console.error(`  ✗ ${file} — ${hits.length} violation(s):`);
    for (const h of hits) {
      console.error(`      line ${h.line}:${h.col}  ${h.value}`);
    }
  }

  console.error(
    `\n  → ${allViolations.length} hardcoded hex literal(s) found outside the allowlist.`
  );
  console.error(`    Move them to constants/colors.ts and consume via useColors(), or add to`);
  console.error(
    `    GLOBAL_ALLOWED / KNOWN_VIOLATIONS in tests/color-tokens.check.mjs if intentional.\n`
  );

  failures = allViolations.length;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`colour-tokens: FAILED (${failures} violation(s))\n`);
  process.exit(1);
} else {
  console.log(`colour-tokens: all checks passed\n`);
  process.exit(0);
}
