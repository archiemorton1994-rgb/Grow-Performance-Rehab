import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SyncPayload } from '@/lib/sync';

export type EquipmentTier = 'bodyweight' | 'bands' | 'dumbbells' | 'kettlebells' | 'fullgym';
export type EnergyLevel = 'low' | 'normal' | 'high';
export type SessionType = 'squat' | 'bench' | 'deadlift' | 'conditioning' | 'prehab' | 'flexibility' | 'custom';
/** Session types that contribute to strength progressive overload. */
export const STRENGTH_SESSION_TYPES: SessionType[] = ['squat', 'bench', 'deadlift'];
export type ExerciseCategory = 'prep' | 'mechanical' | 'neuro' | 'main' | 'accessory' | 'prehab' | 'finisher' | 'cooldown';
export type TimeAvailable = '30' | '45' | '60';
export type TestWeekFrequency = 12 | 18;
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type FitnessGoal = 'strength' | 'muscle' | 'fat_loss' | 'fitness' | 'rehab' | 'power';
export type WeightUnit = 'kg' | 'lbs';

export type PainRegion =
  | 'front_shoulder' | 'rear_shoulder' | 'elbow_wrist' | 'neck'
  | 'lower_back' | 'upper_back' | 'core_ribs'
  | 'knee' | 'hip_groin' | 'ankle_achilles' | 'calf_shin';

export const PAIN_CATEGORIES = {
  upper: {
    label: 'Upper Body',
    regions: [
      { id: 'front_shoulder' as PainRegion, label: 'Front Shoulder' },
      { id: 'rear_shoulder' as PainRegion, label: 'Rear Shoulder' },
      { id: 'elbow_wrist' as PainRegion, label: 'Elbow / Wrist' },
      { id: 'neck' as PainRegion, label: 'Neck' },
    ],
  },
  torso: {
    label: 'Torso',
    regions: [
      { id: 'lower_back' as PainRegion, label: 'Lower Back' },
      { id: 'upper_back' as PainRegion, label: 'Upper Back / Thoracic' },
      { id: 'core_ribs' as PainRegion, label: 'Core / Ribs' },
    ],
  },
  lower: {
    label: 'Lower Body',
    regions: [
      { id: 'knee' as PainRegion, label: 'Knee' },
      { id: 'hip_groin' as PainRegion, label: 'Hip / Groin' },
      { id: 'ankle_achilles' as PainRegion, label: 'Ankle / Achilles' },
      { id: 'calf_shin' as PainRegion, label: 'Calf / Shin' },
    ],
  },
};

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
}

export interface CustomTemplate {
  id: string;
  name: string;
  exercises: CustomExercise[];
  createdAt: string;
}

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
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  sets: SetLog[];
  note?: string;
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
  energy: EnergyLevel;
  timeAvailable: TimeAvailable;
  exerciseCount: number;
  exerciseLogs: ExerciseLog[];
  isTestWeek?: boolean;
  durationSeconds?: number;
}

export type Sex = 'male' | 'female' | 'other';

export interface UserProfile {
  name: string;
  sex: Sex;
  experienceLevel: ExperienceLevel;
  goals: FitnessGoal[];
  bodyweightKg: number;
}

export const TIER_ORDER: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];

interface AppState {
  onboardingComplete: boolean;
  equipmentTiers: EquipmentTier[];
  completedCount: number;
  completedSessions: CompletedSession[];
  oneRepMaxes: OneRepMax[];
  testWeekFrequency: TestWeekFrequency;
  userProfile: UserProfile;
  exerciseFeedback: Record<string, ExerciseFeedback>;
  lastReadinessEnergy: EnergyLevel;
  lastReadinessTime: TimeAvailable;
  weightUnit: WeightUnit;
  lastWeightPromptedAt: number | null;
  hasHydrated: boolean;
  activeSession: ActiveSession | null;
  /** Maximum weight (kg) logged per exercise name in any past session.
   *  Used by the workout engine to auto-progress load by +2.5 kg per session. */
  lastLoggedWeights: Record<string, number>;
  /** Whether the App Store review prompt has already been shown to this user. */
  reviewPromptShown: boolean;
  /** Whether the daily workout reminder is enabled. */
  reminderEnabled: boolean;
  /** Time for the daily workout reminder in "HH:MM" format (24-hour). */
  reminderTime: string;
  /** Whether the "missed workout" nudge notification is enabled. */
  nudgeEnabled: boolean;
  /** Whether the streak-protection alert (8pm on untrained days) is enabled. */
  streakProtectionEnabled: boolean;
  /** Offset into the squat→bench→deadlift rotation for new users who chose a different starting session. */
  cycleStartOffset: number;
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
   * Records how each exercise performed in the most recent session it appeared in.
   * Set by `completeSession` based on actual set completion data, then updated
   * by post-session thumbs/tooEasy feedback. The workout engine uses this as the
   * primary signal for per-exercise progressive overload decisions:
   *   'easy'   → +5 kg next session
   *   'normal' → +2.5 kg next session (or +5 kg after a 3-session no-feedback streak)
   *   'failed' → hold at same weight next session
   */
  lastSessionPerformance: Record<string, 'easy' | 'normal' | 'failed'>;

  setOnboardingComplete: (complete: boolean) => void;
  setEquipmentTiers: (tiers: EquipmentTier[]) => void;
  setTestWeekFrequency: (freq: TestWeekFrequency) => void;
  setUserProfile: (profile: Partial<UserProfile>) => void;
  setLastWeightPromptedAt: (ts: number) => void;
  setHasHydrated: (hydrated: boolean) => void;
  completeSession: (session: Omit<CompletedSession, 'id'>) => void;
  addOneRepMax: (orm: OneRepMax) => void;
  resetProgress: () => void;
  setExerciseFeedback: (exerciseId: string, thumbs: 'up' | 'down' | null) => void;
  applyTooEasyAdjustment: (exerciseIds: string[]) => void;
  setLastReadiness: (energy: EnergyLevel, time: TimeAvailable) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  setActiveSession: (session: ActiveSession) => void;
  clearActiveSession: () => void;
  updateLastLoggedWeights: (weights: Record<string, number>) => void;
  setReviewPromptShown: (shown: boolean) => void;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setNudgeEnabled: (enabled: boolean) => void;
  setStreakProtectionEnabled: (enabled: boolean) => void;
  setCycleStartOffset: (offset: number) => void;
  setProfilePhotoUri: (uri: string | null) => void;
  /** Last session-type filter selected on the Stats screen. Persisted so it survives tab switches and app restarts. */
  historyTypeFilter: SessionType | null;
  setHistoryTypeFilter: (filter: SessionType | null) => void;
  pendingCustomExercises: CustomExercise[];
  setPendingCustomExercises: (exercises: CustomExercise[]) => void;
  clearPendingCustomExercises: () => void;

  savedTemplates: CustomTemplate[];
  saveTemplate: (name: string, exercises: CustomExercise[]) => void;
  deleteTemplate: (id: string) => void;
  updateTemplate: (id: string, patch: Partial<Pick<CustomTemplate, 'name' | 'exercises'>>) => void;

  getCurrentSessionType: () => SessionType;
  isTestWeekDue: () => boolean;
  getStreakDays: () => number;
  getThisWeekCount: () => number;
  getBestORM: (lift: SessionType) => OneRepMax | null;
  getEffectiveTier: () => EquipmentTier;
  getInternalTier: () => 'bodyweight' | 'dumbbells' | 'fullgym';
  getDataForSync: () => SyncPayload;
  mergeServerData: (data: SyncPayload) => void;
}

const SESSION_ORDER: SessionType[] = ['squat', 'bench', 'deadlift'];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboardingComplete: false,
      equipmentTiers: ['bodyweight'],
      completedCount: 0,
      completedSessions: [],
      oneRepMaxes: [],
      testWeekFrequency: 12,
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
      weightUnit: 'kg',
      lastWeightPromptedAt: null,
      hasHydrated: false,
      activeSession: null,
      lastLoggedWeights: {},
      reviewPromptShown: false,
      reminderEnabled: false,
      reminderTime: '07:00',
      nudgeEnabled: true,
      streakProtectionEnabled: false,
      cycleStartOffset: 0,
      profilePhotoUri: null,
      exerciseNormalStreak: {},
      lastSessionPerformance: {},
      pendingCustomExercises: [],
      savedTemplates: [],
      historyTypeFilter: null,

      setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
      setEquipmentTiers: (tiers) => set({ equipmentTiers: tiers.length > 0 ? tiers : ['bodyweight'] }),
      setTestWeekFrequency: (freq) => set({ testWeekFrequency: freq }),
      setUserProfile: (profile) => set((state) => ({
        userProfile: { ...state.userProfile, ...profile },
      })),
      setLastWeightPromptedAt: (ts) => set({ lastWeightPromptedAt: ts }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
      setLastReadiness: (energy, time) => set({ lastReadinessEnergy: energy, lastReadinessTime: time }),
      setWeightUnit: (unit) => set({ weightUnit: unit }),
      setActiveSession: (session) => set({ activeSession: session }),
      clearActiveSession: () => set({ activeSession: null }),
      updateLastLoggedWeights: (weights) => set((state) => ({
        lastLoggedWeights: { ...state.lastLoggedWeights, ...weights },
      })),
      setReviewPromptShown: (shown) => set({ reviewPromptShown: shown }),
      setReminderEnabled: (enabled) => set({ reminderEnabled: enabled }),
      setReminderTime: (time) => set({ reminderTime: time }),
      setNudgeEnabled: (enabled) => set({ nudgeEnabled: enabled }),
      setStreakProtectionEnabled: (enabled) => set({ streakProtectionEnabled: enabled }),
      setCycleStartOffset: (offset) => set({ cycleStartOffset: offset }),
      setProfilePhotoUri: (uri) => set({ profilePhotoUri: uri }),
      setHistoryTypeFilter: (filter) => set({ historyTypeFilter: filter }),
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
      deleteTemplate: (id) => set((state) => ({
        savedTemplates: state.savedTemplates.filter((t) => t.id !== id),
      })),
      updateTemplate: (id, patch) => set((state) => ({
        savedTemplates: state.savedTemplates.map((t) =>
          t.id === id ? { ...t, ...patch } : t
        ),
      })),

      completeSession: (session) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        set((state) => {
          // Derive per-exercise session performance from actual set completion data.
          // This is the primary input for the workout engine's progressive overload
          // decisions in the next session.
          //   'failed'  — at least one set was not completed and not explicitly skipped
          //   'normal'  — all sets were completed (or skipped) successfully
          // Post-session feedback (thumbs/tooEasy) can upgrade 'normal' → 'easy'
          // or downgrade 'normal' → 'failed' via setExerciseFeedback.
          const newPerformance: Record<string, 'easy' | 'normal' | 'failed'> = {
            ...state.lastSessionPerformance,
          };
          // Track consecutive sessions each exercise appeared with a 'normal'
          // performance (no feedback override, all sets completed).
          // We look at what `lastSessionPerformance` was BEFORE this session to
          // decide whether to increment (was 'normal') or reset (was 'easy'/'failed').
          const newStreak = { ...state.exerciseNormalStreak };
          for (const log of session.exerciseLogs) {
            if (!log.exerciseId) continue;
            // If every set was skipped the user didn't perform the exercise at all —
            // treat as a no-op so we don't advance load or streak for a skipped exercise.
            const allSkipped = log.sets.length > 0 && log.sets.every((s) => s.skipped);
            if (allSkipped) continue;
            const hadFailure = log.sets.some((s) => !s.completed && !s.skipped);
            const thisPerf: 'failed' | 'normal' = hadFailure ? 'failed' : 'normal';
            newPerformance[log.exerciseId] = thisPerf;
            // Streak counts consecutive 'normal' sessions for this exercise.
            // Three-way update ensures the streak is always accurate (no
            // inflate-then-correct lag):
            //
            //   both prev AND this session normal  → increment (run continues)
            //   this session normal, prev was not  → 1 (new run begins)
            //   this session failed                → 0 (run broken; reset)
            //
            // Explicit feedback (thumbs/tooEasy) resets to 0 immediately, so
            // the next completeSession starts a fresh run from 1.
            const prevPerf = state.lastSessionPerformance[log.exerciseId];
            if (thisPerf === 'failed') {
              newStreak[log.exerciseId] = 0;
            } else if (prevPerf === 'normal') {
              newStreak[log.exerciseId] = (state.exerciseNormalStreak[log.exerciseId] ?? 1) + 1;
            } else {
              // thisPerf === 'normal' but prev was 'easy', 'failed', or first appearance.
              newStreak[log.exerciseId] = 1;
            }
          }

          return {
            completedCount: state.completedCount + 1,
            completedSessions: [{ ...session, id }, ...state.completedSessions],
            lastSessionPerformance: newPerformance,
            exerciseNormalStreak: newStreak,
          };
        });
      },

      addOneRepMax: (orm) => {
        set((state) => ({
          oneRepMaxes: [orm, ...state.oneRepMaxes],
        }));
      },

      resetProgress: () => set({
        completedCount: 0,
        completedSessions: [],
        oneRepMaxes: [],
      }),

      setExerciseFeedback: (exerciseId, thumbs) => set((state) => {
        const current = state.exerciseFeedback[exerciseId];
        const currentMult = current?.multiplier ?? 1.0;
        let newMult = currentMult;
        if (thumbs === 'up') {
          newMult = parseFloat(Math.min(1.5, currentMult + 0.03).toFixed(3));
        } else if (thumbs === 'down') {
          newMult = parseFloat(Math.max(0.70, currentMult - 0.05).toFixed(3));
        }
        // Thumbs feedback also updates lastSessionPerformance — this is the
        // post-session override that adjusts what completeSession computed from
        // raw set data (e.g. user completed all sets but found it easy = 'easy').
        const performance = thumbs === 'up' ? 'easy' : thumbs === 'down' ? 'failed' : state.lastSessionPerformance[exerciseId];
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
          // exercise — the streak only counts sessions with zero intervention.
          exerciseNormalStreak: {
            ...state.exerciseNormalStreak,
            [exerciseId]: 0,
          },
        };
      }),

      applyTooEasyAdjustment: (exerciseIds) => set((state) => {
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
          // Mark performance as 'easy' — user found this exercise manageable
          updatedPerformance[id] = 'easy';
          // Reset streak — explicit feedback interrupts the no-feedback run
          updatedStreak[id] = 0;
        }
        return {
          exerciseFeedback: updated,
          lastSessionPerformance: updatedPerformance,
          exerciseNormalStreak: updatedStreak,
        };
      }),

      getCurrentSessionType: () => {
        const { completedSessions, cycleStartOffset } = get();
        // Cycle rotation only advances on squat/bench/deadlift sessions.
        // Conditioning, prehab, flexibility, and custom sessions do not shift the rotation.
        const strengthCount = completedSessions.filter(s => SESSION_ORDER.includes(s.sessionType)).length;
        return SESSION_ORDER[(strengthCount + cycleStartOffset) % 3];
      },

      isTestWeekDue: () => {
        const { completedSessions, testWeekFrequency } = get();
        // Test week is based on strength session count only.
        const strengthCount = completedSessions.filter(s => SESSION_ORDER.includes(s.sessionType)).length;
        if (strengthCount === 0) return false;
        return strengthCount % testWeekFrequency === 0;
      },

      getStreakDays: () => {
        const { completedSessions } = get();
        if (completedSessions.length === 0) return 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const uniqueDays = new Set(
          completedSessions.map((s) => {
            const d = new Date(s.date);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
          })
        );

        const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);

        // Allow streak to survive if the user hasn't trained yet today — start
        // counting from yesterday so the streak isn't zeroed out at midnight.
        const todayMs = today.getTime();
        const hasTodaySession = uniqueDays.has(todayMs);
        const startOffset = hasTodaySession ? 0 : 1;

        let streak = 0;
        for (let i = 0; i < sortedDays.length; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() - (i + startOffset));
          checkDate.setHours(0, 0, 0, 0);

          if (sortedDays.includes(checkDate.getTime())) {
            streak++;
          } else {
            break;
          }
        }

        return streak;
      },

      getThisWeekCount: () => {
        const { completedSessions } = get();
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        return completedSessions.filter((s) => new Date(s.date) >= startOfWeek).length;
      },

      getBestORM: (lift) => {
        const { oneRepMaxes } = get();
        const lifts = oneRepMaxes.filter((o) => o.lift === lift);
        if (lifts.length === 0) return null;
        return lifts.reduce((best, curr) => curr.weight > best.weight ? curr : best);
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
          cycleStartOffset: s.cycleStartOffset,
          lastLoggedWeights: s.lastLoggedWeights,
          lastSessionPerformance: s.lastSessionPerformance,
          exerciseNormalStreak: s.exerciseNormalStreak,
          savedTemplates: s.savedTemplates,
        };
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
            cycleStartOffset: data.cycleStartOffset ?? s.cycleStartOffset,
            lastLoggedWeights: data.lastLoggedWeights ?? s.lastLoggedWeights,
            lastSessionPerformance: (data.lastSessionPerformance as any) ?? s.lastSessionPerformance,
            exerciseNormalStreak: data.exerciseNormalStreak ?? s.exerciseNormalStreak,
            savedTemplates: data.savedTemplates ?? s.savedTemplates,
            completedCount: data.completedSessions?.length ?? s.completedCount,
          });
        }
      },
    }),
    {
      name: 'grow-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
      },
      migrate: (persistedState: any, version: number) => {
        if (persistedState && persistedState.equipmentTier && !persistedState.equipmentTiers) {
          persistedState.equipmentTiers = [persistedState.equipmentTier as EquipmentTier];
        }
        if (!persistedState.equipmentTiers || persistedState.equipmentTiers.length === 0) {
          persistedState.equipmentTiers = ['bodyweight'];
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
        return persistedState;
      },
      version: 14,
    }
  )
);
