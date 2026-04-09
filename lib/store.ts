import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EquipmentTier = 'bodyweight' | 'bands' | 'dumbbells' | 'kettlebells' | 'fullgym';
export type EnergyLevel = 'low' | 'normal' | 'high';
export type SessionType = 'squat' | 'bench' | 'deadlift' | 'conditioning' | 'prehab' | 'flexibility';
export type TimeAvailable = '30' | '45' | '60';
export type TestWeekFrequency = 12 | 18;
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type FitnessGoal = 'strength' | 'muscle' | 'fat_loss' | 'fitness' | 'rehab';
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

  getCurrentSessionType: () => SessionType;
  isTestWeekDue: () => boolean;
  getStreakDays: () => number;
  getThisWeekCount: () => number;
  getBestORM: (lift: SessionType) => OneRepMax | null;
  getEffectiveTier: () => EquipmentTier;
  getInternalTier: () => 'bodyweight' | 'dumbbells' | 'fullgym';
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

      completeSession: (session) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        set((state) => ({
          completedCount: state.completedCount + 1,
          completedSessions: [{ ...session, id }, ...state.completedSessions],
        }));
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
        return {
          exerciseFeedback: {
            ...state.exerciseFeedback,
            [exerciseId]: {
              tooEasy: current?.tooEasy ?? false,
              thumbs,
              multiplier: newMult,
            },
          },
        };
      }),

      applyTooEasyAdjustment: (exerciseIds) => set((state) => {
        const updated = { ...state.exerciseFeedback };
        for (const id of exerciseIds) {
          const current = updated[id]?.multiplier ?? 1.0;
          updated[id] = {
            tooEasy: true,
            thumbs: updated[id]?.thumbs ?? null,
            multiplier: parseFloat(Math.min(1.5, current + 0.07).toFixed(3)),
          };
        }
        return { exerciseFeedback: updated };
      }),

      getCurrentSessionType: () => {
        const { completedCount } = get();
        return SESSION_ORDER[completedCount % 3];
      },

      isTestWeekDue: () => {
        const { completedCount, testWeekFrequency } = get();
        if (completedCount === 0) return false;
        return completedCount % testWeekFrequency === 0;
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
        return persistedState;
      },
      version: 10,
    }
  )
);
