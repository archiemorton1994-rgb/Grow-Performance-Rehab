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
  testWeekFrequency: number;
  cycleStartOffset: number;
  lastLoggedWeights: Record<string, number>;
  lastSessionPerformance: Record<string, string>;
  exerciseNormalStreak: Record<string, number>;
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
