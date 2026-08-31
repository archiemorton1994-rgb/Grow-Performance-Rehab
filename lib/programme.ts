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
import type { FitnessGoal, PainRegion, SessionType } from './store';
import type {
  BlockLength,
  InjuryAge,
  ProgrammeFocus,
  SessionLength,
  TrainingDays,
  TreeOutcome,
} from './profile-tree';

export type ProgrammeId =
  | 'barbell'
  | 'foundations'
  | 'upper_lower'
  | 'muscle'
  | 'comeback'
  | 'lean'
  | 'joints';

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
  },
};

export const PROGRAMME_IDS = Object.keys(PROGRAMMES) as ProgrammeId[];

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
  /** How long the block runs. Changeable from the hub. */
  blockWeeks: BlockLength;
  /** Their usual session length, used as the readiness default. */
  minutes: SessionLength;
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

export function programmeFor(id: ProgrammeId): ProgrammeTemplate {
  return PROGRAMMES[id] ?? PROGRAMMES.foundations;
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
    blockWeeks: outcome.blockWeeks,
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
  /** 1-based, capped at blockWeeks. */
  week: number;
  /** days x blockWeeks. */
  totalSessions: number;
  /** True once the block has been finished. */
  complete: boolean;
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
  const cycle = cycleFor(p.templateId, p.days);
  const totalSessions = p.days * p.blockWeeks;
  let onPlan = 0;
  let offPlan = 0;
  for (const type of sessionTypesSinceEnrolment) {
    if (type === cycle[onPlan % cycle.length]) onPlan++;
    else offPlan++;
  }
  const complete = onPlan >= totalSessions;
  return {
    onPlan,
    offPlan,
    next: cycle[onPlan % cycle.length],
    week: Math.min(Math.floor(onPlan / p.days) + 1, p.blockWeeks),
    totalSessions,
    complete,
  };
}

/** The session the programme is asking for now. */
export function nextSessionType(
  p: EnrolledProgramme,
  sessionTypesSinceEnrolment: SessionType[]
): SessionType {
  return programmePosition(p, sessionTypesSinceEnrolment).next;
}

/** What the whole block looks like, for the hub's list. One entry per session. */
export function blockPlan(p: EnrolledProgramme): { week: number; type: SessionType }[] {
  const cycle = cycleFor(p.templateId, p.days);
  const out: { week: number; type: SessionType }[] = [];
  for (let i = 0; i < p.days * p.blockWeeks; i++) {
    out.push({ week: Math.floor(i / p.days) + 1, type: cycle[i % cycle.length] });
  }
  return out;
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

  if (outcome.focus === 'strength' && outcome.experience === 'beginner') {
    out.push('You are new to structured training, so every session covers the whole body.');
  } else if (outcome.focus === 'strength') {
    out.push(`You train ${outcome.days} days a week, which is enough to split upper and lower.`);
  }

  out.push(`${outcome.days} days a week, so your cycle is ${cycleFor(t.id, outcome.days).length} sessions long.`);
  out.push(`Around ${outcome.minutes} minutes a session, so nothing is prescribed that will not fit.`);

  if (outcome.soreRegions.length > 0) {
    const age = outcome.soreFor ? ` ${AGE_WORDS[outcome.soreFor]}` : '';
    out.push(
      `Something has been sore${age}, so every session is built around it and gentle work for that area goes in.`
    );
  }

  if (outcome.equipmentTiers.length > 0 && !outcome.equipmentTiers.includes('fullgym')) {
    out.push('Only exercises you have the kit for, so nothing is prescribed you cannot do.');
  }

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
    body: 'The weights come from what you actually lift, and the session works around whatever is sore that day. If it looks different tomorrow, that is it working.',
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

/** Everything a standing injury needs to reach the rest of the app. */
export interface StandingCare {
  regions: PainRegion[];
  since: InjuryAge | null;
}

export function standingCareFrom(outcome: TreeOutcome): StandingCare {
  return { regions: outcome.soreRegions, since: outcome.soreFor };
}
