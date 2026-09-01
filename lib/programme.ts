/**
 * THE PROGRAMME: which sessions you get, and why that one.
 *
 * WHAT THIS REPLACES
 * ──────────────────
 * `SESSION_ORDER = ['squat', 'bench', 'deadlift']` in lib/store.ts was the whole
 * programme, for everybody, forever. Nothing anyone answered in the profile
 * builder reached it. The app worked out that somebody did not want to squat by
 * watching them decline it for about a fortnight, which is the fortnight that
 * decides whether they stay.
 *
 * Now the answers choose a template, and the template owns a CYCLE of session
 * types. Barbell Strength's cycle is squat, bench, deadlift, which is the old
 * behaviour exactly, so the people that rotation was built for lose nothing.
 *
 * A CYCLE, NOT A WEEKLY SHEET
 * ───────────────────────────
 * The obvious model is "here is your week: Monday, Wednesday, Friday". It is
 * wrong for this app twice over. Nobody trains on the days they said they would,
 * and a fixed sheet cannot survive somebody skipping Wednesday. So a template
 * owns an ordered cycle and `days` decides only how FAST you move through it. A
 * three day week on a three item cycle sees all three every week; a two day week
 * sees all three every week and a half, which is correct rather than broken.
 *
 * POSITION IS DERIVED, NEVER STORED
 * ─────────────────────────────────
 * Same rule the strength test already follows. Where you are is replayed from
 * the sessions you have actually completed, so it survives a reinstall, a new
 * phone and mergeServerData, none of which a stored counter would.
 *
 * The replay is also what makes "train whatever you like in between" work
 * honestly. Walking the history, a session advances the programme only if it is
 * the session the programme was asking for at that point. Everything else is
 * logged, counted, and leaves the block exactly where it was. Nobody is ever
 * punished for going off plan, and nobody is ever silently skipped past a
 * session they have not done.
 *
 * NO REACT AND NO REACT NATIVE IMPORT, so tests/programme.check.mjs can run this
 * rather than read it.
 */
import type { ExperienceLevel, FitnessGoal, PainRegion, SessionType } from './store';
import type {
  InjuryAge,
  ProgrammeFocus,
  SessionCount,
  SessionLength,
  TrainingDays,
  TreeOutcome,
} from './profile-tree';
import { levelBandFor, type ExerciseLevel, type LevelBand } from './exercise-levels';

export type ProgrammeId =
  | 'barbell'
  | 'foundations'
  | 'upper_lower'
  | 'muscle'
  | 'comeback'
  | 'lean'
  | 'joints'
  /**
   * A cycle somebody put together themselves.
   *
   * It is an id like the other seven so that everything downstream - the hub,
   * the history tagging, the position replay, the difficulty label - keeps
   * working without knowing custom programmes exist. What makes it different is
   * that its cycle lives on the ENROLMENT rather than in the table below, which
   * is why cycleOf and extrasOf take an enrolment and cycleFor does not.
   */
  | 'custom';

export interface ProgrammeTemplate {
  id: ProgrammeId;
  /** What it is called on the certificate and in the hub. */
  name: string;
  /** One line, in the app's voice. */
  blurb: string;
  /**
   * The repeating order of session types.
   *
   * Keyed by days a week because a four day week can carry an accessory day a
   * two day week cannot. Never contains 'custom': generateWorkout returns an
   * empty list for that, because a custom session is assembled in the builder
   * rather than generated, so offering it as a slot would hand somebody an
   * empty workout.
   */
  cycle: Record<TrainingDays, SessionType[]>;
  /**
   * Sessions offered ALONGSIDE the block. Never prescribed, never required, and
   * they never move your place in it.
   *
   * Every programme has to be able to reach recovery work. Somebody on Barbell
   * Strength whose knee is grumbling on a Thursday should not have to leave
   * their programme to do twenty minutes of prehab, and until now the app gave
   * them no way to understand that they could. Mechanically this already worked,
   * because an off-plan session leaves the block where it was. What was missing
   * was anybody saying so.
   *
   * A template lists here only what is NOT already in its cycle. Joint Health
   * does not offer prehab as an extra, because prehab is the programme.
   */
  extras: SessionType[];
}

/**
 * Every programme the app can put somebody on.
 *
 * Seven, which covers the six answers to "what should this be built around"
 * plus the split of general strength into a beginner and an experienced shape.
 * Adding an eighth is a data change and nothing else, which is the entire point
 * of the template layer.
 */
export const PROGRAMMES: Record<ProgrammeId, ProgrammeTemplate> = {
  barbell: {
    id: 'barbell',
    name: 'Barbell Strength',
    blurb: 'Squat, bench and deadlift in rotation, tested and progressed.',
    cycle: {
      // The old SESSION_ORDER, unchanged, for the people it was built for.
      2: ['squat', 'bench', 'deadlift'],
      3: ['squat', 'bench', 'deadlift'],
      4: ['squat', 'bench', 'deadlift', 'upper_body'],
      5: ['squat', 'bench', 'deadlift', 'upper_body', 'conditioning'],
    },
    extras: ['prehab', 'flexibility', 'conditioning'],
  },
  foundations: {
    id: 'foundations',
    name: 'Full Body Foundations',
    blurb: 'Every session covers the whole body. The fastest way to build a base.',
    cycle: {
      2: ['full_body'],
      3: ['full_body'],
      4: ['full_body', 'full_body', 'full_body', 'conditioning'],
      5: ['full_body', 'full_body', 'full_body', 'conditioning', 'flexibility'],
    },
    extras: ['prehab', 'flexibility', 'conditioning'],
  },
  upper_lower: {
    id: 'upper_lower',
    name: 'Upper and Lower',
    blurb: 'The classic split. Enough frequency to keep getting stronger.',
    cycle: {
      2: ['upper_body', 'lower_body'],
      3: ['upper_body', 'lower_body', 'full_body'],
      4: ['upper_body', 'lower_body', 'upper_body', 'lower_body'],
      5: ['upper_body', 'lower_body', 'upper_body', 'lower_body', 'conditioning'],
    },
    extras: ['prehab', 'flexibility', 'conditioning'],
  },
  muscle: {
    id: 'muscle',
    name: 'Build Muscle',
    blurb: 'More volume and more accessory work, in the rep ranges that build size.',
    cycle: {
      2: ['upper_body', 'lower_body'],
      3: ['upper_body', 'lower_body', 'full_body'],
      4: ['upper_body', 'lower_body', 'upper_body', 'lower_body'],
      5: ['upper_body', 'lower_body', 'upper_body', 'lower_body', 'upper_body'],
    },
    extras: ['prehab', 'flexibility', 'conditioning'],
  },
  comeback: {
    id: 'comeback',
    name: 'Return to Lifting',
    blurb: 'Rehab first, with load added back only as the area lets you.',
    cycle: {
      2: ['prehab', 'full_body'],
      3: ['prehab', 'full_body', 'flexibility'],
      4: ['prehab', 'full_body', 'prehab', 'lower_body'],
      5: ['prehab', 'full_body', 'flexibility', 'prehab', 'upper_body'],
    },
    extras: ['conditioning', 'flexibility'],
  },
  lean: {
    id: 'lean',
    name: 'Lean and Fit',
    blurb: 'Conditioning led, with enough lifting to keep the muscle you have.',
    cycle: {
      2: ['conditioning', 'full_body'],
      3: ['conditioning', 'full_body', 'conditioning'],
      4: ['conditioning', 'upper_body', 'conditioning', 'lower_body'],
      5: ['conditioning', 'upper_body', 'conditioning', 'lower_body', 'conditioning'],
    },
    extras: ['prehab', 'flexibility'],
  },
  joints: {
    id: 'joints',
    name: 'Joint Health',
    blurb: 'Prehab and mobility as the main work rather than the warm-up.',
    cycle: {
      2: ['prehab', 'flexibility'],
      3: ['prehab', 'flexibility', 'prehab'],
      4: ['prehab', 'flexibility', 'prehab', 'full_body'],
      5: ['prehab', 'flexibility', 'prehab', 'full_body', 'flexibility'],
    },
    extras: ['conditioning', 'full_body'],
  },
  /**
   * THE FALLBACK for a custom programme, never the thing itself.
   *
   * A real custom enrolment carries its own cycle and its own name. This entry
   * exists so that programmeFor('custom') has something to return rather than
   * silently handing back Full Body Foundations, which is what the ?? in
   * programmeFor would have done - and a person's own programme quietly
   * becoming somebody else's is the worst kind of bug, because it looks like
   * the app working.
   */
  custom: {
    id: 'custom',
    name: 'Your Own Programme',
    blurb: 'The sessions you chose, in the order you chose them.',
    cycle: { 2: ['full_body'], 3: ['full_body'], 4: ['full_body'], 5: ['full_body'] },
    extras: ['prehab', 'flexibility', 'conditioning'],
  },
};

/**
 * The seven you can pick off a list.
 *
 * 'custom' is deliberately not in here. It is built, not chosen, so it must not
 * appear in the chooser, in "and six more, included", or in any of the places
 * that enumerate what somebody could switch to. Everything that wants ALL eight
 * reads PROGRAMMES directly.
 */
export const PROGRAMME_IDS = (Object.keys(PROGRAMMES) as ProgrammeId[]).filter(
  (id) => id !== 'custom'
);

/**
 * What somebody is enrolled in.
 *
 * Everything here is either a choice they made or a fact about when they made
 * it. Nothing derived is stored, so there is nothing that can disagree with the
 * session history.
 */
export interface EnrolledProgramme {
  templateId: ProgrammeId;
  /** How fast they move through the cycle. Changeable from the hub. */
  days: TrainingDays;
  /**
   * How many sessions the block runs for. Changeable from the hub.
   *
   * Sessions rather than weeks, so the block only advances when somebody trains.
   * See SessionCount in ./profile-tree for why that is the honest unit.
   */
  sessions: SessionCount;
  /** Their usual session length, used as the readiness default. */
  minutes: SessionLength;
  /**
   * The cycle they built, present only when templateId is 'custom'.
   *
   * Stored on the enrolment rather than anywhere central because it belongs to
   * one person and one block. Switching to a named programme leaves it here,
   * untouched and unread, so switching back does not mean building it again.
   */
  custom?: CustomProgramme;
  /** ISO timestamp the block began. */
  startedAt: string;
  /**
   * How many sessions were already in the history at enrolment.
   *
   * The block's position is replayed from the sessions completed AFTER this
   * point, so somebody with two years of history who starts a new block starts
   * it at week one rather than week ninety.
   */
  startedAtSessionCount: number;
  /** Paused from the hub. The suggestion falls back to the old behaviour. */
  paused?: boolean;
}

/** A cycle somebody assembled, and what they called it. */
export interface CustomProgramme {
  /** Their name for it. Never empty: the builder falls back to a default. */
  name: string;
  /** The repeating order. At least one session, and never 'custom' itself. */
  cycle: SessionType[];
}

/**
 * The most sessions a custom cycle may hold.
 *
 * Eight, which is a week and a bit. Longer than that and the cycle stops being
 * something you can hold in your head, which is the only reason to build one
 * rather than pick one.
 */
export const MAX_CUSTOM_CYCLE = 8;

/**
 * The session types somebody may put in their own cycle.
 *
 * Every type the generator can actually build, which is every one except
 * 'custom': generateWorkout returns an empty list for that, because a custom
 * SESSION is assembled in the session builder rather than generated, so a slot
 * holding one would hand somebody an empty workout.
 */
export const BUILDABLE_SESSION_TYPES: SessionType[] = [
  'squat',
  'bench',
  'deadlift',
  'upper_body',
  'lower_body',
  'full_body',
  'conditioning',
  'prehab',
  'flexibility',
];

/**
 * The cycle for an ENROLMENT, which is the only thing that knows about custom.
 *
 * Everything that has an enrolment in its hand should call this rather than
 * cycleFor: the position replay, the block plan, the history tagging, the hub.
 * cycleFor stays for the places that only have a template id - the chooser
 * previewing a programme nobody is on yet, and the reasons on the certificate.
 */
export function cycleOf(p: EnrolledProgramme): SessionType[] {
  if (p.templateId === 'custom' && p.custom && p.custom.cycle.length > 0) {
    return p.custom.cycle;
  }
  return cycleFor(p.templateId, p.days);
}

/** What is offered alongside THIS enrolment. See extrasFor. */
export function extrasOf(p: EnrolledProgramme): SessionType[] {
  const inCycle = new Set(cycleOf(p));
  return programmeFor(p.templateId).extras.filter((e) => !inCycle.has(e));
}

/** What to call it. Their name for a custom one, the template's otherwise. */
export function nameOf(p: EnrolledProgramme): string {
  if (p.templateId === 'custom' && p.custom?.name.trim()) return p.custom.name.trim();
  return programmeFor(p.templateId).name;
}

export function programmeFor(id: ProgrammeId): ProgrammeTemplate {
  return PROGRAMMES[id] ?? PROGRAMMES.foundations;
}

/**
 * What is offered ALONGSIDE this enrolment, once its own cycle is taken out.
 *
 * The template lists everything it would offer; how many days a week somebody
 * trains decides how much of that they are already getting. A two day Full Body
 * week has no conditioning in it and a five day one does, so the same template
 * honestly offers different extras to the two of them.
 */
export function extrasFor(id: ProgrammeId, days: TrainingDays): SessionType[] {
  const inCycle = new Set(cycleFor(id, days));
  return programmeFor(id).extras.filter((e) => !inCycle.has(e));
}

/** The repeating order of session types for this enrolment. */
export function cycleFor(id: ProgrammeId, days: TrainingDays): SessionType[] {
  const t = programmeFor(id);
  return t.cycle[days] ?? t.cycle[3];
}

// ─── Choosing one ───────────────────────────────────────────────────────────

/**
 * The template their answers point at. Never null: everybody gets a programme.
 *
 * General strength splits on experience and frequency, because "get stronger
 * with whatever kit is around" means a different shape to a beginner training
 * twice a week than to somebody experienced training four times. That split is
 * the reason both of those questions are asked.
 */
export function templateIdFor(focus: ProgrammeFocus, days: TrainingDays, isBeginner: boolean): ProgrammeId {
  switch (focus) {
    case 'barbell':
      return 'barbell';
    case 'muscle':
      return 'muscle';
    case 'comeback':
      return 'comeback';
    case 'fitness':
      return 'lean';
    case 'joints':
      return 'joints';
    case 'strength':
    default:
      return isBeginner || days <= 3 ? 'foundations' : 'upper_lower';
  }
}

/**
 * Enrol somebody from a finished profile tree.
 *
 * `sessionCount` is their history length at this moment, so an existing user
 * who picks a new programme from the hub starts a fresh block rather than
 * inheriting a position from work they did on something else.
 */
export function selectProgramme(
  outcome: TreeOutcome,
  nowIso: string,
  sessionCount: number
): EnrolledProgramme {
  return {
    templateId: templateIdFor(outcome.focus, outcome.days, outcome.experience === 'beginner'),
    days: outcome.days,
    sessions: outcome.sessions,
    minutes: outcome.minutes,
    startedAt: nowIso,
    startedAtSessionCount: Math.max(0, Math.trunc(sessionCount)),
  };
}

// ─── Where they are in it ───────────────────────────────────────────────────

export interface ProgrammePosition {
  /** Sessions completed that the programme actually asked for. */
  onPlan: number;
  /** Sessions completed since enrolment that were something else. */
  offPlan: number;
  /** Which session type comes next. */
  next: SessionType;
  /**
   * Which week of the block they are in, 1-based and capped at `weeks`.
   *
   * Derived from sessions done rather than from the calendar, so it is the
   * week's worth of work they have reached rather than the week it happens to
   * be. Somebody who trained twice in a fortnight on a three day plan is still
   * shown week one, which is true.
   */
  week: number;
  /** How many weeks the block works out at, at their stated frequency. */
  weeks: number;
  /** The block's length. Same number as the enrolment's `sessions`. */
  totalSessions: number;
  /** True once the block has been finished. */
  complete: boolean;
}

/**
 * Sessions expressed as weeks, for anywhere that wants to say "about a month".
 *
 * Always a derived, rounded-up figure and never the thing the block is measured
 * in. Ten sessions at three a week is four weeks of training, which is worth
 * saying, and is not a promise about any particular four weeks.
 */
export function weeksFor(sessions: number, days: TrainingDays): number {
  return Math.max(1, Math.ceil(sessions / days));
}

/**
 * Replay the history against the cycle.
 *
 * `sessionTypesSinceEnrolment` must be in CHRONOLOGICAL order, oldest first.
 * The store keeps completedSessions newest-first, so the caller reverses it,
 * and getting that backwards is the one way this function can be wrong. The
 * contract test asserts the direction.
 *
 * A session advances the pointer only when it matches what the cycle was asking
 * for. Anything else leaves the position alone and is counted as off plan, which
 * is what makes "do whatever you like in between" true rather than a slogan.
 */
export function programmePosition(
  p: EnrolledProgramme,
  sessionTypesSinceEnrolment: SessionType[]
): ProgrammePosition {
  const cycle = cycleOf(p);
  const totalSessions = p.sessions;
  const weeks = weeksFor(totalSessions, p.days);
  const tags = tagSessions(p, sessionTypesSinceEnrolment);
  const onPlan = tags.filter((t) => t.onPlan).length;
  const offPlan = tags.length - onPlan;
  const complete = onPlan >= totalSessions;
  return {
    onPlan,
    offPlan,
    next: cycle[onPlan % cycle.length],
    week: Math.min(Math.floor(onPlan / p.days) + 1, weeks),
    weeks,
    totalSessions,
    complete,
  };
}

/**
 * WHICH OF THE SESSIONS THEY HAVE DONE WERE THE PROGRAMME'S, one tag each.
 *
 * The same replay programmePosition runs, pulled out so the two can never
 * disagree: the counter on the hub and the label on a row in the history are the
 * same walk of the same list.
 *
 * WHY IT NEEDS SAYING AT ALL. "Train whatever you want in between" is the
 * promise, and the app kept it mechanically from the day the programme landed.
 * What it did not do was leave a mark. Somebody scrolling back through six weeks
 * saw twenty-two identical rows and no way to tell the eleven that were their
 * block from the eleven they chose themselves, so the promise and the evidence
 * for it were in different places.
 *
 * Input is CHRONOLOGICAL, oldest first, and the output is in the same order.
 */
export interface SessionPlanTag {
  /** True when this was the session the programme was asking for at the time. */
  onPlan: boolean;
  /** Its 1-based place in the block, for the ones that were. */
  blockIndex: number | null;
}

export function tagSessions(
  p: EnrolledProgramme,
  sessionTypesSinceEnrolment: SessionType[]
): SessionPlanTag[] {
  const cycle = cycleOf(p);
  const out: SessionPlanTag[] = [];
  let onPlan = 0;
  for (const type of sessionTypesSinceEnrolment) {
    if (type === cycle[onPlan % cycle.length]) {
      onPlan++;
      out.push({ onPlan: true, blockIndex: onPlan });
    } else {
      out.push({ onPlan: false, blockIndex: null });
    }
  }
  return out;
}

/** The session the programme is asking for now. */
export function nextSessionType(
  p: EnrolledProgramme,
  sessionTypesSinceEnrolment: SessionType[]
): SessionType {
  return programmePosition(p, sessionTypesSinceEnrolment).next;
}

/**
 * What the whole block looks like, for the hub's list. One entry per session.
 *
 * The week number is a grouping for the list, not a date. The last week can hold
 * fewer sessions than the others, which is what choosing an odd number like ten
 * on a three day plan actually means, and the list says so rather than padding
 * it out to something they did not ask for.
 */
export function blockPlan(p: EnrolledProgramme): { week: number; type: SessionType }[] {
  const cycle = cycleOf(p);
  const out: { week: number; type: SessionType }[] = [];
  for (let i = 0; i < p.sessions; i++) {
    out.push({ week: Math.floor(i / p.days) + 1, type: cycle[i % cycle.length] });
  }
  return out;
}

// ─── How hard it is ─────────────────────────────────────────────────────────

/**
 * The six difficulty labels, easiest first.
 *
 * The index into this array IS the score, so the order is load-bearing and the
 * array is the only place the six words exist.
 */
export const DIFFICULTY_LABELS = [
  'Beginner',
  'Novice',
  'Intermediate',
  'Advanced',
  'Expert',
  'Elite',
] as const;

export type Difficulty = (typeof DIFFICULTY_LABELS)[number];

/**
 * WHAT THE LABEL DESCRIBES: the programme, not the person.
 *
 * Worth being clear about, because the two come apart and the honest answer is
 * the less flattering one. An experienced lifter who picks Joint Health twice a
 * week is on a Novice programme. That is not a judgement about them; it is a
 * true statement about the work, and an app that called it Advanced because the
 * person is advanced would be flattering them instead of informing them.
 *
 * THREE THINGS MAKE IT, and session count is deliberately not one of them.
 * Twenty sessions of mobility work is not harder than four sessions of heavy
 * barbell work, it is just longer, and Archie's brief said exactly that.
 *
 *   THE WORK      what the template actually prescribes. Barbell and hypertrophy
 *                 work is demanding; prehab and a return from injury are not
 *                 meant to be.
 *   THE VOLUME    five days a week is more than two, of anything.
 *   THE CAPABILITY  the same template is prescribed differently by experience:
 *                 the rep schemes, the set counts and the exercises chosen all
 *                 move with it. See goalsForFocus and lib/rep-scheme.ts.
 *
 * AND A CEILING, which is what stops the label being nonsense. A beginner is
 * never handed an Advanced programme however they answer, because the app will
 * not prescribe one: it holds them at Novice at most until they have logged the
 * work. That ceiling is the same idea as the earn-the-barbell rule in
 * PROGRESSION-LADDERS.md, applied to the whole block rather than one movement.
 *
 * WHEN EXERCISE LEVELS LAND, they refine the first term rather than replacing
 * this function: a template's demand becomes the level band it draws from, which
 * is a measured number rather than the judgement below.
 */
const TEMPLATE_DEMAND: Record<ProgrammeId, number> = {
  barbell: 1,
  muscle: 1,
  upper_lower: 1,
  lean: 0,
  foundations: 0,
  comeback: -1,
  joints: -1,
  // Never read. A custom programme's demand comes from what is actually in its
  // cycle - see demandOfCycle - because that is the only thing there is to read.
  custom: 0,
};

/**
 * How demanding a cycle somebody built is, read off the cycle itself.
 *
 * The seven named programmes get a number because a physiotherapist decided
 * what each one is for. A cycle somebody assembled has no such statement of
 * intent, so the work in it has to speak: barbell and split sessions are the
 * heavy end, prehab and mobility the gentle end, and a cycle that is mostly one
 * or the other is mostly one or the other.
 *
 * Rounded to the same -1, 0, 1 the table above uses, so a custom programme and
 * a named one are scored on one scale rather than two.
 */
const HEAVY: SessionType[] = ['squat', 'bench', 'deadlift', 'upper_body', 'lower_body'];
const GENTLE: SessionType[] = ['prehab', 'flexibility'];

export function demandOfCycle(cycle: SessionType[]): number {
  if (cycle.length === 0) return 0;
  const heavy = cycle.filter((t) => HEAVY.includes(t)).length / cycle.length;
  const gentle = cycle.filter((t) => GENTLE.includes(t)).length / cycle.length;
  if (heavy >= 0.6) return 1;
  if (gentle >= 0.6) return -1;
  return 0;
}

const CAPABILITY: Record<ExperienceLevel, number> = {
  beginner: 0,
  intermediate: 2,
  advanced: 3,
};

/** The hardest label each experience level can be prescribed. See the docblock. */
const CAPABILITY_CEILING: Record<ExperienceLevel, number> = {
  beginner: 1,
  intermediate: 3,
  advanced: 5,
};

export interface ProgrammeDifficulty {
  label: Difficulty;
  /** 0 to 5, the index into DIFFICULTY_LABELS. */
  score: number;
  /** One line, naming what made it that. Shown under the label. */
  because: string;
  /** The rungs of the movement ladders it is built from. See lib/exercise-levels. */
  band: LevelBand;
}

/**
 * The hardest rung the app will prescribe to somebody, whatever they picked.
 *
 * WHY THIS IS DERIVED RATHER THAN WRITTEN DOWN. The label is a property of the
 * PROGRAMME and the ceiling is a property of the PERSON, and the two have to
 * agree or the app shows one thing and does another. Computing the ceiling as
 * the hardest band any programme could reach at that experience means they
 * cannot come apart: if the difficulty table changes, this moves with it.
 *
 * It is also the honest reading of the brief. A beginner should not be handed
 * level 4 work because they chose the barbell programme; choosing a harder
 * programme does not make somebody able to do harder movements, which is the
 * whole point of the earn-the-barbell rule in PROGRESSION-LADDERS.md.
 */
export function levelCeilingFor(experience: ExperienceLevel): ExerciseLevel {
  let max = 1;
  for (let i = 0; i <= CAPABILITY_CEILING[experience]; i++) {
    const band = levelBandFor(DIFFICULTY_LABELS[i]);
    if (band.max > max) max = band.max;
  }
  return max as ExerciseLevel;
}

/**
 * What the generator builds on, and what it will not go past.
 *
 * BUILD ON THE RUNG BELOW THE CEILING. That is the whole rule, and it is a
 * coaching one rather than an arithmetic one: a session built AT somebody's
 * limit is a session with nowhere left to go, and the app's job is to leave the
 * next rung in front of them. So a beginner is built on foundations and allowed
 * the first loaded rung; somebody experienced is built on full-range barbell
 * work and allowed the asymmetry rung above it.
 *
 * The generator uses this rather than the programme's own band because it does
 * not know which programme somebody is on - it is handed a session type and a
 * profile. That is the right division: the CEILING is a fact about the person
 * and the LABEL is a fact about the programme, and levelCeilingFor above keeps
 * the two from disagreeing.
 */
export function levelBandForExperience(experience: ExperienceLevel): LevelBand {
  const max = levelCeilingFor(experience);
  return { prefer: (max > 1 ? max - 1 : 1) as ExerciseLevel, max };
}

export function programmeDifficulty(
  id: ProgrammeId,
  experience: ExperienceLevel,
  days: TrainingDays,
  /** The cycle, which is the only source of demand for a custom programme. */
  cycle?: SessionType[]
): ProgrammeDifficulty {
  const work = id === 'custom' ? demandOfCycle(cycle ?? []) : (TEMPLATE_DEMAND[id] ?? 0);
  const volume = days >= 5 ? 1 : days <= 2 ? -1 : 0;
  const raw = CAPABILITY[experience] + work + volume;
  const score = Math.max(0, Math.min(CAPABILITY_CEILING[experience], raw));

  const parts: string[] = [];
  if (work > 0) parts.push('the work is heavy');
  else if (work < 0) parts.push('the work is deliberately gentle');
  if (volume > 0) parts.push('you train five days a week');
  else if (volume < 0) parts.push('you train twice a week');
  if (score === CAPABILITY_CEILING[experience] && raw > score) {
    parts.push('and it goes no further until you have logged the work');
  }

  return {
    label: DIFFICULTY_LABELS[score],
    score,
    band: levelBandFor(DIFFICULTY_LABELS[score]),
    because:
      parts.length > 0
        ? `Because ${parts.join(', ')}.`
        : 'Based on the work it prescribes and how often you train.',
  };
}

// ─── Saying why ─────────────────────────────────────────────────────────────

const AGE_WORDS: Record<InjuryAge, string> = {
  days: 'for a few days',
  weeks: 'for a few weeks',
  months: 'for months',
  years: 'for a year or more',
};

/**
 * Why this programme, in their own answers.
 *
 * Shown on the certificate at the end of the builder and again in the hub. This
 * is the market read's "show the reasoning" advice at the earliest possible
 * moment: the app has just made a decision on somebody's behalf, and saying
 * which of their answers caused it is what separates a considered app from a
 * black box.
 *
 * Every line names a REAL answer. Nothing generic, and nothing that would be
 * true of everybody, because a reason that applies to everybody is not a reason.
 */
export function programmeReasons(outcome: TreeOutcome): string[] {
  const out: string[] = [];
  const t = programmeFor(templateIdFor(outcome.focus, outcome.days, outcome.experience === 'beginner'));

  /**
   * THE CHOICE ITSELF, FIRST.
   *
   * The list used to open with "3 days a week, so your cycle is 3 sessions
   * long", which is true and is not an answer to the question written above it.
   * Somebody who has just told the app in as many words what they want it to
   * build around should see that sentence read back to them before anything
   * else, or the reasoning on display is the reasoning about the small stuff.
   */
  switch (outcome.focus) {
    case 'barbell':
      out.push(
        'You chose the three barbell lifts, so squat, bench and deadlift rotate and each one gets tested.'
      );
      break;
    case 'muscle':
      out.push(
        'You chose building muscle, so there is more volume, more accessory work, and the rep ranges that build size.'
      );
      break;
    case 'comeback':
      out.push(
        'You are coming back from an injury, so this starts with rehab and only adds load back as the area lets you.'
      );
      break;
    case 'fitness':
      out.push(
        'You chose fitness and conditioning, so this is cardio led with enough lifting to keep the muscle you have.'
      );
      break;
    case 'joints':
      out.push(
        'You chose joint health, so prehab and mobility are the main work rather than the warm-up.'
      );
      break;
    case 'strength':
    default:
      out.push(
        outcome.experience === 'beginner'
          ? 'You are new to structured training, so every session covers the whole body.'
          : `You want general strength on ${outcome.days} days a week, which is enough to split upper and lower.`
      );
      break;
  }

  out.push(`${outcome.days} days a week, so your cycle is ${cycleFor(t.id, outcome.days).length} sessions long.`);
  out.push(
    `${outcome.sessions} sessions in the block, about ${weeksFor(outcome.sessions, outcome.days)} weeks at that rate. It is counted in sessions, so it only moves when you train.`
  );
  /**
   * The adaptive half of the time answer, said out loud.
   *
   * The generator has always built a shorter session for a shorter day. Nobody
   * was ever told, so the first time somebody with 30 minutes saw fewer
   * exercises than the plan showed, the reasonable reading was that the app had
   * lost something.
   */
  out.push(
    `Around ${outcome.minutes} minutes a session, and a day you only have 30 gives you the same session with less of it rather than a different one.`
  );

  if (outcome.soreRegions.length > 0) {
    const age = outcome.soreFor ? ` ${AGE_WORDS[outcome.soreFor]}` : '';
    out.push(
      `Something has been sore${age}, so every session is built around it and gentle work for that area goes in.`
    );
  }

  /**
   * Two sentences, because the kit answer has two halves and only one of them
   * was ever said.
   *
   * The first is the promise the equipment fix made true: no equipment means no
   * equipment, everywhere, including behind the swap button. The second is the
   * one people needed and never got - what happens on the day the gym is shut.
   * Everybody gets that half, full gym included, because a full gym is the
   * answer most likely to be wrong on a Sunday.
   */
  if (outcome.equipmentTiers.length > 0 && !outcome.equipmentTiers.includes('fullgym')) {
    out.push('Only exercises you have the kit for, so nothing is prescribed you cannot do.');
  }
  out.push(
    'You are asked what you have got before every session, so turning up without some of it rebuilds the session rather than costing you it.'
  );

  if (outcome.focus === 'barbell' && outcome.testWeekFrequency !== 'never') {
    out.push(`A strength test every ${outcome.testWeekFrequency} sessions, so the weights stay honest.`);
  }

  return out;
}

/**
 * A caution, when their answers deserve one and their choice does not carry it.
 *
 * Somebody whose knee started hurting three days ago and who chose Barbell
 * Strength has told us two things that pull against each other. The app does NOT
 * overrule them: they asked for the barbell and they get the barbell. It says
 * what it has done about it, and it names the programme that would suit better,
 * because pretending not to notice is the thing a physiotherapist would never do.
 */
export function programmeCareNote(outcome: TreeOutcome): string | null {
  if (outcome.soreRegions.length === 0) return null;
  if (outcome.focus === 'comeback' || outcome.focus === 'joints') return null;
  if (outcome.soreFor !== 'days') return null;
  return 'Something has only been sore for a few days, so the first two weeks go easy on it. If it is not settling, Return to Lifting is the better programme and you can switch any time.';
}

/**
 * The three things somebody has to understand at the end of the builder.
 *
 * Lives here rather than in the screen because the hub says the same three
 * things and two copies would drift. The third one matters most: people who
 * hear "programme" expect a fixed sheet, and without that sentence the first
 * time the app adapts a session they will read it as a fault.
 */
export const PROGRAMME_PROMISES: { title: string; body: string }[] = [
  {
    title: 'This is a starting point',
    body: 'It saves you deciding what to train and how heavy. It does not decide for you. Change the programme, the days or the length whenever you like.',
  },
  {
    title: 'Train whatever you want in between',
    body: 'Anything you do is logged, counts towards your records and shows in your history. It just leaves your programme where it was, so you never lose your place.',
  },
  {
    title: 'It changes as you do',
    body: 'The weights come from what you actually lift. The session is built around whatever is sore, whatever kit you have that day and how long you have got. If it looks different tomorrow, that is it working.',
  },
];

/**
 * The focus, translated into the goals the engine already understands.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS. lib/rep-scheme.ts turns goals into an
 * intent, which sets the rep ranges for every exercise, and
 * getGoalVolumeDeltas in lib/workout-engine.ts turns them into set counts. Those
 * two are the only parts of the old profile that ever reached the training.
 *
 * If "what should this be built around" only chose a template, somebody who
 * asked for muscle would get an upper/lower split prescribed in strength rep
 * ranges. The template decides WHICH sessions; the goal decides what the sets
 * and reps inside them look like. Both have to come from the same answer or
 * they can disagree.
 *
 * Joint health maps to rehab rather than to fitness on purpose: prehab and
 * mobility work wants the gentle prescription, and lib/rep-scheme.ts already
 * softens everything under a rehab intent.
 */
export function goalsForFocus(focus: ProgrammeFocus): FitnessGoal[] {
  switch (focus) {
    case 'barbell':
      return ['strength'];
    case 'strength':
      return ['strength'];
    case 'muscle':
      return ['muscle'];
    case 'comeback':
      return ['rehab'];
    case 'joints':
      return ['rehab'];
    case 'fitness':
    default:
      return ['fitness'];
  }
}

/**
 * The other programmes, which choosing one does not take away.
 *
 * Worth saying out loud at the moment somebody is handed theirs. Every one of
 * these is available from the programme hub, switching starts a fresh block, and
 * nothing that has been logged is lost by moving.
 */
export function otherProgrammes(current: ProgrammeId): ProgrammeTemplate[] {
  return PROGRAMME_IDS.filter((id) => id !== current).map((id) => PROGRAMMES[id]);
}

/** Counts the app can state about itself, read from the code that owns them. */
export interface AppCounts {
  exercises: number;
  painAreas: number;
  sessionTypes: number;
}

/**
 * WHAT THE SUBSCRIPTION ACTUALLY BUYS, in one place, for the first time.
 *
 * Every one of these already exists and has existed for months. None of them
 * has ever been listed anywhere a user would see it except the paywall, which
 * they read once, before they had any idea what the words meant.
 *
 * The rule for this list is the rule for the store listing: nothing that is not
 * true today. No video for every exercise, because only some have one recorded
 * and the rest fall back to a search. No claim about a price either: the price
 * comes from the store and is stated where the store can be asked.
 */
export function includedInGrow(c: AppCounts): { title: string; body: string }[] {
  return [
    {
      title: 'The weight moves itself',
      body: 'Every load is worked out from what you actually lifted last time. Clear your reps and it climbs, fall short and it holds.',
    },
    {
      title: `${c.painAreas} areas you can flag as sore`,
      body: 'Say something hurts and the session is rebuilt around it, with gentler work for that area put in and a limit to stay inside.',
    },
    {
      title: 'Rehab and recovery whenever you want it',
      body: 'Prehab, mobility and conditioning sessions sit alongside your programme. Doing one never costs you your place in it.',
    },
    {
      title: 'An assistant that has been watching',
      body: 'A lift that has stalled three sessions running, a personal best you did not clock, an ache you have flagged five times in ten weeks.',
    },
    {
      title: 'Every number, kept',
      body: '1RM trends, personal bests, muscle coverage and your full history, with the plate maths done for you in kilos or pounds.',
    },
    {
      title: 'A summary for your own physio',
      body: 'Every pain report and every session, in one thing you can hand to a clinician. Nothing else on the store produces it.',
    },
    {
      title: `${c.exercises} exercises, ${c.sessionTypes} kinds of session`,
      body: 'Each with written cues and a demonstration a tap away, filtered to the equipment you told us you have.',
    },
  ];
}

/** Everything a standing injury needs to reach the rest of the app. */
export interface StandingCare {
  regions: PainRegion[];
  since: InjuryAge | null;
}

export function standingCareFrom(outcome: TreeOutcome): StandingCare {
  return { regions: outcome.soreRegions, since: outcome.soreFor };
}
