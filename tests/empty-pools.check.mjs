/**
 * Contract test: an empty pool of exercises never crashes a session.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The rebuild onto the exercise library (docs/EXERCISE-LIBRARY.md) empties a
 * great many of the pools the session generators draw from. Several places read
 * the first entry of a pool, or a field off whatever was picked, without asking
 * whether anything was there: the activation block, the explosive block, the
 * strength finisher, the rehab slot and the cool-down in a strength session,
 * the rehab slot in a weekly session, the goal conditioning block and every
 * pick in a conditioning session. Each one threw on an empty pool, and a throw
 * there is not a missing card, it is a session that never opens.
 *
 * The rule this holds: an empty pool drops its block. The session is shorter,
 * it is never broken, and it never shows a card with nothing on it.
 *
 * AND THE GUARDS CHANGE NOTHING FOR ANYONE TODAY. With every pool whole, the
 * sessions built at the end of this run must match, card for card, the ones
 * built at the start, which also proves every pool was put back exactly.
 *
 * HOW
 * ───
 * lib/exercise-db.ts exports SESSION_POOLS, the live arrays every generator
 * reads. This empties each pool in turn IN MEMORY, builds every session type at
 * every equipment tier, length and energy level, and puts it back. Then it
 * empties all of them at once and does the same.
 *
 * It also asserts that emptying each pool CHANGED at least one session. Without
 * that, a pool list holding copies rather than the live arrays would empty
 * nothing, and this whole file would pass while proving nothing.
 *
 * The clock is frozen, because the rotation seed adds today's date: a run that
 * crossed midnight would otherwise compare two different days' sessions.
 *
 * Run:  npx tsx tests/empty-pools.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

const RealDate = Date;
const FIXED_NOW = RealDate.UTC(2026, 0, 15, 12, 0, 0);
globalThis.Date = class FixedDate extends RealDate {
  constructor(...args) {
    super(...(args.length > 0 ? args : [FIXED_NOW]));
  }
  static now() {
    return FIXED_NOW;
  }
};

// Imported after the clock is frozen, so nothing in lib/ can read the real one.
const { generateWorkout } = await import('../lib/workout-engine.ts');
const { SESSION_POOLS } = await import('../lib/exercise-db.ts');
const { CARDIO_MACHINES } = await import('../lib/cardio-warmup.ts');

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

// ─── The pools ───────────────────────────────────────────────────────────────

const isEntry = (x) =>
  !!x && typeof x === 'object' && !Array.isArray(x) && typeof x.name === 'string';

/**
 * Every non-empty array of exercises inside a pool, however deeply it is keyed
 * (by session type, tier and energy). A conditioning circuit pool is an array
 * of circuits, and it is the list of circuits that gets emptied.
 */
function arraysIn(value, out = []) {
  if (Array.isArray(value)) {
    const ofEntries = value.every(isEntry);
    const ofCircuits = value.every((c) => Array.isArray(c) && c.every(isEntry));
    if (value.length > 0 && (ofEntries || ofCircuits)) out.push(value);
    return out;
  }
  if (value && typeof value === 'object' && !isEntry(value)) {
    for (const v of Object.values(value)) arraysIn(v, out);
  }
  return out;
}

/**
 * FIVE OF THE TABLES ARE NOT POOLS ANY MORE, and that is the point.
 *
 * Nothing in the app builds a session out of any of them, so emptying one
 * changes nothing and the "the pool really was emptied" half of section 2 would
 * correctly fail on it. They are still in SESSION_POOLS because the exercises
 * somebody logged out of them years ago have to keep resolving to a name on the
 * history screens.
 *
 *   ORM_TEST - the 1RM testing protocols. Strength test weeks are retired and
 *     the generator that read them is deleted.
 *
 *   MECHANICAL, POWER_MECHANICAL, NEURO and GOAL_CONDITIONING_BLOCKS - the
 *     priming, explosive and goal-conditioning blocks of the old lift-day
 *     generator. That generator was only ever reached through the session ids
 *     'squat', 'bench' and 'deadlift', and those now build a lower, upper or
 *     full body session instead (lib/session-type.ts), so the branch that reads
 *     these four is unreachable. The weekly generator draws its warm-up, its
 *     accessories, its rehab slot, its finisher and its cool-down from PREP,
 *     ACCESSORIES, PREHAB, FINISHERS and COOLDOWN, which are all still live and
 *     still tested in section 2.
 *
 * Listed here rather than quietly dropped, so section 5 can ASSERT the
 * unreachability instead of leaving it as a thing this file stopped looking at.
 */
const UNREACHED_NAMES = [
  'ORM_TEST',
  'MECHANICAL',
  'POWER_MECHANICAL',
  'NEURO',
  'GOAL_CONDITIONING_BLOCKS',
];
const UNREACHED_POOLS = UNREACHED_NAMES.map((name) => ({
  name,
  arrays: arraysIn(SESSION_POOLS[name]),
}));
const POOLS = [
  ...Object.entries(SESSION_POOLS)
    .filter(([name]) => !UNREACHED_NAMES.includes(name))
    .map(([name, value]) => ({ name, arrays: arraysIn(value) })),
  // The gym warm-up machines live in their own file.
  { name: 'CARDIO_MACHINES', arrays: arraysIn(CARDIO_MACHINES) },
];

function emptied(pools, run) {
  const arrays = [...new Set(pools.flatMap((p) => p.arrays))];
  const saved = arrays.map((a) => a.splice(0));
  try {
    return run();
  } finally {
    arrays.forEach((a, i) => a.push(...saved[i]));
  }
}

// ─── The sessions ────────────────────────────────────────────────────────────

const TYPES = [
  'squat',
  'bench',
  'deadlift',
  'upper_body',
  'lower_body',
  'full_body',
  'conditioning',
  'prehab',
  'flexibility',
  'custom',
];
const TIERS =['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
const TIMES = ['30', '45', '60'];
const ENERGIES = ['low', 'normal', 'high'];

/**
 * Two people, chosen so that between them every branch that reads a pool runs.
 *
 * The power goal with nothing sore takes the power activation and explosive
 * pools, the strength finisher, and the rehab slot drawn from the general
 * prehab pool. The fat loss goal with a sore knee takes the ordinary activation
 * and explosive pools, the goal conditioning block, the region's acute rehab
 * slot, and the maintenance rehab session with its supplements.
 */
const CONTEXTS = [
  {
    label: 'power goal, nothing sore',
    profile: {
      name: 'P',
      sex: 'male',
      experienceLevel: 'intermediate',
      goals: ['power'],
      bodyweightKg: 82,
    },
    readiness: { hasAches: false },
  },
  {
    label: 'fat loss goal, sore knee',
    profile: {
      name: 'F',
      sex: 'female',
      experienceLevel: 'beginner',
      goals: ['fat_loss'],
      bodyweightKg: 68,
    },
    readiness: { hasAches: true, painRegion: 'knee', painSeverity: 'mild', acute: false },
  },
];

/** Every session, keyed, with a fixed seed for each (passed positionally). */
function buildAll() {
  const built = new Map();
  let i = 0;
  const attempt = (key, make) => {
    try {
      built.set(key, { session: make() });
    } catch (err) {
      built.set(key, { error: err instanceof Error ? err.message : String(err) });
    }
  };
  for (const type of TYPES) {
    for (const tier of TIERS) {
      for (const time of TIMES) {
        for (const energy of ENERGIES) {
          for (const ctx of CONTEXTS) {
            const seed = i++ % 12;
            attempt(`${type}/${tier}/${time}/${energy}/${ctx.label}`, () =>
              generateWorkout(
                type,
                tier,
                { ...ctx.readiness, energy, timeAvailable: time },
                ctx.profile,
                {},
                undefined,
                seed,
                undefined,
                undefined,
                undefined,
                null
              )
            );
          }
        }
      }
    }
  }
  // The strength test week used to be built here as well, from its own pool.
  // It is retired: generate1RMWorkout is gone from the engine and nothing can
  // reach the ORM_TEST protocols any more. tests/test-weeks-retired.check.mjs
  // holds that, and the table itself is kept only so the exercises a past test
  // week logged still resolve to a name on the history screens.
  return built;
}

/** What is wrong with a built session, if anything. */
function problemsWith(result) {
  if (result.error) return [`threw: ${result.error}`];
  if (!Array.isArray(result.session)) return ['did not return a list of cards'];
  const out = [];
  result.session.forEach((ex, n) => {
    if (!ex || typeof ex !== 'object') out.push(`card ${n + 1} is ${ex}`);
    else if (typeof ex.name !== 'string' || ex.name.trim() === '')
      out.push(`card ${n + 1} has no name`);
    else if (typeof ex.id !== 'string' || ex.id === '') out.push(`${ex.name} has no id`);
    else if (typeof ex.category !== 'string') out.push(`${ex.name} has no category`);
    else if (!Number.isFinite(ex.sets)) out.push(`${ex.name} has ${ex.sets} sets`);
  });
  /**
   * A dropped block must not reshuffle what is left. Every whole session opens
   * with its warm-up cards, measured over 40,500 sessions before the guards
   * went in, so a warm-up card below the work means the session was assembled
   * around a gap as if the gap were still there.
   */
  if (out.length === 0) {
    const firstWork = result.session.findIndex((ex) => ex.category !== 'prep');
    const lateWarmUp =
      firstWork < 0 ? -1 : result.session.findIndex((ex, n) => n > firstWork && ex.category === 'prep');
    if (lateWarmUp >= 0) {
      out.push(
        `warm-up "${result.session[lateWarmUp].name}" comes after "${result.session[firstWork].name}"`
      );
    }
  }
  return out;
}

/** A session as the user would see it: which cards, how much of each. */
const signature = (result) =>
  result.error
    ? `threw: ${result.error}`
    : result.session
        .map((ex) => `${ex?.name} ${ex?.sets}x${ex?.reps} @${ex?.suggestedLoad} [${ex?.category}]`)
        .join(' | ');

function firstFew(list, n = 4) {
  return list.slice(0, n).join('; ') + (list.length > n ? `; and ${list.length - n} more` : '');
}

// ─── 1. The starting point ───────────────────────────────────────────────────
console.log('\n[1] With every pool whole');

const intact = buildAll();
const intactProblems = [...intact].flatMap(([key, r]) =>
  problemsWith(r).map((p) => `${key}: ${p}`)
);
check(
  `all ${intact.size} sessions build with no error and no blank card`,
  intactProblems.length === 0,
  firstFew(intactProblems)
);
check(
  'every session type except Build your own has cards in it',
  [...intact].every(
    ([key, r]) => key.startsWith('custom/') || (r.session && r.session.length > 0)
  )
);

for (const pool of POOLS) {
  check(
    `${pool.name} has exercises in it to empty`,
    pool.arrays.length > 0,
    'nothing found, so emptying it would prove nothing'
  );
}

// ─── 2. One pool at a time ───────────────────────────────────────────────────
console.log('\n[2] Each pool emptied on its own');

for (const pool of POOLS) {
  const { problems, changed } = emptied([pool], () => {
    const built = buildAll();
    const found = [];
    let differs = 0;
    for (const [key, r] of built) {
      for (const p of problemsWith(r)) found.push(`${key}: ${p}`);
      if (signature(r) !== signature(intact.get(key))) differs++;
    }
    return { problems: found, changed: differs };
  });
  check(
    `${pool.name} empty: every session still builds, with no blank card`,
    problems.length === 0,
    firstFew(problems)
  );
  check(
    `${pool.name} empty: at least one session is different, so the pool really was emptied`,
    changed > 0,
    'no session changed, so the check did not reach the arrays the generators read'
  );
}

// ─── 3. Everything at once ───────────────────────────────────────────────────
console.log('\n[3] Every pool emptied together');

const allEmptyProblems = emptied(POOLS, () =>
  [...buildAll()].flatMap(([key, r]) => problemsWith(r).map((p) => `${key}: ${p}`))
);
check(
  'every session still builds, with no blank card',
  allEmptyProblems.length === 0,
  firstFew(allEmptyProblems)
);

// ─── 4. Nothing changed for anyone ───────────────────────────────────────────
console.log('\n[4] With every pool put back, the sessions are exactly what they were');

const after = buildAll();
const drifted = [...intact.keys()].filter(
  (key) => signature(after.get(key)) !== signature(intact.get(key))
);
check(
  `all ${intact.size} sessions match the snapshot taken at the start`,
  drifted.length === 0,
  firstFew(drifted)
);

// ─── 5. The retired tables are unreachable ───────────────────────────────────
console.log('\n[5] Nothing builds a session out of the retired tables');

for (const pool of UNREACHED_POOLS) {
  check(
    `${pool.name} still holds the exercises it always did`,
    pool.arrays.length > 0 && pool.arrays.some((a) => a.length > 0),
    'emptying an already-empty table would prove nothing about reachability'
  );

  const reach = emptied([pool], () => {
    const built = buildAll();
    const problems = [];
    let differs = 0;
    for (const [key, r] of built) {
      for (const p of problemsWith(r)) problems.push(`${key}: ${p}`);
      if (signature(r) !== signature(intact.get(key))) differs++;
    }
    return { problems, differs };
  });
  check(
    `emptying ${pool.name} changes no session at all`,
    reach.differs === 0,
    `${reach.differs} session(s) changed, so some code path is still building out of ${pool.name}`
  );
  check(
    `and every session still builds with no blank card while ${pool.name} is empty`,
    reach.problems.length === 0,
    firstFew(reach.problems)
  );

  const afterRetired = buildAll();
  check(
    `${pool.name} is put back exactly as it was`,
    [...intact.keys()].every(
      (key) => signature(afterRetired.get(key)) === signature(intact.get(key))
    ),
    'the table is history, so the check must not leave it damaged'
  );
}

console.log(`\n${total - failures}/${total} passed`);
process.exitCode = failures === 0 ? 0 : 1;
