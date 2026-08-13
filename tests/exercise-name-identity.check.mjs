/**
 * Contract test: one exercise name means one movement.
 *
 * WHAT WENT WRONG
 * ───────────────
 * 820 exercise entries share 596 names. 111 names are entered more than once —
 * up to nine times — because the same movement is programmed differently in
 * different blocks: a Back Squat is 5x5-6 as a KPI lift and 4x8 in a weekly
 * session, a Band Pull-Apart is a warm-up, a rehab exercise and a prehab
 * exercise. That much is fine and deliberate.
 *
 * What is not fine is that two places collapse those entries by NAME and keep
 * whichever they walked into first:
 *
 *   getAllPickableExercises()  keeps the first entry per name
 *   prescriptionFor()          (lib/exercise-safety.ts) reads that same map
 *
 * prescriptionFor is how the injury screen finds the landing a name leaves out
 * — "AMRAP Finisher" says nothing, its reps say "5 burpees + 10 squat jumps".
 * So when two entries share a name and only one of them prescribes impact, the
 * screen's verdict for BOTH is decided by walk order. Measured before this test
 * existed, three names diverged:
 *
 *   Sled Push              one entry pushes and walks back, the other sprints
 *                          back. The walking one won. A user reporting knee
 *                          pain was cleared for the sprint.
 *   Bear Crawl Intervals   one entry's cue said "sprint hard for 20m" of bear
 *                          crawling. Nothing leaves the ground in a bear crawl.
 *   DB Romanian Deadlift   three entries said "weights run close to legs" and
 *                          "where the hamstrings run out". \bruns?\b is how the
 *                          screen recognises running.
 *
 * Two of those were false positives and one was a real movement hiding behind a
 * gentler namesake. All three were invisible: harmless today, wrong the moment
 * a collection is reordered or an entry is added above another.
 *
 * WHAT THIS ASSERTS, AND WHAT IT DELIBERATELY DOES NOT
 * ────────────────────────────────────────────────────
 * It asserts the facts that DECIDE something, and that a user would experience
 * differently if the wrong sibling won:
 *
 *   1. impact classification — what the injury screen is allowed to give you
 *   2. targetRegions        — what the muscle map shades after you log it
 *   3. upper/lower/core     — what the screen may substitute a movement with
 *   4. no two names for one movement — two rows in the picker, two personal
 *      bests, one exercise
 *
 * It does NOT assert that sibling entries agree on `sets`, `reps`, `cue` or
 * `category`. Those are the programming, not the movement: `category` records
 * which BLOCK an entry is filed in and legitimately differs (session-builder.ts
 * says so in as many words), and a KPI bench and a weekly bench are the same
 * lift on purpose written two different ways. Asserting those would be
 * asserting the implementation, and it would have to be turned off immediately.
 *
 * The impact rule is read out of lib/exercise-safety.ts at runtime rather than
 * copied here, so this test cannot quietly go stale if that regex changes — and
 * if the regexes stop being findable, check 0 fails rather than passing on
 * nothing.
 *
 * Run:  node tests/exercise-name-identity.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dir, '../lib/exercise-db.ts');
const SAFETY_PATH = join(__dir, '../lib/exercise-safety.ts');

let failures = 0;
let total = 0;
function check(label, condition, detail) {
  total++;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}`);
    if (detail) console.log(`      ${detail}`);
  }
}

// ─── Read the live impact rules out of exercise-safety.ts ────────────────────
// Copying them would let this test keep passing on a rule that no longer exists.

const safetySrc = readFileSync(SAFETY_PATH, 'utf8');

function liveRegex(constName) {
  const m = safetySrc.match(new RegExp(`const ${constName} =\\s*(/[\\s\\S]*?/[gimsuy]*);`));
  if (!m) return null;
  try {
    // eslint-disable-next-line no-eval
    return eval(m[1]);
  } catch {
    return null;
  }
}

const IMPACT_IN_PRESCRIPTION = liveRegex('IMPACT_IN_PRESCRIPTION');
const IMPACT_DISCLAIMED = liveRegex('IMPACT_DISCLAIMED');
const SEATED_CONDITIONING = liveRegex('SEATED_CONDITIONING');

// bodyRegionOf's three tables, read the same way.
const LOWER_MUSCLES = liveRegex('LOWER_MUSCLES');
const UPPER_MUSCLES = liveRegex('UPPER_MUSCLES');
const CORE_MUSCLES = liveRegex('CORE_MUSCLES');

function bodyRegionOf(primaryMuscle) {
  if (!primaryMuscle) return 'other';
  if (LOWER_MUSCLES.test(primaryMuscle)) return 'lower';
  if (UPPER_MUSCLES.test(primaryMuscle)) return 'upper';
  if (CORE_MUSCLES.test(primaryMuscle)) return 'core';
  return 'other';
}

/** Does THIS entry's own prescription read as something that lands? */
function prescribesImpact(entry) {
  const rx = `${entry.reps} ${entry.cue}`;
  return (
    IMPACT_IN_PRESCRIPTION.test(rx) &&
    !IMPACT_DISCLAIMED.test(rx) &&
    !SEATED_CONDITIONING.test(`${entry.name} ${rx}`)
  );
}

// ─── Every exercise entry in the database, deduped by nothing ────────────────
// Walking the source rather than the exported getters is the point: the getters
// are what collapse these together, so asking them would ask the accused.

function collectTemplates() {
  const src = readFileSync(DB_PATH, 'utf8');
  const sf = ts.createSourceFile(DB_PATH, src, ts.ScriptTarget.Latest, true);
  const out = [];

  const ownerOf = (node) => {
    let n = node;
    while (n && n.parent) {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
      n = n.parent;
    }
    return '(unknown)';
  };
  const text = (node) => {
    if (!node) return undefined;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isArrayLiteralExpression(node)) return node.elements.map((e) => e.text);
    return node.getText(sf);
  };

  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const p = new Map();
      for (const q of node.properties) {
        if (ts.isPropertyAssignment(q) && (ts.isIdentifier(q.name) || ts.isStringLiteral(q.name))) {
          p.set(q.name.text, q.initializer);
        }
      }
      // An exercise template, as opposed to a comfortVariant or a tier map.
      if (p.has('id') && p.has('name') && p.has('category') && p.has('reps')) {
        out.push({
          id: text(p.get('id')),
          name: text(p.get('name')),
          reps: text(p.get('reps')) ?? '',
          cue: text(p.get('cue')) ?? '',
          category: text(p.get('category')),
          targetRegions: text(p.get('targetRegions')) ?? [],
          primaryMuscle: text(p.get('primaryMuscle')),
          collection: ownerOf(node),
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const templates = collectTemplates();
const byName = new Map();
for (const t of templates) {
  if (!byName.has(t.name)) byName.set(t.name, []);
  byName.get(t.name).push(t);
}
const duplicated = [...byName.entries()].filter(([, v]) => v.length > 1);

const where = (rows) =>
  rows.map((r) => `${r.id} (${r.collection}, line ${r.line})`).join(' vs ');

console.log('\nexercise-name-identity\n');

// ─── 0. NOT VACUOUS ──────────────────────────────────────────────────────────
// Every check below is "no name does X". All of them pass trivially if the
// walk found nothing, or if the rules it judges by failed to load.

console.log('0. the test is actually looking at something');
check(
  `walked the database and found exercise templates (${templates.length})`,
  templates.length > 500,
  `found ${templates.length}; expected the full catalogue`
);
check(
  `found names entered more than once, which is what this test is about (${duplicated.length})`,
  duplicated.length > 20,
  `found ${duplicated.length} duplicated names; if this is 0 the checks below prove nothing`
);
check(
  'every template carries the fields the checks read',
  templates.every((t) => typeof t.name === 'string' && Array.isArray(t.targetRegions)),
  templates
    .filter((t) => typeof t.name !== 'string' || !Array.isArray(t.targetRegions))
    .slice(0, 3)
    .map((t) => `${t.id}: name=${t.name} targetRegions=${JSON.stringify(t.targetRegions)}`)
    .join('; ')
);
check(
  'the live impact rules loaded from lib/exercise-safety.ts',
  [IMPACT_IN_PRESCRIPTION, IMPACT_DISCLAIMED, SEATED_CONDITIONING].every((r) => r instanceof RegExp),
  'one of IMPACT_IN_PRESCRIPTION / IMPACT_DISCLAIMED / SEATED_CONDITIONING could not be read'
);
check(
  'the live upper/lower/core tables loaded from lib/exercise-safety.ts',
  [LOWER_MUSCLES, UPPER_MUSCLES, CORE_MUSCLES].every((r) => r instanceof RegExp),
  'one of LOWER_MUSCLES / UPPER_MUSCLES / CORE_MUSCLES could not be read'
);
check(
  'the impact rule still recognises impact when it sees it',
  IMPACT_IN_PRESCRIPTION instanceof RegExp &&
    prescribesImpact({ name: 'x', reps: '10 burpees', cue: 'sprint back' }) &&
    !prescribesImpact({ name: 'x', reps: '10 reps', cue: 'chest up, brace' }),
  'the rule read out of exercise-safety.ts does not classify a known case'
);

// Without the rules there is nothing to judge by, and every check below would
// pass on an empty comparison. Stop here rather than crash halfway and leave
// the impression that the earlier checks are the whole story.
if (
  ![
    IMPACT_IN_PRESCRIPTION,
    IMPACT_DISCLAIMED,
    SEATED_CONDITIONING,
    LOWER_MUSCLES,
    UPPER_MUSCLES,
    CORE_MUSCLES,
  ].every((r) => r instanceof RegExp)
) {
  console.log(
    '\nexercise-name-identity: ABORTED — the rules this test judges by could not be read ' +
      'out of lib/exercise-safety.ts. Nothing below was checked.'
  );
  process.exit(1);
}

// ─── 1. SAFETY: siblings must agree on whether they land ─────────────────────

console.log('\n1. one name, one answer from the injury screen');
const impactDisagreements = duplicated.filter(
  ([, rows]) => new Set(rows.map(prescribesImpact)).size > 1
);
check(
  'no name has one entry that prescribes impact and another that does not',
  impactDisagreements.length === 0,
  impactDisagreements
    .map(
      ([name, rows]) =>
        `"${name}": ${rows
          .map((r) => `${r.id}=${prescribesImpact(r) ? 'IMPACT' : 'none'}`)
          .join(', ')} — the injury screen reads whichever of these is walked first`
    )
    .join('\n      ')
);

// A name that resolves to impact should say so itself, because the name is the
// only part of an entry that survives the de-dupe.
const silentImpactNames = duplicated.filter(([name, rows]) => {
  if (!rows.some(prescribesImpact)) return false;
  return !IMPACT_IN_PRESCRIPTION.test(name);
});
check(
  'every duplicated name whose prescription lands says so in the name too',
  silentImpactNames.length === 0,
  silentImpactNames
    .map(([name]) => `"${name}" prescribes impact but the name does not admit it`)
    .join('; ')
);

// ─── 2. MUSCLE MAP: siblings must agree on what they work ────────────────────

console.log('\n2. one name, one set of regions on the muscle map');
const regionKey = (t) => [...t.targetRegions].sort().join(',');
const regionDisagreements = duplicated.filter(
  ([, rows]) => new Set(rows.map(regionKey)).size > 1
);
check(
  'no name declares two different targetRegions',
  regionDisagreements.length === 0,
  regionDisagreements
    .map(
      ([name, rows]) =>
        `"${name}": ${[...new Set(rows.map((r) => `[${regionKey(r)}]`))].join(' vs ')} (${where(rows)})`
    )
    .join('\n      ')
);

// ─── 3. SUBSTITUTION: siblings must agree which half of the body they are ────

console.log('\n3. one name, one half of the body');
const halfDisagreements = duplicated.filter(
  ([, rows]) => new Set(rows.map((r) => bodyRegionOf(r.primaryMuscle))).size > 1
);
check(
  'no name is upper body in one entry and lower or core in another',
  halfDisagreements.length === 0,
  halfDisagreements
    .map(
      ([name, rows]) =>
        `"${name}": ${rows
          .map((r) => `${r.id}=${bodyRegionOf(r.primaryMuscle)} (${r.primaryMuscle})`)
          .join(', ')}`
    )
    .join('\n      ')
);

// ─── 4. NO TWO NAMES FOR ONE MOVEMENT ────────────────────────────────────────
// Same words in a different order, or the same qualifier in brackets instead of
// in front. Two rows in the picker, and a personal best split across both.

console.log('\n4. one movement, one name');
// Filler words are dropped, not just reordered. "Thoracic Extension on Floor"
// and "Thoracic Extension (Floor)" were two picker rows one preposition apart —
// close enough to read as a typo, and describing two different movements. A
// normaliser that keeps "on" cannot see that at all.
const FILLER = new Set(['on', 'in', 'at', 'the', 'a', 'to', 'with', 'and', 'of', 'over', 'from']);
const normalise = (name) =>
  name
    .toLowerCase()
    .replace(/[()/,.-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .sort()
    .join(' ');

/**
 * Names that normalise alike and are genuinely two different exercises.
 *
 * Empty, and meant to stay that way. It exists so that a real exception has
 * somewhere to be written down and argued for, rather than being handled by
 * weakening the normaliser until nothing collides. Key format: the colliding
 * names sorted and joined with " | ".
 */
const NOT_THE_SAME_MOVEMENT = new Set([]);

const byShape = new Map();
for (const name of byName.keys()) {
  const k = normalise(name);
  if (!byShape.has(k)) byShape.set(k, []);
  byShape.get(k).push(name);
}
const synonyms = [...byShape.values()]
  .filter((names) => names.length > 1)
  .filter((names) => !NOT_THE_SAME_MOVEMENT.has([...names].sort().join(' | ')));
check(
  `no two catalogue names describe the same movement (${byName.size} names checked)`,
  synonyms.length === 0,
  synonyms
    .map((names) => names.map((n) => `"${n}"`).join(' and ') + ' are the same movement')
    .join('; ')
);

// The normaliser has to be able to see a collision at all, or check 4 is a
// sentence that always passes.
check(
  'the name normaliser would catch a reordered or re-punctuated name',
  normalise('Squat Jump') === normalise('Jump Squat') &&
    normalise('Band Face Pull') === normalise('Face Pull (band)') &&
    normalise('Thoracic Extension on Floor') === normalise('Thoracic Extension (Floor)') &&
    normalise('Back Squat') !== normalise('Front Squat'),
  'the normaliser no longer detects word-order or punctuation duplicates'
);

console.log(
  `\nexercise-name-identity: ${failures === 0 ? `all ${total} checks passed` : `${failures} of ${total} checks FAILED`}`
);
process.exit(failures === 0 ? 0 : 1);
