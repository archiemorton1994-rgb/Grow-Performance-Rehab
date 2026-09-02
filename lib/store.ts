import type { CardioMachineId } from '@/lib/cardio-warmup';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SyncPayload } from '@/lib/sync';
import { evaluateBadges } from '@/lib/badge-engine';
import { displayUnitToKg, isoWeek } from '@/lib/utils';
import { mergeSessionsById } from '@/lib/sync-merge';
import { canonicalExerciseName } from '@/lib/exercise-aliases';
import { performanceForLog } from '@/lib/set-performance';
import {
  combineWithMeasuredReps,
  measuredRating,
  metRepFloor,
  nextPrescription,
} from '@/lib/rep-scheme';
import { CLEAN_SESSIONS_PER_BIG_JUMP } from '@/lib/workout-engine';
import {
  getTrainingBalanceNudge as getBalanceNudge,
  type BalanceNudge,
} from '@/lib/training-balance';
import {
  COMEBACK_SESSIONS,
  estimateOrmFromAmrap,
  getReturnWindow as computeReturnWindow,
  setLastTrainedDate,
  type ReturnWindow,
} from '@/lib/workout-engine';

import type { Answers, InjuryAge } from './profile-tree';
import { outcomeFrom } from './profile-tree';
import type {
  CustomProgramme,
  EnrolledProgramme,
  ProgrammePosition,
  ProgrammeDrift,
  SessionPlanTag,
} from './programme';
import {
  cycleOf,
  goalsForFocus,
  programmePosition,
  programmeDrift,
  selectProgramme,
  sessionsCountingToward,
  tagSessions,
} from './programme';
import { archiveIdFor, completeProgramme, MAX_EARNED_BONUS } from './programme-report';
import { builderTypedMaxes, unitCorrectionFor } from './unit-correction';
import type { UnitCorrection } from './unit-correction';
import type { CompletedProgramme } from './programme-report';

export type EquipmentTier = 'bodyweight' | 'bands' | 'dumbbells' | 'kettlebells' | 'fullgym';
export type EnergyLevel = 'low' | 'normal' | 'high';

export type SessionType =
  | 'squat'
  | 'bench'
  | 'deadlift'
  | 'upper_body'
  | 'lower_body'
  | 'full_body'
  | 'conditioning'
  | 'prehab'
  | 'flexibility'
  | 'custom';
/** Session types that contribute to strength progressive overload (KPI lifts only). */
export const STRENGTH_SESSION_TYPES: SessionType[] = ['squat', 'bench', 'deadlift'];
/** Weekly balanced programming sessions (not KPI-focused). */
export const WEEKLY_SESSION_TYPES: SessionType[] = ['upper_body', 'lower_body', 'full_body'];
export type ExerciseCategory =
  | 'prep'
  | 'mechanical'
  | 'neuro'
  | 'main'
  | 'accessory'
  | 'prehab'
  | 'finisher'
  | 'cooldown'
  | 'cardio';

export interface CardioLogData {
  durationMinutes: number;
  speedKmh?: number;
  distanceKm?: number;
}
export type TimeAvailable = '30' | '45' | '60';
/**
 * How often a strength test week comes due — or 'never'.
 *
 * 'never' exists because plenty of people do not train the three barbell lifts
 * at all: custom-session-only users, people who follow the conditioning and
 * mobility work in their own pattern, people doing weeks of rehab. Before this,
 * the only options were every 12 or every 18 sessions and there was no way to
 * decline, so a max-effort barbell test was imposed on everyone who ever
 * touched a KPI lift.
 */
export type TestWeekFrequency = 12 | 18 | 'never';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type FitnessGoal = 'strength' | 'muscle' | 'fat_loss' | 'fitness' | 'rehab' | 'power';
export type WeightUnit = 'kg' | 'lbs';

export type PainRegion =
  | 'front_shoulder'
  | 'rear_shoulder'
  // Split from a single 'elbow_wrist' region: they are different joints with
  // different aggravating movements and different rehab work. Persisted data
  // still containing 'elbow_wrist' is migrated to both — see migrate() below.
  | 'elbow'
  | 'wrist'
  | 'neck'
  | 'lower_back'
  | 'upper_back'
  | 'core_ribs'
  | 'knee'
  | 'hip_groin'
  | 'ankle_achilles'
  | 'calf_shin'
  | 'chest'
  | 'bicep'
  | 'tricep'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'lat_mid_back';

export const PAIN_CATEGORIES = {
  upper: {
    label: 'Upper Body',
    regions: [
      { id: 'front_shoulder' as PainRegion, label: 'Front Shoulder' },
      { id: 'rear_shoulder' as PainRegion, label: 'Rear Shoulder' },
      { id: 'elbow' as PainRegion, label: 'Elbow' },
      { id: 'wrist' as PainRegion, label: 'Wrist' },
      { id: 'neck' as PainRegion, label: 'Neck' },
    ],
  },
  torso: {
    label: 'Torso',
    regions: [
      { id: 'lower_back' as PainRegion, label: 'Lower Back' },
      { id: 'upper_back' as PainRegion, label: 'Upper Back / Thoracic' },
      { id: 'core_ribs' as PainRegion, label: 'Core' },
    ],
  },
  lower: {
    label: 'Lower Body',
    regions: [
      { id: 'knee' as PainRegion, label: 'Knee' },
      { id: 'hip_groin' as PainRegion, label: 'Hip' },
      { id: 'ankle_achilles' as PainRegion, label: 'Ankle' },
      { id: 'calf_shin' as PainRegion, label: 'Calf / Shin' },
    ],
  },
  upper_muscles: {
    label: 'Upper Body Muscles',
    regions: [
      { id: 'chest' as PainRegion, label: 'Chest' },
      { id: 'bicep' as PainRegion, label: 'Bicep / Front Arm' },
      { id: 'tricep' as PainRegion, label: 'Tricep / Back Arm' },
    ],
  },
  lower_muscles: {
    label: 'Lower Body Muscles',
    regions: [
      { id: 'quads' as PainRegion, label: 'Quads (Front Thigh)' },
      { id: 'hamstrings' as PainRegion, label: 'Hamstrings (Back Thigh)' },
      { id: 'glutes' as PainRegion, label: 'Glutes' },
      { id: 'lat_mid_back' as PainRegion, label: 'Lats' },
    ],
  },
};

/**
 * Every region a user can actually flag, which is all five groups.
 *
 * This used to add upper, torso and lower and stop, silently leaving out
 * upper_muscles and lower_muscles. The body diagram on the readiness screen
 * offers all nineteen (see REGION_FRONT and REGION_BACK in app/(tabs)/recover
 * .tsx, and tests/prehab-regions.check.mjs, which proves every one of them has
 * rehab work behind it). The paywall prints this number as "pain zones", so
 * the app was underselling itself by seven.
 *
 * Summed over Object.values rather than three named groups, so a sixth group
 * cannot be forgotten the same way.
 */
export const PAIN_ADAPTATION_REGION_COUNT = Object.values(PAIN_CATEGORIES).reduce(
  (total, group) => total + group.regions.length,
  0
);

export interface ExerciseFeedback {
  tooEasy: boolean;
  thumbs: 'up' | 'down' | null;
  multiplier: number;
}

export interface CustomExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  cue: string;
  suggestedLoad: string;
  category: ExerciseCategory;
  type?: 'cardio';
}

export interface CustomTemplate {
  id: string;
  name: string;
  exercises: CustomExercise[];
  createdAt: string;
}

/** How an exercise went, as it affects the NEXT session's prescription -
 *  'very_easy' and 'easy' both loosen the step size (a bigger jump for
 *  'very_easy'), 'hard' holds it. There is no 'normal' value: it is the
 *  derived default when nothing is reported.
 *
 *  This is NOT what the user taps. They answer Easy / Challenging / Too Hard
 *  once per SET, and lib/auto-regulation.ts (feedbackRatingFor) folds the run
 *  of answers for an exercise down to one of these — "Challenging" maps to
 *  nothing, and two or more "Easy" answers earn 'very_easy'. */
export type FeedbackRating = 'very_easy' | 'easy' | 'hard';

/** The per-exercise performance state that actually drives progression.
 *  Derived by completeSession() from raw set-completion data, then
 *  optionally upgraded/downgraded by in-session or post-session feedback. */
export type ExercisePerformance = 'very_easy' | 'easy' | 'normal' | 'failed';

/** How bad today's ache is, captured alongside the pain region on the
 *  readiness screen. 'severe' triggers a confirming prompt suggesting a
 *  region-targeted Recovery/Prehab session instead of the planned strength
 *  session - 'mild'/'moderate' just ride along on the completed session for
 *  future reference and don't change routing. */
export type PainSeverity = 'mild' | 'moderate' | 'severe';

export interface SetLog {
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
  skipped?: boolean;
}

export interface InProgressSetData {
  sets: SetLog[];
  swapCount: 0 | 1 | 2;
  activeSetIndex: number;
  /**
   * The cardio machine the user moved the warm-up to, if they moved it.
   *
   * Deliberately separate from swapCount, which is a 0/1/2 slot machinery for
   * the two hand-authored alternatives an exercise can carry and is persisted
   * with that meaning. There are four machines and no reason a fifth could not
   * be added, so the machine is stored as what it is. Optional, so a session
   * paused by an older build still restores.
   */
  cardioMachine?: CardioMachineId;
}

export interface ActiveSession {
  sessionType: SessionType;
  equipmentTier: EquipmentTier;
  hasAches: boolean;
  painRegion?: PainRegion;
  /**
   * The FULL pain context the session was built from.
   *
   * `painRegion` above is only the first area tapped, and for a long time it was
   * the only part of the pain answer that survived a save. Resuming rebuilt the
   * workout without the severity, without the other sore areas and without the
   * acute flag, produced a different exercise list, decided the snapshot did not
   * match it, and silently discarded every logged set — while the Home card
   * still advertised "12/24 sets" and offered a Resume button.
   *
   * Optional because snapshots written by older builds will not have them.
   */
  painRegions?: PainRegion[];
  painSeverity?: PainSeverity;
  acute?: boolean;
  energy: EnergyLevel;
  timeAvailable: TimeAvailable;
  isTestWeek: boolean;
  /** Optional launch-context label (e.g. "Recovery" vs "Targeted Prehab") shown in history. */
  displayLabel?: string;
  exerciseData: InProgressSetData[];
  exerciseNotes: string[];
  activeIndex: number;
  savedAt: string;
  completedSetsCount: number;
  totalSets: number;
  sessionName: string;
  elapsedSeconds: number;
  exerciseIds: string[];
  customExercises?: CustomExercise[];
  /** Whether the user has already dismissed the pain-adaptation banner. Persisted so it stays gone on session resume. */
  painBannerDismissed?: boolean;
  /** Same, for the acute pain-free rule banner. Its own flag because it is
   *  its own banner carrying its own clinical instruction. */
  painFreeBannerDismissed?: boolean;
  /** Per-exercise in-session feedback captured so far; restored on resume. */
  inSessionFeedback?: Record<string, FeedbackRating>;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  sets: SetLog[];
  note?: string;
  /** How the user felt about this exercise during the session. Drives next-session load adjustments. */
  feedbackRating?: FeedbackRating;
  /** Populated for cardio exercises (Custom session type: 'cardio'). */
  cardioData?: CardioLogData;
  /**
   * The reps the card ASKED for, as prescribed ("8-10", "12 each side").
   *
   * Recorded because double progression needs to know whether the target was
   * met, and "12 reps logged" only answers that against the target that was on
   * screen at the time. Without it the app compares this session's result to
   * next session's prescription, which is how a rep target quietly creeps.
   */
  targetReps?: string;
  /** The category, so the next prescription knows which tier this was. */
  category?: ExerciseCategory;
}

export interface OneRepMax {
  lift: SessionType;
  weight: number;
  reps?: number;
  date: string;
  unit: 'kg';
  /**
   * Where this number came from.
   *
   * 'test' is a max actually attempted in a test week. 'manual' is an estimate
   * the user typed into the calculator on the Stats tab from a set they had
   * already done. They were indistinguishable, and the test-week summary read
   * oneRepMaxes[1] as "your last test" - so somebody who used the calculator
   * between test weeks was told "Up 23 kg on your last test" when the real
   * answer was 10.
   *
   * Optional because entries written before this field existed cannot be
   * classified. Those are treated as tests, which is what almost all of them
   * are: the calculator is the newer and rarer path.
   */
  source?: 'test' | 'manual';
}

export interface CompletedSession {
  id: string;
  sessionType: SessionType;
  date: string;
  equipmentTier: EquipmentTier;
  hadAches: boolean;
  painRegion?: PainRegion;
  /** All pain regions selected at session start (multi-select). Supersedes the single painRegion field. */
  painRegions?: PainRegion[];
  /** How bad the ache was reported to be, when hadAches is true. */
  painSeverity?: PainSeverity;
  energy: EnergyLevel;
  timeAvailable: TimeAvailable;
  exerciseCount: number;
  exerciseLogs: ExerciseLog[];
  isTestWeek?: boolean;
  durationSeconds?: number;
  /** Optional launch-context label (e.g. "Recovery" vs "Targeted Prehab") shown in history. */
  displayLabel?: string;
  /** Optional free-text note the user added on the session summary screen. */
  notes?: string;
}

/** One logged appearance of a weighted exercise within a single completed session. */
export interface ExerciseAppearance {
  date: string;
  bestSetWeight: number;
  avgWorkingWeight: number;
  /**
   * Reps on the heaviest set, and an estimated one-rep max from the pair.
   *
   * WHY THE WEIGHT ALONE WAS NOT ENOUGH.
   * The app deliberately climbs reps before it adds weight - eight, then nine,
   * then ten at the same load, and only then a plate. Charting the weight on
   * its own therefore hides the entire first half of every progression: a
   * lifter who went from eight reps to twelve at the same weight saw a flat
   * line, on the exact mechanic the app is built around, and concluded they
   * were not progressing.
   *
   * The estimate is Epley, the same formula estimateOrmFromAmrap already uses
   * for AMRAP sets, so a weight-and-rep pair becomes one number that moves when
   * either half of it does.
   *
   * Optional because every appearance recorded before this change has no rep
   * count. Readers fall back to bestSetWeight, so an old chart keeps working
   * and simply starts carrying reps from the next session on.
   */
  bestSetReps?: number;
  estimatedOrmKg?: number;
}

/** All-time progress for a single weighted exercise, aggregated across every completed session. */
export interface ExerciseProgress {
  exerciseId: string;
  exerciseName: string;
  sessionType: SessionType;
  /** Chronological, oldest appearance first. */
  appearances: ExerciseAppearance[];
}

export type Sex = 'male' | 'female' | 'other';

export interface BodyweightLogEntry {
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  /** Weight in kg. */
  kg: number;
}

export interface UserProfile {
  name: string;
  sex: Sex;
  experienceLevel: ExperienceLevel;
  goals: FitnessGoal[];
  bodyweightKg: number;
  /**
   * All three are OPTIONAL and are undefined for everybody who signed up before
   * the profile tree existed. Nothing may assume they are present: the app has
   * to behave exactly as it does today for a profile that has none of them.
   */
  ageYears?: number;
  /**
   * RUNGS OF THE MOVEMENT LADDER EARNED BY FINISHING BLOCKS, on top of whatever
   * `experienceLevel` allows. Zero for everybody who has not finished one.
   *
   * SEPARATE FROM experienceLevel ON PURPOSE. That answer is something somebody
   * told us about their life outside the app, and it is the answer the hub's own
   * level control edits. This is something they showed us inside it. Writing the
   * second over the first would lose the answer they gave, and would mean the
   * app and the user were both writing to one box for two different reasons.
   *
   * One rung per block cleared, offered by the report and never applied without
   * being accepted. See levelStepFor in lib/programme-report.ts.
   */
  earnedLevelBonus?: number;
  /**
   * WHICH MOVEMENT PATTERNS THEY CAN ACTUALLY DO, from the builder's zero-load
   * screen. See PROGRESSION-LADDERS.md, Phase 1.
   *
   * UNDEFINED IS NOT AN EMPTY LIST. Undefined means no screen was ever taken -
   * every account before this existed, and anybody who skipped the question -
   * and must leave the app behaving exactly as it does for them today. An empty
   * array is somebody who took the screen and passed none of it, and every
   * pattern starts from foundations.
   */
  screenPassed?: string[];
  /**
   * THE SAME QUESTION, ASKED ONE AT A TIME, WHERE IT MATTERS.
   *
   * The builder's movement screen is optional and always will be: reviewed from
   * outside, a wall of movement self-tests during sign-up was called out as the
   * kind of friction that makes people drop out, and skipping it deliberately
   * caps nothing. That leaves a gap. Somebody who skipped it and described
   * themselves as experienced is handed complex movements with nothing having
   * checked anything.
   *
   * So the check moved to the point of use for those people: the first time a
   * session offers a genuinely complex movement on a ladder they have never
   * answered for, the card asks one plain question and eases the movement down
   * if the answer is no. The answer is kept here.
   *
   * KEPT APART FROM screenPassed ON PURPOSE. That field has three states and the
   * difference between them is load-bearing: undefined is "no screen taken" and
   * caps nothing, an empty array is "took it and passed none" and caps
   * everything. Writing one in-session answer into it would flip somebody from
   * the first state to the second and clamp the other five patterns on the
   * strength of a question about one.
   */
  patternChecks?: Record<string, boolean>;
  /**
   * Areas a CLINICIAN has told them to stay off, which is not the same list as
   * what is sore.
   *
   * A shoulder that does not hurt today because it has been avoided for six
   * months is absent from standingSoreRegions and belongs here. It is treated
   * as a standing area to work around whether or not anything hurts.
   *
   * TYPED AS REGIONS rather than plain strings, which it always was in practice:
   * the builder filters its answers down to PainRegion before storing them, and
   * the engine cast it back on the way in. The loose type bought nothing and
   * meant the two standing lists - this and standingSoreRegions, which do the
   * same job through the same code path - did not agree on what they held.
   */
  clinicalAvoid?: PainRegion[];
  /**
   * The heaviest hand weight they can reach, in kg. Absent for a full gym, and
   * for everybody who did not say.
   */
  maxKitKg?: number;
  /**
   * Areas reported as sore in the BUILDER, which is a standing fact about a
   * person rather than the per-session pain flag on the readiness screen. Until
   * now a shoulder that had hurt for six months was re-learned before every
   * session and forgotten after it, and nothing about it reached the programme.
   */
  standingSoreRegions?: PainRegion[];
  standingSoreSince?: InjuryAge | null;
}

/**
 * Bounds for the two numbers a user types that the load maths then multiplies by.
 *
 * Bodyweight scales the entire starting-load heuristic and a 1RM sets the working
 * weight directly, so a misplaced digit does not produce a slightly wrong session,
 * it produces one that cannot be completed: the session bar has its own 500 kg
 * plausibility ceiling (MAX_PLAUSIBLE_KG in app/session.tsx) and simply refuses
 * the weight the app itself just prescribed, with nothing on screen to explain why.
 *
 * Generous rather than clever, on purpose. These exist to catch 9999, 0.0001 and
 * 1e5 — not to argue with anyone's real numbers. The 1RM ceiling is the session
 * bar's own ceiling so that the two can never disagree about what is loggable.
 */
export const MIN_BODYWEIGHT_KG = 25;
export const MAX_BODYWEIGHT_KG = 300;
export const MIN_ONE_REP_MAX_KG = 5;
export const MAX_ONE_REP_MAX_KG = 500;

export function isPlausibleBodyweightKg(kg: number): boolean {
  return Number.isFinite(kg) && kg >= MIN_BODYWEIGHT_KG && kg <= MAX_BODYWEIGHT_KG;
}

export function isPlausibleOneRepMaxKg(kg: number): boolean {
  return Number.isFinite(kg) && kg >= MIN_ONE_REP_MAX_KG && kg <= MAX_ONE_REP_MAX_KG;
}

/**
 * Every answer given in onboarding so far, and the step it was given on.
 *
 * The flow's answers used to live only in component state, which a reload throws
 * away — routine on web, and exactly what a backgrounded phone amounts to once the
 * OS evicts the app. An eight-step form that restarts from nothing is a form most
 * people do not fill in a second time.
 *
 * This is deliberately NOT the profile. Nothing outside onboarding reads it, and
 * writing it never sets `onboardingComplete` — a draft is a half-finished answer
 * sheet, and the gate in app/_layout.tsx has to keep treating it as unfinished.
 */
export interface OnboardingDraft {
  /**
   * EVERY ANSWER, keyed by question id, exactly as lib/profile-tree.ts stores
   * them. This is the whole draft now.
   *
   * The tree recomputes which questions apply from the answers themselves, so
   * there is no step to save. That is the point: the old draft stored a step
   * INDEX, which means something different the moment a question moves, and it
   * could disagree with the answers beside it. A number that can contradict the
   * data it indexes into is a bug waiting for a release.
   */
  treeAnswers?: Answers;

  /**
   * The pager's fields, kept OPTIONAL so a draft written by the old builder
   * still parses rather than throwing on somebody who was half way through when
   * they updated. Nothing reads them any more; they are here so that an
   * abandoned draft is ignored instead of being a crash.
   */
  step?: number;
  name?: string;
  sex?: Sex | null;
  experienceLevel?: ExperienceLevel | null;
  bodyweight?: string;
  goals?: FitnessGoal[];
  equipmentTiers?: EquipmentTier[];
  ormSquat?: string;
  ormBench?: string;
  ormDeadlift?: string;
  testWeekFrequency?: TestWeekFrequency;
}

export const TIER_ORDER: EquipmentTier[] = [
  'bodyweight',
  'bands',
  'dumbbells',
  'kettlebells',
  'fullgym',
];

interface AppState {
  onboardingComplete: boolean;
  /** In-progress onboarding answers, or null when there is nothing half-finished.
   *  Persisted; cleared the moment onboarding is completed. Never a substitute for
   *  onboardingComplete — see OnboardingDraft. */
  onboardingDraft: OnboardingDraft | null;
  equipmentTiers: EquipmentTier[];
  completedCount: number;
  completedSessions: CompletedSession[];
  oneRepMaxes: OneRepMax[];
  testWeekFrequency: TestWeekFrequency;
  /** True when a due test week was postponed (e.g. proper equipment wasn't
   *  available that day) rather than skipped outright. Keeps isTestWeekDue()
   *  true on the very next strength session instead of waiting a full
   *  testWeekFrequency-session cycle for it to come due again. Cleared once a
   *  genuine test-week session completes. Persisted. */
  testWeekDeferred: boolean;
  /**
   * A Reset Progress whose cleared state has not yet reached the server.
   *
   * Startup restores the server copy whenever it is ahead on sessions, which
   * right after a reset it always is. Without this, a reset performed with no
   * signal was silently undone on the next launch. mergeServerData refuses to
   * restore while it is set; a genuinely successful upload clears it.
   */
  resetPendingUpload: boolean;
  userProfile: UserProfile;
  exerciseFeedback: Record<string, ExerciseFeedback>;
  lastReadinessEnergy: EnergyLevel;
  lastReadinessTime: TimeAvailable;
  lastPainRegion: PainRegion | null;
  /** Whether the first-launch guided tour has been completed or skipped. Persisted. */
  tourComplete: boolean;
  /** Transient flag set for ~2.5 s after the tour completion CTA is tapped.
   *  Home screen reads this to briefly pulse the suggested session card. */
  tourJustCompleted: boolean;
  /** Which tab (0=Home, 1=Profile, 2=Train, 3=Restore, 4=Stats) the guided
   *  tour is currently walking through, driving that tab's own in-page
   *  tutorial. Null when no tour is in progress. NOT persisted - a killed
   *  app just re-lands on the intro card rather than resuming mid-tour. */
  tourActiveTab: number | null;
  /**
   * Enter the next tab's tutorial at its LAST card rather than its first.
   *
   * Set only by the tour's Back control when it crosses a tab boundary, and
   * cleared by the entry effect that consumes it. NOT persisted: a killed app
   * restarts the tour from its intro, not halfway back through it.
   */
  tourEnterAtLastStep: boolean;
  /** Bumped every time the tour is skipped, from the intro card or from any
   *  tab's own tutorial, so the tabs layout (which owns the "find it in
   *  Settings" toast) can react regardless of where the skip happened.
   *  NOT persisted. */
  tourSkipNonce: number;
  /** True only when the user reached the natural end of the demo session —
   *  never set by skipping or exiting the tour early. Distinct from
   *  `tourComplete`, which is also true when skipped. Gates the one-time
   *  'onboarding_complete' badge so it rewards actually finishing, not
   *  bailing out. Persisted. */
  tourGenuinelyCompleted: boolean;
  /** Whether the readiness-screen 3-step tutorial has been shown. Persisted. */
  readinessTutorialShown: boolean;
  /** Whether the in-session 5-step tutorial has been shown. Persisted. */
  sessionTutorialShown: boolean;
  weightUnit: WeightUnit;
  /** ISO timestamp of the last time bodyweightKg was explicitly updated. Null if never updated via app. */
  bodyweightUpdatedAt: string | null;
  /** Chronological log of bodyweight updates. A new entry is appended on every save. */
  bodyweightLog: BodyweightLogEntry[];
  /** ISO timestamp of when the bodyweight reminder was last snoozed (dismissed without saving). */
  weightReminderSnoozedAt: string | null;
  lastWeightPromptedAt: number | null;
  /** Account id this device's training data belongs to, null when it belongs to
   *  nobody yet (fresh install, or straight after a sign-out). Sign-in reads it
   *  to tell "my own history, recovered after losing a session" apart from
   *  "the previous person's history", which must never be uploaded into the
   *  account now signing in. Persisted; deliberately not part of SyncPayload. */
  dataOwnerId: string | null;
  /**
   * This device predates owner tagging and may be claimed once.
   *
   * dataOwnerId shipped on 2026-08-11 without bumping the store version, so on
   * every device upgrading from an older build it rehydrates as null - and the
   * sign-in guard read `null !== yourId` as "somebody else's device" and
   * deleted their training. The v29 migration sets this for a device that has
   * completed sessions and no tag: such a device has necessarily been signed
   * in, because the paywall sits between onboarding and the tabs.
   *
   * Cleared the moment the device is tagged.
   */
  dataOwnerClaimPending: boolean;
  hasHydrated: boolean;
  activeSession: ActiveSession | null;
  /** Maximum weight (kg) logged per exercise name in any past session.
   *  Used by the workout engine to auto-progress load by +2.5 kg per session. */
  lastLoggedWeights: Record<string, number>;
  /** Whether the App Store review prompt has already been shown to this user. */
  reviewPromptShown: boolean;
  /** When the training-balance nudge was last dismissed, ms since epoch.
   *  Persisted, because dismissing it has to survive closing the app —
   *  otherwise it is a snooze that pretends to be an answer. */
  balanceNudgeDismissedAt: number | null;
  /**
   * When each assistant message was last waved away, by message id.
   *
   * Generic, because the panel now carries messages that have no natural end -
   * an observation about a chronic knee, a note explaining how the app works.
   * The original single balanceNudgeDismissedAt field is kept as it is rather
   * than migrated into this: it is persisted on every existing device and a
   * migration would be all risk and no benefit for one entry.
   */
  coachDismissedAt: Record<string, number>;
  /**
   * Assistant messages already shown, keyed by SIGNATURE rather than id.
   *
   * The id alone is not enough: 'personal-best' is the same id whether it is
   * reporting a deadlift from six weeks ago or one set an hour ago. The
   * signature pairs the id with the title, and the title carries the number, so
   * the button's badge lights again the moment the underlying fact changes and
   * stays quiet while it has not. See messageSignature in lib/coach.ts.
   */
  coachSeen: Record<string, number>;
  /** Whether the daily workout reminder is enabled. */
  reminderEnabled: boolean;
  /**
   * Has this person ever had an active subscription on this device?
   *
   * Set once, never cleared except by a full reset, and used for one thing: to
   * tell "has not started yet" from "had it and lost it" so the daily reminder
   * can say the right of two honest things. It decides no access whatsoever;
   * the gate reads hasActiveSubscription from RevenueCat and nothing else.
   */
  hasEverSubscribed: boolean;
  /**
   * Has this person been shown what the app does?
   *
   * The showcase sits between signing in and the paywall, so that nobody is
   * asked to pay for something they have not seen. Once through, they go
   * straight to the paywall on every later launch: a pitch you cannot get past
   * is worse than no pitch.
   *
   * It gates a SCREEN, never access. The subscription gate reads
   * hasActiveSubscription and nothing else.
   */
  showcaseComplete: boolean;
  /**
   * Which reminder audience this person is in, and when they entered it.
   *
   * Only the daily prompt uses it, to taper: daily for a fortnight, weekly
   * after that. Recorded per audience rather than once, so a subscription
   * lapsing starts a fresh fortnight rather than inheriting a clock that ran
   * out months ago.
   */
  reminderPromptKind: string | null;
  reminderPromptSince: string | null;
  /**
   * When the server last accepted this device's data.
   *
   * uploadUserData swallows every failure by design, because local is the
   * source of truth and a failed upload is retried on the next foreground. The
   * cost of that is a whole class of problem nobody can see: a payload that has
   * outgrown the body limit, an expired token, a server that has been down for
   * a week. Nothing in the app has ever told a user whether their training is
   * backed up at all. This is what lets it.
   */
  lastSyncedAt: string | null;
  /** Time for the daily workout reminder in "HH:MM" format (24-hour). */
  reminderTime: string;
  /** Whether the "missed workout" nudge notification is enabled. */
  nudgeEnabled: boolean;
  /** Whether the streak-protection alert (8pm on untrained days) is enabled. */
  streakProtectionEnabled: boolean;
  /**
   * Whether the assistant can be opened during a session. Default true.
   *
   * On by default because somebody who never opens Settings should still be
   * offered help, and off is one tap from inside the sheet itself.
   */
  inSessionAssistantEnabled: boolean;
  /** Minimum sessions per Mon–Sun week required to keep a streak alive (2–5). Default 2. */
  weeklyStreakGoal: number;
  /** Whether the bodyweight reminder push notification is enabled. Default true. */
  bodyweightReminderEnabled: boolean;
  /** Time for the streak-protection alert in "HH:MM" format (24-hour). Default '20:00'. */
  streakProtectionTime: string;
  /** Offset into the squat→bench→deadlift rotation for new users who chose a different starting session. */
  cycleStartOffset: number;
  /** User's preferred colour scheme. 'system' follows the device setting. Default 'dark'. Persisted. */
  themePreference: 'dark' | 'light' | 'system';
  /**
   * Transient per-session equipment override. Set by the Train or Home tab chip; cleared on app
   * restart. NOT persisted — lives only in memory for the current app session.
   */
  sessionEquipmentOverride: EquipmentTier[] | null;
  /** URI of the user's profile photo (local file URI from image picker). Null if not set. */
  profilePhotoUri: string | null;
  /**
   * Tracks how many consecutive sessions each exercise has appeared in with a
   * 'normal' (no-feedback) performance outcome. Incremented by `completeSession`
   * when `lastSessionPerformance[id]` was 'normal' before the new session ran,
   * and reset to 0 whenever any explicit feedback (thumbs/tooEasy) is received
   * or when performance was 'easy'/'failed'. The workout engine applies a larger
   * (+5 kg) progression step when this counter reaches 3.
   */
  exerciseNormalStreak: Record<string, number>;
  /**
   * Tracks how many consecutive sessions each exercise has come back 'failed'
   * (incomplete sets or a tough/thumbs-down rating) with no successful
   * session breaking the run. Incremented by `completeSession`; reset to 0
   * the moment that exercise comes back anything other than 'failed'. Drives
   * the plateau nudge on the session-summary Progress tab at streak ≥ 3 -
   * unlike exerciseNormalStreak, this never changes the suggested weight
   * itself, only whether the user is told they might be stuck.
   */
  exerciseStuckStreak: Record<string, number>;
  /**
   * Where each exercise currently sits in its rep range, as a prescription
   * string ("9-10", "12 each side").
   *
   * The missing half of progression. Load was remembered per exercise and reps
   * were not, so the only lever the engine had was weight - and the smallest
   * honest step is a 2.5 kg plate, which is 12.5% of a 20 kg dumbbell press.
   * With nowhere for reps to go, an honest "normal" session under about 50 kg
   * moved nothing at all, three sessions running.
   *
   * Absent for an exercise means "use whatever the catalogue says", which is
   * also what every existing account will have on upgrade.
   */
  exerciseRepTarget: Record<string, string>;
  /**
   * The plain-English reason the rep target moved, per exercise.
   *
   * lib/rep-scheme.ts writes one for every decision it makes and the field is
   * commented "for the card". Nothing kept it, so the reason was computed and
   * thrown away every session — and the session summary, having no better
   * source, read the internal 'failed' flag instead and told people who had
   * completed every set that they had left one incomplete.
   */
  exerciseRepNote: Record<string, string>;
  /**
   * Records how each exercise performed in the most recent session it appeared in.
   * Set by `completeSession` based on actual set completion data, then updated
   * by in-session or post-session thumbs/tooEasy feedback. The workout engine
   * uses this as the primary signal for per-exercise progressive overload decisions:
   *   'very_easy' → +7.5 kg next session
   *   'easy'      → +5 kg next session
   *   'normal'    → +2.5 kg next session (or +5 kg after a 3-session no-feedback streak)
   *   'failed'    → hold at same weight next session
   */
  lastSessionPerformance: Record<string, ExercisePerformance>;

  setOnboardingComplete: (complete: boolean) => void;
  /** Snapshot the answers given so far. Called on every change during onboarding.
   *  There is no matching clear(): the draft is thrown away by
   *  setOnboardingComplete(true), and by the full storage wipe on sign-out. */
  saveOnboardingDraft: (draft: OnboardingDraft) => void;
  setEquipmentTiers: (tiers: EquipmentTier[]) => void;
  setTestWeekFrequency: (freq: TestWeekFrequency) => void;
  /** Postpone today's due test week — isTestWeekDue() stays true until a
   *  genuine test-week session completes, instead of the count moving past it. */
  deferTestWeek: () => void;
  setUserProfile: (profile: Partial<UserProfile>) => void;
  setLastWeightPromptedAt: (ts: number) => void;
  setDataOwnerId: (id: string) => void;
  clearResetPendingUpload: () => void;
  setHasHydrated: (hydrated: boolean) => void;
  completeSession: (session: Omit<CompletedSession, 'id'>) => void;
  addOneRepMax: (orm: OneRepMax) => void;
  resetProgress: () => void;
  setExerciseFeedback: (exerciseId: string, thumbs: 'up' | 'down' | null) => void;
  applyTooEasyAdjustment: (exerciseIds: string[]) => void;
  setLastReadiness: (
    energy: EnergyLevel,
    time: TimeAvailable,
    painRegion?: PainRegion | null
  ) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  setActiveSession: (session: ActiveSession) => void;
  clearActiveSession: () => void;
  updateLastLoggedWeights: (weights: Record<string, number>) => void;
  setReviewPromptShown: (shown: boolean) => void;
  dismissBalanceNudge: (ts: number) => void;
  dismissCoachMessage: (id: string, ts: number) => void;
  markCoachSeen: (signatures: string[], ts: number) => void;
  /** The one training-balance observation worth showing right now, or null.
   *  See lib/training-balance.ts for what it will and will not say. */
  getTrainingBalanceNudge: (now: number) => BalanceNudge | null;
  setReminderEnabled: (enabled: boolean) => void;
  /** Sets hasEverSubscribed once. See the field for why it exists. */
  markHasSubscribed: () => void;
  setShowcaseComplete: (done: boolean) => void;
  /** Records the audience and, only when it CHANGES, restarts its clock. */
  noteReminderAudience: (kind: string, nowIso: string) => void;
  /** Called by uploadUserData on success. See lastSyncedAt. */
  markSynced: (nowIso: string) => void;
  setReminderTime: (time: string) => void;
  setNudgeEnabled: (enabled: boolean) => void;
  setStreakProtectionEnabled: (enabled: boolean) => void;
  setInSessionAssistantEnabled: (enabled: boolean) => void;
  setBodyweightReminderEnabled: (enabled: boolean) => void;
  setStreakProtectionTime: (time: string) => void;
  setWeeklyStreakGoal: (goal: number) => void;
  setCycleStartOffset: (offset: number) => void;
  setThemePreference: (pref: 'dark' | 'light' | 'system') => void;
  setProfilePhotoUri: (uri: string | null) => void;
  setSessionEquipmentOverride: (tiers: EquipmentTier[]) => void;
  clearSessionEquipmentOverride: () => void;
  /** Last session-type filter selected on the Stats screen. Persisted so it survives tab switches and app restarts. */
  historyTypeFilter: SessionType | null;
  setHistoryTypeFilter: (filter: SessionType | null) => void;
  setTourComplete: (complete: boolean) => void;
  setTourJustCompleted: (v: boolean) => void;
  setTourActiveTab: (tab: number | null) => void;
  setTourEnterAtLastStep: (v: boolean) => void;
  /** Abandons the tour from wherever it currently is - the intro card or any
   *  tab's own in-page tutorial - and bumps tourSkipNonce for the toast. */
  skipTour: () => void;
  /** Marks the tour as genuinely finished (not skipped) and evaluates badges
   *  immediately, so the one-time welcome badge is earned at this exact moment. */
  markTourGenuinelyCompleted: () => void;
  setReadinessTutorialShown: (shown: boolean) => void;
  setSessionTutorialShown: (shown: boolean) => void;
  setWeightReminderSnoozedAt: (ts: string | null) => void;
  /** Returns true when the bodyweight reminder card should be shown on the Home tab.
   *  Encapsulates staleness (>14 days or null) + snooze (<7 days) logic in one place. */
  isWeightReminderVisible: () => boolean;
  /** The most recent note written against an exercise, or null. */
  getLastExerciseNote: (exerciseId: string, exerciseName: string) => string | null;
  pendingCustomExercises: CustomExercise[];
  setPendingCustomExercises: (exercises: CustomExercise[]) => void;
  clearPendingCustomExercises: () => void;

  savedTemplates: CustomTemplate[];
  saveTemplate: (name: string, exercises: CustomExercise[]) => void;
  deleteTemplate: (id: string) => void;
  updateTemplate: (id: string, patch: Partial<Pick<CustomTemplate, 'name' | 'exercises'>>) => void;

  /** IDs of all badges the user has earned. Persisted. */
  earnedBadges: string[];
  /** IDs of badges earned since the last time the user viewed their badge toasts. Cleared by `clearNewlyUnlockedBadges`. Persisted so toasts survive app restarts. */
  newlyUnlockedBadges: string[];
  /** Whether the "You're all set" calibration-complete banner has been dismissed. Once true, the banner never shows again. */
  calibrationBannerDismissed: boolean;
  /** Evaluate all badge criteria against current state and append newly earned badges to `earnedBadges` and `newlyUnlockedBadges`. */
  /** Evaluate criteria and record anything newly earned. Pass `{ silent: true }`
   *  to record without queueing a celebration — see the note on the action. */
  awardNewBadges: (opts?: { silent?: boolean }) => void;
  /** Record everything the current history already qualifies for, without
   *  celebrating any of it. Run once per launch. */
  reconcileBadgesSilently: () => void;
  /** Clear the `newlyUnlockedBadges` queue after the user has seen the pop-ups. */
  clearNewlyUnlockedBadges: () => void;
  /** Permanently dismiss the calibration-complete banner. */
  setCalibrationBannerDismissed: (dismissed: boolean) => void;

  /** True when the barbell rotation is what this person is actually doing.
   *  Shared by the home card and the Your Program screen so they cannot
   *  disagree about which programme someone is on. */
  /**
   * The block they are enrolled in, or null for everybody who has never been
   * through the profile tree.
   *
   * Null is not a degraded state. getCurrentSessionType falls through to the
   * behaviour the app has always had, so an existing user who never opens the
   * builder again notices nothing at all.
   */
  programme: EnrolledProgramme | null;
  /** Enrol from a finished profile tree, writing every answer to its home. */
  applyProfileTree: (answers: Answers, nowIso: string) => void;
  /** Change days, block length or session time from the programme hub. */
  updateProgramme: (
    patch: Partial<Pick<EnrolledProgramme, 'days' | 'sessions' | 'minutes'>>
  ) => void;
  /**
   * Start a programme without going back through the profile builder.
   *
   * For the two people the builder does not cover: somebody who was using Grow
   * before programmes existed, and somebody who left theirs and wants another.
   * Neither has a fresh set of tree answers and neither should be made to
   * re-answer twelve questions to pick a different block, so this fills the
   * shape from what the app already knows and lets the hub change the rest.
   */
  enrolInProgramme: (templateId: EnrolledProgramme['templateId'], nowIso: string) => void;
  /**
   * Start a programme somebody assembled themselves.
   *
   * Separate from enrolInProgramme rather than an argument to it, because this
   * one carries the three things the builder collects and that one deliberately
   * guesses: the cycle, how often, and how long.
   */
  enrolInCustomProgramme: (
    custom: CustomProgramme,
    days: EnrolledProgramme['days'],
    sessions: EnrolledProgramme['sessions'],
    nowIso: string
  ) => void;
  /** Swap to a different programme, starting a fresh block from today. */
  switchProgramme: (templateId: EnrolledProgramme['templateId'], nowIso: string) => void;
  setProgrammePaused: (paused: boolean) => void;
  leaveProgramme: () => void;
  /**
   * EVERY BLOCK THEY HAVE EVER FINISHED, oldest first.
   *
   * Frozen records rather than references. See lib/programme-report.ts for why
   * a finished block is the one thing in the programme layer that is stored
   * instead of derived.
   */
  completedProgrammes: CompletedProgramme[];
  /**
   * A block finished and its report has not been opened yet.
   *
   * Persisted on purpose. Somebody who finishes their twelfth session at ten at
   * night and closes the app should still be handed the report in the morning;
   * weeks of work is not something to show once and drop.
   */
  pendingProgrammeReportId: string | null;
  /**
   * Freeze the current block if it has just been finished, and flag the report.
   *
   * Called after every session rather than from a screen, because the moment a
   * block completes is a fact about the history and not about where anybody
   * happens to be looking. Idempotent: the archive id is derived from the
   * enrolment, so training on past the end of a block never collects a second
   * certificate for the same one.
   */
  archiveIfBlockComplete: (nowIso: string) => void;
  clearPendingProgrammeReport: () => void;
  /**
   * Take the rung the report offered.
   *
   * Never applied automatically. Making somebody's next eight weeks harder
   * because the app decided they looked comfortable is the app changing
   * underneath them, which is the one thing the programme layer promises not to
   * do. See levelStepFor.
   *
   * It writes earnedLevelBonus and NOT experienceLevel: what somebody told us
   * about their training history is theirs, and the hub's level control is the
   * only thing that edits it.
   */
  acceptLevelStep: (toBonus: number) => void;
  /**
   * Record a movement check answered inside a session.
   *
   * Only ever reached by somebody who SKIPPED the builder screen - see
   * patternChecks on UserProfile for why the two are kept apart.
   */
  setPatternCheck: (pattern: string, canDo: boolean) => void;
  /** Where they are in the block, replayed from history. Null when not enrolled. */
  getProgrammePosition: () => ProgrammePosition | null;
  /**
   * Which completed sessions were the programme's, keyed by session id.
   *
   * Empty when nobody is enrolled, and it never contains a session logged
   * before enrolment: those were not off plan, there was no plan.
   */
  getSessionPlanTags: () => Record<string, SessionPlanTag>;
  /**
   * Is starting THIS session type right now a planned easier week?
   *
   * One rule, in one place, because four screens ask it and a deload that the
   * session screen applies and the home tile does not mention is the app
   * appearing to have lost somebody's weights.
   *
   * Only ever true for the session the programme is actually asking for. An
   * easier week is part of a plan; something somebody chose to do off plan is
   * their own session and the app has no business quietly watering it down.
   */
  isDeloadSession: (type: SessionType) => boolean;
  /**
   * Is the block being trained AROUND rather than trained?
   *
   * Null unless there is a clear pattern. See programmeDrift for the bar, which
   * is deliberately high: an app that asks whether you are on the right
   * programme after one busy fortnight is an app that nags.
   */
  getProgrammeDrift: () => ProgrammeDrift | null;
  /**
   * Does this account look like the pounds fault? Null for almost everybody.
   *
   * See lib/unit-correction.ts for what it can and cannot tell, and why the
   * card it feeds asks rather than rewriting anything on its own.
   */
  getUnitCorrection: () => UnitCorrection | null;
  /**
   * Their answer to it.
   *
   * 'pounds' means the figures were pounds all along and are divided down.
   * 'kilograms' means the recorded figures were right, and nothing changes
   * except that the question stops being asked.
   *
   * BOTH ANSWERS WRITE A BODYWEIGHT, which is the point: setUserProfile stamps
   * bodyweightUpdatedAt, and that stamp is what makes the detector stop
   * matching. One record, syncing already, rather than a second flag that could
   * disagree with it.
   */
  resolveUnitCorrection: (answer: 'pounds' | 'kilograms') => void;
  isOnStrengthProgramme: () => boolean;
  getCurrentSessionType: () => SessionType;
  /**
   * Where you are in a test week: all three main lifts, one test per session,
   * in SESSION_ORDER. `active` is true from the moment one comes due until the
   * third test is logged. Derived from session history — see the implementation.
   */
  getTestWeekProgress: () => {
    active: boolean;
    /** Tests already logged in this block, 0–3. */
    completed: number;
    total: number;
    /** The lift the next test session should use. */
    nextLift: SessionType;
    /** True when a test IS due by the count but is being withheld because the
     *  user is only just back from a break. See the implementation. */
    held: boolean;
  };
  isTestWeekDue: () => boolean;
  /**
   * Where the user is in a comeback — how long their most recent break was and
   * how many strength sessions they have logged since it ended — or null when
   * there is no break in play. Thresholds live in lib/workout-engine.ts so the
   * load calculation and this cannot disagree about what counts as a break.
   */
  getReturnWindow: () => ReturnWindow | null;
  getStreakDays: () => number;
  getThisWeekCount: () => number;
  getBestORM: (lift: SessionType) => OneRepMax | null;
  getEffectiveTier: () => EquipmentTier;
  getInternalTier: () => 'bodyweight' | 'dumbbells' | 'fullgym';
  getDataForSync: () => SyncPayload;
  /** All completed-set arrays for a given exercise ID across every completed session, newest session first. */
  getExerciseHistory: (exerciseId: string) => { sessionId: string; date: string; sets: SetLog[] }[];
  /** All-time progress for every weighted exercise ever logged (completed sets with weight > 0). */
  getAllExerciseProgress: () => ExerciseProgress[];
  /** Update or clear the free-text notes on a completed session. */
  updateSessionNotes: (id: string, notes: string) => void;
  removeBodyweightEntry: (date: string) => void;
  mergeServerData: (data: SyncPayload) => void;
}

export const SESSION_ORDER: SessionType[] = ['squat', 'bench', 'deadlift'];

/**
 * How many recent sessions the home suggestion looks at to decide whether
 * someone is training the barbell lifts.
 *
 * A window rather than an all-time count, so it corrects in BOTH directions: a
 * lifter who spends a month rehabbing stops being told to squat, and the first
 * squat they log brings the strength rotation straight back.
 */
export const RECENT_WINDOW = 6;

/** Sessions needed before the home screen will diverge from the default
 *  suggestion at all. Enough to be a pattern, not a one-off. */
export const NON_KPI_EVIDENCE = 3;

/** Last-resort suggestion for someone with a history of nothing we can read. */
export const NON_KPI_FALLBACK: SessionType = 'full_body';

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboardingComplete: false,
      onboardingDraft: null,
      equipmentTiers: ['bodyweight'],
      completedCount: 0,
      completedSessions: [],
      oneRepMaxes: [],
      testWeekFrequency: 12,
      testWeekDeferred: false,
      resetPendingUpload: false,
      userProfile: {
        name: '',
        sex: 'male' as Sex,
        experienceLevel: 'beginner',
        goals: ['fitness'],
        bodyweightKg: 75,
      },
      exerciseFeedback: {},
      lastReadinessEnergy: 'normal',
      lastReadinessTime: '45',
      lastPainRegion: null,
      weightUnit: 'kg',
      lastWeightPromptedAt: null,
      dataOwnerId: null,
      dataOwnerClaimPending: false,
      hasHydrated: false,
      activeSession: null,
      lastLoggedWeights: {},
      reviewPromptShown: false,
      balanceNudgeDismissedAt: null,
      coachDismissedAt: {},
      coachSeen: {},
      reminderEnabled: false,
      hasEverSubscribed: false,
      showcaseComplete: false,
      reminderPromptKind: null,
      reminderPromptSince: null,
      lastSyncedAt: null,
      reminderTime: '07:00',
      nudgeEnabled: true,
      streakProtectionEnabled: false,
      inSessionAssistantEnabled: true,
      bodyweightReminderEnabled: true,
      streakProtectionTime: '20:00',
      weeklyStreakGoal: 2,
      cycleStartOffset: 0,
      programme: null,
      completedProgrammes: [],
      pendingProgrammeReportId: null,
      themePreference: 'dark',
      profilePhotoUri: null,
      exerciseNormalStreak: {},
      exerciseStuckStreak: {},
      exerciseRepTarget: {},
      exerciseRepNote: {},
      lastSessionPerformance: {},
      pendingCustomExercises: [],
      savedTemplates: [],
      historyTypeFilter: null,
      tourComplete: false,
      tourJustCompleted: false,
      tourActiveTab: null,
      tourEnterAtLastStep: false,
      tourSkipNonce: 0,
      tourGenuinelyCompleted: false,
      readinessTutorialShown: false,
      sessionTutorialShown: false,
      bodyweightUpdatedAt: null,
      bodyweightLog: [],
      weightReminderSnoozedAt: null,
      sessionEquipmentOverride: null,
      earnedBadges: [],
      newlyUnlockedBadges: [],
      calibrationBannerDismissed: false,

      setOnboardingComplete: (complete) => {
        // Finishing is the one moment the draft is certainly worthless: every
        // answer in it has just been written to the profile. Clearing it here
        // rather than at the call site means no future path can finish
        // onboarding and leave a stale answer sheet behind to be restored.
        set(
          complete
            ? { onboardingComplete: true, onboardingDraft: null }
            : { onboardingComplete: false }
        );
      },
      saveOnboardingDraft: (draft) => set({ onboardingDraft: draft }),
      setEquipmentTiers: (tiers) =>
        set({ equipmentTiers: tiers.length > 0 ? tiers : ['bodyweight'] }),
      /**
       * TURNING TESTS ON ALSO CLEARS ANY OUTSTANDING POSTPONEMENT.
       *
       * testWeekDeferred is set when somebody postpones a due test, and it is
       * persisted and independent of this setting. Without clearing it, the
       * sequence "postpone a test, switch tests off, switch them back on months
       * later" handed the user an all-out max attempt on their very next
       * strength session, because `due` is `testWeekDeferred || count % freq`.
       * A postponement from before they opted out is not a promise they made.
       *
       * Switching OFF deliberately leaves it alone: nothing is scheduled while
       * the frequency is 'never' anyway, and preserving it means someone who
       * turns tests off and straight back on again in the same minute has not
       * silently lost a deferral they still meant.
       */
      setTestWeekFrequency: (freq) =>
        set((s) => ({
          testWeekFrequency: freq,
          testWeekDeferred: freq === 'never' ? s.testWeekDeferred : false,
        })),
      deferTestWeek: () => set({ testWeekDeferred: true }),
      setUserProfile: (profile) => {
        // Last line of defence for the one field the load maths multiplies by.
        // Four screens write a bodyweight (onboarding, profile, the weekly weight
        // prompt in app/_layout.tsx, and Home's prompt); each validates its own
        // input, but a 100000 kg bodyweight reaching persisted state breaks every
        // prescription the app makes afterwards, so it is refused here too rather
        // than trusted to four separate call sites staying correct forever.
        const patch = { ...profile };
        if (patch.bodyweightKg !== undefined && !isPlausibleBodyweightKg(patch.bodyweightKg)) {
          delete patch.bodyweightKg;
        }
        set((state) => {
          if (patch.bodyweightKg !== undefined && patch.bodyweightKg > 0) {
            const lastEntry = state.bodyweightLog[state.bodyweightLog.length - 1];
            const weightChanged = !lastEntry || lastEntry.kg !== patch.bodyweightKg;
            const now = new Date().toISOString();
            return {
              userProfile: { ...state.userProfile, ...patch },
              bodyweightUpdatedAt: now,
              bodyweightLog: weightChanged
                ? [...state.bodyweightLog, { date: now, kg: patch.bodyweightKg }]
                : state.bodyweightLog,
            };
          }
          return { userProfile: { ...state.userProfile, ...patch } };
        });
        get().awardNewBadges();
      },
      setLastWeightPromptedAt: (ts) => set({ lastWeightPromptedAt: ts }),
      // Tagging always ends the claim window, whichever way the tag arrived.
      setDataOwnerId: (id) => set({ dataOwnerId: id, dataOwnerClaimPending: false }),
      clearResetPendingUpload: () => set({ resetPendingUpload: false }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
      setLastReadiness: (energy, time, painRegion) =>
        set({
          lastReadinessEnergy: energy,
          lastReadinessTime: time,
          ...(painRegion !== undefined ? { lastPainRegion: painRegion } : {}),
        }),
      setWeightUnit: (unit) => set({ weightUnit: unit }),
      setActiveSession: (session) => set({ activeSession: session }),
      clearActiveSession: () => set({ activeSession: null }),
      updateLastLoggedWeights: (weights) =>
        set((state) => ({
          lastLoggedWeights: { ...state.lastLoggedWeights, ...weights },
        })),
      setReviewPromptShown: (shown) => set({ reviewPromptShown: shown }),
      dismissBalanceNudge: (ts) => set({ balanceNudgeDismissedAt: ts }),
      dismissCoachMessage: (id, ts) =>
        set((state) => ({ coachDismissedAt: { ...state.coachDismissedAt, [id]: ts } })),
      markCoachSeen: (signatures, ts) =>
        set((state) => {
          // Capped, and oldest-first, because a signature carries a number in
          // it: every personal best a user ever sets adds one and nothing would
          // ever remove them. 200 is far more than the badge needs to be
          // correct and small enough to never matter to the payload.
          const next = { ...state.coachSeen };
          for (const sig of signatures) next[sig] = ts;
          const keys = Object.keys(next);
          if (keys.length > 200) {
            keys
              .sort((a, b) => (next[a] ?? 0) - (next[b] ?? 0))
              .slice(0, keys.length - 200)
              .forEach((k) => delete next[k]);
          }
          return { coachSeen: next };
        }),

      /**
       * The store side of the balance nudge: gather the history, hand it to a
       * pure function, return what it says.
       *
       * `now` is a parameter rather than read here so the rule stays testable
       * without faking a clock — the same reason the module below takes it.
       */
      getTrainingBalanceNudge: (now) => {
        const { completedSessions, balanceNudgeDismissedAt } = get();
        const sessionTypes = completedSessions.map((s) => s.sessionType);
        return getBalanceNudge({
          sessionTypes,
          everTrained: sessionTypes,
          dismissedAt: balanceNudgeDismissedAt,
          now,
        });
      },
      setReminderEnabled: (enabled) => set({ reminderEnabled: enabled }),
      markHasSubscribed: () => {
        if (!get().hasEverSubscribed) set({ hasEverSubscribed: true });
      },
      markSynced: (nowIso) => set({ lastSyncedAt: nowIso }),
      setShowcaseComplete: (done) => set({ showcaseComplete: done }),
      noteReminderAudience: (kind, nowIso) => {
        const s = get();
        // Only on a CHANGE. Writing it every launch would keep resetting the
        // fortnight, and the prompt would never taper.
        if (s.reminderPromptKind === kind && s.reminderPromptSince) return;
        set({ reminderPromptKind: kind, reminderPromptSince: nowIso });
      },
      setReminderTime: (time) => set({ reminderTime: time }),
      setNudgeEnabled: (enabled) => set({ nudgeEnabled: enabled }),
      setStreakProtectionEnabled: (enabled) => set({ streakProtectionEnabled: enabled }),
      setInSessionAssistantEnabled: (enabled) => set({ inSessionAssistantEnabled: enabled }),
      setBodyweightReminderEnabled: (enabled) => set({ bodyweightReminderEnabled: enabled }),
      removeBodyweightEntry: (date) =>
        set((state) => ({ bodyweightLog: state.bodyweightLog.filter((e) => e.date !== date) })),
      setStreakProtectionTime: (time) => set({ streakProtectionTime: time }),
      setWeeklyStreakGoal: (goal) => {
        set({ weeklyStreakGoal: goal });
        get().awardNewBadges();
      },
      setCycleStartOffset: (offset) => set({ cycleStartOffset: offset }),
      setThemePreference: (pref) => set({ themePreference: pref }),
      setProfilePhotoUri: (uri) => {
        set({ profilePhotoUri: uri });
        if (uri) get().awardNewBadges();
      },
      setHistoryTypeFilter: (filter) => set({ historyTypeFilter: filter }),
      setTourComplete: (complete) =>
        set({
          tourComplete: complete,
          ...(complete === false ? { sessionTutorialShown: false } : {}),
        }),
      setTourJustCompleted: (v) => set({ tourJustCompleted: v }),
      setTourActiveTab: (tab) => set({ tourActiveTab: tab }),
      setTourEnterAtLastStep: (v) => set({ tourEnterAtLastStep: v }),
      skipTour: () =>
        set((s) => ({
          tourComplete: true,
          tourActiveTab: null,
          sessionTutorialShown: true,
          tourSkipNonce: s.tourSkipNonce + 1,
        })),
      /**
       * THE END OF THE GUIDED TOUR, AND THE ONE BADGE NOT EARNED BY TRAINING.
       *
       * Sets the flag lib/badge-engine.ts reads for TOUR_WELCOME_BADGE_ID and
       * re-runs the engine, which queues "Welcome Aboard" for the root layout
       * to present.
       *
       * IT HAD NEVER FIRED FOR ANYONE. Until now this had exactly one call
       * site: the isDemo branch of handleComplete in app/session.tsx, which is
       * unreachable. handleComplete only arrives there as onCompleteSession,
       * whose button renders solely when every set of every exercise is marked
       * complete, and demo mode hard-codes every set mutator to a no-op - so
       * that condition is false for the whole of the practice session. The
       * tutorial's real ending goes through advanceTut into the demo-complete
       * modal, and that modal's button navigated away without awarding
       * anything. A finished, catalogued, artworked badge that nobody could
       * earn.
       *
       * The call now lives on that modal's button, which is the control a user
       * actually reaches, and it fires before the navigation into the tabs
       * because the root layout will only present an unlock while the user is
       * inside (tabs).
       *
       * Deliberately NOT called from skipTut, and not on the showcase branch:
       * skipping is not finishing, and the showcase's practice session runs
       * before anybody has subscribed and is not the tour.
       */
      markTourGenuinelyCompleted: () => {
        set({ tourGenuinelyCompleted: true });
        get().awardNewBadges();
      },
      setReadinessTutorialShown: (shown) => set({ readinessTutorialShown: shown }),
      setSessionTutorialShown: (shown) => set({ sessionTutorialShown: shown }),
      setWeightReminderSnoozedAt: (ts) => set({ weightReminderSnoozedAt: ts }),
      /**
       * The last thing you wrote about this exercise.
       *
       * Notes were being SAVED and never read. Every session wrote
       * ExerciseLog.note faithfully and nothing anywhere loaded one back, so
       * "belt on for the top set" or "left knee twinges past 90" was recorded
       * once and then only ever visible by scrolling through history.
       *
       * Matched on id first, then name. The id is the reliable key, but a
       * grip variant or a comfort swap changes it while staying the same
       * movement to the user — and a note about the movement should survive
       * that. Sessions are newest-first, so the first hit is the latest.
       */
      getLastExerciseNote: (exerciseId, exerciseName) => {
        for (const session of get().completedSessions) {
          for (const log of session.exerciseLogs) {
            if (!log.note || !log.note.trim()) continue;
            if (
              log.exerciseId === exerciseId ||
              canonicalExerciseName(log.exerciseName) === canonicalExerciseName(exerciseName)
            ) {
              return log.note.trim();
            }
          }
        }
        return null;
      },

      isWeightReminderVisible: () => {
        const { completedSessions, bodyweightUpdatedAt, weightReminderSnoozedAt } = get();
        if (completedSessions.length === 0) return false;
        const isStale =
          !bodyweightUpdatedAt ||
          (Date.now() - new Date(bodyweightUpdatedAt).getTime()) / 86400000 > 14;
        if (!isStale) return false;
        if (weightReminderSnoozedAt) {
          const snoozedDaysAgo =
            (Date.now() - new Date(weightReminderSnoozedAt).getTime()) / 86400000;
          if (snoozedDaysAgo < 7) return false;
        }
        return true;
      },
      setSessionEquipmentOverride: (tiers) =>
        set({ sessionEquipmentOverride: tiers.length > 0 ? tiers : null }),
      clearSessionEquipmentOverride: () => set({ sessionEquipmentOverride: null }),
      setPendingCustomExercises: (exercises) => set({ pendingCustomExercises: exercises }),
      clearPendingCustomExercises: () => set({ pendingCustomExercises: [] }),

      saveTemplate: (name, exercises) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        set((state) => ({
          savedTemplates: [
            { id, name: name.trim(), exercises, createdAt: new Date().toISOString() },
            ...state.savedTemplates,
          ],
        }));
      },
      deleteTemplate: (id) =>
        set((state) => ({
          savedTemplates: state.savedTemplates.filter((t) => t.id !== id),
        })),
      updateTemplate: (id, patch) =>
        set((state) => ({
          savedTemplates: state.savedTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      completeSession: (session) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        // Read BEFORE the session is added, because adding it is what destroys
        // the evidence: a test held back for a comeback is due on a session
        // count that is a multiple of testWeekFrequency, and the session about
        // to be logged moves the count past it. Without recording the
        // postponement here the held test would silently vanish for a whole
        // block — which is the failure the hold exists to prevent.
        const testHeldForComeback = get().getTestWeekProgress().held;
        set((state) => {
          // Derive per-exercise session performance from actual set completion data.
          // This is the primary input for the workout engine's progressive overload
          // decisions in the next session.
          //   'failed'  - at least one set was not completed and not explicitly skipped
          //   'normal'  - all sets were completed (or skipped) successfully
          // Post-session feedback (thumbs/tooEasy) can upgrade 'normal' → 'easy'
          // or downgrade 'normal' → 'failed' via setExerciseFeedback.
          const newPerformance: Record<string, ExercisePerformance> = {
            ...state.lastSessionPerformance,
          };
          // Track consecutive sessions each exercise appeared with a 'normal'
          // performance (no feedback override, all sets completed).
          // We look at what `lastSessionPerformance` was BEFORE this session to
          // decide whether to increment (was 'normal') or reset (was 'easy'/'failed').
          const newStreak = { ...state.exerciseNormalStreak };
          // Mirror image of newStreak: counts consecutive 'failed' sessions
          // instead of consecutive 'normal' ones, so a genuinely stuck lift can
          // be told apart from one that just had a single off day.
          const newStuckStreak = { ...state.exerciseStuckStreak };
          const newRepTarget = { ...state.exerciseRepTarget };
          const newRepNote: Record<string, string> = {};
          // Exercises whose REPS moved this session. The load must stay put for
          // these: adding a plate on top of an extra rep is two jumps at once,
          // which is the overshoot double progression exists to prevent.
          const repsStillClimbing = new Set<string>();
          /** Exercises whose weight rises this session because the reps topped out. */
          const earnedTheJump = new Set<string>();
          for (const log of session.exerciseLogs) {
            if (!log.exerciseId) continue;
            // Skipped outright: the user never performed it, so it must not
            // advance load, streak or stall counter. Partially skipped, raw
            // failures and the in-session rating are all judged in one place -
            // see lib/set-performance.ts, which exists so this rule can be
            // tested without standing up the whole store.
            //
            // Before any of that: what did the REPS say? The three feedback
            // buttons are a report and the rep count is a measurement, and
            // someone prescribed 8-12 who logged 20 has already proved the
            // weight was light more convincingly than any button could - with
            // no extra tap, and whether or not they ever touch the buttons.
            // "Too Hard" is never overruled by it; see combineWithMeasuredReps.
            const measured =
              log.targetReps && log.category
                ? measuredRating(log.targetReps, log.sets, log.category)
                : null;
            const effectiveRating = combineWithMeasuredReps(log.feedbackRating, measured);
            const perfWithFeedback = performanceForLog(log.sets, effectiveRating ?? undefined);
            if (perfWithFeedback === null) continue;
            newPerformance[log.exerciseId] = perfWithFeedback;

            // ── Double progression: where do the reps go next? ───────────────
            //
            // Reps climb inside the range first; the weight only moves once the
            // top of the range has been earned. Load progression downstream is
            // gated on that, so the two levers cannot both fire in one session
            // and hand someone more weight AND more reps at the same time.
            if (log.targetReps && log.category) {
              const hitEverySet =
                log.sets.length > 0 && log.sets.every((set) => set.completed && !set.skipped);
              // Ticking every box is not the same as doing the reps. See
              // metRepFloor - without this the rep floor climbed away from
              // anyone who consistently fell a rep or two short of it.
              const reachedTheFloor = metRepFloor(log.targetReps, log.sets, log.category);
              // Held so the rep target can be compared against itself below.
              // Overwriting it first is what hid the stall for so long.
              const repsBefore = newRepTarget[log.exerciseId] ?? log.targetReps;
              const next = nextPrescription(
                repsBefore,
                log.targetReps,
                hitEverySet && reachedTheFloor && perfWithFeedback !== 'failed',
                get().userProfile.goals,
                log.category,
                effectiveRating ?? undefined,
                // Is there anything to add? 43 catalogue lifts are bodyweight
                // with a countable rep range, and telling those "the weight
                // goes up" threw the earned reps away for a weight that never
                // arrived. What was actually lifted answers it without
                // pattern-matching a load sentence.
                log.sets.some((set) => set.weight > 0)
              );
              if (next) {
                newRepTarget[log.exerciseId] = next.reps;
                if (next.note) newRepNote[log.exerciseId] = next.note;
                // Reps went up, so the weight does not. Adding a plate on top of
                // an extra rep is two jumps in one session, which is the
                // overshoot double progression exists to prevent.
                if (next.addLoad) {
                  // The rep range has been topped out, so the step up in weight
                  // is EARNED. The engine otherwise refuses any jump larger
                  // than 5% until three clean sessions have banked it - a rule
                  // written when load was the only lever, and one that double
                  // counts now: climbing 8 reps to 12 already took four
                  // sessions. Left alone, the two gates cancel and the weight
                  // never moves at all, which is exactly what the simulation
                  // showed on a 40 kg accessory.
                  newStreak[log.exerciseId] = CLEAN_SESSIONS_PER_BIG_JUMP;
                  earnedTheJump.add(log.exerciseId);
                } else {
                  /**
                   * ONLY A REP TARGET THAT ACTUALLY MOVED IS A CLIMB.
                   *
                   * This is the line that stopped every stall in the app from
                   * ever being counted. A FAILED session comes back from
                   * nextPrescription as "same again - finish every set at this
                   * weight first", which is the same reps it went in with. That
                   * was landing here and being recorded as reps still climbing,
                   * and the stuck counter below resets to zero for anything in
                   * that set. Six failed sessions in a row left the counter at
                   * zero and the weight unchanged, so the 10% drop that is meant
                   * to rescue somebody stuck on a weight never once fired.
                   *
                   * A climb is a climb only when the number changed.
                   */
                  if (next.reps !== repsBefore) repsStillClimbing.add(log.exerciseId);
                  newPerformance[log.exerciseId] = 'failed';
                }
              }
            }
            // Streak counts consecutive 'normal' sessions for this exercise (no feedback,
            // all sets completed). Any explicit feedback or raw failure resets to 0.
            //
            //   perfWithFeedback 'normal' && prev 'normal' → increment (run continues)
            //   perfWithFeedback 'normal' && prev was not  → 1  (new run begins)
            //   perfWithFeedback 'failed' or 'easy'        → 0  (run broken; reset)
            const prevPerf = state.lastSessionPerformance[log.exerciseId];
            if (earnedTheJump.has(log.exerciseId)) {
              // Already set to the banked value above - leave it.
            } else if (perfWithFeedback !== 'normal') {
              newStreak[log.exerciseId] = 0;
            } else if (prevPerf === 'normal') {
              newStreak[log.exerciseId] = (state.exerciseNormalStreak[log.exerciseId] ?? 1) + 1;
            } else {
              // perfWithFeedback === 'normal' but prev was 'easy', 'failed', or first appearance.
              newStreak[log.exerciseId] = 1;
            }
            // Stuck streak: consecutive 'failed' sessions, same shape as the
            // normal streak above but for the opposite outcome.
            // A load held because the REPS are climbing is progress, not a stall.
            // Without this exclusion three good sessions in a row would look
            // identical to three failures and earn a 10% deload.
            if (perfWithFeedback !== 'failed' || repsStillClimbing.has(log.exerciseId)) {
              newStuckStreak[log.exerciseId] = 0;
            } else if (prevPerf === 'failed') {
              newStuckStreak[log.exerciseId] = (state.exerciseStuckStreak[log.exerciseId] ?? 1) + 1;
            } else {
              newStuckStreak[log.exerciseId] = 1;
            }
          }

          return {
            completedCount: state.completedCount + 1,
            completedSessions: [{ ...session, id }, ...state.completedSessions],
            lastSessionPerformance: newPerformance,
            exerciseNormalStreak: newStreak,
            exerciseStuckStreak: newStuckStreak,
            exerciseRepTarget: newRepTarget,
            // Replaced wholesale rather than merged: the note describes what
            // happened in THIS session, and a stale one left over from three
            // weeks ago on an exercise that was not trained today would be read
            // as today's news.
            exerciseRepNote: newRepNote,
            // A genuine test-week session clears any postponement — the thing
            // it was standing in for has now actually happened.
            ...(session.isTestWeek
              ? { testWeekDeferred: false }
              : testHeldForComeback
                ? { testWeekDeferred: true }
                : {}),
          };
        });
        // Award any newly unlocked badges based on the updated state.
        get().awardNewBadges();
        /**
         * AND FREEZE THE BLOCK IF THAT WAS THE LAST SESSION OF IT.
         *
         * Here rather than on a screen. A block completing is a fact about the
         * history, not about where anybody happens to be looking when it
         * happens - and the session summary is not the only way a session can
         * be logged.
         */
        get().archiveIfBlockComplete(session.date);
      },

      addOneRepMax: (orm) => {
        set((state) => ({
          oneRepMaxes: [orm, ...state.oneRepMaxes],
        }));
        // New 1RM may unlock strength badges.
        get().awardNewBadges();
      },

      /**
       * Clear everything the app has learned about how you train.
       *
       * It used to clear the three fields the HISTORY SCREENS read and nothing
       * else, so the reset looked like it had worked and then visibly had not:
       * the next session opened at exactly the weights the deleted history had
       * built up, complete with the easier/harder adjustments learned along the
       * way. Everything below is a number that decides a future weight, so all
       * of it goes.
       *
       * testWeekDeferred matters most of the four counters. Left set, the first
       * session after wiping everything is a max-effort one-rep-max attempt, on
       * an account the app now believes has never trained.
       *
       * Deliberately NOT cleared: the bodyweight log. This resets training
       * progression; a weigh-in is a body measurement, not a lift, and losing a
       * year of them to a training reset is a harsher outcome than the button
       * promises. The confirmation copy says so out loud.
       */
      resetProgress: () =>
        set({
          completedCount: 0,
          completedSessions: [],
          oneRepMaxes: [],
          lastLoggedWeights: {},
          lastSessionPerformance: {},
          exerciseNormalStreak: {},
          exerciseStuckStreak: {},
          exerciseRepTarget: {},
          exerciseRepNote: {},
          exerciseFeedback: {},
          testWeekDeferred: false,
          // The blocks go with the sessions they were built from. A report about
          // twelve sessions that no longer exist is a document about nothing.
          completedProgrammes: [],
          pendingProgrammeReportId: null,
          earnedBadges: [],
          newlyUnlockedBadges: [],
          // The half-finished session goes too. Left behind, Home kept offering
          // "Squat Session - 12/24 sets" with a Resume button, for a session
          // belonging to the history that was just deleted — and finishing it
          // wrote the pre-reset working weights straight back into
          // lastLoggedWeights, quietly undoing the reset one exercise at a time.
          activeSession: null,
          // The reset is not truly done until the server knows about it.
          // Startup restores the server copy whenever it is ahead on sessions,
          // which right after a reset it always is, so a failed upload used to
          // mean every deleted session, badge and learned weight came back on
          // the next launch — with the confirmation dialog having promised "this
          // cannot be undone" and nothing on screen saying the upload failed.
          //
          // While this flag is set, mergeServerData refuses to restore. It is
          // cleared only by an upload that genuinely succeeded.
          resetPendingUpload: true,
        }),

      setExerciseFeedback: (exerciseId, thumbs) =>
        set((state) => {
          const current = state.exerciseFeedback[exerciseId];
          const currentMult = current?.multiplier ?? 1.0;
          let newMult = currentMult;
          if (thumbs === 'up') {
            newMult = parseFloat(Math.min(1.5, currentMult + 0.03).toFixed(3));
          } else if (thumbs === 'down') {
            newMult = parseFloat(Math.max(0.7, currentMult - 0.05).toFixed(3));
          }
          // Thumbs feedback also updates lastSessionPerformance - this is the
          // post-session override that adjusts what completeSession computed from
          // raw set data (e.g. user completed all sets but found it easy = 'easy').
          const performance =
            thumbs === 'up'
              ? 'easy'
              : thumbs === 'down'
                ? 'failed'
                : state.lastSessionPerformance[exerciseId];
          return {
            exerciseFeedback: {
              ...state.exerciseFeedback,
              [exerciseId]: {
                tooEasy: current?.tooEasy ?? false,
                thumbs,
                multiplier: newMult,
              },
            },
            lastSessionPerformance: {
              ...state.lastSessionPerformance,
              ...(performance ? { [exerciseId]: performance } : {}),
            },
            // Any explicit feedback resets the consecutive-normal streak for this
            // exercise - the streak only counts sessions with zero intervention.
            exerciseNormalStreak: {
              ...state.exerciseNormalStreak,
              [exerciseId]: 0,
            },
          };
        }),

      applyTooEasyAdjustment: (exerciseIds) =>
        set((state) => {
          const updated = { ...state.exerciseFeedback };
          const updatedPerformance = { ...state.lastSessionPerformance };
          const updatedStreak = { ...state.exerciseNormalStreak };
          for (const id of exerciseIds) {
            const current = updated[id]?.multiplier ?? 1.0;
            updated[id] = {
              tooEasy: true,
              thumbs: updated[id]?.thumbs ?? null,
              multiplier: parseFloat(Math.min(1.5, current + 0.07).toFixed(3)),
            };
            // Mark performance as 'easy' - user found this exercise manageable
            updatedPerformance[id] = 'easy';
            // Reset streak - explicit feedback interrupts the no-feedback run
            updatedStreak[id] = 0;
          }
          return {
            exerciseFeedback: updated,
            lastSessionPerformance: updatedPerformance,
            exerciseNormalStreak: updatedStreak,
          };
        }),

      /**
       * `silent` records a badge as earned WITHOUT queueing a celebration.
       *
       * Badges are evaluated against your whole history, not against the moment.
       * That is right — it means a badge you deserve is never missed — but it
       * has a consequence: any time `earnedBadges` is empty while the history is
       * not, EVERYTHING you already deserve is "newly unlocked" at once. That
       * happens on a reinstall, on a new device, and every time the server
       * restore in mergeServerData brings back sessions the local store had
       * lost. The user hit it repeatedly on a test account: "it insta awards
       * about 40 that I've already earned previously."
       *
       * A celebration should fire for something you just did. Backfilling
       * history is not that, so those paths record silently and the badges
       * simply appear in the collection, already earned.
       */
      awardNewBadges: (opts) => {
        const state = get();
        const allEarned = evaluateBadges({
          completedSessions: state.completedSessions,
          oneRepMaxes: state.oneRepMaxes,
          userProfile: state.userProfile,
          profilePhotoUri: state.profilePhotoUri,
          equipmentTiers: state.equipmentTiers,
          bodyweightUpdatedAt: state.bodyweightUpdatedAt,
          onboardingComplete: state.onboardingComplete,
          tourGenuinelyCompleted: state.tourGenuinelyCompleted,
          weeklyStreakGoal: state.weeklyStreakGoal ?? 2,
        });
        const newlyUnlocked = allEarned.filter((id) => !state.earnedBadges.includes(id));
        if (newlyUnlocked.length === 0) return;
        set((s) => ({
          earnedBadges: [...new Set([...s.earnedBadges, ...newlyUnlocked])],
          newlyUnlockedBadges: opts?.silent
            ? s.newlyUnlockedBadges
            : [...s.newlyUnlockedBadges, ...newlyUnlocked],
        }));
      },

      reconcileBadgesSilently: () => get().awardNewBadges({ silent: true }),

      clearNewlyUnlockedBadges: () => set({ newlyUnlockedBadges: [] }),
      setCalibrationBannerDismissed: (dismissed) => set({ calibrationBannerDismissed: dismissed }),

      /**
       * Is this person actually running the barbell strength rotation?
       *
       * Shared by the home card and the Your Program screen ON PURPOSE. Both
       * have to answer the same question — "what programme is this person on" —
       * and if they answered it separately they would eventually disagree, so
       * Home would suggest conditioning while Program drew a squat/bench/
       * deadlift timeline. One implementation, one answer.
       *
       * Judged on the RECENT window rather than an all-time count, so it
       * corrects in both directions: a lifter who spends a month rehabbing
       * stops being shown a strength cycle, and their first session back
       * restores it exactly where it left off.
       */
      /**
       * ONE ACTION FOR THE WHOLE BUILDER, rather than the seven separate setters
       * the swipe pager called on its final screen.
       *
       * Those seven could half-succeed. A crash between setUserProfile and
       * setEquipmentTiers left somebody with a profile and no equipment, which
       * generates a bodyweight-only session for a person standing in a gym. One
       * set() cannot land halfway.
       */
      applyProfileTree: (answers, nowIso) => {
        const outcome = outcomeFrom(answers);
        const s = get();

        /**
         * Written exactly the way the old onboarding screen wrote them:
         * keyed by lift, one rep, no source field.
         *
         * `source` is deliberately left off. Absent means "treated as a test",
         * which is what the swipe pager did with these same three numbers, and
         * the test-week summary reads the difference between the last two entries
         * to say "up N kg on your last test". Marking a builder-typed number as
         * 'manual' here would change that sentence for everybody, which is a
         * separate decision from wiring the tree in.
         */
        const maxes: OneRepMax[] = [];
        const push = (lift: SessionType, kg: number | null) => {
          if (kg && kg > 0) {
            maxes.push({ lift, weight: kg, reps: 1, date: nowIso, unit: 'kg' });
          }
        };
        push('squat', outcome.oneRepMaxes.squat);
        push('bench', outcome.oneRepMaxes.bench);
        push('deadlift', outcome.oneRepMaxes.deadlift);

        set({
          userProfile: {
            ...s.userProfile,
            name: outcome.name || s.userProfile.name,
            sex: outcome.sex,
            experienceLevel: outcome.experience,
            // The focus reaches the rep schemes and the set counts through here.
            // See goalsForFocus in lib/programme.ts for why that matters.
            goals: goalsForFocus(outcome.focus),
            bodyweightKg:
              outcome.bodyweightKg > 0 ? outcome.bodyweightKg : s.userProfile.bodyweightKg,
            ageYears: outcome.ageYears > 0 ? outcome.ageYears : undefined,
            standingSoreRegions: outcome.soreRegions,
            standingSoreSince: outcome.soreFor,
            // Null means the screen was skipped, and undefined is how the rest
            // of the app spells "never taken". Kept apart from an empty array,
            // which is somebody who took it and passed nothing.
            screenPassed: outcome.screenPassed ?? undefined,
            clinicalAvoid: outcome.avoidRegions,
            maxKitKg: outcome.maxKitKg > 0 ? outcome.maxKitKg : undefined,
          },
          equipmentTiers: outcome.equipmentTiers.length ? outcome.equipmentTiers : s.equipmentTiers,
          testWeekFrequency: outcome.testWeekFrequency,
          weightUnit: answers.units === 'lbs' ? 'lbs' : 'kg',
          // How long they said they usually have becomes the default on the
          // readiness screen. After that the screen goes on remembering what
          // they actually pick, which is the more honest number.
          lastReadinessTime: String(outcome.minutes) as TimeAvailable,
          oneRepMaxes: maxes.length ? [...maxes, ...s.oneRepMaxes] : s.oneRepMaxes,
          programme: selectProgramme(outcome, nowIso, s.completedSessions.length),
        });
      },

      /**
       * CHANGING THE DAYS A WEEK DOES NOT REWRITE WHAT IS ALREADY DONE.
       *
       * Most templates prescribe a different cycle at four days a week than at
       * three, so the day count is the plan rather than a preference. Patching
       * it used to re-walk the whole block against the new cycle: a user six
       * sessions into Lean and Fit who tapped "4" watched the hub drop from
       * "Session 7 of 12, week 3 of 4, 50%" to "Session 2 of 12, week 1 of 3,
       * 8%", with five weeks of their work reclassified as sessions they had
       * chosen themselves. One tap, no warning.
       *
       * The change is recorded as taking effect HERE, so the sessions already
       * logged keep the cycle they were done under and the new one applies from
       * the next session on.
       */
      updateProgramme: (patch) =>
        set((s) => {
          if (!s.programme) return {};
          const changingDays = patch.days !== undefined && patch.days !== s.programme.days;
          if (!changingDays) return { programme: { ...s.programme, ...patch } };
          const at = get().getProgrammePosition()?.onPlan ?? 0;
          const segments = [...(s.programme.daySegments ?? [])];
          // The block as it stood before this tap, so the sessions already done
          // are still read against the cycle they were done under. Only recorded
          // once: a second change at the same point replaces rather than stacks.
          if (segments.length === 0) segments.push({ fromOnPlan: 0, days: s.programme.days });
          const last = segments[segments.length - 1];
          if (last.fromOnPlan === at) segments[segments.length - 1] = { fromOnPlan: at, days: patch.days! };
          else segments.push({ fromOnPlan: at, days: patch.days! });
          return { programme: { ...s.programme, ...patch, daySegments: segments } };
        }),

      /**
       * A fresh block from today, keeping every other answer they gave.
       *
       * startedAtSessionCount resets to the CURRENT history length so the new
       * block starts at week one. Without that, somebody switching programmes in
       * week nine would land in week nine of the new one.
       */
      enrolInProgramme: (templateId, nowIso) =>
        set((s) => ({
          programme: {
            templateId,
            /**
             * Three days and twelve sessions, and both are changeable on the
             * very next screen.
             *
             * They are the two questions the builder asks that this route
             * skips, and a wrong guess here costs nothing because the hub they
             * land on puts both controls in front of them. Guessing from their
             * history was the alternative and it is worse: somebody's last
             * fortnight is a description of the fortnight they had, not of the
             * week they are trying to have.
             */
            days: s.programme?.days ?? 3,
            sessions: s.programme?.sessions ?? 12,
            // The one thing the app DOES know, because the readiness screen has
            // been remembering it after every session.
            minutes: (Number(s.lastReadinessTime) || 45) as EnrolledProgramme['minutes'],
            startedAt: nowIso,
            startedAtSessionCount: s.completedSessions.length,
          },
        })),

      enrolInCustomProgramme: (custom, days, sessions, nowIso) =>
        set((s) => ({
          programme: {
            templateId: 'custom',
            custom,
            days,
            sessions,
            minutes: (Number(s.lastReadinessTime) || 45) as EnrolledProgramme['minutes'],
            startedAt: nowIso,
            startedAtSessionCount: s.completedSessions.length,
          },
        })),

      switchProgramme: (templateId, nowIso) =>
        set((s) =>
          s.programme
            ? {
                programme: {
                  ...s.programme,
                  templateId,
                  startedAt: nowIso,
                  startedAtSessionCount: s.completedSessions.length,
                  paused: false,
                },
              }
            : {}
        ),

      /**
       * Pausing OPENS a range of sessions that will not count, and resuming
       * closes it.
       *
       * The hub has always said "you are still training, it just is not moving
       * the block along". Nothing implemented it: the position replayed every
       * session logged since enrolment and never consulted the flag, so a paused
       * block advanced normally and finished itself. Recording where the pause
       * began is what makes the sentence true, and it has to be a range rather
       * than a count because once training resumes those sessions are no longer
       * the most recent ones.
       */
      setProgrammePaused: (paused) =>
        set((s) => {
          if (!s.programme) return {};
          const at = s.completedSessions.length;
          const ranges = [...(s.programme.pausedRanges ?? [])];
          const openIndex = ranges.findIndex((r) => r.to === undefined);
          if (paused) {
            // Already paused: leave the range that is open where it is, rather
            // than moving its start forward and quietly counting the sessions in
            // between.
            if (openIndex < 0) ranges.push({ from: at });
          } else if (openIndex >= 0) {
            const open = ranges[openIndex];
            // A pause nobody trained through leaves nothing behind.
            if (at > open.from) ranges[openIndex] = { ...open, to: at };
            else ranges.splice(openIndex, 1);
          }
          return { programme: { ...s.programme, paused, pausedRanges: ranges } };
        }),

      leaveProgramme: () => set({ programme: null }),

      archiveIfBlockComplete: (nowIso) => {
        const { programme, completedSessions, completedProgrammes, userProfile } = get();
        if (!programme) return;
        /**
         * A PAUSED BLOCK CANNOT FINISH ITSELF.
         *
         * The position no longer advances while paused, so in practice this is
         * belt and braces - but a block that completed and archived a report
         * while its owner had explicitly stopped it is the exact thing being
         * fixed, and the report is frozen the moment it is written. There is no
         * next render to take it back on.
         */
        if (programme.paused) return;
        const pos = get().getProgrammePosition();
        if (!pos || !pos.complete) return;
        const id = archiveIdFor(programme);
        // Derived rather than generated, so this is safe to call after every
        // single session for the rest of the block's life.
        if (completedProgrammes.some((c) => c.id === id)) return;

        /**
         * One shared rule for what counts towards the block - since enrolment,
         * and not while it was paused - rather than a fourth hand-rolled
         * reverse-and-slice. See sessionsCountingToward.
         */
        const since = sessionsCountingToward(programme, completedSessions);
        const counted = new Set(since.map((x) => x.id));
        // Everything else, for the personal-best comparison: the history before
        // this block AND anything logged while it was paused, which is real
        // training and still has to be beaten to count as a best.
        const before = completedSessions.filter((x) => !counted.has(x.id));

        const done = completeProgramme({
          programme,
          sessionsSinceEnrolment: since,
          historyBefore: before,
          experience: userProfile.experienceLevel,
          earnedBonus: userProfile.earnedLevelBonus ?? 0,
          finishedAt: nowIso,
        });
        set((st) => ({
          completedProgrammes: [...st.completedProgrammes, done],
          pendingProgrammeReportId: done.id,
        }));
      },

      clearPendingProgrammeReport: () => set({ pendingProgrammeReportId: null }),

      setPatternCheck: (pattern, canDo) =>
        set((st) => ({
          userProfile: {
            ...st.userProfile,
            patternChecks: { ...(st.userProfile.patternChecks ?? {}), [pattern]: canDo },
          },
        })),

      acceptLevelStep: (toBonus) =>
        set((st) => ({
          userProfile: {
            ...st.userProfile,
            // Clamped here as well as in the report, because this is reachable
            // from a screen and a screen is reachable from a stale report.
            earnedLevelBonus: Math.max(0, Math.min(MAX_EARNED_BONUS, Math.trunc(toBonus))),
          },
        })),

      getProgrammePosition: () => {
        const { programme, completedSessions } = get();
        if (!programme) return null;
        /**
         * completedSessions is NEWEST FIRST, so the sessions logged since
         * enrolment are the first N entries and they have to be reversed before
         * the replay sees them. Getting this backwards silently lands somebody on
         * the wrong session, which is why programmePosition's own contract test
         * asserts the direction rather than trusting the caller.
         */
        const since = sessionsCountingToward(programme, completedSessions);
        return programmePosition(
          programme,
          since.map((x) => x.sessionType)
        );
      },

      /**
       * The same replay, kept per session rather than summed.
       *
       * Built here rather than in the history screen because the screen has the
       * sessions newest-first and the replay has to run oldest-first, and that
       * reversal is the one thing about this that is easy to get wrong. Doing it
       * once, next to the position selector that does the same reversal, means
       * there is one place to be right.
       */
      getSessionPlanTags: () => {
        const { programme, completedSessions } = get();
        if (!programme) return {};
        const since = sessionsCountingToward(programme, completedSessions);
        const tags = tagSessions(
          programme,
          since.map((x) => x.sessionType)
        );
        const out: Record<string, SessionPlanTag> = {};
        since.forEach((s, i) => {
          if (tags[i]) out[s.id] = tags[i];
        });
        return out;
      },

      isDeloadSession: (type) => {
        const { programme } = get();
        if (!programme || programme.paused) return false;
        const pos = get().getProgrammePosition();
        if (!pos || !pos.deload) return false;
        return pos.next === type;
      },

      getUnitCorrection: () => {
        const s = get();
        return unitCorrectionFor({
          weightUnit: s.weightUnit,
          bodyweightKg: s.userProfile.bodyweightKg,
          bodyweightUpdatedAt: s.bodyweightUpdatedAt,
          oneRepMaxes: s.oneRepMaxes,
        });
      },

      resolveUnitCorrection: (answer) => {
        const found = get().getUnitCorrection();
        if (!found) return;
        if (answer === 'pounds') {
          /**
           * The maxes first, and by identity rather than by position.
           *
           * They are matched on the exact objects the detector found, so a max
           * logged between the card appearing and the tap landing cannot be
           * caught by a stale index and silently halved.
           */
          const bad = new Set(builderTypedMaxes(get().oneRepMaxes));
          set((st) => ({
            oneRepMaxes: st.oneRepMaxes.map((m) =>
              bad.has(m)
                ? { ...m, weight: Math.round(displayUnitToKg(m.weight, 'lbs') * 10) / 10 }
                : m
            ),
          }));
        }
        /**
         * And the bodyweight, through setUserProfile either way.
         *
         * Confirming a figure is a real answer about it, so it earns the same
         * stamp and the same weigh-in entry as changing one. Without that, an
         * account that answered "kilograms" would be asked again on every
         * launch for ever.
         */
        get().setUserProfile({
          bodyweightKg: answer === 'pounds' ? found.correctedKg : found.storedKg,
        });
      },

      getProgrammeDrift: () => {
        const { programme, completedSessions } = get();
        if (!programme) return null;
        const since = sessionsCountingToward(programme, completedSessions);
        return programmeDrift(
          programme,
          since.map((x) => x.sessionType)
        );
      },

      isOnStrengthProgramme: () => {
        const { completedSessions, testWeekFrequency } = get();
        /**
         * SAYING YES TO TEST WEEKS RAISES THE BAR FOR DIVERTING.
         *
         * Someone who chose "test my strength every 12 sessions" has told us,
         * in as many words, that the three lifts are part of their plan. With a
         * flat three-session threshold, three conditioning sessions in their
         * first fortnight was enough to move them off the barbell rotation —
         * and once off it they could never be tested either, because a test
         * only comes due on a strength session. Opting in led to never being
         * offered the thing they opted into.
         *
         * So an opted-in user keeps the rotation until a FULL recent window has
         * gone by without a single KPI lift in it. The divert still works — a
         * lifter who spends six sessions rehabbing stops being told to squat,
         * and their first squat back restores the rotation exactly where it was
         * — it just takes a clear, repeated choice rather than a quiet fortnight.
         *
         * Someone who declined test weeks keeps the lighter threshold: they
         * said the opposite, and taking three sessions at their word is right.
         */
        const evidenceNeeded = testWeekFrequency === 'never' ? NON_KPI_EVIDENCE : RECENT_WINDOW;
        if (completedSessions.length < evidenceNeeded) return true;
        return completedSessions
          .slice(0, RECENT_WINDOW)
          .some((s) => SESSION_ORDER.includes(s.sessionType));
      },

      getCurrentSessionType: () => {
        const { completedSessions, cycleStartOffset } = get();
        // During a test week the lift is dictated by how far through the three
        // tests you are, not by the normal rotation.
        const progress = get().getTestWeekProgress();
        if (progress.active) return progress.nextLift;
        /**
         * THE PROGRAMME, IF THERE IS ONE.
         *
         * Placed AFTER the test-week override, because a due strength test
         * dictates the lift whatever the block would otherwise ask for, and
         * BEFORE everything below, because everything below is the behaviour the
         * app had when nothing chose your sessions for you. Somebody who has
         * never been through the profile tree has programme === null and reaches
         * exactly the code they reach today.
         *
         * Paused is a real state rather than a deletion: the hub can pause a
         * block, the suggestion falls back to the old behaviour, and the position
         * is still there when they come back to it.
         */
        const enrolled = get().programme;
        if (enrolled && !enrolled.paused) {
          const pos = get().getProgrammePosition();
          if (pos) return pos.next;
        }

        // Cycle rotation only advances on squat/bench/deadlift sessions.
        // Conditioning, prehab, flexibility, and custom sessions do not shift the rotation.
        const strengthCount = completedSessions.filter((s) =>
          SESSION_ORDER.includes(s.sessionType)
        ).length;

        // Nobody has to lift the big three.
        //
        // This used to fall straight through to SESSION_ORDER[offset % 3] with
        // strengthCount pinned at 0, because the rotation filters non-strength
        // sessions out before it counts. So someone who trains conditioning,
        // mobility or their own custom sessions was told "Today: Squat Session"
        // every single day, forever, and nothing they logged could move it.
        //
        // The decision is made on the RECENT window, not an all-time count, so
        // it corrects both ways — a lifter who spends a month rehabbing stops
        // being told to squat, and their first squat back restores the strength
        // rotation exactly where it was (strengthCount is still all-time, so
        // the cycle position is never lost).
        if (get().isOnStrengthProgramme()) {
          return SESSION_ORDER[(strengthCount + cycleStartOffset) % 3];
        }

        // Suggest from the kinds of session they ACTUALLY do — the one they
        // have trained least recently. Someone who only does conditioning is
        // only ever offered conditioning; someone who mixes conditioning and
        // mobility gets them alternately. It can never suggest a type they have
        // never chosen, which is the whole point.
        //
        // 'custom' is held back from the rotation rather than excluded from the
        // answer. generateWorkout returns [] for it (lib/workout-engine.ts) —
        // a custom session is assembled in the builder, not generated — so it
        // must never be offered as one of several types to rotate through, or
        // the home card would eventually hand someone an empty workout.
        //
        // But a user whose ONLY sessions are custom has no other vocabulary to
        // draw on, and used to fall through to a generated full-body session
        // they had never once chosen. For them the honest suggestion is their
        // own session, and the home card routes it to the builder instead of
        // the generator.
        const vocabulary: SessionType[] = [];
        let hasCustom = false;
        for (const s of completedSessions) {
          if (SESSION_ORDER.includes(s.sessionType)) continue;
          if (s.sessionType === 'custom') {
            hasCustom = true;
            continue;
          }
          if (!vocabulary.includes(s.sessionType)) vocabulary.push(s.sessionType);
        }
        // completedSessions is newest-first, so the LAST entry gathered above is
        // the one trained least recently.
        if (vocabulary.length > 0) return vocabulary[vocabulary.length - 1];
        return hasCustom ? 'custom' : NON_KPI_FALLBACK;
      },

      /**
       * A test week is all three main lifts, tested one per session, in
       * SESSION_ORDER (squat → bench → deadlift).
       *
       * WHY THIS IS DERIVED, NOT A FLAG
       * ───────────────────────────────
       * How far through you are is read back off the session history: count the
       * most recent consecutive strength sessions that were tests. That survives
       * a reinstall, a device switch, and mergeServerData, none of which a
       * separate in-progress counter would.
       *
       * THE BUG THIS REPLACES
       * ─────────────────────
       * A test used to be a single session, fired when strengthCount hit a
       * multiple of testWeekFrequency. Both frequency options (12 and 18) divide
       * exactly by 3, so the rotation was always sitting on the same lift when a
       * test came due — the same lift was tested every time, forever, and the
       * other two never were. Replaying 40 sessions produced squat, squat, squat
       * and never once bench or deadlift.
       */
      getTestWeekProgress: () => {
        const { completedSessions, testWeekFrequency, testWeekDeferred } = get();
        const idleOff = {
          active: false,
          completed: 0,
          total: SESSION_ORDER.length,
          nextLift: SESSION_ORDER[0],
          held: false,
        };
        // Turned off entirely. Checked before the resume branch below on
        // purpose: someone who switches test weeks off part-way through a block
        // is asking not to be tested, and "you still owe us two more" is not an
        // answer to that.
        if (testWeekFrequency === 'never') return idleOff;

        /**
         * A STRENGTH TEST BELONGS TO A PROGRAMME BUILT ON THE BARBELL LIFTS.
         *
         * Reported from use: a home screen reading "Test Week 1 of 3" above a
         * Squat Session, to somebody whose programme was nothing of the sort.
         * Two things caused it and both are fixed here.
         *
         * The test-week question is only ASKED on the barbell path, and
         * everybody else was defaulted to every 12 sessions so that
         * isTestWeekDue could not read undefined. Safe, and wrong: it quietly
         * signed up the person who came to the app because their knee hurts for
         * a one-rep max attempt.
         *
         * So: if a programme is running and its cycle contains none of the
         * three lifts, a strength test is not part of their plan and never
         * interrupts it. Somebody enrolled in nothing at all is untouched -
         * that is every existing user, and their rotation still tests them.
         */
        const enrolled = get().programme;
        if (
          enrolled &&
          !cycleOf(enrolled).some((t) =>
            SESSION_ORDER.includes(t)
          )
        ) {
          return idleOff;
        }

        const strength = completedSessions.filter((s) =>
          SESSION_ORDER.includes(s.sessionType)
        );

        // completedSessions is newest-first, so this walks backwards in time.
        let completed = 0;
        for (const s of strength) {
          if (!s.isTestWeek) break;
          completed++;
          if (completed === SESSION_ORDER.length) break;
        }

        const idle = {
          active: false,
          completed: 0,
          total: SESSION_ORDER.length,
          nextLift: SESSION_ORDER[0],
          held: false,
        };

        // Part-way through: finish the remaining lifts before anything else.
        if (completed > 0 && completed < SESSION_ORDER.length) {
          return {
            active: true,
            completed,
            total: SESSION_ORDER.length,
            nextLift: SESSION_ORDER[completed],
            held: false,
          };
        }
        // All three done — the block is over.
        if (completed >= SESSION_ORDER.length) return idle;

        // Not started. A postponed test stays due regardless of count until it
        // is actually taken, otherwise the next strength session would consume
        // the "due" count and push the real test a whole block away.
        const due =
          testWeekDeferred ||
          (strength.length > 0 && strength.length % testWeekFrequency === 0);
        if (!due) return idle;

        // Nobody walks out of a layoff into a max-effort test.
        //
        // Someone who stopped at session 11 and came back a month later used to
        // be handed a one-rep max attempt on their first session, on a body that
        // had not been under a bar since. The test waits until they have put
        // COMEBACK_SESSIONS strength sessions back in — enough for the load
        // calculation to have something recent to work from, and for the number
        // the test produces to mean something.
        //
        // Held, not cancelled: completeSession sets testWeekDeferred while this
        // is true, so the test comes due again the moment the baseline is back
        // rather than disappearing for another full block.
        const comeback = get().getReturnWindow();
        if (comeback !== null && comeback.sessionsBack < COMEBACK_SESSIONS) {
          return { ...idle, held: true };
        }
        return {
          active: true,
          completed: 0,
          total: SESSION_ORDER.length,
          nextLift: SESSION_ORDER[0],
          held: false,
        };
      },

      isTestWeekDue: () => get().getTestWeekProgress().active,

      getReturnWindow: () => {
        const { completedSessions } = get();
        // The break is measured across ALL training — a month of conditioning is
        // not a month off. What counts as re-establishing a baseline is narrower:
        // only the barbell lifts, because a barbell test is what is waiting.
        return computeReturnWindow(
          completedSessions.map((s) => s.date),
          completedSessions.filter((s) => SESSION_ORDER.includes(s.sessionType)).map((s) => s.date)
        );
      },

      getStreakDays: () => {
        const { completedSessions, weeklyStreakGoal } = get();
        if (completedSessions.length === 0) return 0;
        const goal = weeklyStreakGoal ?? 2;

        // Count sessions per ISO week.
        const weekCounts = new Map<string, number>();
        for (const session of completedSessions) {
          const w = isoWeek(new Date(session.date));
          weekCounts.set(w, (weekCounts.get(w) ?? 0) + 1);
        }

        // A "training week" = any Mon–Sun week with ≥ goal sessions.
        // Streak = consecutive training weeks ending with the most recent one.
        // If the current week already qualifies, include it; otherwise treat it as
        // "in progress" and start counting from the previous week so the streak is
        // not broken just because it is early in the week.
        const thisWeek = isoWeek(new Date());
        const thisWeekCount = weekCounts.get(thisWeek) ?? 0;
        let checkDate = thisWeekCount >= goal ? new Date() : new Date(Date.now() - 7 * 86400000);

        let streak = 0;
        for (let i = 0; i < 200; i++) {
          const key = isoWeek(checkDate);
          if ((weekCounts.get(key) ?? 0) >= goal) {
            streak++;
            checkDate = new Date(checkDate.getTime() - 7 * 86400000);
          } else {
            break;
          }
        }
        return streak;
      },

      /**
       * ONE RULE FOR "THIS WEEK", AND IT IS THE STREAK'S RULE.
       *
       * The comment here used to say it matched getStreakDays. It did not. The
       * streak buckets every session by isoWeek(), which takes the LOCAL
       * calendar day; this built a UTC-midnight Monday and compared absolute
       * instants against it. West of UTC they agree; east of it they do not. In
       * London in summer a session logged at 00:30 on Monday is 23:30 UTC on
       * Sunday, so the streak counted it as this week and this counted it as
       * last week - on the same screen, one line apart.
       *
       * Same helper, same answer, and it is shorter.
       */
      getThisWeekCount: () => {
        const { completedSessions } = get();
        const thisWeek = isoWeek(new Date());
        return completedSessions.filter((s) => isoWeek(new Date(s.date)) === thisWeek).length;
      },

      getBestORM: (lift) => {
        const { oneRepMaxes } = get();
        const lifts = oneRepMaxes.filter((o) => o.lift === lift);
        if (lifts.length === 0) return null;
        return lifts.reduce((best, curr) => (curr.weight > best.weight ? curr : best));
      },

      getEffectiveTier: () => {
        const { equipmentTiers } = get();
        if (!equipmentTiers || equipmentTiers.length === 0) return 'bodyweight';
        let bestIdx = 0;
        for (const t of equipmentTiers) {
          const idx = TIER_ORDER.indexOf(t);
          if (idx > bestIdx) bestIdx = idx;
        }
        return TIER_ORDER[bestIdx];
      },

      getInternalTier: () => {
        const effective = get().getEffectiveTier();
        if (effective === 'bands' || effective === 'bodyweight') return 'bodyweight';
        if (effective === 'kettlebells' || effective === 'dumbbells') return 'dumbbells';
        return 'fullgym';
      },

      getDataForSync: () => {
        const s = get();
        return {
          userProfile: s.userProfile,
          equipmentTiers: s.equipmentTiers,
          completedSessions: s.completedSessions,
          oneRepMaxes: s.oneRepMaxes,
          exerciseFeedback: s.exerciseFeedback,
          weightUnit: s.weightUnit,
          testWeekFrequency: s.testWeekFrequency,
          testWeekDeferred: s.testWeekDeferred,
          cycleStartOffset: s.cycleStartOffset,
          programme: s.programme,
          completedProgrammes: s.completedProgrammes,
          lastLoggedWeights: s.lastLoggedWeights,
          lastSessionPerformance: s.lastSessionPerformance,
          exerciseNormalStreak: s.exerciseNormalStreak,
          exerciseStuckStreak: s.exerciseStuckStreak,
          /**
           * The rep targets the app has earned for you, and the note explaining
           * the last change.
           *
           * These were the only part of progression that never left the phone.
           * Everything around them syncs - the weights, the streaks, the
           * performance ratings - so a new phone restored your loads and then
           * quietly reset every rep target to the catalogue default, undoing
           * weeks of double progression without saying anything. The privacy
           * policy meanwhile promised your progress carries over across
           * devices.
           */
          exerciseRepTarget: s.exerciseRepTarget,
          exerciseRepNote: s.exerciseRepNote,
          savedTemplates: s.savedTemplates,
          bodyweightLog: s.bodyweightLog,
          bodyweightUpdatedAt: s.bodyweightUpdatedAt,
          weeklyStreakGoal: s.weeklyStreakGoal,
          earnedBadges: s.earnedBadges,
        };
      },

      getExerciseHistory: (exerciseId) => {
        const { completedSessions } = get();
        return completedSessions
          .map((session) => {
            const log = session.exerciseLogs.find((el) => el.exerciseId === exerciseId);
            if (!log) return null;
            return { sessionId: session.id, date: session.date, sets: log.sets };
          })
          .filter(
            (entry): entry is { sessionId: string; date: string; sets: SetLog[] } => entry !== null
          );
      },

      getAllExerciseProgress: () => {
        const { completedSessions } = get();
        const map = new Map<string, ExerciseProgress>();
        // completedSessions is stored newest-first; iterate oldest-first so each
        // exercise's appearances read left-to-right chronologically.
        const chronological = [...completedSessions].reverse();
        for (const session of chronological) {
          for (const log of session.exerciseLogs) {
            const workingSets = log.sets.filter((s) => s.completed && s.weight > 0);
            if (workingSets.length === 0) continue;
            const bestSetWeight = workingSets.reduce((b, s) => (s.weight > b ? s.weight : b), 0);
            const avgWorkingWeight =
              workingSets.reduce((sum, s) => sum + s.weight, 0) / workingSets.length;
            // The reps that went with the heaviest set. Where two sets tie on
            // weight the better one is the one with more reps, which is also
            // the honest answer to "what was your best set".
            const bestSetReps = workingSets
              .filter((s) => s.weight === bestSetWeight)
              .reduce((b, s) => (s.reps > b ? s.reps : b), 0);
            const estimatedOrmKg =
              bestSetReps > 0 ? estimateOrmFromAmrap(bestSetWeight, bestSetReps) : undefined;
            /**
             * Keyed by the CANONICAL NAME, not by the exercise id.
             *
             * The same movement existed in the database twice — once in the
             * KPI-lift collection and once in the weekly-session collection —
             * with different ids. So a bench press logged on bench day and a
             * bench press logged on upper-body day produced two separate rows
             * in Exercise Progress, each with half the history, and neither
             * showing the real trend. Merging the names fixed the picker; this
             * fixes the twelve months of data behind it.
             *
             * canonicalExerciseName also carries pre-rename history forward, so
             * nobody's chart restarts because the app changed a label.
             */
            const key = canonicalExerciseName(log.exerciseName);
            let entry = map.get(key);
            if (!entry) {
              entry = {
                exerciseId: log.exerciseId,
                exerciseName: key,
                sessionType: session.sessionType,
                appearances: [],
              };
              map.set(key, entry);
            }
            // Iterating oldest->newest means the last write wins, so the row shows
            // the most recent id/session-type for an exercise that may have moved.
            entry.exerciseId = log.exerciseId;
            entry.sessionType = session.sessionType;
            entry.appearances.push({
              date: session.date,
              bestSetWeight,
              avgWorkingWeight,
              bestSetReps: bestSetReps > 0 ? bestSetReps : undefined,
              estimatedOrmKg,
            });
          }
        }
        return Array.from(map.values());
      },

      updateSessionNotes: (id, notes) => {
        set((s) => ({
          completedSessions: s.completedSessions.map((sess) =>
            sess.id === id ? { ...sess, notes } : sess
          ),
        }));
      },

      mergeServerData: (data) => {
        const s = get();
        // A reset that has not reached the server yet outranks anything the
        // server can offer. Without this, resetting with no signal looked like
        // it worked and was silently undone on the next launch — the server is
        // ahead on sessions BY DEFINITION right after a reset, so the restore
        // branch below fires every time and hands back exactly what the user
        // just deleted. The confirmation said "this cannot be undone".
        if (s.resetPendingUpload) return;
        const serverCount = data.completedSessions?.length ?? 0;
        const localCount = s.completedSessions.length;
        // Only a server that is strictly ahead may overwrite, so sessions logged
        // offline and not yet uploaded are never thrown away. This is only safe
        // because whatever is on the device is guaranteed to belong to the
        // account being merged into — sign-out and a mismatched sign-in both
        // wipe the device first (see lib/auth-context.tsx).
        /**
         * The bodyweight the user typed most recently wins, whichever side it
         * came from.
         *
         * The gate order is onboarding, then sign-in — so a user restoring on a
         * new phone, or after a reinstall or a sign-out, has to complete the
         * whole profile again BEFORE they are allowed to sign in. They step on
         * the scales, type today's weight, sign in, and the server's copy
         * overwrites it with whatever was last uploaded. Every load in the app
         * is scaled from that number.
         *
         * Comparing the timestamps keeps the newer answer rather than letting
         * the session count decide something it knows nothing about.
         */
        const serverWeighedAt = data.bodyweightUpdatedAt
          ? new Date(data.bodyweightUpdatedAt).getTime()
          : 0;
        const localWeighedAt = s.bodyweightUpdatedAt
          ? new Date(s.bodyweightUpdatedAt).getTime()
          : 0;
        const keepLocalBodyweight =
          localWeighedAt > serverWeighedAt && (s.userProfile.bodyweightKg ?? 0) > 0;

        /**
         * SESSIONS ARE UNIONED BEFORE ANYTHING ELSE IS DECIDED.
         *
         * This used to sit inside the block below as
         * `completedSessions: data.completedSessions ?? s.completedSessions`,
         * which REPLACES. A session logged with no signal and not yet uploaded
         * was destroyed the moment the server happened to be one ahead - and
         * uploads fail silently with no retry queue, so that is not rare.
         *
         * Ids are unique per session, so the union needs no gate: it is right
         * whichever side is ahead, and it is right when neither is.
         */
        const mergedSessions = mergeSessionsById(s.completedSessions, data.completedSessions);
        if (mergedSessions.length !== s.completedSessions.length) {
          set({ completedSessions: mergedSessions, completedCount: mergedSessions.length });
        }

        if (serverCount > localCount) {
          const mergedProfile = {
            ...((data.userProfile as any) ?? s.userProfile),
            ...(keepLocalBodyweight ? { bodyweightKg: s.userProfile.bodyweightKg } : {}),
          };
          set({
            userProfile: mergedProfile,
            equipmentTiers: (data.equipmentTiers as any) ?? s.equipmentTiers,
            // Already unioned above. Kept out of this set() on purpose: this
            // branch is "the server is ahead so adopt its view of the current
            // state", and the session list is the one field where neither side
            // is authoritative.
            oneRepMaxes: data.oneRepMaxes ?? s.oneRepMaxes,
            exerciseFeedback: data.exerciseFeedback ?? s.exerciseFeedback,
            weightUnit: (data.weightUnit as any) ?? s.weightUnit,
            testWeekFrequency: (data.testWeekFrequency as any) ?? s.testWeekFrequency,
            testWeekDeferred: data.testWeekDeferred ?? s.testWeekDeferred,
            cycleStartOffset: data.cycleStartOffset ?? s.cycleStartOffset,
            // ?? rather than ||, so a server copy written by an older build
            // (which has no programme key at all) leaves the local enrolment
            // alone instead of un-enrolling somebody on their next sign-in.
            programme: (data.programme as EnrolledProgramme | null) ?? s.programme,
            /**
             * NEVER REPLACED, ALWAYS UNIONED, whichever side is ahead.
             *
             * Same rule as the session list and for the same reason: two
             * devices can each hold a finished block the other has never seen,
             * and adopting one side's view would delete a record of weeks of
             * somebody's training. Ids are derived from the enrolment, so the
             * union needs no gate.
             */
            completedProgrammes: (() => {
              const incoming = (data.completedProgrammes as CompletedProgramme[]) ?? [];
              const byId = new Map(s.completedProgrammes.map((c) => [c.id, c]));
              for (const c of incoming) if (!byId.has(c.id)) byId.set(c.id, c);
              return [...byId.values()].sort((a, b) =>
                a.finishedAt < b.finishedAt ? -1 : a.finishedAt > b.finishedAt ? 1 : 0
              );
            })(),
            lastLoggedWeights: data.lastLoggedWeights ?? s.lastLoggedWeights,
            lastSessionPerformance:
              (data.lastSessionPerformance as any) ?? s.lastSessionPerformance,
            exerciseNormalStreak: data.exerciseNormalStreak ?? s.exerciseNormalStreak,
            exerciseStuckStreak: data.exerciseStuckStreak ?? s.exerciseStuckStreak,
            exerciseRepTarget: (data.exerciseRepTarget as any) ?? s.exerciseRepTarget,
            exerciseRepNote: (data.exerciseRepNote as any) ?? s.exerciseRepNote,
            savedTemplates: data.savedTemplates ?? s.savedTemplates,
            weeklyStreakGoal: data.weeklyStreakGoal ?? s.weeklyStreakGoal,
            earnedBadges: data.earnedBadges ?? s.earnedBadges,
            completedCount: mergedSessions.length,
          });
          // The server just handed back sessions this device did not have, so
          // everything they earned is about to look brand new. Record it
          // silently — restoring a backup is not an achievement.
          get().awardNewBadges({ silent: true });
        }

        // The weigh-in log gets its OWN gate rather than riding on the session
        // count. Someone can have two years of weigh-ins and no completed
        // sessions — the weight screen does not require training — and under a
        // session-count-only gate that user gets nothing back on a new phone,
        // which is precisely the case the sync was added to protect.
        //
        // Same principle either way: whichever side is strictly ahead wins, so
        // entries added offline and not yet uploaded are never thrown away.
        // MERGED by date, not replaced. One weigh-in per day, so the date is a
        // natural key; a straight swap threw away any entry made on this device
        // and not yet uploaded, which is the same class of loss this sync was
        // added to prevent. The device's own entry wins a same-day tie — it is
        // the one the user is looking at.
        const serverLog = (data.bodyweightLog as BodyweightLogEntry[] | undefined) ?? [];
        if (serverLog.length > 0) {
          const byDate = new Map<string, BodyweightLogEntry>();
          for (const entry of serverLog) byDate.set(entry.date, entry);
          for (const entry of s.bodyweightLog) byDate.set(entry.date, entry);
          const merged = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
          set({
            bodyweightLog: merged,
            // Keep whichever weigh-in actually happened later.
            bodyweightUpdatedAt:
              localWeighedAt >= serverWeighedAt
                ? s.bodyweightUpdatedAt
                : (data.bodyweightUpdatedAt ?? s.bodyweightUpdatedAt),
          });
        }
      },
    }),
    {
      name: 'grow-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        const {
          sessionEquipmentOverride: _transient,
          tourJustCompleted: _tourJustCompleted,
          tourActiveTab: _tourActiveTab,
          tourEnterAtLastStep: _tourEnterAtLastStep,
          tourSkipNonce: _tourSkipNonce,
          // newlyUnlockedBadges is a queue of pop-ups still to show, not a
          // record of anything. What the user actually owns is `earnedBadges`,
          // which is persisted. Storing the queue meant any failure to present
          // or dismiss the achievement sheet became PERMANENT: the sheet is a
          // root-level Modal, the queue only clears once the user dismisses it,
          // and it came straight back on the next cold start. A bug in one
          // pop-up could brick the whole app past a reboot, with no way out but
          // wiping app data. Worst case now is a celebration nobody sees; the
          // badge itself is never at risk.
          newlyUnlockedBadges: _pendingToasts,
          ...persisted
        } = state;
        return persisted as typeof state;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Drop any queue written by a build that still persisted it, before
          // anything can render it. Without this the stale value is merged back
          // in on first load and the trap survives the fix.
          if (state.newlyUnlockedBadges.length > 0) state.clearNewlyUnlockedBadges();
          // Bring earnedBadges up to date with whatever history was just loaded,
          // without celebrating any of it. Nothing can be *earned* between
          // launches — badges only come from actions taken inside the app — so
          // anything this finds is by definition a backfill, not a moment.
          state.reconcileBadgesSilently();
          state.setHasHydrated(true);
        }
      },
      migrate: (persistedState: any, version: number) => {
        // 'elbow_wrist' was split into separate 'elbow' and 'wrist' regions.
        // Anything stored under the old key becomes both: we cannot know which
        // joint the user actually meant, and dropping one would silently lose
        // pain history. Applied to every field that can hold a PainRegion.
        if (persistedState) {
          const splitRegion = (r: string): string[] =>
            r === 'elbow_wrist' ? ['elbow', 'wrist'] : [r];
          const migrateList = (list: unknown): unknown => {
            if (!Array.isArray(list)) return list;
            const out: string[] = [];
            for (const r of list) {
              if (typeof r !== 'string') continue;
              for (const next of splitRegion(r)) if (!out.includes(next)) out.push(next);
            }
            return out;
          };

          if (persistedState.lastPainRegion === 'elbow_wrist') {
            // Single-valued field, so it has to pick one. Wrist: every prehab
            // exercise filed under the old combined region was wrist work.
            persistedState.lastPainRegion = 'wrist';
          }
          if (Array.isArray(persistedState.completedSessions)) {
            for (const s of persistedState.completedSessions) {
              if (!s || typeof s !== 'object') continue;
              if (s.painRegion === 'elbow_wrist') s.painRegion = 'wrist';
              if (s.painRegions) s.painRegions = migrateList(s.painRegions);
            }
          }
          if (persistedState.activeSession?.painRegion === 'elbow_wrist') {
            persistedState.activeSession.painRegion = 'wrist';
          }
        }

        if (persistedState && persistedState.equipmentTier && !persistedState.equipmentTiers) {
          persistedState.equipmentTiers = [persistedState.equipmentTier as EquipmentTier];
        }
        if (!persistedState.equipmentTiers || persistedState.equipmentTiers.length === 0) {
          persistedState.equipmentTiers = ['bodyweight'];
        }
        if (Array.isArray(persistedState.equipmentTiers)) {
          persistedState.equipmentTiers = persistedState.equipmentTiers.map((t: string) =>
            t === 'barbell' ? 'fullgym' : t
          );
        }
        if (!persistedState.exerciseFeedback) {
          persistedState.exerciseFeedback = {};
        }
        if (!persistedState.lastReadinessEnergy) {
          persistedState.lastReadinessEnergy = 'normal';
        }
        if (!persistedState.lastReadinessTime) {
          persistedState.lastReadinessTime = '45';
        }
        if (!persistedState.weightUnit) {
          persistedState.weightUnit = 'kg';
        }
        if (!('lastWeightPromptedAt' in persistedState)) {
          persistedState.lastWeightPromptedAt = null;
        }
        if (!('activeSession' in persistedState)) {
          persistedState.activeSession = null;
        }
        if (!persistedState.lastLoggedWeights) {
          persistedState.lastLoggedWeights = {};
        }
        if (!('reviewPromptShown' in persistedState)) {
          persistedState.reviewPromptShown = false;
        }
        if (!('showcaseComplete' in persistedState)) {
          // An existing user has already paid, so the gate never sends them
          // here; and if their subscription later lapses, seeing what they are
          // being asked to pay for again is the right outcome, not a bug.
          persistedState.showcaseComplete = false;
        }
        if (!('lastSyncedAt' in persistedState)) {
          persistedState.lastSyncedAt = null;
        }
        if (!('reminderPromptKind' in persistedState)) {
          // Null means "not seen yet", and the first launch after upgrading
          // stamps it, so an existing user starts their fortnight from now
          // rather than being dropped straight to weekly.
          persistedState.reminderPromptKind = null;
          persistedState.reminderPromptSince = null;
        }
        if (!('hasEverSubscribed' in persistedState)) {
          // Somebody upgrading who is subscribed right now gets it set on the
          // next launch by the effect in app/_layout.tsx, so the only people who
          // briefly read as "never subscribed" are the ones who are not.
          persistedState.hasEverSubscribed = false;
        }
        if (!('reminderEnabled' in persistedState)) {
          persistedState.reminderEnabled = false;
        }
        if (!('reminderTime' in persistedState)) {
          persistedState.reminderTime = '07:00';
        }
        if (!('cycleStartOffset' in persistedState)) {
          persistedState.cycleStartOffset = 0;
        }
        /**
         * Null, and never a guessed enrolment.
         *
         * Everybody upgrading has answered none of the six new questions, so a
         * programme invented for them here would be built on nothing. Null means
         * getCurrentSessionType falls through to the behaviour they already have,
         * and they get offered the builder rather than moved without being asked.
         */
        if (!('programme' in persistedState)) {
          persistedState.programme = null;
        }
        /**
         * A block measured in weeks becomes the same block measured in sessions.
         *
         * days x blockWeeks is exactly what the old totalSessions was, so
         * anybody mid-block keeps the same finish line and the same position in
         * it. Clamped to the twenty the question now offers, because a five day
         * sixteen week block was eighty sessions and no such choice exists any
         * more.
         */
        if (persistedState.programme && 'blockWeeks' in persistedState.programme) {
          const p = persistedState.programme as Record<string, unknown>;
          const days = Number(p.days) || 3;
          const weeks = Number(p.blockWeeks) || 12;
          const converted = Math.round((days * weeks) / 2) * 2;
          p.sessions = Math.max(4, Math.min(20, converted));
          delete p.blockWeeks;
        }
        /**
         * Nobody upgrading has a finished block on record.
         *
         * Deliberately NOT backfilled from history. The app could look at
         * somebody who has done ninety sessions and manufacture seven blocks
         * they were never on, and every number in those reports would be a
         * guess dressed up as a record. Their first real block is the first one
         * they finish from here.
         */
        if (!Array.isArray(persistedState.completedProgrammes)) {
          persistedState.completedProgrammes = [];
        }
        if (!('pendingProgrammeReportId' in persistedState)) {
          persistedState.pendingProgrammeReportId = null;
        }
        if (!persistedState.exerciseNormalStreak) {
          persistedState.exerciseNormalStreak = {};
        }
        if (!persistedState.exerciseStuckStreak) {
          persistedState.exerciseStuckStreak = {};
        }
        if (!persistedState.lastSessionPerformance) {
          persistedState.lastSessionPerformance = {};
        }
        if (!('profilePhotoUri' in persistedState)) {
          persistedState.profilePhotoUri = null;
        }
        if (!persistedState.savedTemplates) {
          persistedState.savedTemplates = [];
        }
        delete persistedState.feedbackGivenAtCount;
        if (!('historyTypeFilter' in persistedState)) {
          persistedState.historyTypeFilter = null;
        }
        if (!('nudgeEnabled' in persistedState)) {
          persistedState.nudgeEnabled = true;
        }
        if (!('streakProtectionEnabled' in persistedState)) {
          persistedState.streakProtectionEnabled = false;
        }
        if (!('bodyweightReminderEnabled' in persistedState)) {
          persistedState.bodyweightReminderEnabled = true;
        }
        if (!('streakProtectionTime' in persistedState)) {
          persistedState.streakProtectionTime = '20:00';
        }
        if (!('lastPainRegion' in persistedState)) {
          persistedState.lastPainRegion = null;
        }
        if (!('tourComplete' in persistedState)) {
          persistedState.tourComplete = (persistedState.completedSessions?.length ?? 0) > 0;
        }
        if (!('bodyweightUpdatedAt' in persistedState)) {
          persistedState.bodyweightUpdatedAt = null;
        }
        if (!('weightReminderSnoozedAt' in persistedState)) {
          persistedState.weightReminderSnoozedAt = null;
        }
        if (!persistedState.earnedBadges) {
          persistedState.earnedBadges = [];
        }
        if (!persistedState.newlyUnlockedBadges) {
          persistedState.newlyUnlockedBadges = [];
        }
        if (!('weeklyStreakGoal' in persistedState)) {
          persistedState.weeklyStreakGoal = 2;
        }
        if (!('testWeekDeferred' in persistedState)) {
          persistedState.testWeekDeferred = false;
        }
        if (!('themePreference' in persistedState)) {
          persistedState.themePreference = 'dark';
        }
        if (!('onboardingDraft' in persistedState)) {
          persistedState.onboardingDraft = null;
        }
        // v21: badge prestige revamp. Profile-setup badges were removed — badges
        // are now earned through training only. Strip the 9 retired profile IDs
        // from persisted state, and for already-onboarded users seed the single
        // 'onboarding_complete' welcome badge so their count stays correct and no
        // spurious unlock toast fires on next launch.
        const RETIRED_BADGE_IDS = [
          'profile_photo',
          'profile_goals_set',
          'profile_goals_multi',
          'profile_1rm_squat',
          'profile_1rm_bench',
          'profile_1rm_deadlift',
          'profile_1rm_all',
          'profile_bodyweight_updated',
          'profile_onboarding',
        ];
        if (Array.isArray(persistedState.earnedBadges)) {
          persistedState.earnedBadges = persistedState.earnedBadges.filter(
            (id: string) => !RETIRED_BADGE_IDS.includes(id)
          );
          if (
            persistedState.onboardingComplete === true &&
            !persistedState.earnedBadges.includes('onboarding_complete')
          ) {
            persistedState.earnedBadges.push('onboarding_complete');
          }
        }
        if (Array.isArray(persistedState.newlyUnlockedBadges)) {
          persistedState.newlyUnlockedBadges = persistedState.newlyUnlockedBadges.filter(
            (id: string) => !RETIRED_BADGE_IDS.includes(id)
          );
        }
        if (!('calibrationBannerDismissed' in persistedState)) {
          persistedState.calibrationBannerDismissed = false;
        }
        if (!('readinessTutorialShown' in persistedState)) {
          persistedState.readinessTutorialShown =
            (persistedState.completedSessions?.length ?? 0) > 0;
        }
        if (!('sessionTutorialShown' in persistedState)) {
          persistedState.sessionTutorialShown = (persistedState.completedSessions?.length ?? 0) > 0;
        }
        if (!persistedState.bodyweightLog) {
          persistedState.bodyweightLog = [];
        }
        // v26: seed bodyweightLog for users who set their weight before the log
        // existed (or via older setUserProfile that didn't append to the log).
        // Uses bodyweightUpdatedAt as the entry date; falls back to now.
        if (
          persistedState.bodyweightLog.length === 0 &&
          persistedState.userProfile?.bodyweightKg > 0
        ) {
          persistedState.bodyweightLog = [
            {
              date: persistedState.bodyweightUpdatedAt ?? new Date().toISOString(),
              kg: persistedState.userProfile.bodyweightKg,
            },
          ];
        }
        /**
         * v29 - THE MIGRATION THE OWNER TAG SHIPPED WITHOUT.
         *
         * dataOwnerId was added on 2026-08-11 and the version was not bumped,
         * so migrate() never ran for an upgrading device and the field stayed
         * at its initial null. The sign-in guard in lib/auth-context.tsx treats
         * "null owner, and this device has training on it" as an intruder and
         * clears storage - so every user on an older build lost their history
         * the next time they signed in, which they all do eventually: the token
         * lasts 30 days and there is no refresh.
         *
         * We cannot name the account that owns an untagged device. But a device
         * with completed sessions on it has necessarily been signed in, because
         * the paywall sits between onboarding and the tabs, so the person
         * signing in on it is that same person. Mark it claimable exactly once;
         * setDataOwnerId clears the flag, and from then on the guard is a plain
         * identity check again.
         *
         * A device with a profile and NO sessions is not marked: that is either
         * a first-run user about to sign in for the first time, which the guard
         * already allows, or the hand-me-down case the guard exists to catch.
         */
        if (!('dataOwnerClaimPending' in persistedState)) {
          persistedState.dataOwnerClaimPending =
            !persistedState.dataOwnerId &&
            (persistedState.completedSessions?.length ?? 0) > 0;
        }
        return persistedState;
      },
      version: 32,
    }
  )
);

/**
 * Keep the workout engine's idea of when you last trained in step with the
 * store's.
 *
 * A subscription rather than a line inside each action, because
 * `completedSessions` changes on four separate paths — completing a session,
 * resetting progress, merging server data, and rehydrating from disk — and a
 * date that is right on three of them is worse than no date at all: it would
 * back the load off for someone who had been training all along.
 *
 * The engine is deliberately store-free (its contract tests import it directly
 * and cannot drag persistence in behind it), so the dependency runs this way
 * round and only this way round.
 */
const publishLastTrained = (state: AppState) =>
  setLastTrainedDate(state.completedSessions[0]?.date ?? null);
publishLastTrained(useAppStore.getState());
useAppStore.subscribe(publishLastTrained);
