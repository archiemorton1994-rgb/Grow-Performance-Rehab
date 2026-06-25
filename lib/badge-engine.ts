/**
 * Badge Engine — pure evaluation function.
 *
 * `evaluateBadges(state)` receives a snapshot of the Zustand store and returns
 * the full list of badge IDs the user has currently earned.  It is intentionally
 * stateless: the store layer diffs the result against `earnedBadges` to find
 * newly unlocked badges.
 *
 * Rules:
 *  - Never import from the store (circular dependency).  Accept a plain typed snapshot.
 *  - O(n) over completed sessions at worst.  All heavy work is done once per call.
 *  - When a criterion cannot be verified (e.g. session date missing), skip silently.
 */

import type { CompletedSession, OneRepMax, UserProfile, EquipmentTier, SessionType, FitnessGoal } from '@/lib/store';

export interface BadgeEvalState {
  completedSessions: CompletedSession[];
  oneRepMaxes: OneRepMax[];
  userProfile: UserProfile;
  profilePhotoUri: string | null;
  equipmentTiers: EquipmentTier[];
  bodyweightUpdatedAt: string | null;
  onboardingComplete: boolean;
  /** Minimum sessions per Mon–Sun week required to keep a streak alive. Default 2. */
  weeklyStreakGoal: number;
}

// ─── Pre-computed stats ───────────────────────────────────────────────────────

interface Stats {
  total: number;
  byType: Record<string, number>;
  streak: number;
  totalVolumeKg: number;
  bestOrm: Record<string, number>;           // lift → best kg
  testWeekCount: number;
  sessionsByDate: Map<string, CompletedSession[]>;  // YYYY-MM-DD → sessions
  sessionDates: string[];                    // sorted ISO date strings
  maxSessionVolumeKg: number;
  maxSingleSetWeightKg: number;
  recoveryCount: number;                     // prehab + flex combined
  sixtyMinCount: number;
  fortyFiveMinCount: number;
  thirtyMinCount: number;
  totalTrainingSeconds: number;
  comebackCount: number;                     // times returned after 7+ day gap
  earlySessionCount: number;                 // before 07:00
  before6Count: number;                      // before 06:00
  nightSessionCount: number;                 // after 21:00
  midnightCount: number;                     // after 00:00 (ie next calendar day)
  weekendCount: number;
  noonCount: number;                         // 12:00 – 14:00
  eveningCount: number;                      // 17:00 – 19:00
  distinctTypesUsed: Set<string>;
  uniqueEquipmentUsed: Set<string>;
  strengthSessionCount: number;              // squat + bench + deadlift
  conditioningCount: number;
  morningSessionsInRow: number;              // running counter (unused by engine – computed separately)
  lowEnergyCount: number;
  weeklyGrouped: Map<string, Set<string>>;   // "YYYY-Www" → set of session types
  weeklySessionCounts: Map<string, number>;  // "YYYY-Www" → session count
  monthlySessionCounts: Map<string, number>; // "YYYY-MM"  → session count
  ormLiftsSet: Set<string>;                  // lifts with at least one ORM entry
}

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function computeStats(state: BadgeEvalState): Stats {
  const { completedSessions, oneRepMaxes } = state;

  const byType: Record<string, number> = {};
  const sessionsByDate = new Map<string, CompletedSession[]>();
  const weeklyGrouped = new Map<string, Set<string>>();
  const weeklySessionCounts = new Map<string, number>();
  const monthlySessionCounts = new Map<string, number>();
  const distinctTypesUsed = new Set<string>();
  const uniqueEquipmentUsed = new Set<string>();
  const ormLiftsSet = new Set<string>();

  let totalVolumeKg = 0;
  let maxSessionVolumeKg = 0;
  let maxSingleSetWeightKg = 0;
  let testWeekCount = 0;
  let recoveryCount = 0;
  let sixtyMinCount = 0;
  let fortyFiveMinCount = 0;
  let thirtyMinCount = 0;
  let totalTrainingSeconds = 0;
  let earlySessionCount = 0;
  let before6Count = 0;
  let nightSessionCount = 0;
  let midnightCount = 0;
  let weekendCount = 0;
  let noonCount = 0;
  let eveningCount = 0;
  let strengthSessionCount = 0;
  let conditioningCount = 0;
  let lowEnergyCount = 0;

  for (const session of completedSessions) {
    const type = session.sessionType;
    byType[type] = (byType[type] ?? 0) + 1;
    distinctTypesUsed.add(type);
    uniqueEquipmentUsed.add(session.equipmentTier);

    if (type === 'prehab' || type === 'flexibility') recoveryCount++;
    if (type === 'squat' || type === 'bench' || type === 'deadlift') strengthSessionCount++;
    if (type === 'conditioning') conditioningCount++;
    if (session.isTestWeek) testWeekCount++;
    if (session.energy === 'low') lowEnergyCount++;

    const dur = session.durationSeconds ?? 0;
    totalTrainingSeconds += dur;
    if (session.timeAvailable === '60') sixtyMinCount++;
    if (session.timeAvailable === '45') fortyFiveMinCount++;
    if (session.timeAvailable === '30') thirtyMinCount++;

    // Date-based grouping
    const dateObj = new Date(session.date);
    const dateKey = dateObj.toISOString().slice(0, 10);
    if (!sessionsByDate.has(dateKey)) sessionsByDate.set(dateKey, []);
    sessionsByDate.get(dateKey)!.push(session);

    const week = isoWeek(dateObj);
    if (!weeklyGrouped.has(week)) weeklyGrouped.set(week, new Set());
    weeklyGrouped.get(week)!.add(type);
    weeklySessionCounts.set(week, (weeklySessionCounts.get(week) ?? 0) + 1);

    const monthKey = session.date.slice(0, 7);
    monthlySessionCounts.set(monthKey, (monthlySessionCounts.get(monthKey) ?? 0) + 1);

    // Time-of-day
    const hour = dateObj.getHours();
    if (hour < 6)  before6Count++;
    if (hour < 7)  earlySessionCount++;
    if (hour >= 21) nightSessionCount++;
    if (hour === 0) midnightCount++;
    if (hour >= 12 && hour < 14) noonCount++;
    if (hour >= 17 && hour < 19) eveningCount++;
    const dow = dateObj.getDay();
    if (dow === 0 || dow === 6) weekendCount++;

    // Volume
    let sessionVol = 0;
    for (const log of session.exerciseLogs) {
      for (const set of log.sets) {
        if (set.completed && set.weight > 0) {
          const vol = set.weight * set.reps;
          totalVolumeKg += vol;
          sessionVol += vol;
          if (set.weight > maxSingleSetWeightKg) maxSingleSetWeightKg = set.weight;
        }
      }
    }
    if (sessionVol > maxSessionVolumeKg) maxSessionVolumeKg = sessionVol;
  }

  // Best ORM per lift
  const bestOrm: Record<string, number> = {};
  for (const orm of oneRepMaxes) {
    ormLiftsSet.add(orm.lift);
    if (!bestOrm[orm.lift] || orm.weight > bestOrm[orm.lift]) {
      bestOrm[orm.lift] = orm.weight;
    }
  }

  // Streak — consecutive Mon–Sun training weeks with ≥ 2 sessions each.
  // If the current week already has ≥ 2 sessions it counts; otherwise the
  // current week is treated as "in progress" and we start from the prior week
  // so the streak is not penalised for early-week reads.
  const streakToday = new Date();
  const thisWeekKey = isoWeek(streakToday);
  const thisWeekCount = weeklySessionCounts.get(thisWeekKey) ?? 0;
  let streakCheckDate = thisWeekCount >= 2
    ? streakToday
    : new Date(streakToday.getTime() - 7 * 86400000);
  let streak = 0;
  for (let _i = 0; _i < 200; _i++) {
    const key = isoWeek(streakCheckDate);
    if ((weeklySessionCounts.get(key) ?? 0) >= 2) {
      streak++;
      streakCheckDate = new Date(streakCheckDate.getTime() - 7 * 86400000);
    } else {
      break;
    }
  }

  // Comeback count: times a session follows a 7+ day gap
  const sortedDates = Array.from(sessionsByDate.keys()).sort();
  let comebackCount = 0;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]).getTime();
    const curr = new Date(sortedDates[i]).getTime();
    const gapDays = (curr - prev) / 86400000;
    if (gapDays >= 7) comebackCount++;
  }

  return {
    total: completedSessions.length,
    byType,
    streak,
    totalVolumeKg,
    bestOrm,
    testWeekCount,
    sessionsByDate,
    sessionDates: sortedDates,
    maxSessionVolumeKg,
    maxSingleSetWeightKg,
    recoveryCount,
    sixtyMinCount,
    fortyFiveMinCount,
    thirtyMinCount,
    totalTrainingSeconds,
    comebackCount,
    earlySessionCount,
    before6Count,
    nightSessionCount,
    midnightCount,
    weekendCount,
    noonCount,
    eveningCount,
    distinctTypesUsed,
    uniqueEquipmentUsed,
    strengthSessionCount,
    conditioningCount,
    morningSessionsInRow: 0,
    lowEnergyCount,
    weeklyGrouped,
    weeklySessionCounts,
    monthlySessionCounts,
    ormLiftsSet,
  };
}

// Helper: how many consecutive weeks had N+ sessions
function consecutiveWeeksWithMinSessions(weeklySessionCounts: Map<string, number>, minSessions: number): number {
  const weeks = Array.from(weeklySessionCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b));
  let maxRun = 0;
  let run = 0;
  for (const [, count] of weeks) {
    if (count >= minSessions) {
      run++;
      if (run > maxRun) maxRun = run;
    } else {
      run = 0;
    }
  }
  return maxRun;
}

// ─── Main evaluator ───────────────────────────────────────────────────────────

export function evaluateBadges(state: BadgeEvalState): string[] {
  const earned: string[] = [];
  const s = computeStats(state);
  const { userProfile, profilePhotoUri, equipmentTiers, bodyweightUpdatedAt, onboardingComplete } = state;
  const goals: FitnessGoal[] = userProfile.goals ?? [];

  function award(id: string) { earned.push(id); }
  function awardIf(condition: boolean, id: string) { if (condition) earned.push(id); }

  // ── 1. Milestones ──────────────────────────────────────────────────────────
  const milestoneCounts = [1,2,3,5,7,10,15,20,25,30,40,50,60,75,100,125,150,175,200,250,300,350,400,500,750];
  for (const n of milestoneCounts) {
    awardIf(s.total >= n, `milestone_${n}`);
  }

  // ── 2. Streaks (consecutive training weeks with ≥ 2 sessions) ──────────────
  const streakWeekThresholds = [2,4,6,8,12,16,20,26,32,40,52,78,104];
  for (const n of streakWeekThresholds) {
    awardIf(s.streak >= n, `streak_${n}wk`);
  }

  // ── 3. Strength – Squat 1RM (every 10 kg, 20–400 kg) ────────────────────────
  const squatOrm = s.bestOrm['squat'] ?? 0;
  for (let kg = 20; kg <= 400; kg += 10) {
    awardIf(squatOrm >= kg, `squat_${kg}kg`);
  }

  // ── 4. Strength – Bench 1RM (every 10 kg, 20–300 kg) ────────────────────────
  const benchOrm = s.bestOrm['bench'] ?? 0;
  for (let kg = 20; kg <= 300; kg += 10) {
    awardIf(benchOrm >= kg, `bench_${kg}kg`);
  }

  // ── 5. Strength – Deadlift 1RM (every 10 kg, 20–500 kg) ──────────────────────
  const dlOrm = s.bestOrm['deadlift'] ?? 0;
  for (let kg = 20; kg <= 500; kg += 10) {
    awardIf(dlOrm >= kg, `deadlift_${kg}kg`);
  }

  // ── 6. Volume (cumulative) ────────────────────────────────────────────────
  for (const n of [1_000,5_000,10_000,25_000,50_000,100_000,200_000,500_000,1_000_000,2_000_000,5_000_000,10_000_000]) {
    awardIf(s.totalVolumeKg >= n, `volume_${n}`);
  }

  // ── 7-13. Session type counts ─────────────────────────────────────────────
  const typeMap: Record<string, string> = {
    squat: 'lower', bench: 'upper', deadlift: 'full',
    conditioning: 'conditioning', prehab: 'prehab', flexibility: 'flex', custom: 'custom',
  };
  for (const [storeType, prefix] of Object.entries(typeMap)) {
    const count = s.byType[storeType] ?? 0;
    for (const n of [1,3,5,10,15,20,25,30,50,75,100,150,200]) {
      awardIf(count >= n, `${prefix}_session_${n}`);
    }
  }

  // ── 14. Consistency ───────────────────────────────────────────────────────
  const consec2x = consecutiveWeeksWithMinSessions(s.weeklySessionCounts, 2);
  const consec3x = consecutiveWeeksWithMinSessions(s.weeklySessionCounts, 3);
  const consec4x = consecutiveWeeksWithMinSessions(s.weeklySessionCounts, 4);
  awardIf(consec2x >= 4,  'consistent_2x_4wk');
  awardIf(consec2x >= 8,  'consistent_2x_8wk');
  awardIf(consec2x >= 12, 'consistent_2x_12wk');
  awardIf(consec3x >= 4,  'consistent_3x_4wk');
  awardIf(consec3x >= 8,  'consistent_3x_8wk');
  awardIf(consec3x >= 12, 'consistent_3x_12wk');
  awardIf(consec4x >= 4,  'consistent_4x_4wk');
  awardIf(consec4x >= 8,  'consistent_4x_8wk');
  // 5+ sessions in any week
  awardIf(Array.from(s.weeklySessionCounts.values()).some(c => c >= 5), 'consistent_5x_1wk');
  // Perfect week (7 different days = full week)
  awardIf(Array.from(s.weeklySessionCounts.values()).some(c => c >= 7), 'consistent_7x_1wk');
  // 20+ in a month
  awardIf(Array.from(s.monthlySessionCounts.values()).some(c => c >= 20), 'consistent_20_month');
  // 30 in any 30-day window (approximate with sorted dates)
  if (s.sessionDates.length >= 30) {
    const sd = s.sessionDates;
    let found = false;
    for (let i = 29; i < sd.length; i++) {
      const windowStart = new Date(sd[i - 29]).getTime();
      const windowEnd   = new Date(sd[i]).getTime();
      if ((windowEnd - windowStart) / 86400000 <= 30) { found = true; break; }
    }
    awardIf(found, 'consistent_30_month');
  }
  // 100 sessions in any 365-day window
  if (s.sessionDates.length >= 100) {
    const sd = s.sessionDates;
    let found = false;
    for (let i = 99; i < sd.length; i++) {
      const windowStart = new Date(sd[i - 99]).getTime();
      const windowEnd   = new Date(sd[i]).getTime();
      if ((windowEnd - windowStart) / 86400000 <= 365) { found = true; break; }
    }
    awardIf(found, 'consistent_100_year');
  }
  awardIf(s.earlySessionCount >= 10, 'consistent_morning_10');
  awardIf(s.earlySessionCount >= 30, 'consistent_morning_30');

  // ── 15. Goals ─────────────────────────────────────────────────────────────
  const strengthSessions = (s.byType['squat'] ?? 0) + (s.byType['bench'] ?? 0) + (s.byType['deadlift'] ?? 0);
  // Strength
  awardIf(s.ormLiftsSet.size >= 1,       'goal_strength_1rm');
  awardIf(strengthSessions >= 10,        'goal_strength_10');
  awardIf(strengthSessions >= 25,        'goal_strength_25');
  awardIf(strengthSessions >= 50,        'goal_strength_50');
  awardIf(strengthSessions >= 100,       'goal_strength_100');
  awardIf(state.oneRepMaxes.length >= 2, 'goal_strength_pb'); // at least 2 tests = at least one follow-up PB
  // Muscle
  awardIf(s.total >= 1,                              'goal_muscle_1');
  awardIf(s.total >= 10,                             'goal_muscle_10');
  awardIf(s.total >= 25,                             'goal_muscle_25');
  awardIf(s.total >= 50,                             'goal_muscle_50');
  awardIf(s.total >= 100,                            'goal_muscle_100');
  awardIf(s.totalVolumeKg >= 50_000,                 'goal_muscle_volume');
  // Fat loss
  awardIf(s.conditioningCount >= 1,   'goal_fatloss_1');
  awardIf(s.conditioningCount >= 10,  'goal_fatloss_10');
  awardIf(s.conditioningCount >= 25,  'goal_fatloss_25');
  awardIf(s.conditioningCount >= 50,  'goal_fatloss_50');
  awardIf(s.conditioningCount >= 100, 'goal_fatloss_100');
  // Cardio Week: any single Mon–Sun week with 3+ conditioning sessions
  const condPerWeek = new Map<string, number>();
  for (const sess of state.completedSessions) {
    if (sess.sessionType === 'conditioning') {
      const w = isoWeek(new Date(sess.date));
      condPerWeek.set(w, (condPerWeek.get(w) ?? 0) + 1);
    }
  }
  awardIf(Array.from(condPerWeek.values()).some(c => c >= 3), 'goal_fatloss_streak');
  // Fitness
  awardIf(s.total >= 1,  'goal_fitness_1');
  awardIf(s.total >= 10, 'goal_fitness_10');
  awardIf(Array.from(s.weeklyGrouped.values()).some(types => types.size >= 4), 'goal_fitness_variety');
  awardIf(s.total >= 50,  'goal_fitness_50');
  awardIf(s.total >= 100, 'goal_fitness_100');
  // All types with 5 sessions each
  const allTypesDone = ['squat','bench','deadlift','conditioning','prehab','flexibility','custom']
    .every(t => (s.byType[t] ?? 0) >= 5);
  awardIf(allTypesDone, 'goal_fitness_all');
  // Rehab
  const prehabCount = s.byType['prehab'] ?? 0;
  awardIf(prehabCount >= 1,  'goal_rehab_1');
  awardIf(prehabCount >= 5,  'goal_rehab_5');
  awardIf(prehabCount >= 10, 'goal_rehab_10');
  awardIf(prehabCount >= 25, 'goal_rehab_25');
  awardIf(prehabCount >= 50, 'goal_rehab_50');
  // Pain adaptation: sessions where hadAches was true
  const painAdaptCount = state.completedSessions.filter(sess => sess.hadAches).length;
  awardIf(painAdaptCount >= 10, 'goal_rehab_adapt');
  // Power
  awardIf(s.total >= 1,   'goal_power_1');
  awardIf(s.total >= 5,   'goal_power_5');
  awardIf(s.total >= 10,  'goal_power_10');
  awardIf(s.total >= 25,  'goal_power_25');
  awardIf(s.total >= 50,  'goal_power_50');
  awardIf(s.ormLiftsSet.size >= 3, 'goal_power_max');

  // ── 16. Profile ───────────────────────────────────────────────────────────
  awardIf(!!profilePhotoUri,               'profile_photo');
  awardIf(goals.length >= 1,              'profile_goals_set');
  awardIf(goals.length >= 3,              'profile_goals_multi');
  awardIf(s.ormLiftsSet.has('squat'),      'profile_1rm_squat');
  awardIf(s.ormLiftsSet.has('bench'),      'profile_1rm_bench');
  awardIf(s.ormLiftsSet.has('squat') && s.ormLiftsSet.has('bench') && s.ormLiftsSet.has('deadlift'), 'profile_1rm_all');
  awardIf(!!bodyweightUpdatedAt,           'profile_bodyweight_updated');
  awardIf(onboardingComplete,              'profile_onboarding');

  // ── 17. Equipment ─────────────────────────────────────────────────────────
  awardIf(s.uniqueEquipmentUsed.has('bodyweight'),  'equip_bodyweight');
  awardIf(s.uniqueEquipmentUsed.has('bands'),       'equip_bands');
  awardIf(s.uniqueEquipmentUsed.has('dumbbells'),   'equip_dumbbells');
  awardIf(s.uniqueEquipmentUsed.has('kettlebells'), 'equip_kettlebells');
  awardIf(s.uniqueEquipmentUsed.has('barbell'),     'equip_barbell');
  awardIf(s.uniqueEquipmentUsed.has('fullgym'),     'equip_fullgym');
  awardIf(s.uniqueEquipmentUsed.size >= 4,          'equip_all');
  // "Levelled up" = currently has more than one tier (upgraded beyond bodyweight only)
  awardIf(equipmentTiers.length > 1 || equipmentTiers.includes('fullgym') || equipmentTiers.includes('dumbbells'), 'equip_upgraded');

  // ── 18. Test Weeks ────────────────────────────────────────────────────────
  awardIf(s.testWeekCount >= 1,  'test_1');
  awardIf(s.testWeekCount >= 3,  'test_3');
  awardIf(s.testWeekCount >= 5,  'test_5');
  awardIf(s.testWeekCount >= 10, 'test_10');
  awardIf(s.testWeekCount >= 20, 'test_20');

  // ── 19. Time of Day ───────────────────────────────────────────────────────
  awardIf(s.before6Count >= 1,   'time_5am');
  awardIf(s.earlySessionCount >= 5,  'time_early_5');
  awardIf(s.earlySessionCount >= 20, 'time_early_20');
  awardIf(s.noonCount >= 10,    'time_noon_10');
  awardIf(s.eveningCount >= 5,  'time_evening_5');
  awardIf(s.nightSessionCount >= 1,  'time_night_1');
  awardIf(s.nightSessionCount >= 10, 'time_night_10');
  awardIf(s.midnightCount >= 1, 'time_midnight');
  awardIf(s.weekendCount >= 10, 'time_weekend_10');
  awardIf(s.weekendCount >= 30, 'time_weekend_30');

  // ── 20. Variety ───────────────────────────────────────────────────────────
  awardIf(s.distinctTypesUsed.size >= 3, 'variety_3_types');
  awardIf(s.distinctTypesUsed.size >= 5, 'variety_5_types');
  awardIf(s.distinctTypesUsed.size >= 7, 'variety_all_types');
  awardIf(Array.from(s.weeklyGrouped.values()).some(t => t.size >= 3), 'variety_3_in_week');
  awardIf(Array.from(s.weeklyGrouped.values()).some(t => t.size >= 5), 'variety_5_in_week');
  awardIf(s.strengthSessionCount >= 10 && s.conditioningCount >= 10, 'variety_strength_cond');
  awardIf((s.byType['prehab'] ?? 0) >= 5 && (s.byType['flexibility'] ?? 0) >= 5, 'variety_recovery_balance');
  awardIf(Array.from(s.monthlySessionCounts.keys()).some(month => {
    const sessionsThisMonth = state.completedSessions.filter(sess => sess.date.startsWith(month));
    return new Set(sessionsThisMonth.map(sess => sess.sessionType)).size >= 4;
  }), 'variety_all_in_month');
  // 50 sessions across 5 types (any 5)
  const typesSorted = Object.values(s.byType).sort((a,b) => b - a);
  const top5Sum = typesSorted.slice(0, 5).reduce((a, c) => a + c, 0);
  awardIf(top5Sum >= 50 && typesSorted.length >= 5, 'variety_50_per_type');
  awardIf((s.byType['squat'] ?? 0) >= 10 && (s.byType['bench'] ?? 0) >= 10 && (s.byType['deadlift'] ?? 0) >= 10, 'variety_strength_trio');

  // ── 21. Recovery ─────────────────────────────────────────────────────────
  awardIf(s.recoveryCount >= 5,   'recovery_5');
  awardIf(s.recoveryCount >= 15,  'recovery_15');
  awardIf(s.recoveryCount >= 30,  'recovery_30');
  awardIf(s.recoveryCount >= 50,  'recovery_50');
  awardIf(s.recoveryCount >= 100, 'recovery_100');
  // 3+ recovery sessions in a single week
  awardIf(Array.from(s.weeklyGrouped.entries()).some(([week, types]) => {
    const recoveryTypesThisWeek = ['prehab', 'flexibility'].filter(t => types.has(t)).length;
    if (recoveryTypesThisWeek === 0) return false;
    // Count all recovery sessions in this week
    const allRecoveryWeekCount = state.completedSessions.filter(sess =>
      isoWeek(new Date(sess.date)) === week &&
      (sess.sessionType === 'prehab' || sess.sessionType === 'flexibility')
    ).length;
    return allRecoveryWeekCount >= 3;
  }), 'recovery_week');

  // ── 22. Duration ─────────────────────────────────────────────────────────
  awardIf(s.sixtyMinCount >= 1,  'duration_60min_1');
  awardIf(s.sixtyMinCount >= 5,  'duration_60min_5');
  awardIf(s.sixtyMinCount >= 20, 'duration_60min_20');
  awardIf(s.sixtyMinCount >= 50, 'duration_60min_50');
  awardIf(s.sixtyMinCount + s.fortyFiveMinCount >= 10, 'duration_45min_10');
  awardIf(s.thirtyMinCount >= 30, 'duration_30_30');
  const totalHours = s.totalTrainingSeconds / 3600;
  awardIf(totalHours >= 50,  'duration_total_50h');
  awardIf(totalHours >= 100, 'duration_total_100h');

  // ── 23. Comeback ─────────────────────────────────────────────────────────
  if (s.sessionDates.length >= 2) {
    let came7 = false, came14 = false, came30 = false;
    for (let i = 1; i < s.sessionDates.length; i++) {
      const prev = new Date(s.sessionDates[i - 1]).getTime();
      const curr = new Date(s.sessionDates[i]).getTime();
      const gap = (curr - prev) / 86400000;
      if (gap >= 7)  came7  = true;
      if (gap >= 14) came14 = true;
      if (gap >= 30) came30 = true;
    }
    awardIf(came7,  'comeback_7d');
    awardIf(came14, 'comeback_14d');
    awardIf(came30, 'comeback_30d');
  }
  awardIf(s.comebackCount >= 3, 'comeback_3x');
  awardIf(s.comebackCount >= 5, 'comeback_5x');

  // ── 24. Volume Per Session ────────────────────────────────────────────────
  for (const n of [500,1000,2000,3000,5000,7500,10000,15000]) {
    awardIf(s.maxSessionVolumeKg >= n, `vol_session_${n}`);
  }

  // ── 25. Load (heaviest single set) ───────────────────────────────────────
  for (const n of [50,75,100,120,140,160,180,200,250,300]) {
    awardIf(s.maxSingleSetWeightKg >= n, `load_${n}kg`);
  }

  // ── 26. Pain Warrior (sessions with a pain adaptation active) ─────────────
  awardIf(painAdaptCount >= 1,  'pain_warrior_1');
  awardIf(painAdaptCount >= 3,  'pain_warrior_3');
  awardIf(painAdaptCount >= 5,  'pain_warrior_5');
  awardIf(painAdaptCount >= 10, 'pain_warrior_10');
  awardIf(painAdaptCount >= 20, 'pain_warrior_20');

  // ── 27. Endurance / No Excuses (sessions completed when energy was low) ───
  awardIf(s.lowEnergyCount >= 1,  'endurance_1');
  awardIf(s.lowEnergyCount >= 3,  'endurance_3');
  awardIf(s.lowEnergyCount >= 5,  'endurance_5');
  awardIf(s.lowEnergyCount >= 10, 'endurance_10');

  return earned;
}
