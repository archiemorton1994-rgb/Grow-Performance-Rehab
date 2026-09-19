/**
 * Contract test: weekly sessions actually vary.
 *
 * WHY THIS MATTERS
 * ────────────────
 * "If someone does upper body over and over, is it just the same exercises each
 * time?" It was, and the reason was not the rotation engine — that already
 * existed and was already used. It was the pool:
 *
 *   WEEKLY_UPPER_BODY / _LOWER_BODY / _FULL_BODY were hand-written lists of
 *   five or six exercises per tier, held separately from the exercise database.
 *   With four required movement patterns out of a pool of five, an upper body
 *   session had exactly one rotating slot — and none at all at 30 minutes.
 *
 * Two things must hold together, and they pull against each other:
 *   VARIETY  — the accessories must genuinely change between sessions
 *   COHERENCE— the session must still be about what it is called, nothing may
 *              appear twice, and the main exercise must stay put most of the
 *              time because it is the thing being progressed
 *
 * WHAT THE LIBRARY CHANGED, AND WHY THIS FILE IS NOW ALL BEHAVIOUR
 * ───────────────────────────────────────────────────────────────
 * Lower, Upper and Full Body are all built from Archie's library now
 * (LIBRARY_LIVE_TYPES in lib/workout-engine.ts), so the curated weekly lists
 * and the wide accessory pool that this file was written about build nothing at
 * all. Three kinds of assertion have gone with them, and each is replaced by
 * the same promise asked of the builder that does run:
 *
 *   The wiring assertions read lib/workout-engine.ts for the spellings of
 *   `widePool`, `accessoryPool` and `MAIN_VARIATION_EVERY`. Those lines are in
 *   a generator nothing reaches, so they had become a test that reads code
 *   nobody runs - which is this repo's commonest defect, in the check rather
 *   than in the app. Section 1 measures the variation instead.
 *
 *   The coverage assertion asked that every pattern in the curated list turned
 *   up in the session. A library session's patterns are the library's own, and
 *   "every pattern the session asked for is in it or the gap is declared" is
 *   held by tests/train-library.check.mjs, where it belongs. What is asked here
 *   instead is the half that file does not cover: a Lower Body session may only
 *   contain lower body work, whatever the level or the kit.
 *
 *   The substitution assertions said a stand-in must share the movement
 *   pattern, the muscle family and enough supporting muscles. The library
 *   substitutes by walking the SAME pattern's pool down the level ladder, so
 *   same-pattern is structural rather than a rule that can drift, and section 2
 *   measures it on the cards themselves.
 *
 * The main exercise still has to stay put, and that IS asked of all three,
 * because it is the same promise about progression whoever built the session. A
 * library session alternates which pattern leads - squat, then hinge, then
 * squat - and steps along the pattern's pool every fourth session of its type,
 * so the same main comes back every other session and changes every fourth.
 * That is more faces over eight sessions than the old engine's one in four, and
 * still a main that repeats rather than one that is new every time.
 *
 * Run:  npx tsx tests/session-variety.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

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

const { generateWorkout, LIBRARY_LIVE_TYPES } = await import('../lib/workout-engine.ts');
const { CONDITIONING_EXERCISES, LIBRARY_EXERCISES, patternsOf } = await import(
  '../lib/exercise-library.ts'
);
const { tierOf } = await import('../lib/exercise-classification.ts');

/** Every record a session can serve, by the name that goes on the card. */
const recordByName = new Map();
for (const r of LIBRARY_EXERCISES) recordByName.set(r.name, r);
for (const r of CONDITIONING_EXERCISES) recordByName.set(r.name, r);

const TYPES = ['lower_body', 'upper_body', 'full_body'];
const LEVELS = ['beginner', 'intermediate', 'advanced', 'athlete'];
const TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
const TIMES = ['30', '45', '60'];

const gen = (type, tier, time, n, level = 'intermediate') =>
  generateWorkout(
    type,
    tier,
    { energy: 'normal', timeAvailable: time, hasAches: false },
    { name: 'A', sex: 'male', experienceLevel: level, goals: ['muscle'], bodyweightKg: 80 },
    {},
    undefined,
    n,
    undefined,
    undefined,
    undefined,
    0,
    { equipment: [tier], sessionTypeCount: n }
  );

check(
  `all three lifting sessions are built from the library (${LIBRARY_LIVE_TYPES.join(', ')})`,
  TYPES.every((t) => LIBRARY_LIVE_TYPES.includes(t)),
  'a type still on the old engine is not measured by anything in this file any more'
);

// ─── 1. Variety, session after session ───────────────────────────────────────
console.log('\n[1] The work moves between sessions, and the main exercise does not');

/**
 * THE BAR WAS IN THE WRONG PLACE, AND A MUTATION RUN FOUND IT.
 *
 * This used to ask for six distinct accessories across eight sessions, which
 * sounds like a variety rule and is not one: a single Full Body session already
 * holds five, so almost any behaviour clears it. Freezing the pool walk outright
 * - SLOT_ROTATION_EVERY in lib/library-session.ts from 3 to 1000, so every slot
 * takes the first record of its pool for ever - left it green at six and seven.
 * The bar was sitting exactly on the failure.
 *
 * Two things fix it, and it takes both, because the library has two independent
 * sources of variety and either one alone would carry the other's weight:
 *
 *   THE UNION, measured against what ONE session holds. Frozen, the eight
 *     sessions between them hold barely more than one session does, because all
 *     that is left is the pattern order turning over. Measured: 15, 16 and 18
 *     across the three types against 4, 4 and 5 in a single session; frozen, 6,
 *     7 and 6. The bar is twice one session's worth, which is well above the
 *     mutant and well below the real thing.
 *
 *   THE SESSIONS THEMSELVES BEING DIFFERENT, which is the promise in the words
 *     somebody would use. Six of the eight accessory lists are distinct today
 *     and two are when the walk is frozen.
 */
for (const type of TYPES) {
  const accessories = new Set();
  const mainCounts = new Map();
  const lists = new Set();
  let biggestSession = 0;
  for (let n = 0; n < 8; n++) {
    const w = gen(type, 'fullgym', '60', n);
    const names = w.filter((e) => e.category === 'accessory').map((e) => e.name);
    names.forEach((name) => accessories.add(name));
    biggestSession = Math.max(biggestSession, new Set(names).size);
    lists.add([...names].sort().join('|'));
    w.filter((e) => e.category === 'main').forEach((e) => {
      mainCounts.set(e.name, (mainCounts.get(e.name) ?? 0) + 1);
    });
  }
  check(
    `${type}: 8 sessions hold far more accessories than one does (${accessories.size} across 8, ${biggestSession} in the fullest single session)`,
    biggestSession > 0 && accessories.size >= biggestSession * 2,
    `${accessories.size} distinct across 8 sessions when one session alone holds ${biggestSession} — the pool is not being walked`
  );
  check(
    `${type}: and the sessions are not the same session twice (${lists.size} distinct accessory lists of 8)`,
    lists.size >= 4,
    `only ${lists.size} of 8 differ — somebody training twice a week gets the identical work`
  );
  /**
   * A main that is never repeated is a main nobody can progress. The library
   * alternates two patterns and steps each pool every fourth session, so eight
   * sessions show at most four mains and every one of them comes round again.
   */
  const onceOnly = [...mainCounts].filter(([, n]) => n < 2).map(([name]) => name);
  check(
    `${type}: the main exercise stays put (${mainCounts.size} distinct across 8)`,
    mainCounts.size >= 1 && mainCounts.size <= 4 && onceOnly.length === 0,
    onceOnly.length > 0
      ? `never repeated: ${onceOnly.join(', ')} — progression needs the same movement more than once`
      : `${mainCounts.size} distinct mains — progression needs the same movement most weeks`
  );
}

// ─── 2. Coherence, swept over every level, kit and length ────────────────────
console.log('\n[2] And the session is still the session it is called');

/**
 * The patterns each session is about, written here rather than read off
 * lib/library-session.ts.
 *
 * Deliberately a second opinion. Asking the builder which patterns a Lower Body
 * session may contain and then checking that it only used those is a question
 * that answers itself; this is the product promise stated independently, so a
 * pattern quietly joining a session type's list fails here.
 */
const PATTERNS_OF_TYPE = {
  lower_body: ['squat', 'hinge', 'lunge', 'core'],
  upper_body: ['push', 'pull', 'core'],
  full_body: ['squat', 'hinge', 'push', 'pull', 'core', 'lunge'],
};

const NOISE = new Set([
  'barbell',
  'dumbbell',
  'db',
  'kb',
  'kettlebell',
  'cable',
  'machine',
  'seated',
  'standing',
  'the',
  'with',
  'a',
]);
const tokens = (s) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/[\s-]+/)
      .filter((w) => w.length > 1 && !NOISE.has(w))
  );
const sameMovement = (x, y) => {
  const A = tokens(x);
  const B = tokens(y);
  const [s, l] = A.size <= B.size ? [A, B] : [B, A];
  return s.size >= 2
    ? [...s].every((w) => l.has(w))
    : s.size === l.size && [...s].every((w) => l.has(w));
};

/**
 * THE ONE PAIR THAT READS AS THE SAME MOVEMENT TWICE, PINNED EXACTLY.
 *
 * An Upper Body session asks for push, pull, core, push, pull, and at full gym
 * from Intermediate up the two press slots can land on the seated and the
 * standing dumbbell press in the same session. Archie's list holds them as two
 * exercises and they are two exercises, but a card reading "Seated Dumbbell
 * Press" above one reading "Standing Dumbbell Press" is the complaint this rule
 * exists for.
 *
 * Pinned in BOTH directions rather than tolerated: a new pair appearing fails
 * here, and this pair disappearing fails here too, so whoever fixes it has to
 * come back and say so. 3 of the 1,440 sessions swept.
 */
const KNOWN_REPEAT = ['Seated Dumbbell Press + Standing Dumbbell Press'];

const offPattern = [];
const repeats = new Map();
const isolationMains = [];
const weakMains = [];
let sessions = 0;
let workCards = 0;

for (const type of TYPES) {
  for (const level of LEVELS) {
    for (const tier of TIERS) {
      for (const time of TIMES) {
        for (let n = 0; n < 8; n++) {
          const w = gen(type, tier, time, n, level);
          sessions++;
          const work = w.filter((e) => e.category === 'main' || e.category === 'accessory');
          workCards += work.length;
          const where = `${type}/${level}/${tier}/${time}#${n}`;

          for (const e of work) {
            const record = recordByName.get(e.name);
            if (!record) {
              offPattern.push(`${where}: ${e.name} is not a library record at all`);
              continue;
            }
            if (!patternsOf(record).some((p) => PATTERNS_OF_TYPE[type].includes(p))) {
              offPattern.push(`${where}: ${e.name} is ${patternsOf(record).join('/')} work`);
            }
          }

          const names = work.map((e) => e.name);
          for (let i = 0; i < names.length; i++) {
            for (let j = i + 1; j < names.length; j++) {
              if (!sameMovement(names[i], names[j])) continue;
              const pair = [names[i], names[j]].sort().join(' + ');
              repeats.set(pair, (repeats.get(pair) ?? 0) + 1);
            }
          }

          const main = w.find((e) => e.category === 'main');
          const mainRecord = main ? recordByName.get(main.name) : undefined;
          if (mainRecord && tierOf(mainRecord) === 'isolation') {
            isolationMains.push(`${where}: ${main.name}`);
          }
          if (mainRecord && tierOf(mainRecord) !== 'primary_compound') {
            weakMains.push(`${type}/${level}/${tier}: ${main.name}`);
          }
        }
      }
    }
  }
}

check(
  `the sweep really built sessions (${sessions} sessions, ${workCards} pieces of work)`,
  sessions > 1000 && workCards > 3000,
  'nothing was generated, so everything below proves nothing'
);

check(
  'a session only ever contains work the session is about',
  offPattern.length === 0,
  `${offPattern.length}: ${[...new Set(offPattern)].slice(0, 3).join(' | ')}`
);

const newRepeats = [...repeats.keys()].filter((p) => !KNOWN_REPEAT.includes(p));
const goneRepeats = KNOWN_REPEAT.filter((p) => !repeats.has(p));
check(
  `nothing appears twice in a session except the pair that is written down (${repeats.size} pair(s))`,
  newRepeats.length === 0 && goneRepeats.length === 0,
  newRepeats.length > 0
    ? `new: ${newRepeats.join(' | ')}`
    : `fixed, so take it out of KNOWN_REPEAT: ${goneRepeats.join(' | ')}`
);

check(
  'no isolation movement ever leads a session',
  isolationMains.length === 0,
  [...new Set(isolationMains)].slice(0, 4).join(' | ')
);

/**
 * AND ALMOST NONE OF THEM IS SUPPORT WORK EITHER, with the exception named.
 *
 * `tierOf` calls a Banded Serratus Punch support work because it is aimed at a
 * stabiliser, and it is right. It is the only record in Archie's list that ever
 * leads a session: a Beginner whose only kit is bands has one press, one pull
 * and that punch to choose from, and on two of the eight rotations the walk
 * lands on it. Pinned rather than tolerated, in both directions, so a second
 * one appearing fails here and this one going away has to be noticed.
 */
const KNOWN_WEAK_MAIN = 'upper_body/beginner/bands: Banded Serratus Punch';
const unexpectedWeak = [...new Set(weakMains)].filter((m) => m !== KNOWN_WEAK_MAIN);
check(
  `and the exercise that leads a session is a compound one, bar the case written down (${new Set(weakMains).size})`,
  unexpectedWeak.length === 0 && weakMains.includes(KNOWN_WEAK_MAIN),
  unexpectedWeak.length > 0
    ? `${unexpectedWeak.slice(0, 4).join(' | ')}`
    : `${KNOWN_WEAK_MAIN} no longer happens, so take it out of KNOWN_WEAK_MAIN`
);

console.log('');
if (failures > 0) {
  console.error(`session-variety: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`session-variety: all ${total} checks passed\n`);
  process.exitCode = 0;
}
