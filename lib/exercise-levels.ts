/**
 * HOW HARD A MOVEMENT IS, on a five rung ladder, per pattern.
 *
 * WHAT THIS IS FOR
 * ────────────────
 * The app has always known how HEAVY to make something: the load comes from
 * what you lifted last time. It has never known how HARD the movement itself is.
 * Those are different axes and the second one is the one a coach actually uses.
 * Somebody who cannot hinge without rounding does not need a lighter deadlift,
 * they need a wall-touch hinge. Somebody doing dumbbell Romanian deadlifts
 * comfortably does not need more dumbbell reps, they need a barbell.
 *
 * The lists below are Archie's, from PROGRESSION-LADDERS.md, and they are the
 * specification rather than an illustration of it: tests/exercise-levels.check
 * asserts that every named movement comes back at the level he put it on. When
 * the classifier and the physiotherapist disagree, the classifier is wrong.
 *
 * WHAT IS NOT ON A LADDER, AND WHY THAT IS NOT AN OVERSIGHT
 * ────────────────────────────────────────────────────────
 * levelOf returns null for conditioning, rehabilitation, mobility, isometric and
 * rotation work, which is 412 of the 689 pickable templates. Those are not
 * easier or harder versions of each other: a Pallof Press is not a rung below a
 * deadlift, and an Assault Bike interval is not a rung above one. Giving them a
 * number would let the rest of the app compare things that do not compare, and
 * the first thing that would fall out of it is a beginner's rehab drill being
 * withheld for being "level 4".
 *
 * NULL IS NOT ZERO AND IT IS NOT ONE. Callers filter on the ceiling only where
 * a level exists; unlevelled work passes through untouched.
 *
 * NO REACT AND NO REACT NATIVE IMPORT, so the contract test can run this.
 */

export type ExerciseLevel = 1 | 2 | 3 | 4 | 5;

/** The six patterns the ladders cover. Everything else is deliberately absent. */
export type LadderPattern = 'hinge' | 'squat' | 'lunge' | 'push' | 'pull' | 'carry';

export const LADDER_PATTERNS: LadderPattern[] = [
  'hinge',
  'squat',
  'lunge',
  'push',
  'pull',
  'carry',
];

export function isLadderPattern(p?: string): p is LadderPattern {
  return !!p && (LADDER_PATTERNS as string[]).includes(p);
}

/** What each rung is called, for anywhere that shows one to a user. */
export const LEVEL_NAMES: Record<ExerciseLevel, string> = {
  1: 'Foundations',
  2: 'Loaded',
  3: 'Full range',
  4: 'Range and asymmetry',
  5: 'Elite',
};

/**
 * A rung: the level, and how a movement's name says it belongs on it.
 *
 * ORDER IS LOAD-BEARING. Rungs are tested from level 5 downwards, so the most
 * specific claim wins: "Single-Arm Overhead Barbell Walking Lunge" contains
 * "walking lunge" and must not come back as the level 2 exercise of that name.
 * That is also the rule for writing a new one - a rung that would match a
 * simpler movement's name belongs lower down or needs tightening, and the
 * contract test catches the ones that do not.
 */
interface Rung {
  level: ExerciseLevel;
  match: RegExp;
  /**
   * An exception carved out of `match`, for the rungs whose natural wording
   * swallows a movement that belongs somewhere else.
   *
   * Two of them earn their place, both found by printing what the classifier
   * actually produced rather than by reading it:
   *
   *   A Romanian deadlift IS a deadlift by name and is level 2 on the ladder,
   *   while the conventional pull is level 3. Without the exception every RDL in
   *   the catalogue was promoted a rung.
   *
   *   "Towel Row (Door Handle)" is the bodyweight row a beginner does in a
   *   doorway. The level 4 rung is about towel-gripped PULL-UPS, and it was
   *   catching the easiest pull in the app and calling it advanced.
   */
  unless?: RegExp;
}

/**
 * The ladders themselves, high to low.
 *
 * Written as patterns rather than exact names because the catalogue and the
 * physiotherapist's lists do not use identical wording, and because one entry
 * frequently covers several catalogue rows: "weighted dips or push-ups" is one
 * rung and four exercises.
 */
const LADDER: Record<LadderPattern, Rung[]> = {
  hinge: [
    { level: 5, match: /\breeves\b|\bjefferson\b|suitcase deadlift|snatch[- ]grip.*deficit/i },
    {
      level: 4,
      match:
        /deficit deadlift|stiff[- ]leg|single[- ]leg (barbell|bb) (rdl|romanian)|(band|chain)[- ]resisted deadlift|pause deadlift|deadlift.*(pause|chain|band)|power clean|hang clean|\bsnatch\b|clean (and|&) (jerk|press)/i,
    },
    // The one RDL the ladder puts at level 3, matched before the exception
    // below can send every RDL down to level 2.
    { level: 3, match: /single[- ]leg.{0,12}(rdl|romanian)|split[- ]stance.{0,12}romanian/i },
    {
      level: 3,
      // A Romanian deadlift is a deadlift by name and a rung lower on the
      // ladder. Without `unless`, every RDL in the catalogue was promoted.
      match:
        /trap bar (deadlift|low)|sumo deadlift|conventional deadlift|barbell deadlift|\bdeadlift\b|barbell good morning/i,
      // A trap bar pulled from the HIGH handles is the level 2 entry; the low
      // handles are level 3. One rung could not tell them apart.
      unless: /romanian|\brdl\b|stiff[- ]leg|rack pull|high handles/i,
    },
    {
      level: 2,
      match:
        /(kettlebell|kb|dumbbell|db) (rdl|romanian)|romanian deadlift|\brdl\b|rack pull|trap bar|kettlebell swing|\bkb swing\b|hip thrust|\bswing\b/i,
    },
    {
      level: 1,
      match:
        /wall[- ]touch|dowel|glute bridge|banded good morning|bodyweight good morning|bodyweight hip hinge|single[- ]leg (bodyweight )?hinge|hip hinge|back extension|good morning|leg curl|nordic/i,
    },
  ],
  squat: [
    { level: 5, match: /pistol squat|zercher deficit|supramaximal/i },
    {
      level: 4,
      match:
        /heels?[- ]elevated|anderson squat|pause squat|overhead squat|skater squat|barbell bulgarian|\bbb bulgarian\b|tempo squat/i,
    },
    {
      level: 3,
      match:
        /front squat|high[- ]bar|low[- ]bar|back squat|safety squat|hack squat|(db|dumbbell) bulgarian|belt squat|sissy squat/i,
      // Racked on the shoulders is level 3; held out in front of you is level 2,
      // and goblet, landmine, Zercher and dual-dumbbell are all the second thing.
      unless: /dual (dumbbell|db)|goblet|landmine|zercher/i,
    },
    // Jumping is a power demand rather than a squat rung, and the ladders do not
    // list it. Level 3 is the honest placement: not beginner work, not the
    // asymmetry rung either. The step-down and seated variants ARE the
    // regressions of it, so they sit a rung lower.
    { level: 3, match: /\bjump\b|\bplyo/i, unless: /step[- ]down|\bseated\b|\bpogo\b/i },
    {
      level: 2,
      match:
        /goblet squat|dual dumbbell front|zercher squat|landmine squat|box squat|leg press|split squat|cossack|wall sit|step[- ]up|jump.{0,14}step[- ]down|seated.{0,10}jump/i,
    },
    {
      level: 1,
      match:
        /sit[- ]to[- ]stand|assisted (bodyweight )?squat|air squat|plate[- ]reach|counterbalance|goblet squat to box|bodyweight squat|squat to box|chair squat/i,
    },
  ],
  lunge: [
    {
      level: 5,
      match:
        /(barbell|bb|single[- ]arm).{0,24}overhead walking lunge|zercher deficit walking|weighted plyometric lunge/i,
    },
    {
      level: 4,
      match:
        /suitcase lunge|offset lunge|front[- ]rack walking|jumping split squat|split squat jump|overhead walking lunge|lunge drive|jump lunge/i,
    },
    {
      level: 3,
      match:
        /(db|dumbbell) walking lunge|(barbell|bb) (reverse|forward|walking) lunge|deficit reverse lunge|clock lunge|barbell bulgarian/i,
    },
    {
      level: 2,
      match:
        /forward lunge|goblet split squat|(db|dumbbell) (reverse|lateral|step)|walking lunge|elevated front[- ]foot|bulgarian split squat|step[- ]up/i,
    },
    {
      level: 1,
      match:
        /assisted (static )?split squat|(bodyweight )?static split squat|reverse lunge|lateral lunge|curtsy lunge|split squat/i,
    },
  ],
  push: [
    {
      level: 5,
      match:
        /handstand push[- ]?up|single[- ]arm (barbell|bb) floor press|bottom[- ]up (kettlebell|kb) press/i,
    },
    {
      level: 4,
      match:
        /weighted (dip|push[- ]?up)|single[- ]arm overhead press|ring (push[- ]?up|dip)|pin bench|pause bench|bench.{0,12}(chain|band)|archer push/i,
    },
    {
      level: 3,
      match:
        /incline (barbell |db |dumbbell )?(bench|press)|deficit push[- ]?up|(parallel bar )?\bdip\b|decline push[- ]?up|push press|close[- ]grip bench|landmine press/i,
    },
    {
      level: 2,
      match:
        /(standard )?push[- ]?up|(db|dumbbell) (flat )?bench|standing (db|dumbbell) (overhead|shoulder) press|barbell bench|standing (barbell|bb) (overhead|shoulder) press|overhead press|shoulder press|chest press|\bfly\b|lateral raise|tricep/i,
      // The plain push-up is level 2. Every named variation of it sits on
      // another rung, and the bare word was matching all of them first.
      unless:
        /\bwall\b|\bincline\b|\bkneeling\b|\bdeficit\b|\bdecline\b|\bring\b|\bweighted\b|\barcher\b|handstand|floor press/i,
    },
    {
      level: 1,
      match:
        /wall push[- ]?up|incline push[- ]?up|seated (overhead )?(db|dumbbell) press|kneeling push[- ]?up|(db|dumbbell) floor press|band chest press|scapular push/i,
    },
  ],
  pull: [
    {
      level: 5,
      match: /archer pull[- ]?up|muscle[- ]?up|single[- ]arm inverted|one[- ]arm (pull|pulldown)/i,
    },
    {
      level: 4,
      // PULL-UPS, not rows. "Towel Row (Door Handle)" is the bodyweight row a
      // beginner does in a doorway, and the loose version of this rung was
      // catching the easiest pull in the app and calling it advanced.
      match:
        /weighted (pull|chin)[- ]?up|ring (pull[- ]?up|row)|unsupported single[- ]arm row|chest[- ]to[- ]bar|(towel|thick[- ]grip|fat grip) (pull[- ]?up|chin[- ]?up)/i,
    },
    {
      level: 3,
      match:
        /strict (chin|pull)[- ]?up|\bchin[- ]?up\b|\bpull[- ]?up\b|meadows row|feet[- ]elevated inverted|kipping/i,
      // A scapular pull-up is a level 1 hang and a band-assisted one is level 2.
      // Both are pull-ups by name, and both came back as the strict one.
      unless:
        /scapular|assisted|weighted|\bring\b|archer|chest[- ]to[- ]bar|muscle[- ]?up|thick[- ]grip|towel/i,
    },
    {
      level: 2,
      match:
        /low[- ]incline inverted|single[- ]arm (db|dumbbell) row|band[- ]assisted pull|seated cable row|bent[- ]over (barbell|bb) row|barbell row|\bcable row\b|\bcurl\b|face pull|rear delt|shrug|single[- ]arm.{0,20}(towel|inverted) row/i,
    },
    {
      level: 1,
      match:
        /doorframe|high[- ]incline inverted|lat pulldown|band pulldown|chest[- ]supported|scapular (pull|retraction)|towel row|banded pull[- ]apart|band pull[- ]apart|inverted row/i,
    },
  ],
  carry: [
    { level: 5, match: /(?!)/ },
    { level: 4, match: /(?!)/ },
    { level: 3, match: /single[- ]arm front[- ]rack|waiter'?s walk|cross[- ]body|mixed[- ]rack/i },
    {
      level: 2,
      match:
        /suitcase carry|front[- ]rack (kettlebell|kb) carry|uneven|sandbag|heavy trap bar|farmers carry \(heavy\)/i,
    },
    {
      level: 1,
      match:
        /trap bar carry|farmer'?s? (carry|hold|walk)|goblet carry|hug carry|plate pinch|farmer'?s hold march|\bcarry\b|\bhold\b/i,
    },
  ],
};

/**
 * When nothing on the ladder matches, the kit decides.
 *
 * Every ladder in PROGRESSION-LADDERS.md climbs through the same three stages -
 * bodyweight and supported, then a dumbbell or kettlebell, then a barbell - so
 * a movement nobody wrote a rung for is placed by the same reasoning rather than
 * by a guess. It is deliberately the LOW end of each stage: a movement the app
 * cannot recognise is one it should not be calling advanced.
 */
const KIT_LEVEL: { match: RegExp; level: ExerciseLevel }[] = [
  { match: /barbell|trap bar|smith|landmine|ez[- ]bar/i, level: 3 },
  { match: /dumbbell|\bdb\b|kettlebell|\bkb\b|cable|machine|plate/i, level: 2 },
  { match: /band|bodyweight/i, level: 1 },
];

/**
 * Markers that move a movement UP a rung, and ONLY where the ladder was silent.
 *
 * Straight out of the ladders: level 4 on every one of them is the range and
 * asymmetry rung, and these are the words it is written in.
 *
 * THE "ONLY WHERE THE LADDER WAS SILENT" PART IS THE WHOLE RULE, and it was
 * learned by printing the output. Applied unconditionally, these modifiers
 * overruled the physiotherapist three times in the first run: a Deficit Push-Up
 * is level 3 on his list and came back 4; Weighted Dips are level 4 and came
 * back 5; a single-leg bodyweight hinge is level 1 and came back 2. Every one of
 * those is the heuristic double-counting a demand the ladder had already priced
 * in. Where he has named a movement, his number stands.
 */
const HARDER = /\bdeficit\b|\bpause[ds]?\b|\btempo\b|\bweighted\b|\bring\b|\barcher\b|\bsingle[- ](arm|leg)\b|\bone[- ](arm|leg)\b|\boverhead\b|\bchain/i;

/** And markers that hold it down, which beat the ones above. */
const EASIER = /\bassisted\b|\bsupported\b|\bwall\b|\bkneeling\b|\bseated\b|\bbox\b|\bincline\b|\bisometric\b|\bhold\b|\bbanded?\b/i;

const clamp = (n: number): ExerciseLevel =>
  (n < 1 ? 1 : n > 5 ? 5 : n) as ExerciseLevel;

const cache = new Map<string, ExerciseLevel | null>();

/**
 * The rung a movement sits on, or null when it is not on a ladder at all.
 *
 * `pattern` is the template's own movementPattern. It decides WHICH ladder is
 * read, which is what stops "Farmers Carry" being read against the pull ladder
 * for containing the word row, and it is why a template with no pattern gets
 * null rather than a guess.
 */
export function levelOf(name: string, pattern?: string): ExerciseLevel | null {
  if (!isLadderPattern(pattern)) return null;
  const key = `${pattern}::${name.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  let level: ExerciseLevel | null = null;
  for (const rung of LADDER[pattern]) {
    if (rung.match.test(name) && !(rung.unless && rung.unless.test(name))) {
      level = rung.level;
      break;
    }
  }

  if (level === null) {
    for (const k of KIT_LEVEL) {
      if (k.match.test(name)) {
        level = k.level;
        break;
      }
    }
    if (level === null) level = 2;

    // The two modifiers, in the order that makes "Assisted Single-Leg X" easy
    // rather than hard: a movement that says it is supported IS supported,
    // whatever else its name claims. Inside this branch on purpose - see HARDER.
    if (EASIER.test(name)) level = clamp(level - 1);
    else if (HARDER.test(name)) level = clamp(level + 1);
  }

  cache.set(key, level);
  return level;
}

// ─── What each difficulty draws from ────────────────────────────────────────

/**
 * The band of rungs a programme of each difficulty is built from.
 *
 * OVERLAPPING, not partitioned, which is how Archie put it: "level 1 exercises
 * would fit into beginner, novice, 2 overlapping into novice etc".
 *
 * TWO NUMBERS, DOING TWO DIFFERENT JOBS.
 *
 *   `max` is a CEILING and it is enforced. Nothing above it is ever prescribed,
 *   which is what makes a difficulty label mean something rather than describe
 *   something. Beginner and Novice both stop at 2, which is the earn-the-barbell
 *   rule of PROGRESSION-LADDERS.md stated as a band: level 3 is where the
 *   barbell starts on every one of the six ladders.
 *
 *   `prefer` is the rung the programme is BUILT ON, and it is a sort key rather
 *   than a filter. Filtering the bottom out would delete the warm-up from an
 *   Elite programme, and a wall-touch hinge is a warm-up at every level there
 *   is. It is also the only thing separating Beginner from Novice, which share
 *   a ceiling on purpose - see below.
 *
 * WHY BEGINNER IS NOT "LEVEL 1 ONLY", WHICH IS WHAT IT WAS FIRST WRITTEN AS.
 * Measured across the catalogue: one squat sits at level 1. A level-1-only
 * ceiling would serve a Bodyweight Squat and nothing else, every squat session,
 * forever. The five level-2 squats a beginner should be doing - goblet, box,
 * split squat, leg press - are on the right side of the barbell line and the
 * wrong side of a level-1 ceiling. So Beginner prefers 1 and is allowed 2. The
 * fix for a genuinely level-1-only beginner block is more level 1 exercises in
 * the catalogue, which is Archie's to write, not a filter's to fake.
 */
export interface LevelBand {
  /** The rung the programme is built on. A preference, never a filter. */
  prefer: ExerciseLevel;
  /** The hardest rung it may ever prescribe. Enforced. */
  max: ExerciseLevel;
}

const BANDS: Record<string, LevelBand> = {
  Beginner: { prefer: 1, max: 2 },
  Novice: { prefer: 2, max: 2 },
  Intermediate: { prefer: 2, max: 3 },
  Advanced: { prefer: 3, max: 4 },
  Expert: { prefer: 4, max: 5 },
  Elite: { prefer: 5, max: 5 },
};

export function levelBandFor(difficulty: string): LevelBand {
  return BANDS[difficulty] ?? BANDS.Intermediate;
}

/** How the band reads on a certificate. "Level 1 to 2 work", or "Level 5 work". */
export function bandLabel(band: LevelBand): string {
  return band.prefer === band.max
    ? `Level ${band.max} work`
    : `Level ${band.prefer} to ${band.max} work`;
}

/**
 * Candidates ordered by how close they are to the rung this band is built on.
 *
 * Stable: equal-distance candidates keep the order they arrived in, which is
 * already seeded so the same session regenerates the same way. Without that,
 * levelling would silently undo the accessory rotation.
 */
export function byLevelPreference<T>(
  items: T[],
  band: LevelBand,
  read: (item: T) => { name: string; movementPattern?: string }
): T[] {
  return items
    .map((item, i) => {
      const t = read(item);
      const level = levelOf(t.name, t.movementPattern);
      // Unlevelled work sorts as if it were exactly right, because it is not on
      // this ladder and has no business being pushed down it.
      return { item, i, distance: level === null ? 0 : Math.abs(level - band.prefer) };
    })
    .sort((a, b) => a.distance - b.distance || a.i - b.i)
    .map((x) => x.item);
}

/**
 * May this movement be prescribed to somebody working at this ceiling?
 *
 * Unlevelled work always may. See the docblock at the top: a rehab drill and a
 * conditioning round are not rungs, and withholding one for being "too advanced"
 * would be the filter inventing a rule nobody wrote.
 */
export function withinLevel(name: string, pattern: string | undefined, ceiling: ExerciseLevel): boolean {
  const level = levelOf(name, pattern);
  return level === null || level <= ceiling;
}
