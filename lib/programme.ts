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
import type { ExperienceLevel, SessionType } from './store';
import { levelBandFor, type ExerciseLevel, type LevelBand } from './exercise-levels';

// ─── The vocabulary a programme is described in ─────────────────────────────

/**
 * These used to live in lib/profile-tree.ts, because the profile builder was the
 * first thing to need words for them. They are not the builder's, they are the
 * programme's: days sets how fast the cycle turns, minutes and sessions are
 * written on the enrolment, and an injury age says how long something has been
 * sore. The builder is gone and every one of these is still read, by the
 * programme hub, the custom-programme screen and the profile.
 */

/** Days a week. The first thing any coach asks, and never once asked here. */
export type TrainingDays = 2 | 3 | 4 | 5;

/**
 * Usual session length in minutes.
 *
 * Exactly the three the generator understands. TimeAvailable in ./store is
 * '30' | '45' | '60' and lib/workout-engine.ts branches on those three strings
 * throughout, so a fourth option here would be a question the app collects an
 * answer to and then cannot honour. Asking it would break the one rule the
 * profile tree is built on.
 */
export type SessionLength = 30 | 45 | 60;

/**
 * How long the first block runs, counted in SESSIONS.
 *
 * WHY NOT WEEKS. A block measured in weeks is a promise about the calendar, and
 * this app has no control over anybody's calendar. Somebody who said three days
 * a week and then trained twice for a fortnight has not fallen behind a
 * twelve-week block, but a week counter says they have, and the app that keeps
 * telling you that you are behind is the app you delete.
 *
 * Counted in sessions, the block only moves when they train, so it is a promise
 * the app can keep. It also lets somebody choose something genuinely short: four
 * sessions is a fortnight of trying it out, and no number of weeks expresses
 * that without assuming a frequency.
 *
 * Nine choices rather than three, because "how much am I committing to" is the
 * question people actually hesitate over, and three answers made two of them
 * wrong for most people.
 */
export type SessionCount = 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20;

/** Every count offered, in the order the question lists them. */
export const SESSION_COUNTS: SessionCount[] = [4, 6, 8, 10, 12, 14, 16, 18, 20];

/** How long something has been sore. Changes whether it is treated as acute. */
export type InjuryAge = 'days' | 'weeks' | 'months' | 'years';

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
  /** What it is called in the chooser and in the hub. */
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
 * Seven, which covers the six things people come to this app to train for plus
 * the split of general strength into a beginner and an experienced shape.
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
   * See SessionCount above for why that is the honest unit.
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
  /**
   * SESSIONS THAT DO NOT COUNT TOWARDS THE BLOCK, as half-open ranges over the
   * chronological session count: [from, to). The one still open while paused has
   * no `to` yet.
   *
   * The hub says, in these words, "Paused. You are still training, it just is
   * not moving the block along." That was false: the position is replayed from
   * every session logged since enrolment, and nothing consulted `paused`. A
   * twelve session block paused and then trained through advanced on every
   * session and finished itself, archiving a report the user never asked for.
   *
   * A COUNT WOULD NOT HAVE BEEN ENOUGH. Sessions logged during a pause are the
   * most recent ones only until training resumes, after which they sit in the
   * middle of the history. Where they were has to be remembered, not how many.
   */
  pausedRanges?: { from: number; to?: number }[];
  /**
   * WHICH DAY COUNT WAS IN FORCE AT EACH POINT OF THE BLOCK.
   *
   * Appended whenever the hub's "days a week" control changes mid-block, keyed
   * by the on-plan session index it took effect at. Absent for every block that
   * has never had it changed, which is nearly all of them, and absent means
   * "p.days all the way through" - so nothing about an existing block moves.
   *
   * It exists because most templates prescribe a different CYCLE at four days a
   * week than at three. Without it, one tap re-walked the entire history against
   * the new cycle and reclassified weeks of work as sessions the user had chosen
   * themselves. See cycleOfAt.
   */
  daySegments?: { fromOnPlan: number; days: TrainingDays }[];
}

/**
 * THE SESSIONS THAT COUNT TOWARDS THE BLOCK, oldest first.
 *
 * Four places used to work this out for themselves - the position, the report,
 * the history tags and the drift rule - each doing the same reverse-and-slice
 * and each carrying its own comment warning that the store keeps sessions
 * newest first. Four copies of one rule is four chances to get it wrong, and
 * when pausing had to start excluding sessions there would have been four
 * places to remember.
 *
 * Two things are dropped:
 *
 *   EVERYTHING BEFORE ENROLMENT, so somebody with two years of history who
 *   starts a block starts it at session one rather than session four hundred.
 *
 *   AND EVERYTHING LOGGED WHILE THE BLOCK WAS PAUSED, which is what the hub has
 *   always promised and never did. See pausedRanges.
 *
 * Takes sessions NEWEST FIRST, which is how the store holds them, and returns
 * them oldest first, which is the order every replay wants.
 */
export function sessionsCountingToward<T>(
  p: EnrolledProgramme,
  completedNewestFirst: readonly T[]
): T[] {
  const total = completedNewestFirst.length;
  const chronological = completedNewestFirst.slice().reverse();
  const ranges = p.pausedRanges ?? [];
  const paused = (index: number) =>
    ranges.some((r) => index >= r.from && index < (r.to ?? Number.POSITIVE_INFINITY));
  const out: T[] = [];
  for (let i = p.startedAtSessionCount; i < total; i++) {
    if (!paused(i)) out.push(chronological[i]);
  }
  return out;
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

/**
 * THE CYCLE A SESSION AT THIS POINT IN THE BLOCK WAS MEASURED AGAINST.
 *
 * Most templates prescribe a different cycle at four days a week than at three,
 * so the day count is not a preference, it is the plan. Changing it used to
 * re-walk the WHOLE block against the new cycle: a user six sessions into Lean
 * and Fit who tapped "4" instead of "3" watched the hub go from "Session 7 of
 * 12, week 3 of 4, 50%" to "Session 2 of 12, week 1 of 3, 8%", with five weeks
 * of their work reclassified as sessions they had chosen themselves. One tap,
 * no warning, on a control the screen presents as a simple preference.
 *
 * A day count is now a fact with a date on it. Sessions already done keep the
 * cycle they were done under, and the new one applies from here forward.
 */
export function cycleOfAt(p: EnrolledProgramme, onPlanIndex: number): SessionType[] {
  if (p.templateId === 'custom' && p.custom && p.custom.cycle.length > 0) {
    return p.custom.cycle;
  }
  const segments = p.daySegments;
  if (!segments || segments.length === 0) return cycleFor(p.templateId, p.days);
  // The last segment that had started by this point. Segments are appended in
  // order, so a reverse scan finds it without sorting.
  let days = p.days;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].fromOnPlan <= onPlanIndex) {
      days = segments[i].days;
      break;
    }
  }
  return cycleFor(p.templateId, days);
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
  /**
   * The next session falls in a deliberately easier week. See deloadWeeksFor.
   *
   * Carried on the position rather than worked out by each screen because four
   * of them need it - the home tile, the hub, the session screen and the
   * summary - and a deload that some surfaces know about and others do not is
   * worse than no deload at all.
   */
  deload: boolean;
  /** Which weeks of this block contain easier work, 1-based. */
  deloadWeeks: number[];
  /**
   * And which SESSIONS are the easier ones, 1-based.
   *
   * The schedule is decided in sessions, so this is the honest unit to show. A
   * deload window that was trimmed to keep the last session normal covers only
   * part of a week, and "week 4 is an easier week" then overstates it - the
   * screens say which sessions instead.
   */
  deloadSessions: number[];
}

// ─── The easier week ────────────────────────────────────────────────────────

/**
 * A BLOCK THAT ONLY EVER GOES UP IS NOT A BLOCK.
 *
 * Twenty sessions of climbing load with nothing planned in between is not how
 * anybody who writes programmes for a living writes one, and it is not what the
 * app was doing to people by accident either - it was doing it by omission.
 * Every easing mechanism in here so far is REACTIVE: the weight comes down after
 * three failed sessions, or after a fortnight away. Both of those are the app
 * noticing damage. A deload is the app preventing it.
 *
 * EVERY FOURTH WEEK, AND NEVER THE LAST ONE.
 *
 * Four is the number the literature and every commercial programme converge on,
 * and it falls out of the same arithmetic here: at three days a week that is
 * twelve sessions of accumulation, which is about as long as load can climb
 * before it stops being a straight line.
 *
 * The second half of the rule matters as much. A deload is a run-up to
 * something, so an easier week with no week after it is just a block that ends
 * quietly. A four week block therefore has no deload in it at all - it is not
 * long enough to need one - and a five week block eases off in week four and
 * finishes hard in week five.
 */
export const DELOAD_EVERY_WEEKS = 4;

/**
 * Session types with a load worth taking off.
 *
 * A deload week on a cycle of prehab and mobility is meaningless: there is
 * nothing to ease. Two days a week of Joint Health therefore never sees one,
 * and five days of it does, because at five days that cycle picks up a full
 * body session. The same rule the test-week gate follows - look at what is
 * actually in the cycle, not at the name on the front.
 */
const LOADED_TYPES: SessionType[] = [
  'squat',
  'bench',
  'deadlift',
  'upper_body',
  'lower_body',
  'full_body',
];

export function cycleHasLoadedWork(cycle: SessionType[]): boolean {
  return cycle.some((t) => LOADED_TYPES.includes(t));
}

/**
 * WHICH SESSIONS OF THIS BLOCK ARE DELIBERATELY EASIER. 0-based, on-plan only.
 *
 * COUNTED IN SESSIONS, AND THAT IS THE WHOLE FIX. This used to be counted in
 * weeks, where a "week" is however many sessions you train. So the gap between
 * easier weeks was four times your training frequency: every 8 sessions if you
 * trained twice a week, every 20 if you trained five times. The person doing
 * the most work waited the longest, which is exactly backwards, and because the
 * last week was excluded the DEFAULT block got nothing at all. Measured across
 * every block length the builder offers against every frequency, 24 of the 36
 * combinations had no easier week anywhere in them.
 *
 * Fatigue accumulates per session, not per calendar week, so the schedule now
 * does too. The deload lands on the same session number for everybody.
 *
 * A DELOAD IS STILL A WEEK'S WORTH, not one session. It opens at the session
 * below and runs for `days` sessions, which is what "an easier week" means to
 * somebody following the plan.
 *
 * AND IT NEVER TOUCHES THE LAST SESSION. Finishing a block on a deliberately
 * light session would take the ending away, and the block boundary is its own
 * rest. A window that would reach the end is trimmed rather than dropped, so a
 * five-day-a-week user still gets one.
 */
export const DELOAD_EVERY_SESSIONS = 8;

/**
 * And at most three sessions of it, however often somebody trains.
 *
 * A week's worth is the right idea and the wrong measure at the top end: five
 * days a week over a twenty session block is two windows of five, which eases
 * eight sessions out of twenty. Forty per cent of a block is not a deload, it is
 * a different programme. Three is a real easier stretch for anybody and caps the
 * damage at the frequencies where a week is a large fraction of the block.
 */
export const DELOAD_MAX_SESSIONS = 3;

export function deloadIndexes(p: EnrolledProgramme): Set<number> {
  const out = new Set<number>();
  if (!cycleHasLoadedWork(cycleOf(p))) return out;
  const span = Math.min(p.days, DELOAD_MAX_SESSIONS);
  // The last session is never eased, so it is also the last thing a window may
  // reach back from.
  const lastEasable = p.sessions - 2;
  for (let start = DELOAD_EVERY_SESSIONS; start <= lastEasable; start += DELOAD_EVERY_SESSIONS) {
    for (let i = start; i < start + span && i <= lastEasable; i++) out.add(i);
  }
  return out;
}

/**
 * The same thing expressed in weeks, for anywhere that shows one.
 *
 * Derived from the sessions rather than computed alongside them, so the chips
 * in the hub and the sessions the engine actually eases cannot drift apart.
 */
export function deloadWeeksFor(p: EnrolledProgramme): number[] {
  const weeks = new Set<number>();
  for (const i of deloadIndexes(p)) weeks.add(Math.floor(i / p.days) + 1);
  return [...weeks].sort((a, b) => a - b);
}

/**
 * Is the on-plan session at this 0-based index in an easier week?
 *
 * Indexed by session rather than dated, for the same reason the block is: the
 * week you are in is the week's worth of work you have reached. Somebody who
 * trained twice in a fortnight has not deloaded by accident.
 */
export function isDeloadIndex(p: EnrolledProgramme, onPlanIndex: number): boolean {
  if (onPlanIndex < 0 || onPlanIndex >= p.sessions) return false;
  // Asked of the sessions directly rather than of the weeks they fall in. A
  // window that was trimmed to keep the last session normal covers part of a
  // week, and rounding that back up to the whole week would ease a session the
  // schedule deliberately left alone.
  return deloadIndexes(p).has(onPlanIndex);
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
    // The session about to be done, not the one just finished, which is why it
    // is indexed by onPlan rather than onPlan - 1.
    deload: !complete && isDeloadIndex(p, onPlan),
    deloadWeeks: deloadWeeksFor(p),
    deloadSessions: [...deloadIndexes(p)].sort((a, b) => a - b).map((i) => i + 1),
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
  /** It fell in one of the block's planned easier weeks. */
  deload: boolean;
}

export function tagSessions(
  p: EnrolledProgramme,
  sessionTypesSinceEnrolment: SessionType[]
): SessionPlanTag[] {
  const out: SessionPlanTag[] = [];
  let onPlan = 0;
  for (const type of sessionTypesSinceEnrolment) {
    // Asked per session rather than once, so a day count changed mid-block does
    // not reclassify everything done before it. See cycleOfAt.
    const cycle = cycleOfAt(p, onPlan);
    if (type === cycle[onPlan % cycle.length]) {
      // Read at the index this session OCCUPIED, which is the count before it
      // was added, not after.
      const deload = isDeloadIndex(p, onPlan);
      onPlan++;
      out.push({ onPlan: true, blockIndex: onPlan, deload });
    } else {
      out.push({ onPlan: false, blockIndex: null, deload: false });
    }
  }
  return out;
}

// ─── When the programme is being trained around ─────────────────────────────

/**
 * THE BLOCK DOES NOT NOTICE BEING IGNORED, and that is the gap this closes.
 *
 * "Train whatever you want in between" is the promise, and the app keeps it
 * perfectly: an off-plan session is logged, counted, and leaves the block
 * exactly where it was. What it never did was READ that. Somebody who trains
 * five times a fortnight and does one programme session gets no acknowledgement
 * of it at all, and keeps being offered a squat every time they open the app.
 *
 * The assistant already watches for a stalled lift, an unclocked personal best
 * and a knee flagged five times in ten weeks. This is the same machinery pointed
 * at the block, and it is the difference between "adaptive" being a word on the
 * store listing and being something the app does.
 *
 * IT IS NOT A TELLING-OFF. Nothing here is wrong. The message this produces has
 * to say so, and has to end with an offer rather than an instruction, because
 * the honest reading of somebody consistently doing something else is that they
 * are on the wrong programme rather than that they are failing at this one.
 */
export interface ProgrammeDrift {
  /** Sessions looked at. Always DRIFT_WINDOW once the rule fires. */
  window: number;
  /** How many of those were the programme's. */
  onPlan: number;
  /** What they have actually been doing instead, most often. */
  favoured: SessionType;
  /**
   * The programme whose cycle is closest to what they have actually been doing,
   * or null when nothing on the list fits better than what they are on.
   */
  suggestion: ProgrammeId | null;
}

/**
 * How many recent sessions the rule looks at, and how few of them may be the
 * programme's before it says anything.
 *
 * Eight and two. Deliberately a high bar: one busy fortnight is not drift, and
 * an app that asks whether you are on the right programme after a single week
 * of conditioning is an app that nags. Eight sessions with only two on plan is a
 * pattern nobody could call an accident.
 */
export const DRIFT_WINDOW = 8;
export const DRIFT_MAX_ON_PLAN = 2;

export function programmeDrift(
  p: EnrolledProgramme,
  sessionTypesSinceEnrolment: SessionType[]
): ProgrammeDrift | null {
  if (p.paused) return null;
  if (sessionTypesSinceEnrolment.length < DRIFT_WINDOW) return null;

  // Tag the WHOLE history, then look at the tail. Tagging only the tail would
  // replay the cycle from its first item and call on-plan sessions off-plan.
  const tags = tagSessions(p, sessionTypesSinceEnrolment);
  const from = sessionTypesSinceEnrolment.length - DRIFT_WINDOW;
  const window = sessionTypesSinceEnrolment.slice(from);
  const windowTags = tags.slice(from);
  const onPlan = windowTags.filter((t) => t.onPlan).length;
  if (onPlan > DRIFT_MAX_ON_PLAN) return null;

  const counts = new Map<SessionType, number>();
  window.forEach((type, i) => {
    if (windowTags[i].onPlan) return;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  });
  let favoured: SessionType | null = null;
  let best = 0;
  for (const [type, n] of counts) {
    if (n > best) {
      best = n;
      favoured = type;
    }
  }
  // Every session in the window was on plan is impossible here, but a window of
  // nothing but sessions the cycle happened to contain is not, so guard it.
  if (!favoured) return null;

  return { window: DRIFT_WINDOW, onPlan, favoured, suggestion: closestProgramme(window, p.templateId) };
}

/**
 * Which of the seven fits what somebody has ACTUALLY been doing.
 *
 * TWO HALVES, MULTIPLIED, and the second half is the one that earns its place.
 *
 *   COVERAGE  how much of what they have been doing the cycle contains. On its
 *             own this is what the first version used, and it ties constantly:
 *             somebody doing nothing but prehab and mobility is covered
 *             perfectly by Joint Health AND by Return to Lifting, and the answer
 *             came down to which appeared first in the list.
 *   FOCUS     how much of the cycle is work they actually do. This is what
 *             separates the two: Joint Health is entirely that work, Return to
 *             Lifting carries a full body day they have not touched. The one
 *             that is ABOUT what they are doing beats the one that merely
 *             includes it.
 *
 * A blunt measure either way, and the right kind of blunt: the question is not
 * "which programme is best for this person", which no arithmetic can answer. It
 * is "is there one on the list that looks more like what they are actually doing
 * than the one they are on". Near-misses return null, because suggesting a
 * switch that would change almost nothing is worse than saying nothing.
 */
export function closestProgramme(
  recentTypes: SessionType[],
  current: ProgrammeId,
  days: TrainingDays = 3
): ProgrammeId | null {
  if (recentTypes.length === 0) return null;
  const doing = new Set(recentTypes);
  const fit = (id: ProgrammeId) => {
    const cycle = cycleFor(id, days);
    const inCycle = new Set(cycle);
    const coverage = recentTypes.filter((t) => inCycle.has(t)).length / recentTypes.length;
    const focus = [...inCycle].filter((t) => doing.has(t)).length / inCycle.size;
    return coverage * focus;
  };
  const mine = fit(current);
  let best: ProgrammeId | null = null;
  let bestShare = 0;
  for (const id of PROGRAMME_IDS) {
    if (id === current) continue;
    const s = fit(id);
    if (s > bestShare) {
      bestShare = s;
      best = id;
    }
  }
  // A clear margin, not a hair. Moving somebody to a programme that covers one
  // more session in eight is churn dressed up as insight.
  return best !== null && bestShare >= mine + 0.25 ? best : null;
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
export function blockPlan(
  p: EnrolledProgramme
): { week: number; type: SessionType; deload: boolean }[] {
  const cycle = cycleOf(p);
  // The session set, not the week set: the printed plan has to agree row for
  // row with what the engine will actually build.
  const eased = deloadIndexes(p);
  const out: { week: number; type: SessionType; deload: boolean }[] = [];
  for (let i = 0; i < p.sessions; i++) {
    const week = Math.floor(i / p.days) + 1;
    out.push({ week, type: cycle[i % cycle.length], deload: eased.has(i) });
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
 *                 move with it. See lib/rep-scheme.ts.
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
  // The same as advanced, deliberately. This number decides the WORD printed on
  // the block, and the label has to describe the work. An athlete on the three
  // day barbell block is handed the same sessions as an advanced lifter - the
  // same movement band, the same schemes, the same sets - so calling it Elite
  // for one of them and Advanced for the other would be the app flattering
  // somebody for the answer they gave. Raise it when athlete sessions actually
  // differ, and not before.
  athlete: 3,
};

/** The hardest label each experience level can be prescribed. See the docblock. */
const CAPABILITY_CEILING: Record<ExperienceLevel, number> = {
  beginner: 1,
  intermediate: 3,
  advanced: 5,
  // Also the same as advanced, and this one is the earn-the-barbell rule. The
  // ladders stop at level 5 and advanced already reaches it, so the top of the
  // scale cannot move up. Do NOT make room by lowering advanced: everybody who
  // has already answered "3 yrs plus" would lose a rung overnight for a change
  // they never made.
  athlete: 5,
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
export function levelCeilingFor(
  experience: ExperienceLevel,
  /** Rungs earned by finishing blocks. See UserProfile.earnedLevelBonus. */
  earnedBonus: number = 0
): ExerciseLevel {
  let max = 1;
  for (let i = 0; i <= CAPABILITY_CEILING[experience]; i++) {
    const band = levelBandFor(DIFFICULTY_LABELS[i]);
    if (band.max > max) max = band.max;
  }
  // Clamped at both ends. A negative bonus cannot drag somebody below the level
  // they answered for, and nothing can climb past the top of the ladder.
  const bonus = Math.max(0, Math.trunc(earnedBonus));
  return Math.min(MAX_EXERCISE_LEVEL, max + bonus) as ExerciseLevel;
}

/** The top of every ladder in lib/exercise-levels.ts. Nothing goes past it. */
export const MAX_EXERCISE_LEVEL = 5;

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
export function levelBandForExperience(
  experience: ExperienceLevel,
  earnedBonus: number = 0
): LevelBand {
  const max = levelCeilingFor(experience, earnedBonus);
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
