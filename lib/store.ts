import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EquipmentTier = 'bodyweight' | 'dumbbells' | 'fullgym';
export type EnergyLevel = 'low' | 'normal' | 'high';
export type PainArea = 'upper' | 'back' | 'legs';
export type SessionType = 'squat' | 'bench' | 'deadlift';

export interface CompletedSession {
  id: string;
  sessionType: SessionType;
  date: string;
  equipmentTier: EquipmentTier;
  hadAches: boolean;
  painArea?: PainArea;
  energy: EnergyLevel;
  exerciseCount: number;
}

interface AppState {
  onboardingComplete: boolean;
  equipmentTier: EquipmentTier;
  completedCount: number;
  completedSessions: CompletedSession[];

  setOnboardingComplete: (complete: boolean) => void;
  setEquipmentTier: (tier: EquipmentTier) => void;
  completeSession: (session: Omit<CompletedSession, 'id'>) => void;
  resetProgress: () => void;

  getCurrentSessionType: () => SessionType;
  getStreakDays: () => number;
  getThisWeekCount: () => number;
}

const SESSION_ORDER: SessionType[] = ['squat', 'bench', 'deadlift'];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboardingComplete: false,
      equipmentTier: 'bodyweight',
      completedCount: 0,
      completedSessions: [],

      setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
      setEquipmentTier: (tier) => set({ equipmentTier: tier }),

      completeSession: (session) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        set((state) => ({
          completedCount: state.completedCount + 1,
          completedSessions: [{ ...session, id }, ...state.completedSessions],
        }));
      },

      resetProgress: () => set({
        completedCount: 0,
        completedSessions: [],
      }),

      getCurrentSessionType: () => {
        const { completedCount } = get();
        return SESSION_ORDER[completedCount % 3];
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
    }),
    {
      name: 'grow-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
