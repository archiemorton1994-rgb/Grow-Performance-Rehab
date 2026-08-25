/**
 * What makes two exercises alternatives for each other.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The swap button offered up to two stand-ins and never said what either one
 * was FOR. Both came out of a single ranking, so on a good day you were shown
 * two versions of the same idea, and on a bad day two things that had nothing
 * in common except a muscle. The user has two genuinely different reasons for
 * tapping it, and the sheet answered neither of them:
 *
 *   "The cable station is taken."     - I want THIS movement, other kit.
 *   "My shoulder has had enough."     - I want other work, SAME muscles.
 *
 * So the two slots now mean something. Slot one is the same movement with
 * different equipment; slot two is a different movement over the same muscle
 * group. The sheet labels each one, because an alternative you cannot tell
 * apart from the other one is not a choice.
 *
 * WHY THE NAME BEATS THE EQUIPMENT FIELD
 * ──────────────────────────────────────
 * `equipmentRequired` looks like the obvious source and is not. Measured across
 * the 689 pickable exercises, 51 of them disagree with their own name: Cable
 * Bicep Curl is tagged 'barbell', Landmine Press is tagged 'cable machine',
 * every Banded * is tagged 'bodyweight', every Sled * is tagged 'barbell'. The
 * field has been filled in as "which tier do you need for this" rather than
 * "what do you pick up", which is a perfectly reasonable thing for it to mean
 * and the wrong answer to this question.
 *
 * The name is written for the user and says the tool. So the name leads, the
 * field is the fallback, and 'full gym' is treated as unknown rather than as a
 * piece of equipment - nobody picks up a full gym.
 *
 * Pure data and pure functions, no react-native import, so the contract test
 * can call it rather than read it.
 */

/** Which of the user's two reasons this alternative answers. */
export type SwapKind = 'equipment' | 'movement';

/**
 * Kit words as they appear in exercise NAMES, mapped to what the user picks up.
 *
 * Order matters: the first match wins, so the specific bars come before the
 * bare 'barbell', and 'med ball' before 'ball'. A trap bar, a landmine and a
 * Smith machine are all filed as barbell because to somebody standing in a gym
 * deciding what is free, they are the same answer.
 *
 * Deliberately NOT here: bench, box, bar on its own, step, wall. Those change
 * the movement rather than the tool, and stripping them turned Landmine Press
 * into an alternative for Barbell Bench Press.
 */
const KIT_FROM_NAME: [RegExp, string][] = [
  [/\bsmith\b/, 'barbell'],
  [/\blandmine\b/, 'barbell'],
  [/\btrap bar\b|\bhex bar\b/, 'barbell'],
  [/\bez bar\b|\bsafety bar\b/, 'barbell'],
  [/\bbarbell\b/, 'barbell'],
  [/\bdumbbells?\b|\bdb\b/, 'dumbbells'],
  [/\bkettlebells?\b|\bkb\b/, 'kettlebell'],
  [/\bcables?\b/, 'cable machine'],
  [/\bbanded\b|\bresistance bands?\b|\bband\b/, 'resistance band'],
  [/\bmachine\b/, 'machine'],
  [/\btrx\b|\bsuspension\b|\brings?\b/, 'suspension trainer'],
  [/\bsled\b/, 'sled'],
  [/\bsandbag\b/, 'sandbag'],
  [/\b(medicine|med|slam) ball\b/, 'medicine ball'],
  [/\bab wheel\b/, 'ab wheel'],
  [/\b(stability|swiss) ball\b/, 'stability ball'],
  [/\bfoam roller\b/, 'foam roller'],
  [/\btowel\b/, 'towel'],
  [/\bweighted\b/, 'added weight'],
  [/\bbodyweight\b/, 'bodyweight'],
];

/**
 * The same words, for stripping out of a name to leave the movement behind.
 *
 * 'Banded Pallof Press' and 'Pallof Press' both reduce to 'pallof press', which
 * is the whole trick: two rows in the catalogue that are the same movement with
 * different kit have the same remainder and nothing else does.
 */
const KIT_WORDS = [
  'barbell',
  'dumbbell',
  'dumbbells',
  'db',
  'kettlebell',
  'kb',
  'cable',
  'cables',
  'band',
  'banded',
  'machine',
  'smith',
  'landmine',
  'trap bar',
  'hex bar',
  'ez bar',
  'safety bar',
  'bodyweight',
  'weighted',
  'sled',
  'trx',
  'suspension',
  'ring',
  'rings',
  'sandbag',
  'medicine ball',
  'med ball',
  'slam ball',
  'resistance band',
  'resistance bands',
  'towel',
  'foam roller',
  'ab wheel',
  'stability ball',
  'swiss ball',
  'plate',
];

/** Longest first, so 'medicine ball' is removed before 'ball' can be. */
const KIT_WORDS_BY_LENGTH = [...KIT_WORDS].sort((a, b) => b.length - a.length);

/** Plurals that would otherwise split one movement into two. */
const SINGULAR: Record<string, string> = {
  ups: 'up',
  downs: 'down',
  rows: 'row',
  presses: 'press',
  curls: 'curl',
  raises: 'raise',
  squats: 'squat',
  lunges: 'lunge',
  swings: 'swing',
};

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-/]/g, ' ')
    .replace(/[^a-z0-9() ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * An exercise name with the equipment taken out of it.
 *
 * Parentheses are KEPT. '(Isometric Hold)' and '(light)' are variations of the
 * movement, not of the kit, and collapsing them made Pallof Press (Isometric
 * Hold) an "equipment variant" of Pallof Press - same tool, different exercise,
 * exactly the confusion this is meant to remove.
 */
const coreCache = new Map<string, string>();

export function movementCoreOf(name: string): string {
  const hit = coreCache.get(name);
  if (hit !== undefined) return hit;
  const value = computeMovementCore(name);
  coreCache.set(name, value);
  return value;
}

/** Memoised above. Every candidate in the catalogue is compared against every
 *  exercise in the session, so the same few hundred names are normalised over
 *  and over. */
function computeMovementCore(name: string): string {
  let padded = ` ${normaliseName(name)} `;
  for (const word of KIT_WORDS_BY_LENGTH) {
    padded = padded.split(` ${word} `).join(' ');
  }
  const core = padded.replace(/\s+/g, ' ').trim();
  return core.replace(/\b(ups|downs|rows|presses|curls|raises|squats|lunges|swings)\b/g, (m) =>
    SINGULAR[m] != null ? SINGULAR[m] : m
  );
}

/** The movement itself, which in an exercise name is almost always the last
 *  word: Squat, Press, Row, Curl, Deadlift, Raise. */
export function movementNounOf(name: string): string {
  const core = movementCoreOf(name)
    .replace(/\(.*?\)/g, '')
    .trim();
  const words = core.split(' ').filter(Boolean);
  return words.length > 0 ? words[words.length - 1] : '';
}

/** Values of `equipmentRequired` that describe a tier rather than a tool, and
 *  so answer "what do you pick up" with nothing. */
const TIER_NOT_TOOL = new Set(['full gym', 'fullgym', '']);

const KIT_FROM_FIELD: Record<string, string> = {
  'resistance bands': 'resistance band',
  bands: 'resistance band',
};

/**
 * What the user actually picks up, or null if the catalogue does not say.
 *
 * Name first - see the header. Null is a real answer and callers must respect
 * it: offering "the same movement with different kit" without knowing either
 * kit is a promise the app cannot keep.
 */
const kitCache = new Map<string, string | null>();

export function kitOf(name: string, equipmentRequired?: string): string | null {
  const key = `${name}|${equipmentRequired ?? ''}`;
  const hit = kitCache.get(key);
  if (hit !== undefined) return hit;
  const value = computeKit(name, equipmentRequired);
  kitCache.set(key, value);
  return value;
}

/** Memoised above, for the same reason movementCoreOf is. */
function computeKit(name: string, equipmentRequired?: string): string | null {
  const padded = ` ${normaliseName(name)} `;
  for (const [pattern, kit] of KIT_FROM_NAME) {
    if (pattern.test(padded)) return kit;
  }
  const field = (equipmentRequired ?? '').toLowerCase().trim();
  if (TIER_NOT_TOOL.has(field)) return null;
  return KIT_FROM_FIELD[field] ?? field;
}

/** How a piece of kit is written in a sentence. */
export function kitLabel(kit: string): string {
  if (kit === 'bodyweight') return 'no equipment';
  if (kit === 'added weight') return 'added weight';
  return kit;
}

export type MuscleGroup =
  | 'shoulders'
  | 'chest'
  | 'back'
  | 'lower_back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'hip_flexors'
  | 'calves'
  | 'core'
  | 'neck';

/**
 * `primaryMuscle` is free text and there are 54 distinct values of it, most of
 * which are the same muscle written more precisely: Anterior deltoid, Lateral
 * deltoid, Rear deltoid and Deltoids are four separate strings for one group.
 *
 * The old ranking compared those strings for equality, so a shoulder press and
 * a lateral raise were as unrelated to each other as a shoulder press and a
 * calf raise. Grouping them is what makes "different exercise, same muscles"
 * mean anything.
 *
 * Order matters where a value could match twice.
 */
const MUSCLE_GROUP_PATTERNS: [MuscleGroup, RegExp][] = [
  ['lower_back', /erector|thoracic extensor|lower back|spinal rotator|multifidus|quadratus/i],
  ['shoulders', /deltoid|\bdelts?\b|rotator cuff|infraspinatus|supraspinatus|serratus/i],
  ['chest', /pectoral|\bpecs?\b|chest/i],
  ['back', /latissimus|\blats?\b|rhomboid|mid back|trapezius|\btraps?\b|teres/i],
  ['biceps', /biceps|brachialis/i],
  ['triceps', /triceps/i],
  ['forearms', /forearm|grip|wrist|pronator/i],
  ['quads', /quadricep|\bquads?\b|vastus/i],
  ['hamstrings', /hamstring/i],
  ['glutes', /glute/i],
  ['adductors', /adductor/i],
  ['hip_flexors', /hip flexor|iliopsoas|psoas/i],
  ['calves', /calves|\bcalf\b|soleus|gastrocnemius|tibialis/i],
  ['core', /\bcore\b|abdomin|oblique|diaphragm/i],
  ['neck', /neck/i],
];

/** Plain names, for a sentence the user reads. */
export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  shoulders: 'shoulders',
  chest: 'chest',
  back: 'back',
  lower_back: 'lower back',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms and grip',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  adductors: 'adductors',
  hip_flexors: 'hip flexors',
  calves: 'calves',
  core: 'core',
  neck: 'neck',
};

/**
 * Null for 'Full body', 'Cardiovascular system', 'Hip external rotators',
 * 'Elbow joint' and anything left blank - 63 of the 689. Those are not a muscle
 * group and pretending otherwise would put a deadbug and a treadmill run in the
 * same bucket. Callers fall back to the old ranking rather than guessing.
 */
export function muscleGroupOf(primaryMuscle?: string): MuscleGroup | null {
  if (!primaryMuscle) return null;
  for (const [group, pattern] of MUSCLE_GROUP_PATTERNS) {
    if (pattern.test(primaryMuscle)) return group;
  }
  return null;
}

/** The shape both sides of a comparison need. Deliberately structural so this
 *  file does not have to import ExerciseTemplate or Exercise. */
export interface SwapCandidate {
  name: string;
  equipmentRequired?: string;
  movementPattern?: string;
  primaryMuscle?: string;
}

/**
 * Words that say how the lift is set up, not which exercise it is.
 *
 * The near rule needs one more constraint than "same pattern, same muscle, same
 * last word", because that lets everything ending in Squat match everything
 * else ending in Squat. It offered a SPANISH SQUAT - a band-loaded knee rehab
 * movement - as "the same exercise" as a barbell back squat, which is the exact
 * confusion the two-option split is meant to remove.
 *
 * The first eight describe where the bar sits. A back squat, a front squat and
 * a goblet squat are one movement with the weight held somewhere else, which is
 * precisely what "the rack is taken, give me a squat I can do" is asking for.
 *
 * The last four describe the position you are in rather than the exercise: a
 * standing calf raise and a calf raise, an overhead press and an alternating
 * dumbbell overhead press. Adding them found 24 more pairs across the catalogue
 * and not one wrong one, which is the test any addition here has to pass -
 * every word on this list is one that a physiotherapist would agree does not
 * change what you are doing.
 *
 * Spanish, Sissy, Bulgarian, Cossack, Pistol, Box and Wall are NOT on the list
 * because they name a different movement that happens to end in the same word.
 * Neither is Incline, Decline or Deficit: those change the exercise.
 *
 * The other way to qualify is for one of the two names to be the bare movement -
 * 'Squat', 'Deadlift', 'Row' with nothing but kit in front of it. A name that
 * reduces to one word IS the movement, so anything else of the same shape is a
 * version of it. (Push-Up does not qualify: its core is two words, and it finds
 * Weighted Push-Up through the exact rule instead.)
 */
const SETUP_ONLY = new Set([
  // where the bar sits
  'back',
  'front',
  'goblet',
  'overhead',
  'zercher',
  'hack',
  'sumo',
  'safety',
  // what position you are in
  'seated',
  'standing',
  'lying',
  'alternating',
]);

const wordsOf = (name: string) => movementCoreOf(name).split(' ').filter(Boolean);

/** Is the name nothing but the movement, once the kit is taken out? */
const isBareMovement = (name: string) => {
  const words = wordsOf(name);
  return words.length === 1 && words[0] === movementNounOf(name);
};

/** Do the two names differ only in how the lift is set up? */
function differsOnlyBySetup(a: string, b: string): boolean {
  const left = new Set(wordsOf(a));
  const right = new Set(wordsOf(b));
  const only = [...left]
    .filter((w) => !right.has(w))
    .concat([...right].filter((w) => !left.has(w)));
  return only.length > 0 && only.every((w) => SETUP_ONLY.has(w));
}

/**
 * Is `candidate` the same movement as `source`, done with different equipment?
 *
 * Two ways to qualify, and both need the kit to genuinely differ:
 *
 *   EXACT     the movement left behind after removing the kit words is the
 *             same string. Pallof Press / Banded Pallof Press, Push-Up /
 *             Weighted Push-Up. Unarguable, and it covers 11% of the
 *             catalogue on its own.
 *
 *   NEAR      same movement pattern, same primary muscle, the same movement
 *             noun, and either one of the names is the bare movement or the
 *             two differ only in where the weight is held. Back Squat /
 *             Goblet Squat. The catalogue names squat variations after the
 *             position of the bar rather than after the kit, so the exact rule
 *             cannot see them - and "the rack is taken, give me a squat I can
 *             do" is the single most useful swap in the app. Takes coverage
 *             to 16%.
 *
 * The bar-position clause is the whole difficulty. Without it, "same pattern,
 * same muscle, same last word" matched everything ending in Squat to everything
 * else ending in Squat, and a SPANISH SQUAT - a band-loaded knee rehab movement
 * - was offered as "the same exercise" as a barbell back squat. Coverage went
 * from 16% to 26% and the extra ten points were wrong.
 *
 * Everything else is a different exercise, and there is a slot for those.
 */
export function isEquipmentVariant(source: SwapCandidate, candidate: SwapCandidate): boolean {
  if (candidate.name === source.name) return false;
  const sourceKit = kitOf(source.name, source.equipmentRequired);
  const candidateKit = kitOf(candidate.name, candidate.equipmentRequired);
  if (!sourceKit || !candidateKit || sourceKit === candidateKit) return false;

  if (movementCoreOf(candidate.name) === movementCoreOf(source.name)) return true;

  const noun = movementNounOf(source.name);
  return (
    noun.length > 0 &&
    movementNounOf(candidate.name) === noun &&
    (isBareMovement(source.name) ||
      isBareMovement(candidate.name) ||
      differsOnlyBySetup(source.name, candidate.name)) &&
    !!source.movementPattern &&
    source.movementPattern === candidate.movementPattern &&
    !!source.primaryMuscle &&
    source.primaryMuscle === candidate.primaryMuscle
  );
}

/**
 * Is `candidate` a different movement that trains the same muscle group?
 *
 * The mirror image of the rule above, and the reason it is a separate question:
 * an alternative that satisfies both is an equipment variant, and belongs in
 * that slot rather than being offered twice.
 */
export function isSameMuscleAlternative(source: SwapCandidate, candidate: SwapCandidate): boolean {
  if (candidate.name === source.name) return false;
  const group = muscleGroupOf(source.primaryMuscle);
  if (!group) return false;
  if (muscleGroupOf(candidate.primaryMuscle) !== group) return false;
  if (movementCoreOf(candidate.name) === movementCoreOf(source.name)) return false;
  return !isEquipmentVariant(source, candidate);
}

/**
 * The one line under an alternative that says what it is for.
 *
 * Written to be read at arm's length between sets, so it names the thing that
 * changed and stops. `kit` is the alternative's own equipment, never a
 * before-and-after: the source's kit is the value most often wrong in the
 * catalogue, and a sentence is not worth being wrong for.
 */
export function swapReasonFor(
  kind: SwapKind,
  kit: string | null,
  group: MuscleGroup | null
): string {
  if (kind === 'equipment') {
    return kit
      ? `Same movement, ${kitLabel(kit)} instead.`
      : 'The same movement with different kit.';
  }
  return group
    ? `Different exercise, same ${MUSCLE_GROUP_LABELS[group]} work.`
    : 'A different exercise for the same job.';
}

/** Headings for the two choices. The sheet shows both at once, so they have to
 *  be tellable apart in one glance. */
export const SWAP_KIND_HEADINGS: Record<SwapKind, string> = {
  equipment: 'Same exercise, different kit',
  movement: 'Different exercise, same muscles',
};
