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
