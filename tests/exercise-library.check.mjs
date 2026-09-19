/**
 * Contract test: lib/exercise-library.ts says exactly what the library document
 * says.
 *
 * WHY THIS ONE PARSES THE DOCUMENT
 * ────────────────────────────────
 * docs/EXERCISE-LIBRARY.md is the source of truth Archie supplied: 160
 * exercises across six patterns and four levels, plus nine conditioning
 * exercises. lib/exercise-library.ts is the app's copy of it. Two copies of the
 * same list always drift, and the way they drift here is silent: a level moves,
 * a piece of kit is dropped, an exercise quietly goes missing from a cell, and
 * the app still builds a session, so nothing complains. Somebody just stops
 * being offered the pull.
 *
 * So this check reads the document itself at run time and compares, rather than
 * repeating the list a third time. It parses names, patterns, levels and the
 * plain-English equipment text, turns that text into the same short kit keys the
 * records use, and demands they agree. Edit a row in the document and this fails
 * until the record catches up, and the other way round.
 *
 * It also guards the thing a person would feel: every load and rep anybody has
 * logged is filed under the id of the exercise they did, so where a record is
 * the same movement with the same implement as an exercise the app already had,
 * it keeps that exercise's id. This asserts that every one of those ids still
 * resolves to a real exercise in the live catalogue, that no two records claim
 * the same one, that none of them is Restore content (which keeps serving under
 * its own name), and that a brand-new record never lands on an id that already
 * belongs to something else.
 *
 * And the document's own two exceptions, written in its "Notes taken while
 * transcribing" section:
 *   - "Squat Jump" (Squat, Athlete) and "Squat Jumps" (Lunge, Athlete) are one
 *     movement listed twice. One record, both patterns, both spellings.
 *   - "Single Leg Romanian Deadlift" is two exercises on purpose: dumbbell or
 *     kettlebell at Intermediate, barbell at Advanced.
 *
 * Run:  npx tsx tests/exercise-library.check.mjs
 * Run against an edited copy, which is how it is mutation-tested:
 *       LIBRARY_DOC=/tmp/edited.md npx tsx tests/exercise-library.check.mjs
 *       npx tsx tests/exercise-library.check.mjs /tmp/edited.md
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { getExerciseNameMap, getExerciseCategoryMap } from '../lib/exercise-db.ts';
import {
  LIBRARY_EXERCISES,
  CONDITIONING_EXERCISES,
  KIT_KEYS,
  LIBRARY_LEVEL_NAMES,
  patternsOf,
  libraryNamesOf,
  libraryByPattern,
} from '../lib/exercise-library.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const DOC_PATH =
  process.env.LIBRARY_DOC ?? process.argv[2] ?? join(__dir, '../docs/EXERCISE-LIBRARY.md');

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

// ─── Reading the document ────────────────────────────────────────────────────

const PATTERN_HEADINGS = ['Push', 'Pull', 'Hinge', 'Squat', 'Lunge', 'Core'];
const LEVEL_HEADINGS = { Beginner: 1, Intermediate: 2, Advanced: 3, Athlete: 4 };

/**
 * Each phrase the document uses for a piece of kit, and the keys that satisfy
 * it. A list of more than one key means any of them will do: "Box (or Bench)"
 * is a box or a bench, "Bench/Weight Plates" is either. "Bodyweight" is an
 * empty list, because there is nothing to own.
 *
 * Written out in full rather than guessed at from the words, so a phrase the
 * document has never used before fails loudly below instead of being read as
 * whatever is nearest.
 */
const KIT_PHRASES = {
  'Ab Wheel': ['abwheel'],
  'Assault Bike': ['assaultbike'],
  Barbell: ['barbell'],
  Bench: ['bench'],
  'Bench/Weight Plates': ['bench', 'plates'],
  Bodyweight: [],
  'Box (or Bench)': ['box', 'bench'],
  'Box/Bench': ['box', 'bench'],
  'Cable Machine': ['cable'],
  'Door Frame': ['doorframe'],
  Dumbbell: ['dumbbell'],
  'Dumbbell (or Kettlebell)': ['dumbbell', 'kettlebell'],
  'Dumbbell or Kettlebell': ['dumbbell', 'kettlebell'],
  Dumbbells: ['dumbbell'],
  Kettlebell: ['kettlebell'],
  Kettlebells: ['kettlebell'],
  'Kettlebells (or Dumbbells)': ['kettlebell', 'dumbbell'],
  'Landmine Attachment (or Corner)': ['landmine', 'corner'],
  'Lat Pulldown Machine / Cable Machine': ['latpulldown', 'cable'],
  'Medicine Ball': ['medball'],
  'Medicine Ball (Slam Ball)': ['slamball'],
  'Plyo Box/Bench': ['box', 'bench'],
  'Pull-Up Bar': ['pullupbar'],
  Rack: ['rack'],
  'Resistance Band': ['band'],
  'Rowing Machine': ['rower'],
  // Decision 7: skipping is with a rope or on the spot, so the rope is never
  // required. It is declared as optionalKit on the record instead.
  'Skipping Rope (or on the spot)': [],
  Sled: ['sled'],
  'Sled (walked backwards, dragging the sled)': ['sled'],
  'Trap Bar': ['trapbar'],
  Treadmill: ['treadmill'],
  'TRX (or Suspension Trainer)': ['trx'],
  'TRX / Suspension Trainer': ['trx'],
  'Weight Plate': ['plates'],
  'Weight Plate (or Block)': ['plates', 'blocks'],
  'Weight Plates': ['plates'],
  'Weight Plates (or Block)': ['plates', 'blocks'],
  'Weight Plates (or Blocks)': ['plates', 'blocks'],
};

/** Split an equipment line on the commas that separate requirements. */
function equipmentPieces(text) {
  const pieces = [];
  let depth = 0;
  let cur = '';
  for (const c of text) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) {
      pieces.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  pieces.push(cur.trim());
  return pieces;
}

const unknownPhrases = new Set();

function kitFromDoc(text) {
  const groups = [];
  for (const piece of equipmentPieces(text)) {
    const keys = KIT_PHRASES[piece];
    if (!keys) {
      unknownPhrases.add(piece);
      continue;
    }
    if (keys.length) groups.push(keys);
  }
  return groups;
}

function parseDoc(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  let section = null;
  let level = null;
  const rows = [];
  const conditioning = [];
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^## (.+)$/))) {
      section = m[1];
      level = null;
      continue;
    }
    if ((m = line.match(/^### (.+)$/))) {
      level = m[1];
      continue;
    }
    if (!(m = line.match(/^- (.+?) - (.+)$/))) continue;
    if (PATTERN_HEADINGS.includes(section) && LEVEL_HEADINGS[level]) {
      rows.push({
        name: m[1],
        pattern: section.toLowerCase(),
        level: LEVEL_HEADINGS[level],
        equipment: m[2],
      });
    } else if (section === 'Conditioning') {
      conditioning.push({ name: m[1], equipment: m[2] });
    }
  }
  return { rows, conditioning };
}

const doc = parseDoc(DOC_PATH);
for (const row of doc.rows) row.kit = kitFromDoc(row.equipment);
for (const row of doc.conditioning) row.kit = kitFromDoc(row.equipment);

const sameKit = (a, b) =>
  a.length === b.length &&
  a.every((g, i) => g.length === b[i].length && g.every((k, j) => k === b[i][j]));

const show = (kit) => (kit.length ? kit.map((g) => g.join('|')).join(' + ') : '(nothing)');

console.log(`\nReading ${DOC_PATH}`);

// ─── 1. The document itself is shaped the way the records assume ─────────────
console.log('\n[1] The document is readable');

check(
  'the document lists exercises under all six patterns and all four levels',
  PATTERN_HEADINGS.every((p) =>
    Object.values(LEVEL_HEADINGS).every((l) =>
      doc.rows.some((r) => r.pattern === p.toLowerCase() && r.level === l)
    )
  ),
  'an empty pattern or level cell means a session slot with nothing to put in it'
);
check(
  'every piece of kit the document names is one this check knows how to read',
  unknownPhrases.size === 0,
  `${[...unknownPhrases].map((p) => `"${p}"`).join(', ')} — a new phrase has to be given a key before a record can honour it`
);
check(
  'the document has a Conditioning section',
  doc.conditioning.length > 0,
  'no conditioning exercises were read'
);

// ─── 2. One record per document row, and no records nobody asked for ─────────
console.log('\n[2] Every exercise in the document is one record in the app');

/** The records a document row could be: name and level must both match. */
function recordsFor(row) {
  return LIBRARY_EXERCISES.filter(
    (e) =>
      libraryNamesOf(e).includes(row.name) &&
      patternsOf(e).includes(row.pattern) &&
      e.level === row.level
  );
}

const unmatchedRows = doc.rows.filter((r) => recordsFor(r).length !== 1);
check(
  `all ${doc.rows.length} document rows resolve to exactly one record`,
  unmatchedRows.length === 0,
  unmatchedRows
    .map((r) => `${r.pattern}/${r.level} "${r.name}" matched ${recordsFor(r).length}`)
    .join('; ')
);

const claimed = new Set();
for (const row of doc.rows) for (const e of recordsFor(row)) claimed.add(e.id);
const orphans = LIBRARY_EXERCISES.filter((e) => !claimed.has(e.id));
check(
  'no record exists that the document does not list',
  orphans.length === 0,
  orphans.map((e) => `${e.id} (${e.libraryName})`).join(', ')
);

// 161 rows, 160 records: the Squat Jump merge is the difference.
check(
  `the document's ${doc.rows.length} rows become ${doc.rows.length - 1} records (one movement is listed twice)`,
  LIBRARY_EXERCISES.length === doc.rows.length - 1,
  `${LIBRARY_EXERCISES.length} records`
);

for (const p of PATTERN_HEADINGS) {
  const pattern = p.toLowerCase();
  for (const [word, level] of Object.entries(LEVEL_HEADINGS)) {
    const inDoc = doc.rows.filter((r) => r.pattern === pattern && r.level === level).length;
    const inApp = libraryByPattern(pattern).filter((e) => e.level === level).length;
    check(
      `${p} / ${word}: ${inDoc} in the document, ${inApp} in the app`,
      inDoc === inApp,
      'a cell that is short is a slot the generator cannot fill'
    );
  }
}

// ─── 3. Names, patterns, levels and kit match the document ───────────────────
console.log('\n[3] Each record says what the document says');

const wrongKit = [];
const wrongName = [];
for (const row of doc.rows) {
  const [record] = recordsFor(row);
  if (!record) continue;
  if (!sameKit(record.kit, row.kit)) {
    wrongKit.push(
      `${row.pattern}/${row.level} "${row.name}": document says ${show(row.kit)}, record says ${show(record.kit)}`
    );
  }
  if (record.name !== record.libraryName) {
    wrongName.push(`${record.id}: name "${record.name}" is not libraryName "${record.libraryName}"`);
  }
}
check(
  `all ${doc.rows.length} rows carry the kit the document gives them`,
  wrongKit.length === 0,
  wrongKit.slice(0, 6).join(' | ')
);
check(
  'every record is displayed under the name the document spells',
  wrongName.length === 0,
  wrongName.slice(0, 6).join(' | ')
);

const badLevel = LIBRARY_EXERCISES.filter((e) => !LIBRARY_LEVEL_NAMES[e.level]);
check(
  'every level is one of the four onboarding answers',
  badLevel.length === 0,
  badLevel.map((e) => `${e.id} level ${e.level}`).join(', ')
);

const kitKeys = new Set(KIT_KEYS);
const badKit = [];
for (const e of [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES]) {
  for (const group of e.kit) {
    if (group.length === 0) badKit.push(`${e.id}: an empty requirement nobody can satisfy`);
    for (const key of group) if (!kitKeys.has(key)) badKit.push(`${e.id}: unknown kit "${key}"`);
    if (new Set(group).size !== group.length) badKit.push(`${e.id}: a key repeated in one group`);
  }
  const seen = e.kit.map((g) => [...g].sort().join('|'));
  if (new Set(seen).size !== seen.length) badKit.push(`${e.id}: the same requirement listed twice`);
}
check('every kit key is one of the canonical keys', badKit.length === 0, badKit.slice(0, 6).join(' | '));

// ─── 4. The document's two deliberate exceptions ─────────────────────────────
console.log('\n[4] The one movement listed twice, and the one name used twice');

const squatJumps = LIBRARY_EXERCISES.filter((e) => libraryNamesOf(e).includes('Squat Jumps'));
check(
  '"Squat Jump" and "Squat Jumps" are one record, not two',
  squatJumps.length === 1,
  `${squatJumps.length} records answer to "Squat Jumps"`
);
if (squatJumps.length === 1) {
  const [jump] = squatJumps;
  check(
    'that one record is filed under both Squat and Lunge',
    patternsOf(jump).includes('squat') && patternsOf(jump).includes('lunge'),
    `filed under ${patternsOf(jump).join(' and ')}`
  );
  check(
    'a Lunge slot and a Squat slot can both reach it',
    libraryByPattern('lunge').some((e) => e.id === jump.id) &&
      libraryByPattern('squat').some((e) => e.id === jump.id),
    'one of the two patterns cannot see it'
  );
  check(
    'it answers to both spellings the document uses',
    libraryNamesOf(jump).includes('Squat Jump') && libraryNamesOf(jump).includes('Squat Jumps'),
    libraryNamesOf(jump).join(' / ')
  );
  check('it is Athlete level in both places', jump.level === 4, `level ${jump.level}`);
}

const singleLegRdl = LIBRARY_EXERCISES.filter(
  (e) => e.libraryName === 'Single Leg Romanian Deadlift'
);
check(
  '"Single Leg Romanian Deadlift" is two records, not one',
  singleLegRdl.length === 2,
  `${singleLegRdl.length} records`
);
if (singleLegRdl.length === 2) {
  const byLevel = Object.fromEntries(singleLegRdl.map((e) => [e.level, e]));
  check(
    'one sits at Intermediate and one at Advanced',
    Boolean(byLevel[2] && byLevel[3]),
    singleLegRdl.map((e) => `level ${e.level}`).join(', ')
  );
  if (byLevel[2] && byLevel[3]) {
    check(
      'the Intermediate one takes a dumbbell or a kettlebell, the Advanced one a barbell',
      sameKit(byLevel[2].kit, [['dumbbell', 'kettlebell']]) &&
        byLevel[3].kit.some((g) => g.includes('barbell')),
      `${show(byLevel[2].kit)} and ${show(byLevel[3].kit)}`
    );
    check(
      'they are two separate exercises, with two separate ids',
      byLevel[2].id !== byLevel[3].id,
      `both are ${byLevel[2].id}`
    );
  }
}

// ─── 5. Ids: progress carries over, and nothing is overwritten ───────────────
console.log('\n[5] Ids keep logged progress, and never land on somebody else');

const templateNames = getExerciseNameMap();
const templateCategories = getExerciseCategoryMap();
const all = [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES];

const ids = all.map((e) => e.id);
const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
check(
  `all ${ids.length} record ids are unique`,
  repeated.length === 0,
  `${[...new Set(repeated)].join(', ')} — two exercises sharing an id share one person's loads`
);

const reused = all.filter((e) => !e.id.startsWith('lib-'));
const fresh = all.filter((e) => e.id.startsWith('lib-'));

const missingTemplates = reused.filter((e) => !templateNames[e.id]);
check(
  `all ${reused.length} reused ids still resolve to an exercise in the catalogue`,
  missingTemplates.length === 0,
  missingTemplates.map((e) => `${e.id} (${e.libraryName})`).join(', ')
);

const collisions = fresh.filter((e) => templateNames[e.id]);
check(
  `none of the ${fresh.length} new ids lands on an exercise that already exists`,
  collisions.length === 0,
  collisions.map((e) => `${e.id} is already "${templateNames[e.id]}"`).join(', ')
);

const restoreCategories = new Set(['prehab', 'cooldown']);
const restoreReuse = reused.filter(
  (e) =>
    restoreCategories.has(templateCategories[e.id]) ||
    e.id.startsWith('ph-') ||
    e.id.startsWith('fl-') ||
    e.id.startsWith('acute-')
);
check(
  'no record takes over an id that Restore is still using',
  restoreReuse.length === 0,
  restoreReuse
    .map((e) => `${e.libraryName} took ${e.id} ("${templateNames[e.id]}")`)
    .join(', ') + ' — Restore keeps serving that exercise under its own name'
);

const badSlug = fresh.filter((e) => {
  const slug = e.libraryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const prefix = CONDITIONING_EXERCISES.includes(e) ? 'cond' : e.pattern;
  return e.id !== `lib-${prefix}-${slug}`;
});
check(
  'every new id is lib- its pattern - its name',
  badSlug.length === 0,
  badSlug.map((e) => `${e.id} for "${e.libraryName}"`).join(', ')
);

// ─── 6. Roles ────────────────────────────────────────────────────────────────
console.log('\n[6] Every record says what job it does');

const ROLES = new Set(['main', 'accessory', 'power']);
const badRole = LIBRARY_EXERCISES.filter((e) => !ROLES.has(e.role));
check(
  'every role is main, accessory or power',
  badRole.length === 0,
  badRole.map((e) => `${e.id} role "${e.role}"`).join(', ')
);

// Decision 8: jumps and throws stay at Athlete level only, whatever the goal.
const lowPower = LIBRARY_EXERCISES.filter((e) => e.role === 'power' && e.level !== 4);
check(
  'every jump, throw and slam is Athlete level, as decision 8 requires',
  lowPower.length === 0,
  lowPower.map((e) => `${e.libraryName} at level ${e.level}`).join(', ')
);

const noMovement = LIBRARY_EXERCISES.filter((e) => !e.movementPattern);
check(
  'every record keeps its finer movementPattern alongside the library pattern',
  noMovement.length === 0,
  noMovement.map((e) => e.id).join(', ')
);

// ─── 7. Conditioning ─────────────────────────────────────────────────────────
console.log('\n[7] The nine conditioning exercises');

const docConditioningNames = doc.conditioning.map((r) => r.name);
const appConditioningNames = CONDITIONING_EXERCISES.map((e) => e.libraryName);
check(
  `the app holds the document's ${docConditioningNames.length} conditioning exercises, in its order`,
  docConditioningNames.length === appConditioningNames.length &&
    docConditioningNames.every((n, i) => n === appConditioningNames[i]),
  `document: ${docConditioningNames.join(', ')} | app: ${appConditioningNames.join(', ')}`
);

const condKitWrong = [];
for (const row of doc.conditioning) {
  const record = CONDITIONING_EXERCISES.find((e) => e.libraryName === row.name);
  if (!record) continue;
  if (!sameKit(record.kit, row.kit)) {
    condKitWrong.push(
      `"${row.name}": document says ${show(row.kit)}, record says ${show(record.kit)}`
    );
  }
}
check(
  'each conditioning exercise carries the kit the document gives it',
  condKitWrong.length === 0,
  condKitWrong.join(' | ')
);

const skipping = CONDITIONING_EXERCISES.find((e) => e.libraryName === 'Skipping');
check(
  'skipping needs no rope, because the document says a rope or on the spot',
  Boolean(skipping) && skipping.kit.length === 0,
  skipping ? `it requires ${show(skipping.kit)}` : 'there is no Skipping record'
);
check(
  'and it says a rope is the thing that helps',
  Boolean(skipping) && (skipping.optionalKit ?? []).includes('rope'),
  skipping ? `optionalKit ${(skipping.optionalKit ?? []).join(', ') || '(none)'}` : ''
);

const sledPull = doc.conditioning.find((r) => r.name === 'Sled Pull');
check(
  'the document still describes Sled Pull as a backwards drag',
  Boolean(sledPull) && /backwards/i.test(sledPull.equipment),
  sledPull ? sledPull.equipment : 'there is no Sled Pull row'
);

const condRoleWrong = CONDITIONING_EXERCISES.filter((e) => e.role !== 'conditioning');
check(
  'every conditioning record is marked as conditioning',
  condRoleWrong.length === 0,
  condRoleWrong.map((e) => `${e.id} role "${e.role}"`).join(', ')
);

const condInStrength = CONDITIONING_EXERCISES.filter((e) =>
  LIBRARY_EXERCISES.some((s) => s.libraryName === e.libraryName)
);
check(
  'no conditioning exercise is also a strength record',
  condInStrength.length === 0,
  condInStrength.map((e) => e.libraryName).join(', ')
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`exercise-library: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`exercise-library: all ${total} checks passed\n`);
  process.exitCode = 0;
}
