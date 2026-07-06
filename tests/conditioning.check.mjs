/**
 * Contract tests: conditioning exercise pool is non-empty for every tier/energy
 * combination, and the call chain that generates conditioning sessions is intact.
 *
 * HOW CONDITIONING SESSIONS WORK
 * ─────────────────────────────────
 * 1. flex.tsx navigates to /readiness with sessionType:'conditioning' + energy +
 *    timeAvailable params (derived from the selected ConditioningLevel).
 * 2. readiness.tsx passes through to /session with those params.
 * 3. session.tsx calls generateWorkout('conditioning', tier, readiness, ...) from
 *    workout-engine.ts.
 * 4. workout-engine.ts routes conditioning to the private generateConditioningWorkout()
 *    which calls getConditioningWorkout(equipmentTier, energyKey) from exercise-db.ts.
 * 5. getConditioningWorkout() looks up CONDITIONING_WORKOUTS[internalTier][energyKey]
 *    and returns the exercise array.
 *
 * Silent failure modes this catches:
 *  - CONDITIONING_WORKOUTS tier/energy array deleted or left empty → 0 exercises
 *  - getConditioningWorkout() removed/not exported → generateConditioningWorkout() fails
 *  - workout-engine.ts 'conditioning' routing removed → generateWorkout() returns []
 *  - flex.tsx stops passing sessionType:'conditioning' → conditioning sessions never launch
 *  - session.tsx stops importing generateWorkout → session screen crashes at boot
 *  - Duplicate conditioning exercise IDs → set-logging and swap bugs
 *
 * Checks:
 *  1. POOL STRUCTURE   — CONDITIONING_WORKOUTS present with all 3 internal tiers
 *  2. ENERGY KEYS      — every tier has easy / normal / hard keys
 *  3. EXERCISE COUNT   — every tier×energy array has ≥ 1 exercise
 *  4. DB WIRING        — getConditioningWorkout exported and delegates to the pool
 *  5. ENGINE WIRING    — workout-engine.ts imports getConditioningWorkout and calls it
 *  6. ENGINE ROUTING   — generateWorkout routes 'conditioning' to generateConditioningWorkout
 *  7. UI WIRING        — flex.tsx navigates with sessionType:'conditioning'; session.tsx
 *                        imports generateWorkout from workout-engine
 *  8. ID UNIQUENESS    — no duplicate exercise IDs in CONDITIONING_WORKOUTS
 *
 * Run:  node tests/conditioning.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const dbSrc = readFileSync(join(__dir, '../lib/exercise-db.ts'), 'utf8');
const engineSrc = readFileSync(join(__dir, '../lib/workout-engine.ts'), 'utf8');
const flexSrc = readFileSync(join(__dir, '../app/(tabs)/flex.tsx'), 'utf8');
const sessionSrc = readFileSync(join(__dir, '../app/session.tsx'), 'utf8');

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

// ─── Helper: find the opening brace of a value after 'const NAME' ─────────────
// TypeScript typed constants look like:
//   const FOO: Record<A, B> = { ... }
// The type annotation may contain '{' and '}', so we cannot use indexOf('{').
// Instead we find the '= {' assignment operator which marks the actual value.
function findConstObjectBoundary(src, constName) {
  const constIdx = src.indexOf(`const ${constName}`);
  if (constIdx === -1) return { constIdx: -1, objOpen: -1, objEnd: -1 };

  // Find '= {' after the const declaration (skips the type annotation entirely)
  const assignIdx = src.indexOf('= {', constIdx);
  if (assignIdx === -1) return { constIdx, objOpen: -1, objEnd: -1 };

  const objOpen = assignIdx + 2; // points to the '{'
  let braceDepth = 0;
  let objEnd = -1;

  for (let i = objOpen; i < src.length; i++) {
    if (src[i] === '{') braceDepth++;
    else if (src[i] === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        objEnd = i;
        break;
      }
    }
  }

  return { constIdx, objOpen, objEnd };
}

// ─── 1. CONDITIONING_WORKOUTS pool structure ──────────────────────────────────
console.log('\n[1] Pool structure — CONDITIONING_WORKOUTS present in exercise-db.ts');

const INTERNAL_TIERS = ['bodyweight', 'dumbbells', 'fullgym'];
const ENERGY_KEYS = ['easy', 'normal', 'hard'];

const {
  constIdx: poolIdx,
  objOpen: poolOpen,
  objEnd: poolEnd,
} = findConstObjectBoundary(dbSrc, 'CONDITIONING_WORKOUTS');

check(
  'CONDITIONING_WORKOUTS constant found in exercise-db.ts',
  poolIdx !== -1,
  'constant not found — check lib/exercise-db.ts'
);

check(
  'CONDITIONING_WORKOUTS object boundary found (balanced braces)',
  poolEnd !== -1,
  'brace counting failed — unbalanced braces in CONDITIONING_WORKOUTS?'
);

// tier -> energy -> exercise count
const poolMatrix = {};

if (poolOpen !== -1 && poolEnd !== -1) {
  const block = dbSrc.slice(poolOpen, poolEnd + 1);

  // Walk depth-1 to find tier keys: bodyweight, dumbbells, fullgym
  let depth = 0;
  let i = 0;

  while (i < block.length) {
    const ch = block[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;

    if (depth === 1) {
      const tierMatch = block.slice(i).match(/^([a-z]+):\s*\{/);
      if (tierMatch) {
        const tierKey = tierMatch[1];
        if (INTERNAL_TIERS.includes(tierKey)) {
          poolMatrix[tierKey] = {};

          const tierObjOpen = block.indexOf('{', i + tierMatch[0].indexOf('{'));
          let tierDepth = 0;
          let tierEnd = -1;

          for (let j = tierObjOpen; j < block.length; j++) {
            if (block[j] === '{') tierDepth++;
            else if (block[j] === '}') {
              tierDepth--;
              if (tierDepth === 0) {
                tierEnd = j;
                break;
              }
            }
          }

          if (tierEnd !== -1) {
            const tierBlock = block.slice(tierObjOpen, tierEnd + 1);

            // Inside tier block, find energy keys at depth 1 of the tier object
            let ed = 0;
            let ei = 0;
            while (ei < tierBlock.length) {
              const ec = tierBlock[ei];
              if (ec === '{' || ec === '[') ed++;
              else if (ec === '}' || ec === ']') ed--;

              if (ed === 1) {
                const energyMatch = tierBlock.slice(ei).match(/^([a-z]+):\s*\[/);
                if (energyMatch) {
                  const energyKey = energyMatch[1];
                  const arrOpen = tierBlock.indexOf('[', ei + energyMatch[0].indexOf('['));
                  let arrD = 0;
                  let arrEnd = -1;

                  for (let j = arrOpen; j < tierBlock.length; j++) {
                    if (tierBlock[j] === '[') arrD++;
                    else if (tierBlock[j] === ']') {
                      arrD--;
                      if (arrD === 0) {
                        arrEnd = j;
                        break;
                      }
                    }
                  }

                  const arrSlice = arrEnd !== -1 ? tierBlock.slice(arrOpen, arrEnd + 1) : '';
                  const count = (arrSlice.match(/id:\s*'/g) || []).length;
                  poolMatrix[tierKey][energyKey] = count;

                  if (arrEnd !== -1) ei = arrEnd;
                }
              }
              ei++;
            }
            i = tierEnd;
          }
        }
      }
    }
    i++;
  }

  const foundTiers = Object.keys(poolMatrix);
  check(
    `CONDITIONING_WORKOUTS has all ${INTERNAL_TIERS.length} internal tiers (found ${foundTiers.length}: ${foundTiers.join(', ')})`,
    INTERNAL_TIERS.every((t) => foundTiers.includes(t)),
    `missing tiers: ${INTERNAL_TIERS.filter((t) => !foundTiers.includes(t)).join(', ')}`
  );

  for (const tier of foundTiers) {
    for (const [energy, count] of Object.entries(poolMatrix[tier])) {
      console.log(`  · ${tier}.${energy}: ${count} exercises`);
    }
  }
}

// ─── 2. Energy keys — every tier has easy / normal / hard ────────────────────
console.log('\n[2] Energy keys — every tier has easy / normal / hard arrays');

for (const tier of INTERNAL_TIERS) {
  for (const energy of ENERGY_KEYS) {
    const count = poolMatrix[tier]?.[energy];
    check(
      `CONDITIONING_WORKOUTS['${tier}']['${energy}'] key exists`,
      count !== undefined,
      `tier '${tier}' is missing energy key '${energy}' — getConditioningWorkout() returns undefined`
    );
  }
}

// ─── 3. Exercise count — every tier×energy array has ≥ 1 exercise ────────────
console.log('\n[3] Exercise count — every tier×energy array has ≥ 1 exercise');

for (const tier of INTERNAL_TIERS) {
  for (const energy of ENERGY_KEYS) {
    const count = poolMatrix[tier]?.[energy] ?? 0;
    check(
      `CONDITIONING_WORKOUTS['${tier}']['${energy}'] has ≥ 1 exercise (found ${count})`,
      count >= 1,
      `empty array — conditioning session for ${tier}/${energy} launches with 0 exercises`
    );
  }
}

// ─── 4. DB wiring — getConditioningWorkout exported and uses the pool ─────────
console.log('\n[4] DB wiring — getConditioningWorkout exported and delegates to pool');

check(
  'getConditioningWorkout is exported from exercise-db.ts',
  dbSrc.includes('export function getConditioningWorkout'),
  'function not found — workout-engine.ts call fails at import time'
);

check(
  'getConditioningWorkout references CONDITIONING_WORKOUTS',
  dbSrc.includes('CONDITIONING_WORKOUTS['),
  'function does not index into CONDITIONING_WORKOUTS — pool is disconnected'
);

check(
  'getConditioningWorkout calls toInternalTier() for tier mapping',
  dbSrc.includes('toInternalTier('),
  'toInternalTier call missing — user-facing tier names will not map to internal keys'
);

// ─── 5. Engine wiring — workout-engine.ts imports and calls getConditioningWorkout
console.log('\n[5] Engine wiring — workout-engine.ts imports and calls getConditioningWorkout');

check(
  'workout-engine.ts imports getConditioningWorkout from exercise-db',
  engineSrc.includes('getConditioningWorkout'),
  'import not found — generateConditioningWorkout() cannot call into the pool'
);

check(
  'generateConditioningWorkout calls getConditioningWorkout(equipmentTier, energyKey)',
  engineSrc.includes('getConditioningWorkout(equipmentTier, energyKey)'),
  'call site missing — pool is imported but never invoked; conditioning sessions return []'
);

check(
  'generateConditioningWorkout maps energy level to easy/normal/hard key',
  engineSrc.includes("'low' ? 'easy'") || engineSrc.includes("=== 'low' ? 'easy'"),
  'energy-to-key mapping missing — all conditioning sessions always use the same energy pool'
);

// ─── 6. Engine routing — generateWorkout routes 'conditioning' to its generator
console.log(
  "\n[6] Engine routing — generateWorkout routes 'conditioning' to generateConditioningWorkout"
);

check(
  "workout-engine.ts routes sessionType 'conditioning' to generateConditioningWorkout",
  engineSrc.includes("sessionType === 'conditioning'") &&
    engineSrc.includes('generateConditioningWorkout('),
  "routing missing — 'conditioning' sessions fall through to strength generator and crash or produce wrong exercises"
);

// Verify the routing happens before the strength generator runs (conditioning check appears
// before the main strength session logic which references 'mainType')
const conditioningCheckIdx = engineSrc.indexOf("sessionType === 'conditioning'");
const generateCondCallIdx = engineSrc.indexOf('generateConditioningWorkout(');
const strengthGeneratorIdx = engineSrc.indexOf('const mainType = sessionType as MainSessionType');

check(
  'conditioning routing happens before the strength generator block',
  conditioningCheckIdx !== -1 &&
    strengthGeneratorIdx !== -1 &&
    conditioningCheckIdx < strengthGeneratorIdx,
  "'conditioning' check comes after the strength generator — conditioning sessions may run strength logic"
);

// ─── 7. UI wiring — flex.tsx passes conditioning type; session.tsx calls generateWorkout
console.log(
  '\n[7] UI wiring — flex.tsx navigates with conditioning type; session.tsx calls generateWorkout'
);

check(
  "flex.tsx navigates to /readiness with sessionType: 'conditioning'",
  flexSrc.includes("sessionType: 'conditioning'"),
  'navigation call not found — tapping a conditioning level never launches a conditioning session'
);

check(
  'flex.tsx passes energy param to /readiness for conditioning level',
  flexSrc.includes('energy: level.energy') || flexSrc.includes('energy:'),
  'energy param not passed — conditioning session always uses the default energy level'
);

check(
  'session.tsx imports generateWorkout from workout-engine',
  sessionSrc.includes('generateWorkout'),
  'import not found — session screen cannot generate any session type including conditioning'
);

// ─── 8. ID uniqueness — no duplicate IDs across all conditioning arrays ────────
console.log('\n[8] ID uniqueness — no duplicate exercise IDs in CONDITIONING_WORKOUTS');

const condIdMatches = dbSrc.match(/id:\s*'cond-[^']+'/g) ?? [];
const condIds = condIdMatches.map((m) => m.replace(/id:\s*'/, '').replace(/'$/, ''));
const seen = new Set();
const dupes = [];

for (const id of condIds) {
  if (seen.has(id)) dupes.push(id);
  else seen.add(id);
}

check(
  `all ${condIds.length} conditioning exercise IDs are unique (no duplicates)`,
  dupes.length === 0,
  dupes.length > 0 ? `duplicate IDs: ${dupes.join(', ')}` : ''
);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`conditioning: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`conditioning: all ${total} checks passed\n`);
  process.exit(0);
}
