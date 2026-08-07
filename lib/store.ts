import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SyncPayload } from '@/lib/sync';
import { evaluateBadges } from '@/lib/badge-engine';
import { isoWeek } from '@/lib/utils';
import {
  getTrainingBalanceNudge as getBalanceNudge,
  type BalanceNudge,
} from '@/lib/training-balance';

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

export const PAIN_ADAPTATION_REGION_COUNT =
  PAIN_CATEGORIES.upper.regions.length +
  PAIN_CATEGORIES.torso.regions.length +
  PAIN_CATEGORIES.lower.regions.length;

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
}

export interface ActiveSession {
  sessionType: SessionType;
  equipmentTier: EquipmentTier;
  hasAches: boolean;
  painRegion?: PainRegion;
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
}

export interface OneRepMax {
  lift: SessionType;
  weight: number;
  reps?: number;
  date: string;
  unit: 'kg';
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
  /** Whether the daily workout reminder is enabled. */
  reminderEnabled: boolean;
  /** Time for the daily workout reminder in "HH:MM" format (24-hour). */
  reminderTime: string;
  /** Whether the "missed workout" nudge notification is enabled. */
  nudgeEnabled: boolean;
  /** Whether the streak-protection alert (8pm on untrained days) is enabled. */
  streakProtectionEnabled: boolean;
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
  setEquipmentTiers: (tiers: EquipmentTier[]) => void;
  setTestWeekFrequency: (freq: TestWeekFrequency) => void;
  /** Postpone today's due test week — isTestWeekDue() stays true until a
   *  genuine test-week session completes, instead of the count moving past it. */
  deferTestWeek: () => void;
  setUserProfile: (profile: Partial<UserProfile>) => void;
  setLastWeightPromptedAt: (ts: number) => void;
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
  /** The one training-balance observation worth showing right now, or null.
   *  See lib/training-balance.ts for what it will and will not say. */
  getTrainingBalanceNudge: (now: number) => BalanceNudge | null;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setNudgeEnabled: (enabled: boolean) => void;
  setStreakProtectionEnabled: (enabled: boolean) => void;
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
  };
  isTestWeekDue: () => boolean;
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
      equipmentTiers: ['bodyweight'],
      completedCount: 0,
      completedSessions: [],
      oneRepMaxes: [],
      testWeekFrequency: 12,
      testWeekDeferred: false,
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
      hasHydrated: false,
      activeSession: null,
      lastLoggedWeights: {},
      reviewPromptShown: false,
      balanceNudgeDismissedAt: null,
      reminderEnabled: false,
      reminderTime: '07:00',
      nudgeEnabled: true,
      streakProtectionEnabled: false,
      bodyweightReminderEnabled: true,
      streakProtectionTime: '20:00',
      weeklyStreakGoal: 2,
      cycleStartOffset: 0,
      themePreference: 'dark',
      profilePhotoUri: null,
      exerciseNormalStreak: {},
      exerciseStuckStreak: {},
      lastSessionPerformance: {},
      pendingCustomExercises: [],
      savedTemplates: [],
      historyTypeFilter: null,
      tourComplete: false,
      tourJustCompleted: false,
      tourActiveTab: null,
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
        set({ onboardingComplete: complete });
      },
      setEquipmentTiers: (tiers) =>
        set({ equipmentTiers: tiers.length > 0 ? tiers : ['bodyweight'] }),
      setTestWeekFrequency: (freq) => set({ testWeekFrequency: freq }),
      deferTestWeek: () => set({ testWeekDeferred: true }),
      setUserProfile: (profile) => {
        set((state) => {
          if (profile.bodyweightKg !== undefined && profile.bodyweightKg > 0) {
            const lastEntry = state.bodyweightLog[state.bodyweightLog.length - 1];
            const weightChanged = !lastEntry || lastEntry.kg !== profile.bodyweightKg;
            const now = new Date().toISOString();
            return {
              userProfile: { ...state.userProfile, ...profile },
              bodyweightUpdatedAt: now,
              bodyweightLog: weightChanged
                ? [...state.bodyweightLog, { date: now, kg: profile.bodyweightKg }]
                : state.bodyweightLog,
            };
          }
          return { userProfile: { ...state.userProfile, ...profile } };
        });
        get().awardNewBadges();
      },
      setLastWeightPromptedAt: (ts) => set({ lastWeightPromptedAt: ts }),
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
      setReminderTime: (time) => set({ reminderTime: time }),
      setNudgeEnabled: (enabled) => set({ nudgeEnabled: enabled }),
      setStreakProtectionEnabled: (enabled) => set({ streakProtectionEnabled: enabled }),
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
      skipTour: () =>
        set((s) => ({
          tourComplete: true,
          tourActiveTab: null,
          sessionTutorialShown: true,
          tourSkipNonce: s.tourSkipNonce + 1,
        })),
      markTourGenuinelyCompleted: () => {
        set({ tourGenuinelyCompleted: true });
        get().awardNewBadges();
      },
      setReadinessTutorialShown: (shown) => set({ readinessTutorialShown: shown }),
      setSessionTutorialShown: (shown) => set({ sessionTutorialShown: shown }),
      setWeightReminderSnoozedAt: (ts) => set({ weightReminderSnoozedAt: ts }),
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
          for (const log of session.exerciseLogs) {
            if (!log.exerciseId) continue;
            // If every set was skipped the user didn't perform the exercise at all -
            // treat as a no-op so we don't advance load or streak for a skipped exercise.
            const allSkipped = log.sets.length > 0 && log.sets.every((s) => s.skipped);
            if (allSkipped) continue;
            const hadFailure = log.sets.some((s) => !s.completed && !s.skipped);
            const thisPerf: 'failed' | 'normal' = hadFailure ? 'failed' : 'normal';
            // Apply in-session feedback override: 'very_easy'/'easy' upgrade to more
            // load next session (a bigger jump for 'very_easy'), 'hard' downgrades to
            // failed (hold load next session). This is equivalent to what
            // setExerciseFeedback does post-session, but applied inline so the data
            // is available immediately without a separate action call.
            let perfWithFeedback: ExercisePerformance = thisPerf;
            if (log.feedbackRating === 'very_easy') perfWithFeedback = 'very_easy';
            else if (log.feedbackRating === 'easy') perfWithFeedback = 'easy';
            else if (log.feedbackRating === 'hard') perfWithFeedback = 'failed';
            newPerformance[log.exerciseId] = perfWithFeedback;
            // Streak counts consecutive 'normal' sessions for this exercise (no feedback,
            // all sets completed). Any explicit feedback or raw failure resets to 0.
            //
            //   perfWithFeedback 'normal' && prev 'normal' → increment (run continues)
            //   perfWithFeedback 'normal' && prev was not  → 1  (new run begins)
            //   perfWithFeedback 'failed' or 'easy'        → 0  (run broken; reset)
            const prevPerf = state.lastSessionPerformance[log.exerciseId];
            if (perfWithFeedback !== 'normal') {
              newStreak[log.exerciseId] = 0;
            } else if (prevPerf === 'normal') {
              newStreak[log.exerciseId] = (state.exerciseNormalStreak[log.exerciseId] ?? 1) + 1;
            } else {
              // perfWithFeedback === 'normal' but prev was 'easy', 'failed', or first appearance.
              newStreak[log.exerciseId] = 1;
            }
            // Stuck streak: consecutive 'failed' sessions, same shape as the
            // normal streak above but for the opposite outcome.
            if (perfWithFeedback !== 'failed') {
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
            // A genuine test-week session clears any postponement — the thing
            // it was standing in for has now actually happened.
            ...(session.isTestWeek ? { testWeekDeferred: false } : {}),
          };
        });
        // Award any newly unlocked badges based on the updated state.
        get().awardNewBadges();
      },

      addOneRepMax: (orm) => {
        set((state) => ({
          oneRepMaxes: [orm, ...state.oneRepMaxes],
        }));
        // New 1RM may unlock strength badges.
        get().awardNewBadges();
      },

      resetProgress: () =>
        set({
          completedCount: 0,
          completedSessions: [],
          oneRepMaxes: [],
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
      isOnStrengthProgramme: () => {
        const { completedSessions } = get();
        if (completedSessions.length < NON_KPI_EVIDENCE) return true;
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
        };
        // Turned off entirely. Checked before the resume branch below on
        // purpose: someone who switches test weeks off part-way through a block
        // is asking not to be tested, and "you still owe us two more" is not an
        // answer to that.
        if (testWeekFrequency === 'never') return idleOff;

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
        };

        // Part-way through: finish the remaining lifts before anything else.
        if (completed > 0 && completed < SESSION_ORDER.length) {
          return {
            active: true,
            completed,
            total: SESSION_ORDER.length,
            nextLift: SESSION_ORDER[completed],
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
        return due
          ? { active: true, completed: 0, total: SESSION_ORDER.length, nextLift: SESSION_ORDER[0] }
          : idle;
      },

      isTestWeekDue: () => get().getTestWeekProgress().active,

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

      getThisWeekCount: () => {
        const { completedSessions } = get();
        // Use the same ISO Mon–Sun week boundary as getStreakDays() to avoid
        // Sun/Mon boundary mismatches when comparing "this week" to the streak.
        const now = new Date();
        const startOfWeek = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const dow = startOfWeek.getUTCDay() || 7; // 1=Mon … 7=Sun
        startOfWeek.setUTCDate(startOfWeek.getUTCDate() - (dow - 1)); // back to Monday
        startOfWeek.setUTCHours(0, 0, 0, 0);

        return completedSessions.filter((s) => new Date(s.date) >= startOfWeek).length;
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
          lastLoggedWeights: s.lastLoggedWeights,
          lastSessionPerformance: s.lastSessionPerformance,
          exerciseNormalStreak: s.exerciseNormalStreak,
          exerciseStuckStreak: s.exerciseStuckStreak,
          savedTemplates: s.savedTemplates,
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
            let entry = map.get(log.exerciseId);
            if (!entry) {
              entry = {
                exerciseId: log.exerciseId,
                exerciseName: log.exerciseName,
                sessionType: session.sessionType,
                appearances: [],
              };
              map.set(log.exerciseId, entry);
            }
            // Iterating oldest->newest means the last write wins, so the row shows
            // the most recent name/session-type for an exercise that may have moved.
            entry.exerciseName = log.exerciseName;
            entry.sessionType = session.sessionType;
            entry.appearances.push({ date: session.date, bestSetWeight, avgWorkingWeight });
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
        const serverCount = data.completedSessions?.length ?? 0;
        const localCount = s.completedSessions.length;
        if (serverCount > localCount) {
          set({
            userProfile: (data.userProfile as any) ?? s.userProfile,
            equipmentTiers: (data.equipmentTiers as any) ?? s.equipmentTiers,
            completedSessions: data.completedSessions ?? s.completedSessions,
            oneRepMaxes: data.oneRepMaxes ?? s.oneRepMaxes,
            exerciseFeedback: data.exerciseFeedback ?? s.exerciseFeedback,
            weightUnit: (data.weightUnit as any) ?? s.weightUnit,
            testWeekFrequency: (data.testWeekFrequency as any) ?? s.testWeekFrequency,
            testWeekDeferred: data.testWeekDeferred ?? s.testWeekDeferred,
            cycleStartOffset: data.cycleStartOffset ?? s.cycleStartOffset,
            lastLoggedWeights: data.lastLoggedWeights ?? s.lastLoggedWeights,
            lastSessionPerformance:
              (data.lastSessionPerformance as any) ?? s.lastSessionPerformance,
            exerciseNormalStreak: data.exerciseNormalStreak ?? s.exerciseNormalStreak,
            exerciseStuckStreak: data.exerciseStuckStreak ?? s.exerciseStuckStreak,
            savedTemplates: data.savedTemplates ?? s.savedTemplates,
            completedCount: data.completedSessions?.length ?? s.completedCount,
          });
          // The server just handed back sessions this device did not have, so
          // everything they earned is about to look brand new. Record it
          // silently — restoring a backup is not an achievement.
          get().awardNewBadges({ silent: true });
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
        if (!('reminderEnabled' in persistedState)) {
          persistedState.reminderEnabled = false;
        }
        if (!('reminderTime' in persistedState)) {
          persistedState.reminderTime = '07:00';
        }
        if (!('cycleStartOffset' in persistedState)) {
          persistedState.cycleStartOffset = 0;
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
        return persistedState;
      },
      version: 27,
    }
  )
);
