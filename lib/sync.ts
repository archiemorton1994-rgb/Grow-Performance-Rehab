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
  /** Optional for the same reason the fields below are: a payload written by an
   *  older build will not carry them, and an absent field must leave whatever is
   *  on the device alone rather than wiping it. */
  exerciseRepTarget?: Record<string, string>;
  exerciseRepNote?: Record<string, string>;
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

/**
 * Returns whether the upload actually landed.
 *
 * It used to return void and swallow every failure, which is right for the
 * routine case — local data is the source of truth and the next foreground
 * retries. But one caller genuinely needs to know: Reset Progress is only
 * irreversible once the server has the cleared state, and a reset performed with
 * no signal was otherwise undone by the next launch restoring the server copy.
 * Silence is still the default; the boolean is there for callers that care.
 */
/**
 * Records a successful upload, so the app can tell the user their years of
 * training are actually somewhere other than this phone.
 *
 * Written HERE rather than at the six call sites, because a seventh caller
 * added later would otherwise be silently missing from the answer. The store's
 * only import from this file is `import type`, which is erased, so there is no
 * runtime cycle; and the import below sits inside the function so it is not
 * evaluated at module load.
 */
async function noteUploadTime(): Promise<void> {
  try {
    const { useAppStore } = await import('@/lib/store');
    useAppStore.getState().markSynced(new Date().toISOString());
  } catch {
    // A timestamp is a nicety. It must never be able to fail an upload.
  }
}

export async function uploadUserData(payload: SyncPayload): Promise<boolean> {
  try {
    await apiRequest('PUT', '/api/user/data', payload);
    void noteUploadTime();
    return true;
  } catch {
    // Silent - local data is always source of truth; upload retry on next foreground
    return false;
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
