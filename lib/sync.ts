import { apiRequest } from '@/lib/query-client';

export interface SyncPayload {
  userProfile: {
    name: string;
    sex: string;
    experienceLevel: string;
    goals: string[];
    bodyweightKg: number;
  };
  equipmentTiers: string[];
  completedSessions: any[];
  oneRepMaxes: any[];
  exerciseFeedback: Record<string, any>;
  weightUnit: string;
  /** 12 | 18 | 'never' — see TestWeekFrequency in lib/store.ts. Widened when
   *  'never' was added; a device switch must not silently turn test weeks back
   *  on for someone who declined them. */
  testWeekFrequency: number | string;
  testWeekDeferred: boolean;
  cycleStartOffset: number;
  lastLoggedWeights: Record<string, number>;
  lastSessionPerformance: Record<string, string>;
  exerciseNormalStreak: Record<string, number>;
  exerciseStuckStreak: Record<string, number>;
  savedTemplates: any[];
  /**
   * Weigh-ins, the streak goal, and the badge wall.
   *
   * These were the three things a user owned that never left the phone. Sign-out
   * wipes the device (deliberately — two people sharing a handset must not share
   * an account), so anything absent from this payload is destroyed rather than
   * merely un-synced. A year of weigh-ins, the chart and the history list built
   * from them, all gone to a routine sign-out or a new phone, with no warning.
   *
   * Optional because a payload written by an older build will not have them, and
   * an absent field must leave what is on the device alone.
   */
  bodyweightLog?: any[];
  bodyweightUpdatedAt?: string | null;
  weeklyStreakGoal?: number;
  earnedBadges?: string[];
}

export async function uploadUserData(payload: SyncPayload): Promise<void> {
  try {
    await apiRequest('PUT', '/api/user/data', payload);
  } catch {
    // Silent - local data is always source of truth; upload retry on next foreground
  }
}

export async function downloadUserData(): Promise<SyncPayload | null> {
  try {
    const res = await apiRequest('GET', '/api/user/data');
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}
