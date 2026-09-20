import type {
  EnergyLevel,
  EquipmentTier,
  ExperienceLevel,
  TimeAvailable,
  UserProfile,
  WeightUnit,
} from './store';
import type { ExerciseTemplate } from './exercise-db';
import { getCooldown, getStandalonePrehabWorkout, possibleFor } from './exercise-db';
import type { StressTag } from './exercise-safety';
import {
  SEVERE_SET_REDUCTION,
  restrictedTagsFor,
  restrictedTagsOn,
  restrictedTagsOnRecord,
} from './exercise-safety';
import type { KitKey, LibraryLevel } from './exercise-library';
import { CONDITIONING_EXERCISES, hasAuthoredContent } from './exercise-library';
import { canPerformWith } from './kit';
import type { LibraryReadiness } from './library-session';
import { kitSentence, levelCeilingFor } from './library-session';
import type { Exercise } from './workout-engine';
import {
  applyInjurySafety,
  easeForDeloadWeek,
  getEffectiveTier,
  templateToExercise,
} from './workout-engine';

/**
 * THE CONDITIONING SESSION, BUILT FROM ARCHIE'S NINE.
 *
 * NOTHING CALLS THIS YET. Like the strength builder next door it is written
 * beside the old engine and switched on in a later phase, so it can be read and
 * argued with before anybody's session changes.
 *
 * WHAT IT BUILDS, IN ORDER (plan section 1; decision 7)
 * ────────────────────────────────────────────────────
 *   1. Pulse raiser     an easy effort to get warm.
 *   2. Interval blocks  2 / 3 / 4 of them at 30 / 45 / 60 minutes.
 *   3. Cool-down        a Restore drill.
 *
 * THE NINE, AND NOTHING ELSE
 * ──────────────────────────
 * `CONDITIONING_EXERCISES` is the whole universe of work here: Sled Push, Sled
 * Pull (Archie's backwards drag), Sled Rows, Assault Bike, Incline Treadmill
 * Walk, Rowing Machine, Duck Walks, Skipping and Bear Crawl. Three of them need
 * nothing, which is what a home session is made of, and the other six are gym
 * kit. The only things from outside the nine are the Restore cool-down and the
 * Restore warm-up that stands in when the list is too short to spare one.
 *
 * WHY EVERY BLOCK IS A CLOCK AND NOT THE RECORD'S OWN DOSE
 * ───────────────────────────────────────────────────────
 * Each of the nine carries a written standalone dose, and those doses are not
 * comparable: 15 m of bear crawl against 500 m of rowing against 5 minutes of
 * treadmill walking. An interval block is one shape shared by every movement in
 * it - work this long, rest that long, this many times - so the dose here is the
 * clock, scaled by level and energy, and the authored distance stays what it is
 * for the strength session's pulse raiser and finisher.
 *
 * It also keeps a promise the plan makes in so many words: the nine get no
 * double progression. `parseReps` refuses a duration, so a block written as
 * "40s" can never start climbing.
 *
 * ONE EXERCISE PER CARD, WHICH IS STRONGER THAN "NOT TWICE IN A ROW"
 * ─────────────────────────────────────────────────────────────────
 * The brief asks that the same exercise never appears in two blocks running.
 * This goes one further and gives every card in the session a different
 * exercise, because the weaker rule cannot be implemented safely: two cards
 * built from one record carry ONE exercise id, and the session screen logs sets
 * against that id, so a home user's second Bear Crawl block would write its sets
 * on top of the first one's. Where the list is too short for the blocks the
 * clock asks for, the session is shorter and `notes` says so - see the floor
 * below.
 *
 * THE PER-KIT FLOOR, WHICH IS THE HONEST VERSION OF "FOUR BLOCKS"
 * ──────────────────────────────────────────────────────────────
 * Nine records, but only three of them need no equipment, and a beginner may
 * not be given the one that lands (decision 7). So the most a beginner at home
 * can be given is two blocks, and a beginner at home with a sore knee gets one.
 * That is a fact about the list rather than a bug, and the session states it
 * instead of padding itself out with something that is not conditioning.
 *
 * DETERMINISTIC, WITH NO DAY INDEX
 * ────────────────────────────────
 * Everything that varies varies on `sessionCount`, which is how many
 * conditioning sessions the person has finished. Nothing reads the clock, so
 * the same answers build the same session today, tomorrow and on the screen
 * that previews it.
 */

/** How many interval blocks the clock asks for. */
export const BLOCKS_BY_TIME: Record<TimeAvailable, number> = { '30': 2, '45': 3, '60': 4 };

/** One interval block, as numbers rather than as a sentence. */
export interface ConditioningInterval {
  /** How long one effort lasts. */
  workSeconds: number;
  /** How long the rest between efforts lasts. */
  restSeconds: number;
  /** How many efforts. */
  rounds: number;
}

/** A block of the session: which of the nine, and the interval it is worked at. */
export interface ConditioningBlock extends ConditioningInterval {
  /** The record's id, so a caller need not match on the name. */
  id: string;
  name: string;
}

export interface LibraryConditioningSession {
  exercises: Exercise[];
  /**
   * The interval blocks, in order, as numbers.
   *
   * Structured rather than only a sentence on a card, because "how long do I
   * work and how long do I rest" is the whole session and something has to be
   * able to ask it without reading English. The switch-on phase renders these;
   * nothing is smuggled into the load line in the meantime.
   */
  blocks: ConditioningBlock[];
  /** Honest lines about anything the session could not give. Usually empty. */
  notes: string[];
  /**
   * Set only when not one of the nine can be given today, in which case
   * `exercises` and `blocks` are both empty.
   *
   * A conditioning session with no conditioning in it would be the app
   * pretending. Saying so, and saying what would change it, is the honest
   * answer.
   */
  emptyState: string | null;
}

export interface LibraryConditioningInput {
  /** Everything they ticked, not the single best rung. See lib/kit.ts. */
  equipment: readonly EquipmentTier[];
  readiness: LibraryReadiness;
  profile?: UserProfile;
  /** Completed CONDITIONING sessions, all time. The only thing variety turns on. */
  sessionCount?: number;
  loadUnit?: WeightUnit;
}

/**
 * The interval each level is worked at, before energy is spent on it.
 *
 * Read down the columns rather than across: as the level rises the effort gets
 * longer, the rest gets shorter and the rounds go up, which are the three knobs
 * an interval has. A beginner's twenty seconds on and a full minute off is a
 * work-to-rest of one to three, which somebody unfit can repeat four times with
 * the last round still looking like the first; an athlete's forty-five on and
 * thirty off is one to two thirds.
 *
 * Keyed by the same effective level the strength builder uses as its ceiling,
 * so a rung earned by finishing a block counts here too.
 */
const LEVEL_INTERVAL: Record<LibraryLevel, ConditioningInterval> = {
  1: { workSeconds: 20, restSeconds: 60, rounds: 4 },
  2: { workSeconds: 30, restSeconds: 45, rounds: 5 },
  3: { workSeconds: 40, restSeconds: 40, rounds: 6 },
  4: { workSeconds: 45, restSeconds: 30, rounds: 6 },
};

/**
 * What today's energy answer is worth, as a change to each of the three.
 *
 * A low-energy day is not simply a shorter session, it is a gentler one, so the
 * effort comes down AND the rest goes up AND a round comes off. Answering "I am
 * flat today" with the same work and less of it would leave every single round
 * exactly as hard as it was.
 */
const ENERGY_INTERVAL: Record<EnergyLevel, ConditioningInterval> = {
  low: { workSeconds: -5, restSeconds: 15, rounds: -1 },
  normal: { workSeconds: 0, restSeconds: 0, rounds: 0 },
  high: { workSeconds: 5, restSeconds: -5, rounds: 1 },
};

/** Bounds nothing may leave, whatever the tables and the deltas add up to. */
export const INTERVAL_BOUNDS = {
  workSeconds: { min: 15, max: 60 },
  restSeconds: { min: 15, max: 90 },
  rounds: { min: 2, max: 8 },
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * The interval this person works at today.
 *
 * `severelySore` is the third input and the only one that is not about how fit
 * they are or how they feel: it is "the area you told us about is severe". The
 * rest of the app answers that by taking a set off every working block
 * (SEVERE_SET_REDUCTION, lib/exercise-safety.ts), and a round of an interval is
 * this session's working set, so it is answered here in the same units and off
 * the same number.
 *
 * DONE TO THE INTERVAL RATHER THAN TO THE FINISHED CARDS, which is where the
 * strength session does it. The blocks this builder returns are read as numbers
 * by whatever renders the session, so a round taken off a card and not off the
 * block it came from would leave the app showing six rounds beside a card
 * prescribing five. One interval, one answer, and both halves of the session
 * come off it.
 *
 * Inside the clamp, so a round can never be taken below the floor an interval
 * is allowed to have.
 */
export function intervalFor(
  profile: UserProfile | undefined,
  energy: EnergyLevel,
  severelySore: boolean = false
): ConditioningInterval {
  const base = LEVEL_INTERVAL[levelCeilingFor(profile)];
  const delta = ENERGY_INTERVAL[energy] ?? ENERGY_INTERVAL.normal;
  return {
    workSeconds: clamp(
      base.workSeconds + delta.workSeconds,
      INTERVAL_BOUNDS.workSeconds.min,
      INTERVAL_BOUNDS.workSeconds.max
    ),
    restSeconds: clamp(
      base.restSeconds + delta.restSeconds,
      INTERVAL_BOUNDS.restSeconds.min,
      INTERVAL_BOUNDS.restSeconds.max
    ),
    rounds: clamp(
      base.rounds + delta.rounds - (severelySore ? SEVERE_SET_REDUCTION : 0),
      INTERVAL_BOUNDS.rounds.min,
      INTERVAL_BOUNDS.rounds.max
    ),
  };
}

/**
 * Tags the app will not CHOOSE for a beginner, whether or not anything hurts.
 *
 * Decision 7, word for word: beginners are not given skipping. The same
 * sentence is true of anything else that lands hard, so it is written as the
 * tag rather than as the name. Kept identical to the strength builder's rule so
 * the two sessions cannot disagree about who may be handed a skipping rope.
 */
const BEGINNER_NEVER: readonly StressTag[] = ['high_impact'];

/** A record carrying everything the safety screen reads. */
type ScreenableRecord = ExerciseTemplate & { stress?: readonly StressTag[] };

/**
 * What this movement asks of the body that today rules out.
 *
 * Asked both ways round, exactly as the strength builder asks it: the record's
 * own authored tags unioned with what its name, reps and cue say. Screening on
 * the union means `applyInjurySafety` at the end can never find something this
 * let through, which matters because the backstop substitutes out of the OLD
 * catalogue and would put a name that is not one of the nine into the session.
 */
function ruledOut(record: ScreenableRecord, banned: Set<StressTag>): boolean {
  if (banned.size === 0) return false;
  const asRecord = restrictedTagsOnRecord(
    {
      name: record.name,
      movementPattern: record.movementPattern,
      reps: record.reps,
      cue: record.cue,
      stress: record.stress,
    },
    banned
  );
  if (asRecord.length > 0) return true;
  return restrictedTagsOn(record.name, banned, undefined, record.cue).length > 0;
}

/**
 * Which kit, if they had it, would open more conditioning up.
 *
 * Read off the records actually refused rather than guessed, the same way the
 * strength builder reads it: every one of the nine the kit rules out is asked
 * which of its requirements went unmet, and the keys named most often come
 * back. A bodyweight answer gets "a sled" first, because three of the nine are
 * sled work and nothing else is needed twice.
 *
 * Records today would rule out anyway are not counted, so the sentence is only
 * ever true. Buying a sled does not help somebody whose sore wrist is what took
 * the sled rows away.
 */
function kitThatWouldUnlock(
  equipment: readonly EquipmentTier[],
  neverChoose: Set<StressTag>
): KitKey[] {
  const counts = new Map<KitKey, number>();
  for (const record of CONDITIONING_EXERCISES) {
    if (!hasAuthoredContent(record) || canPerformWith(record, equipment)) continue;
    if (ruledOut(record, neverChoose)) continue;
    const missing = new Set<KitKey>();
    for (const group of record.kit) {
      if (canPerformWith({ kit: [group], libraryName: record.libraryName }, equipment)) continue;
      for (const key of group) missing.add(key);
    }
    for (const key of missing) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([key]) => key);
}

/** "3 blocks" / "1 block". */
function blockWord(count: number): string {
  return count === 1 ? '1 block' : `${count} blocks`;
}

/**
 * The conditioning session, built from the nine.
 *
 * Returns the cards, the blocks as numbers, and anything it could not give.
 * The second and third are the honest half: a home session is drawn from three
 * exercises, and a home session with a sore knee is drawn from one, so the
 * shape of it has to be able to say what it is short of.
 */
export function generateLibraryConditioningSession(
  input: LibraryConditioningInput
): LibraryConditioningSession {
  const { readiness, profile, sessionCount = 0, loadUnit = 'kg' } = input;
  /**
   * An empty selection means bodyweight, not "no exercises at all".
   *
   * `canPerformWith` already reads an empty list as the three things everybody
   * owns, but `possibleFor` - which the Restore pools go through - reads it as
   * owning nothing, and would hand back an empty cool-down.
   */
  const equipment: EquipmentTier[] =
    input.equipment.length > 0 ? [...input.equipment] : ['bodyweight'];

  const { energy, timeAvailable } = readiness;
  const n = Math.max(0, Math.trunc(sessionCount));
  const experience: ExperienceLevel = profile?.experienceLevel ?? 'intermediate';
  const effectiveTier = getEffectiveTier(equipment);

  /**
   * EVERY AREA THAT MATTERS, NOT ONLY WHAT HURTS TODAY.
   *
   * What they reported on the readiness screen, what a clinician told them to
   * stay off, and what was already sore at sign-up. The same three lists the
   * strength builder merges, for the same reason: the second and third were
   * stored and synced and read by nothing for a long time.
   */
  const reportedToday = readiness.painRegion
    ? Array.isArray(readiness.painRegion)
      ? readiness.painRegion
      : [readiness.painRegion]
    : [];
  const flagged = [
    ...new Set([
      ...reportedToday,
      ...(profile?.standingSoreRegions ?? []),
      ...(profile?.clinicalAvoid ?? []),
    ]),
  ];
  const screenedReadiness: LibraryReadiness =
    flagged.length === reportedToday.length && flagged.every((r) => reportedToday.includes(r))
      ? readiness
      : { ...readiness, painRegion: flagged };

  const banned = restrictedTagsFor(flagged, experience, readiness.painSeverity ?? 'mild');
  /**
   * What may not be CHOSEN, which is a wider list than what may not stay.
   *
   * The beginner impact rule lives here rather than in `banned` because it is
   * not a pain adaptation. Nothing is swapped and nothing is labelled: Skipping
   * simply never enters a beginner's list, and a card reading "swapped to
   * protect your knee" on somebody whose knee is fine would be a lie.
   */
  const neverChoose = new Set<StressTag>([
    ...banned,
    ...(experience === 'beginner' ? BEGINNER_NEVER : []),
  ]);

  /** The nine, minus what the kit rules out. */
  const kitPool = CONDITIONING_EXERCISES.filter(
    (e) => hasAuthoredContent(e) && canPerformWith(e, equipment)
  );
  /** ...minus what today rules out. This is the list the session is built from. */
  const available = kitPool.filter((e) => !ruledOut(e, neverChoose));

  const notes: string[] = [];
  const unlock = kitSentence(kitThatWouldUnlock(equipment, neverChoose));
  /**
   * WHY THE LIST IS AS SHORT AS IT IS, and it is not always the same reason.
   *
   * A sore area comes first, because it is the reason that changes tomorrow.
   * Next is the beginner impact rule, which is about the person's level rather
   * than about today and would read as a lie under "safe to give you today" to
   * somebody who is not sore anywhere. Last is the kit, which is the answer
   * whenever nothing was screened out at all.
   */
  const painRemoved = kitPool.some((e) => ruledOut(e, banned));
  const because = painRemoved
    ? 'is safe to give you today'
    : available.length < kitPool.length
      ? 'suits a beginner'
      : 'matches your equipment';
  const becausePlural = painRemoved
    ? 'are safe to give you today'
    : available.length < kitPool.length
      ? 'suit a beginner'
      : 'match your equipment';

  if (available.length === 0) {
    return {
      exercises: [],
      blocks: [],
      notes,
      emptyState: `Nothing on the conditioning list ${because}. ${unlock} Restore is the better session for you today.`,
    };
  }

  const asked = BLOCKS_BY_TIME[timeAvailable] ?? BLOCKS_BY_TIME['45'];
  /**
   * The warm-up is one of the nine only when the list can spare one.
   *
   * Otherwise Restore's own warm-up stands in and every conditioning exercise
   * goes where it counts, which is the blocks. A home beginner has two
   * exercises, and spending one of them on an easy-pace warm-up would leave a
   * single block of work.
   */
  const pulseFromNine = available.length > asked;
  const start = n % available.length;
  const blockStart = pulseFromNine ? start + 1 : start;
  const blockCount = Math.min(asked, pulseFromNine ? available.length - 1 : available.length);

  const built: Exercise[] = [];
  const blocks: ConditioningBlock[] = [];

  // ── 1. Pulse raiser ───────────────────────────────────────────────────────
  if (pulseFromNine) {
    built.push({
      ...templateToExercise(available[start]),
      category: 'prep',
      sets: 1,
      suggestedLoad: 'Easy pace',
    });
  } else {
    const fallback = possibleFor(getStandalonePrehabWorkout(), equipment).find(
      (t) => t.category === 'prep' && !ruledOut(t, neverChoose)
    );
    if (fallback) built.push({ ...templateToExercise(fallback), category: 'prep', sets: 1 });
  }

  // ── 2. Interval blocks ────────────────────────────────────────────────────
  // Consecutive entries of the available list, so two neighbours are never the
  // same exercise, and capped at the length of that list so no exercise appears
  // twice anywhere in the session.
  /**
   * A round comes off every block when a reported area is severe.
   *
   * Gated on an area actually being flagged, not on the severity answer alone:
   * "severe" with nothing named is an answer to a question that was not asked,
   * and quietly shortening somebody's session over it would be the app acting
   * on a field rather than on a complaint.
   */
  const interval = intervalFor(
    profile,
    energy,
    flagged.length > 0 && readiness.painSeverity === 'severe'
  );
  for (let i = 0; i < blockCount; i++) {
    const record = available[(blockStart + i) % available.length];
    blocks.push({ id: record.id, name: record.name, ...interval });
    built.push({
      ...templateToExercise(record),
      category: 'cardio',
      sets: interval.rounds,
      reps: `${interval.workSeconds}s`,
    });
  }
  if (blockCount < asked) {
    const k = available.length;
    notes.push(
      `Only ${k === 1 ? 'one conditioning exercise' : `${k} conditioning exercises`} ${k === 1 ? because : becausePlural}, so this is ${blockWord(blockCount)} rather than ${asked}. ${unlock}`
    );
  }

  /**
   * WHAT ELSE ON THE LIST THEY COULD DO INSTEAD, WHICH IS THE SWAP BUTTON.
   *
   * Archie's rule about the button is plain: "EVERYthing should be swappable at
   * least once, sometimes twice". Every other session has its swap slots filled
   * by `fillSwapAlternatives` out of the old catalogue, and for a conditioning
   * block that is the wrong answer twice over. It found nothing at all for four
   * of the nine, because the catalogue has no entry with a matching name to
   * reach from; and where it did find something, what it offered was not on the
   * list, so a session built from the nine could be tapped into something that
   * is not conditioning at all.
   *
   * So the alternatives are answered here, from the same nine the session came
   * from, and only from the records this person can actually do today: the ones
   * the kit allows and the day did not rule out. The engine's fill runs after
   * this and honours what it finds already written on a card, so these survive.
   *
   * THE RECORDS ALREADY IN THE SESSION ARE NOT OFFERED, which is the same rule
   * that gives every card its own exercise. Two cards built from one record
   * share an id, and the session screen logs sets against the id, so swapping
   * the third block into the second block's exercise would write its sets on
   * top of them.
   *
   * WHICH MEANS A HOME SESSION CAN HAVE NOTHING TO OFFER, and it says so by
   * leaving the button empty rather than by reaching off the list. Three of the
   * nine need no equipment, and a session at home is drawn from those three, so
   * when all three are in front of you there is genuinely nothing else on
   * Archie's list you could be doing instead.
   */
  const usedIds = new Set(built.map((e) => e.id));
  const spare = available.filter((record) => !usedIds.has(record.id));
  if (spare.length > 0) {
    let offset = 0;
    for (const card of built) {
      if (card.category !== 'cardio') continue;
      const first = spare[offset % spare.length];
      const second = spare.length > 1 ? spare[(offset + 1) % spare.length] : undefined;
      offset++;
      card.hasSwap = true;
      card.swapName = first.name;
      card.swapCue = first.cue;
      card.swapLoad = first.suggestedLoad;
      if (second) {
        card.swap2Name = second.name;
        card.swap2Cue = second.cue;
        card.swap2Load = second.suggestedLoad;
      }
    }
  }

  // ── 3. Cool-down ──────────────────────────────────────────────────────────
  // Restore's own, and the one thing in the session that is not one of the nine.
  const cooldownPool = possibleFor(getCooldown(), equipment).filter(
    (t) => !ruledOut(t, neverChoose)
  );
  if (cooldownPool.length > 0) {
    built.push({
      ...templateToExercise(cooldownPool[n % cooldownPool.length]),
      category: 'cooldown',
    });
  }

  /**
   * The backstop, and it should have nothing to substitute.
   *
   * Everything above was screened against the same banned set BEFORE it was
   * picked. What is left for this pass is what only it can do, and for this
   * session that is nothing at all: a `cardio` card is not set-reduced at
   * severe and is not one of the blocks moderate pain removes. If it ever does
   * start substituting, something upstream let a banned movement through - and
   * what it substitutes comes from the old catalogue, which
   * tests/library-conditioning.check.mjs sees as a name that is not one of the
   * nine.
   */
  const screened = applyInjurySafety(
    built,
    screenedReadiness,
    effectiveTier,
    profile,
    n,
    'conditioning'
  );
  /**
   * The easier week, through the same helper the strength session uses.
   *
   * It takes a tenth off anything with a number in its load line, which here is
   * the sled work, and leaves the rounds alone, because `cardio` is not one of
   * the categories that drops a set. Cutting a round as well would be a new
   * rule nobody has asked for, so it is deliberately not invented here.
   */
  const eased = readiness.deload ? easeForDeloadWeek(screened, loadUnit) : screened;

  return { exercises: eased, blocks, notes, emptyState: null };
}
