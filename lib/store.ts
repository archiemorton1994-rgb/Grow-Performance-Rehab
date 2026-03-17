import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EquipmentTier = 'bodyweight' | 'bands' | 'dumbbells' | 'kettlebells' | 'fullgym';
export type EnergyLevel = 'low' | 'normal' | 'high';
export type SessionType = 'squat' | 'bench' | 'deadlift' | 'conditioning';
export type TimeAvailable = '30' | '45' | '60';
export type TestWeekFrequency = 12 | 18;
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type FitnessGoal = 'strength' | 'muscle' | 'fat_loss' | 'fitness' | 'rehab';

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

export interface SetLog {
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  sets: SetLog[];
}

export interface OneRepMax {
  lift: SessionType;
  weight: number;
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
}

export type Sex = 'male' | 'female' | 'other';

export interface UserProfile {
  name: string;
  sex: Sex;
  experienceLevel: ExperienceLevel;
  goal: FitnessGoal;
  bodyweightKg: number;
}

interface AppState {
  onboardingComplete: boolean;
  equipmentTier: EquipmentTier;
  completedCount: number;
  completedSessions: CompletedSession[];
  oneRepMaxes: OneRepMax[];
  testWeekFrequency: TestWeekFrequency;
  userProfile: UserProfile;

  setOnboardingComplete: (complete: boolean) => void;
  setEquipmentTier: (tier: EquipmentTier) => void;
  setTestWeekFrequency: (freq: TestWeekFrequency) => void;
  setUserProfile: (profile: Partial<UserProfile>) => void;
  completeSession: (session: Omit<CompletedSession, 'id'>) => void;
  addOneRepMax: (orm: OneRepMax) => void;
  resetProgress: () => void;

  getCurrentSessionType: () => SessionType;
  isTestWeekDue: () => boolean;
  getStreakDays: () => number;
  getThisWeekCount: () => number;
  getBestORM: (lift: SessionType) => OneRepMax | null;
  getInternalTier: () => 'bodyweight' | 'dumbbells' | 'fullgym';
}

const SESSION_ORDER: SessionType[] = ['squat', 'bench', 'deadlift'];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboardingComplete: false,
      equipmentTier: 'bodyweight',
      completedCount: 0,
      completedSessions: [],
      oneRepMaxes: [],
      testWeekFrequency: 12,
      userProfile: {
        name: '',
        sex: 'male' as Sex,
        experienceLevel: 'beginner',
        goal: 'fitness',
        bodyweightKg: 75,
      },

      setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
      setEquipmentTier: (tier) => set({ equipmentTier: tier }),
      setTestWeekFrequency: (freq) => set({ testWeekFrequency: freq }),
      setUserProfile: (profile) => set((state) => ({
        userProfile: { ...state.userProfile, ...profile },
      })),

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

        let streak = 0;
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

        for (let i = 0; i < sortedDays.length; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() - i);
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

      getInternalTier: () => {
        const { equipmentTier } = get();
        if (equipmentTier === 'bands' || equipmentTier === 'bodyweight') return 'bodyweight';
        if (equipmentTier === 'kettlebells' || equipmentTier === 'dumbbells') return 'dumbbells';
        return 'fullgym';
      },
    }),
    {
      name: 'grow-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
