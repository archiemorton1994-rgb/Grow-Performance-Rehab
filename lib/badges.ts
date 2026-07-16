/**
 * GROW Badge Catalog — 400+ badges across 21 categories.
 *
 * Each badge has a stable snake_case `id`, an evocative `name`, a plain-English
 * `description` (what you did to earn it), a `category`, a `criteriaType` (the
 * class of data used to evaluate the badge), an Ionicons `icon`, and a `color` hex.
 * The badge engine (`lib/badge-engine.ts`) evaluates which badges a store snapshot
 * has earned.
 */
import { ACHIEVEMENT_GOLD } from '@/constants/colors';

export type BadgeCategory =
  | 'milestone' // total session count
  | 'streak' // consecutive training weeks
  | 'strength_progress' // % improvement on 1RM lifts
  | 'session_lower' // lower body session count
  | 'session_upper' // upper body session count
  | 'session_full' // full body session count
  | 'session_conditioning' // conditioning session count
  | 'session_prehab' // prehab session count
  | 'session_flex' // flexibility session count
  | 'session_custom' // custom session count
  | 'consistency' // weekly / monthly training habits
  | 'goals' // goal-specific achievements
  | 'equipment' // equipment tier usage
  | 'test_week' // 1RM test week completions
  | 'time_of_day' // when you train
  | 'variety' // training variety
  | 'recovery' // combined prehab + flex
  | 'duration' // session duration milestones
  | 'comeback' // returning after a break
  | 'pain_warrior' // sessions completed with pain adaptations
  | 'endurance' // sessions completed when energy was low
  | 'exercise_milestone'; // first time logging a specific named exercise

/**
 * The class of criteria used to evaluate a badge.  Downstream UI can use this
 * to display an explanatory subtitle on locked badges (e.g. "Based on your 1RM").
 */
export type BadgeCriteriaType =
  | 'session_count' // total sessions completed
  | 'streak_weeks' // consecutive training weeks (≥ N sessions per week)
  | 'strength_improvement' // % improvement on a lift 1RM vs first entry
  | 'session_type_count' // count of a specific session type
  | 'consistency_habit' // weekly/monthly regularity patterns
  | 'goal_progress' // goal-specific session/lift milestones
  | 'profile_action' // profile setup / data entry
  | 'equipment_usage' // equipment tiers used in sessions
  | 'test_week' // 1RM test-week completions
  | 'time_based' // time-of-day / day-of-week patterns
  | 'variety' // breadth of session type usage
  | 'recovery' // combined prehab + flexibility sessions
  | 'duration_based' // session duration (timeAvailable)
  | 'comeback' // gap between consecutive sessions
  | 'pain_adaptation' // sessions with pain-region adaptation active
  | 'low_energy' // sessions completed when energy was reported low
  | 'exercise_specific'; // specific named exercise logged for the first time

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  /** Classification of the underlying data used to evaluate this badge. */
  criteriaType: BadgeCriteriaType;
  icon: string; // Ionicons glyph map key
  color: string; // hex
}

// ─── Color palette ───────────────────────────────────────────────────────────
const C = {
  green: '#2f6b46',
  emerald: '#27ae60',
  orange: '#e67e22',
  amber: '#f39c12',
  yellow: '#d4ac0d',
  blue: '#2980b9',
  sky: '#3498db',
  purple: '#8e44ad',
  violet: '#9b59b6',
  red: '#c0392b',
  crimson: '#e74c3c',
  teal: '#16a085',
  mint: '#1abc9c',
  grey: '#7f8c8d',
  pink: '#e84393',
  lime: '#2ecc71',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── 1. Milestone Badges (total session count) ───────────────────────────────
const MILESTONE_DATA: [number, string, string][] = [
  [1, 'First Step', 'Complete your first session'],
  [2, 'Back for More', 'Complete 2 sessions'],
  [3, 'Finding My Groove', 'Complete 3 sessions'],
  [5, 'High Five', 'Complete 5 sessions'],
  [7, 'One Week Strong', 'Complete 7 sessions'],
  [10, 'Double Digits', 'Complete 10 sessions'],
  [15, 'Halfway to Twenty', 'Complete 15 sessions'],
  [20, 'Twenty Down', 'Complete 20 sessions'],
  [25, 'Quarter Century', 'Complete 25 sessions'],
  [30, 'One Month', 'Complete 30 sessions'],
  [40, 'Building Momentum', 'Complete 40 sessions'],
  [50, 'Fifty Strong', 'Complete 50 sessions'],
  [60, 'Sixty Sessions', 'Complete 60 sessions'],
  [75, 'Grinding Hard', 'Complete 75 sessions'],
  [100, 'Century Club', 'Complete 100 sessions'],
  [125, 'Unstoppable', 'Complete 125 sessions'],
  [150, 'Iron Will', 'Complete 150 sessions'],
  [175, 'Beyond Limits', 'Complete 175 sessions'],
  [200, 'Elite 200', 'Complete 200 sessions'],
  [250, 'Quarter Thousand', 'Complete 250 sessions'],
  [300, 'Tricentennial', 'Complete 300 sessions'],
  [350, '350 Sessions Strong', 'Complete 350 sessions'],
  [400, '400 Sessions Strong', 'Complete 400 sessions'],
  [500, 'Legend', 'Complete 500 sessions'],
  [750, 'Immortal', 'Complete 750 sessions'],
];
const milestoneBadges: Badge[] = MILESTONE_DATA.map(([n, name, description]) => ({
  id: `milestone_${n}`,
  name,
  description,
  category: 'milestone',
  criteriaType: 'session_count',
  icon: 'trophy-outline',
  color: C.green,
}));

// ─── 2. Streak Badges (consecutive training weeks with ≥ 2 sessions) ─────────
const STREAK_DATA: [number, string][] = [
  [2, 'On a Roll'],
  [4, 'A Month Strong'],
  [6, 'Six Week Grind'],
  [8, 'Two Month Run'],
  [12, 'Three Month Machine'],
  [16, 'Four Month Force'],
  [20, 'Five Month Beast'],
  [26, 'Half Year Hero'],
  [32, 'Eight Month Titan'],
  [40, 'Ten Month Legend'],
  [52, 'Year of Iron'],
  [78, 'Eighteen Months'],
  [104, 'Two Year Legend'],
];
const streakBadges: Badge[] = STREAK_DATA.map(([n, name]) => ({
  id: `streak_${n}wk`,
  name,
  description: `Train at least 2× per week for ${n} consecutive weeks`,
  category: 'streak',
  criteriaType: 'streak_weeks',
  icon: 'flame-outline',
  color: C.orange,
}));

// ─── 3. Strength Progress (% improvement on 1RM from first to latest test) ───
// These badges scale to every user — a 5% gain is meaningful whether you squat
// 40 kg or 140 kg. Awarded as soon as a 2nd 1RM entry exists for that lift.
type LiftMeta = { color: string; icon: string; label: string };
const LIFT_META: Record<'squat' | 'bench' | 'deadlift', LiftMeta> = {
  squat: { color: C.purple, icon: 'walk-outline', label: 'Squat' },
  bench: { color: C.blue, icon: 'person-outline', label: 'Bench' },
  deadlift: { color: C.red, icon: 'body-outline', label: 'Deadlift' },
};

const PROGRESS_TIERS: [number, string, string][] = [
  [5, 'First Gains', 'Your first measurable improvement'],
  [10, 'Getting Stronger', '10% stronger than when you started'],
  [20, 'Rising Fast', '20% stronger than your first test'],
  [30, 'Breakthrough', '30% stronger than when you started'],
  [50, 'Transformed', '50% stronger - a completely different athlete'],
];

const strengthProgressBadges: Badge[] = (['squat', 'bench', 'deadlift'] as const).flatMap((lift) =>
  PROGRESS_TIERS.map(([pct, name, descSuffix]) => ({
    id: `progress_${lift}_${pct}pct`,
    name: `${LIFT_META[lift].label} ${name}`,
    description: `Improve your ${LIFT_META[lift].label.toLowerCase()} 1RM by ${pct}% - ${descSuffix}`,
    category: 'strength_progress' as BadgeCategory,
    criteriaType: 'strength_improvement' as BadgeCriteriaType,
    icon: LIFT_META[lift].icon,
    color: LIFT_META[lift].color,
  }))
);

// ─── 7–13. Session Type Count Badges ─────────────────────────────────────────
type SessionTypeConfig = {
  prefix: string;
  category: BadgeCategory;
  icon: string;
  color: string;
  typeName: string;
};
const SESSION_TYPE_CONFIGS: SessionTypeConfig[] = [
  {
    prefix: 'lower',
    category: 'session_lower',
    icon: 'walk-outline',
    color: C.purple,
    typeName: 'lower body',
  },
  {
    prefix: 'upper',
    category: 'session_upper',
    icon: 'person-outline',
    color: C.blue,
    typeName: 'upper body',
  },
  {
    prefix: 'full',
    category: 'session_full',
    icon: 'body-outline',
    color: C.red,
    typeName: 'full body',
  },
  {
    prefix: 'conditioning',
    category: 'session_conditioning',
    icon: 'flame-outline',
    color: C.orange,
    typeName: 'conditioning',
  },
  {
    prefix: 'prehab',
    category: 'session_prehab',
    icon: 'shield-checkmark-outline',
    color: C.teal,
    typeName: 'prehab',
  },
  {
    prefix: 'flex',
    category: 'session_flex',
    icon: 'leaf-outline',
    color: C.mint,
    typeName: 'flexibility',
  },
  {
    prefix: 'custom',
    category: 'session_custom',
    icon: 'create-outline',
    color: C.grey,
    typeName: 'custom',
  },
];

const SESSION_COUNT_NAMES: Record<number, (type: string) => string> = {
  1: (t) => `First ${capitalize(t)}`,
  3: (t) => `${capitalize(t)} Trio`,
  5: (t) => `${capitalize(t)} Five`,
  10: (t) => `${capitalize(t)} Veteran`,
  15: (t) => `${capitalize(t)} Regular`,
  20: (t) => `${capitalize(t)} Machine`,
  25: (t) => `${capitalize(t)} Quarter`,
  30: (t) => `${capitalize(t)} Devotee`,
  50: (t) => `${capitalize(t)} Master`,
  75: (t) => `${capitalize(t)} Expert`,
  100: (t) => `${capitalize(t)} Legend`,
  150: (t) => `${capitalize(t)} Champion`,
  200: (t) => `${capitalize(t)} God`,
};

const SESSION_COUNTS = [1, 3, 5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200];
const sessionTypeBadges: Badge[] = SESSION_TYPE_CONFIGS.flatMap(
  ({ prefix, category, icon, color, typeName }) =>
    SESSION_COUNTS.map((n) => ({
      id: `${prefix}_session_${n}`,
      name: (SESSION_COUNT_NAMES[n] ?? ((t: string) => `${capitalize(t)} ${n}`))(typeName),
      description:
        n === 1 ? `Complete your first ${typeName} session` : `Complete ${n} ${typeName} sessions`,
      category,
      criteriaType: 'session_type_count' as BadgeCriteriaType,
      icon,
      color,
    }))
);

// ─── 14. Consistency Badges ───────────────────────────────────────────────────
const consistencyBadges: Badge[] = [
  {
    id: 'consistent_2x_4wk',
    name: 'Twice a Week',
    description: 'Train at least 2× per week for 4 consecutive weeks',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'calendar-outline',
    color: C.amber,
  },
  {
    id: 'consistent_2x_8wk',
    name: 'Twice Weekly Pro',
    description: 'Train at least 2× per week for 8 consecutive weeks',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'calendar-outline',
    color: C.amber,
  },
  {
    id: 'consistent_2x_12wk',
    name: 'Two Days Locked In',
    description: 'Train at least 2× per week for 12 consecutive weeks',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'calendar-outline',
    color: C.amber,
  },
  {
    id: 'consistent_3x_4wk',
    name: 'Three Times Weekly',
    description: 'Train at least 3× per week for 4 consecutive weeks',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'calendar-outline',
    color: C.yellow,
  },
  {
    id: 'consistent_3x_8wk',
    name: 'Three Days Locked',
    description: 'Train at least 3× per week for 8 consecutive weeks',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'calendar-outline',
    color: C.yellow,
  },
  {
    id: 'consistent_3x_12wk',
    name: 'Disciplined',
    description: 'Train at least 3× per week for 12 consecutive weeks',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'calendar-outline',
    color: C.yellow,
  },
  {
    id: 'consistent_4x_4wk',
    name: 'Four Day Week',
    description: 'Train at least 4× per week for 4 consecutive weeks',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'calendar-outline',
    color: C.orange,
  },
  {
    id: 'consistent_4x_8wk',
    name: 'Four Day Force',
    description: 'Train at least 4× per week for 8 consecutive weeks',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'calendar-outline',
    color: C.orange,
  },
  {
    id: 'consistent_5x_1wk',
    name: 'Five in a Week',
    description: 'Train 5 or more times in a single calendar week',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'stats-chart-outline',
    color: C.red,
  },
  {
    id: 'consistent_7x_1wk',
    name: 'Perfect Week',
    description: 'Train every single day of a calendar week',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'star-outline',
    color: C.red,
  },
  {
    id: 'consistent_20_month',
    name: '20 in a Month',
    description: 'Complete 20+ sessions in a single calendar month',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'time-outline',
    color: C.crimson,
  },
  {
    id: 'consistent_30_month',
    name: '30 in 30',
    description: 'Complete 30 sessions across any 30-day window',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'infinite-outline',
    color: C.crimson,
  },
  {
    id: 'consistent_100_year',
    name: 'Century Year',
    description: 'Complete 100 sessions in any 12-month window',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'ribbon-outline',
    color: C.green,
  },
  {
    id: 'consistent_morning_10',
    name: 'Morning 10',
    description: 'Complete 10 sessions before 9am',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'sunny-outline',
    color: C.yellow,
  },
  {
    id: 'consistent_morning_30',
    name: 'Morning Devotee',
    description: 'Complete 30 sessions before 9am',
    category: 'consistency',
    criteriaType: 'consistency_habit',
    icon: 'sunny-outline',
    color: C.amber,
  },
];

// ─── 15. Goal-Specific Badges ─────────────────────────────────────────────────
const goalsBadges: Badge[] = [
  // Strength
  {
    id: 'goal_strength_1rm',
    name: 'Strength Seeker',
    description: 'Log your first strength 1RM test',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'barbell-outline',
    color: C.purple,
  },
  {
    id: 'goal_strength_10',
    name: 'Strong Foundation',
    description: 'Complete 10 strength sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'barbell-outline',
    color: C.purple,
  },
  {
    id: 'goal_strength_25',
    name: 'Strength Builder',
    description: 'Complete 25 strength sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'barbell-outline',
    color: C.purple,
  },
  {
    id: 'goal_strength_50',
    name: 'Strength Focused',
    description: 'Complete 50 strength sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'barbell-outline',
    color: C.purple,
  },
  {
    id: 'goal_strength_100',
    name: 'Strength Legend',
    description: 'Complete 100 strength sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'trophy-outline',
    color: C.purple,
  },
  {
    id: 'goal_strength_pb',
    name: 'Personal Record',
    description: 'Set a new 1RM personal best',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'medal-outline',
    color: C.purple,
  },
  // Muscle
  {
    id: 'goal_muscle_1',
    name: 'Muscle Awakens',
    description: 'Complete your first training session',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'body-outline',
    color: C.teal,
  },
  {
    id: 'goal_muscle_10',
    name: 'Pump Chaser',
    description: 'Complete 10 sessions targeting muscle',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'body-outline',
    color: C.teal,
  },
  {
    id: 'goal_muscle_25',
    name: 'Hypertrophy Habit',
    description: 'Complete 25 sessions targeting muscle',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'body-outline',
    color: C.teal,
  },
  {
    id: 'goal_muscle_50',
    name: 'Mass Builder',
    description: 'Complete 50 sessions targeting muscle',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'body-outline',
    color: C.teal,
  },
  {
    id: 'goal_muscle_100',
    name: 'Muscle Machine',
    description: 'Complete 100 sessions targeting muscle',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'trophy-outline',
    color: C.teal,
  },
  {
    id: 'goal_muscle_volume',
    name: 'Volume King',
    description: 'Lift 50,000 kg total',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'barbell-outline',
    color: C.teal,
  },
  // Fat loss
  {
    id: 'goal_fatloss_1',
    name: 'Fat Burner',
    description: 'Complete your first conditioning session',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'flame-outline',
    color: C.orange,
  },
  {
    id: 'goal_fatloss_10',
    name: 'Sweat Factory',
    description: 'Complete 10 conditioning sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'flame-outline',
    color: C.orange,
  },
  {
    id: 'goal_fatloss_25',
    name: 'Calorie Crusher',
    description: 'Complete 25 conditioning sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'flame-outline',
    color: C.orange,
  },
  {
    id: 'goal_fatloss_50',
    name: 'Burn Artist',
    description: 'Complete 50 conditioning sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'flame-outline',
    color: C.orange,
  },
  {
    id: 'goal_fatloss_100',
    name: 'Inferno',
    description: 'Complete 100 conditioning sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'trophy-outline',
    color: C.orange,
  },
  {
    id: 'goal_fatloss_streak',
    name: 'Cardio Week',
    description: 'Complete 3 conditioning sessions in a single week',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'medal-outline',
    color: C.orange,
  },
  // Fitness
  {
    id: 'goal_fitness_1',
    name: 'All-Rounder',
    description: 'Complete your first session',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'heart-outline',
    color: C.mint,
  },
  {
    id: 'goal_fitness_10',
    name: 'Well-Rounded',
    description: 'Complete 10 sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'heart-outline',
    color: C.mint,
  },
  {
    id: 'goal_fitness_variety',
    name: 'Fitness Variety',
    description: 'Complete 4 different session types in one week',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'grid-outline',
    color: C.mint,
  },
  {
    id: 'goal_fitness_50',
    name: 'Fitness Fanatic',
    description: 'Complete 50 sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'heart-outline',
    color: C.mint,
  },
  {
    id: 'goal_fitness_100',
    name: 'Health Hero',
    description: 'Complete 100 sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'trophy-outline',
    color: C.mint,
  },
  {
    id: 'goal_fitness_all',
    name: 'Jack of All',
    description: 'Complete at least 5 sessions of every type',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'star-outline',
    color: C.mint,
  },
  // Rehab
  {
    id: 'goal_rehab_1',
    name: 'Healing Begins',
    description: 'Complete your first prehab session',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'medical-outline',
    color: C.sky,
  },
  {
    id: 'goal_rehab_5',
    name: 'Recovery Routine',
    description: 'Complete 5 prehab sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'medical-outline',
    color: C.sky,
  },
  {
    id: 'goal_rehab_10',
    name: 'Rehab Committed',
    description: 'Complete 10 prehab sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'medical-outline',
    color: C.sky,
  },
  {
    id: 'goal_rehab_25',
    name: 'Joint Guardian',
    description: 'Complete 25 prehab sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'shield-outline',
    color: C.sky,
  },
  {
    id: 'goal_rehab_50',
    name: 'Body Mechanic',
    description: 'Complete 50 prehab sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'construct-outline',
    color: C.sky,
  },
  {
    id: 'goal_rehab_adapt',
    name: 'Adaptive Athlete',
    description: 'Complete 10 sessions with pain adaptation active',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'fitness-outline',
    color: C.sky,
  },
  // Power
  {
    id: 'goal_power_1',
    name: 'Power Awakens',
    description: 'Complete your first session',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'flash-outline',
    color: C.violet,
  },
  {
    id: 'goal_power_5',
    name: 'Explosive Start',
    description: 'Complete 5 sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'flash-outline',
    color: C.violet,
  },
  {
    id: 'goal_power_10',
    name: 'Power Output',
    description: 'Complete 10 sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'flash-outline',
    color: C.violet,
  },
  {
    id: 'goal_power_25',
    name: 'Athletic Dynamo',
    description: 'Complete 25 sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'flash-outline',
    color: C.violet,
  },
  {
    id: 'goal_power_50',
    name: 'Power Specialist',
    description: 'Complete 50 sessions',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'flash-outline',
    color: C.violet,
  },
  {
    id: 'goal_power_max',
    name: 'Peak Power',
    description: 'Log a 1RM on all three major lifts',
    category: 'goals',
    criteriaType: 'goal_progress',
    icon: 'trophy-outline',
    color: C.violet,
  },
];

// ─── Onboarding Welcome Badge ─────────────────────────────────────────────────
// The ONLY badge that is not earned through training. It marks the start of the
// journey and is awarded once when onboarding completes. Every other badge is a
// training reward (see lib/badge-engine.ts), so a brand-new user finishes
// onboarding with EXACTLY ONE earned badge. Do NOT add profile-setup badges.
const onboardingBadge: Badge = {
  id: 'onboarding_complete',
  name: 'First Steps',
  description: 'You built your GROW profile and started your journey.',
  category: 'milestone',
  criteriaType: 'profile_action',
  icon: 'rocket-outline',
  color: ACHIEVEMENT_GOLD,
};

// ─── 17. Equipment Badges ─────────────────────────────────────────────────────
const equipmentBadges: Badge[] = [
  {
    id: 'equip_bodyweight',
    name: 'Bodyweight Boss',
    description: 'Complete a session using bodyweight only',
    category: 'equipment',
    criteriaType: 'equipment_usage',
    icon: 'body-outline',
    color: C.grey,
  },
  {
    id: 'equip_bands',
    name: 'Band Aid',
    description: 'Complete a session with resistance bands',
    category: 'equipment',
    criteriaType: 'equipment_usage',
    icon: 'git-compare-outline',
    color: C.grey,
  },
  {
    id: 'equip_dumbbells',
    name: 'Dumbbell Days',
    description: 'Complete a session with dumbbells',
    category: 'equipment',
    criteriaType: 'equipment_usage',
    icon: 'barbell-outline',
    color: C.grey,
  },
  {
    id: 'equip_kettlebells',
    name: 'Bell Ringer',
    description: 'Complete a session with kettlebells',
    category: 'equipment',
    criteriaType: 'equipment_usage',
    icon: 'fitness-outline',
    color: C.grey,
  },
  {
    id: 'equip_fullgym',
    name: 'Gym Rat',
    description: 'Complete a session with full gym access',
    category: 'equipment',
    criteriaType: 'equipment_usage',
    icon: 'business-outline',
    color: C.grey,
  },
  {
    id: 'equip_all',
    name: 'Equipment Explorer',
    description: 'Use 4 or more different equipment tiers in sessions',
    category: 'equipment',
    criteriaType: 'equipment_usage',
    icon: 'grid-outline',
    color: C.amber,
  },
  {
    id: 'equip_upgraded',
    name: 'Levelled Up',
    description: 'Complete a session with equipment beyond bodyweight',
    category: 'equipment',
    criteriaType: 'equipment_usage',
    icon: 'arrow-up-outline',
    color: C.amber,
  },
];

// ─── 18. Test Week Badges ─────────────────────────────────────────────────────
const testWeekBadges: Badge[] = [
  {
    id: 'test_1',
    name: 'First Test',
    description: 'Complete your first 1RM test week',
    category: 'test_week',
    criteriaType: 'test_week',
    icon: 'analytics-outline',
    color: C.violet,
  },
  {
    id: 'test_3',
    name: 'Tested',
    description: 'Complete 3 test weeks',
    category: 'test_week',
    criteriaType: 'test_week',
    icon: 'analytics-outline',
    color: C.violet,
  },
  {
    id: 'test_5',
    name: 'Five Tests Strong',
    description: 'Complete 5 test weeks',
    category: 'test_week',
    criteriaType: 'test_week',
    icon: 'analytics-outline',
    color: C.violet,
  },
  {
    id: 'test_10',
    name: 'Benchmark Master',
    description: 'Complete 10 test weeks',
    category: 'test_week',
    criteriaType: 'test_week',
    icon: 'ribbon-outline',
    color: C.violet,
  },
  {
    id: 'test_20',
    name: 'Testing Legend',
    description: 'Complete 20 test weeks',
    category: 'test_week',
    criteriaType: 'test_week',
    icon: 'trophy-outline',
    color: C.violet,
  },
];

// ─── 19. Time of Day Badges ───────────────────────────────────────────────────
const timeOfDayBadges: Badge[] = [
  {
    id: 'time_5am',
    name: '5am Club',
    description: 'Complete a session before 6am',
    category: 'time_of_day',
    criteriaType: 'time_based',
    icon: 'moon-outline',
    color: C.yellow,
  },
  {
    id: 'time_early_5',
    name: 'Early Riser',
    description: 'Complete 5 sessions before 7am',
    category: 'time_of_day',
    criteriaType: 'time_based',
    icon: 'sunny-outline',
    color: C.yellow,
  },
  {
    id: 'time_early_20',
    name: 'Morning Warrior',
    description: 'Complete 20 sessions before 7am',
    category: 'time_of_day',
    criteriaType: 'time_based',
    icon: 'sunny-outline',
    color: C.amber,
  },
  {
    id: 'time_noon_10',
    name: 'Lunch Lifter',
    description: 'Complete 10 sessions between 12-2pm',
    category: 'time_of_day',
    criteriaType: 'time_based',
    icon: 'restaurant-outline',
    color: C.yellow,
  },
  {
    id: 'time_evening_5',
    name: 'After Work Hero',
    description: 'Complete 5 sessions between 5-7pm',
    category: 'time_of_day',
    criteriaType: 'time_based',
    icon: 'briefcase-outline',
    color: C.amber,
  },
  {
    id: 'time_night_1',
    name: 'Night Owl',
    description: 'Complete a session after 9pm',
    category: 'time_of_day',
    criteriaType: 'time_based',
    icon: 'moon-outline',
    color: C.violet,
  },
  {
    id: 'time_night_10',
    name: 'Night Grinder',
    description: 'Complete 10 sessions after 9pm',
    category: 'time_of_day',
    criteriaType: 'time_based',
    icon: 'moon-outline',
    color: C.violet,
  },
  {
    id: 'time_midnight',
    name: 'Midnight Mover',
    description: 'Complete a session after midnight',
    category: 'time_of_day',
    criteriaType: 'time_based',
    icon: 'star-outline',
    color: C.violet,
  },
  {
    id: 'time_weekend_10',
    name: 'Weekend Warrior',
    description: 'Complete 10 sessions on a Saturday or Sunday',
    category: 'time_of_day',
    criteriaType: 'time_based',
    icon: 'sunny-outline',
    color: C.sky,
  },
  {
    id: 'time_weekend_30',
    name: 'Weekend Champion',
    description: 'Complete 30 sessions on a Saturday or Sunday',
    category: 'time_of_day',
    criteriaType: 'time_based',
    icon: 'trophy-outline',
    color: C.sky,
  },
];

// ─── 20. Variety Badges ───────────────────────────────────────────────────────
const varietyBadges: Badge[] = [
  {
    id: 'variety_3_types',
    name: 'Well Rounded',
    description: 'Complete sessions of 3 different types',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'grid-outline',
    color: C.crimson,
  },
  {
    id: 'variety_5_types',
    name: 'Versatile',
    description: 'Complete sessions of 5 different types',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'grid-outline',
    color: C.crimson,
  },
  {
    id: 'variety_all_types',
    name: 'Complete Athlete',
    description: 'Complete at least one session of every type',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'star-outline',
    color: C.crimson,
  },
  {
    id: 'variety_3_in_week',
    name: 'Big Week',
    description: 'Complete 3 different session types in one week',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'calendar-outline',
    color: C.orange,
  },
  {
    id: 'variety_5_in_week',
    name: 'Full Spectrum',
    description: 'Complete 5 different session types in one week',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'calendar-outline',
    color: C.orange,
  },
  {
    id: 'variety_strength_cond',
    name: 'Hybrid Athlete',
    description: 'Complete 10 strength and 10 conditioning sessions',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'flash-outline',
    color: C.red,
  },
  {
    id: 'variety_recovery_balance',
    name: 'Balanced',
    description: 'Log 5 prehab + 5 flexibility sessions',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'scale-outline',
    color: C.teal,
  },
  {
    id: 'variety_all_in_month',
    name: 'Month of All',
    description: 'Complete 4+ different session types in a month',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'ribbon-outline',
    color: C.emerald,
  },
  {
    id: 'variety_50_per_type',
    name: 'Specialist Range',
    description: 'Complete 50 sessions across 5 different types',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'bar-chart-outline',
    color: C.green,
  },
  {
    id: 'variety_strength_trio',
    name: 'Triathlon of Iron',
    description: 'Complete at least 10 lower, upper AND full body sessions',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'trophy-outline',
    color: C.purple,
  },
];

// ─── 21. Recovery Badges ─────────────────────────────────────────────────────
const recoveryBadges: Badge[] = [
  {
    id: 'recovery_5',
    name: 'Recovery Starter',
    description: 'Complete 5 prehab or flexibility sessions combined',
    category: 'recovery',
    criteriaType: 'recovery',
    icon: 'leaf-outline',
    color: C.mint,
  },
  {
    id: 'recovery_15',
    name: 'Body Maintenance',
    description: 'Complete 15 recovery sessions',
    category: 'recovery',
    criteriaType: 'recovery',
    icon: 'leaf-outline',
    color: C.mint,
  },
  {
    id: 'recovery_30',
    name: 'Mobility Mover',
    description: 'Complete 30 recovery sessions',
    category: 'recovery',
    criteriaType: 'recovery',
    icon: 'leaf-outline',
    color: C.mint,
  },
  {
    id: 'recovery_50',
    name: 'Mobility Master',
    description: 'Complete 50 recovery sessions',
    category: 'recovery',
    criteriaType: 'recovery',
    icon: 'shield-checkmark-outline',
    color: C.teal,
  },
  {
    id: 'recovery_100',
    name: 'Body Architect',
    description: 'Complete 100 recovery sessions',
    category: 'recovery',
    criteriaType: 'recovery',
    icon: 'trophy-outline',
    color: C.teal,
  },
  {
    id: 'recovery_week',
    name: 'Recovery Week',
    description: 'Complete 3+ recovery sessions in a single week',
    category: 'recovery',
    criteriaType: 'recovery',
    icon: 'calendar-outline',
    color: C.mint,
  },
];

// ─── 22. Duration Badges ─────────────────────────────────────────────────────
const durationBadges: Badge[] = [
  {
    id: 'duration_60min_1',
    name: 'Full Hour',
    description: 'Complete your first 60-minute session',
    category: 'duration',
    criteriaType: 'duration_based',
    icon: 'time-outline',
    color: C.lime,
  },
  {
    id: 'duration_60min_5',
    name: 'Hour Power',
    description: 'Complete 5 sessions of 60 minutes',
    category: 'duration',
    criteriaType: 'duration_based',
    icon: 'time-outline',
    color: C.lime,
  },
  {
    id: 'duration_60min_20',
    name: 'Hour Machine',
    description: 'Complete 20 sessions of 60 minutes',
    category: 'duration',
    criteriaType: 'duration_based',
    icon: 'time-outline',
    color: C.emerald,
  },
  {
    id: 'duration_60min_50',
    name: 'Full-Hour Elite',
    description: 'Complete 50 sessions of 60 minutes',
    category: 'duration',
    criteriaType: 'duration_based',
    icon: 'ribbon-outline',
    color: C.emerald,
  },
  {
    id: 'duration_45min_10',
    name: '45 Minute Club',
    description: 'Complete 10 sessions of 45 minutes or more',
    category: 'duration',
    criteriaType: 'duration_based',
    icon: 'time-outline',
    color: C.lime,
  },
  {
    id: 'duration_30_30',
    name: 'Quick & Dirty',
    description: 'Complete 30 sessions of exactly 30 minutes',
    category: 'duration',
    criteriaType: 'duration_based',
    icon: 'flash-outline',
    color: C.amber,
  },
  {
    id: 'duration_total_50h',
    name: 'Fifty Hours',
    description: 'Accumulate 50 total hours of training',
    category: 'duration',
    criteriaType: 'duration_based',
    icon: 'hourglass-outline',
    color: C.green,
  },
  {
    id: 'duration_total_100h',
    name: 'Century of Hours',
    description: 'Accumulate 100 total hours of training',
    category: 'duration',
    criteriaType: 'duration_based',
    icon: 'trophy-outline',
    color: C.green,
  },
];

// ─── 23. Comeback Badges ─────────────────────────────────────────────────────
const comebackBadges: Badge[] = [
  {
    id: 'comeback_7d',
    name: 'Back in Action',
    description: 'Train again after a 7+ day rest',
    category: 'comeback',
    criteriaType: 'comeback',
    icon: 'refresh-outline',
    color: C.pink,
  },
  {
    id: 'comeback_14d',
    name: 'Resurrection',
    description: 'Train again after a 14+ day break',
    category: 'comeback',
    criteriaType: 'comeback',
    icon: 'refresh-outline',
    color: C.pink,
  },
  {
    id: 'comeback_30d',
    name: 'Phoenix Rising',
    description: 'Train again after a 30+ day break',
    category: 'comeback',
    criteriaType: 'comeback',
    icon: 'flame-outline',
    color: C.crimson,
  },
  {
    id: 'comeback_3x',
    name: 'Serial Returner',
    description: 'Return after a 7+ day break 3 separate times',
    category: 'comeback',
    criteriaType: 'comeback',
    icon: 'repeat-outline',
    color: C.pink,
  },
  {
    id: 'comeback_5x',
    name: 'Resilient',
    description: 'Return after a 7+ day break 5 separate times',
    category: 'comeback',
    criteriaType: 'comeback',
    icon: 'medal-outline',
    color: C.crimson,
  },
];

// ─── 24. Pain Warrior Badges ─────────────────────────────────────────────────
const painWarriorBadges: Badge[] = [
  {
    id: 'pain_warrior_1',
    name: 'Adapts & Overcomes',
    description: 'Complete a session with a pain adaptation active',
    category: 'pain_warrior',
    criteriaType: 'pain_adaptation',
    icon: 'shield-outline',
    color: C.teal,
  },
  {
    id: 'pain_warrior_3',
    name: 'Resilient Athlete',
    description: 'Complete 3 sessions with pain adaptation active',
    category: 'pain_warrior',
    criteriaType: 'pain_adaptation',
    icon: 'shield-outline',
    color: C.teal,
  },
  {
    id: 'pain_warrior_5',
    name: 'Pain Warrior',
    description: 'Complete 5 sessions with pain adaptation active',
    category: 'pain_warrior',
    criteriaType: 'pain_adaptation',
    icon: 'shield-checkmark-outline',
    color: C.teal,
  },
  {
    id: 'pain_warrior_10',
    name: 'Adaptive Master',
    description: 'Complete 10 sessions with pain adaptation active',
    category: 'pain_warrior',
    criteriaType: 'pain_adaptation',
    icon: 'shield-checkmark-outline',
    color: C.blue,
  },
  {
    id: 'pain_warrior_20',
    name: 'Unbreakable',
    description: 'Complete 20 sessions with pain adaptation active',
    category: 'pain_warrior',
    criteriaType: 'pain_adaptation',
    icon: 'trophy-outline',
    color: C.blue,
  },
];

// ─── 27. Endurance (Low-Energy) Badges ────────────────────────────────────────
const enduranceBadges: Badge[] = [
  {
    id: 'endurance_1',
    name: 'No Excuses',
    description: 'Complete a session when your energy was low',
    category: 'endurance',
    criteriaType: 'low_energy',
    icon: 'battery-dead-outline',
    color: C.amber,
  },
  {
    id: 'endurance_3',
    name: 'Mind Over Matter',
    description: 'Complete 3 sessions when your energy was low',
    category: 'endurance',
    criteriaType: 'low_energy',
    icon: 'battery-dead-outline',
    color: C.amber,
  },
  {
    id: 'endurance_5',
    name: 'Grit',
    description: 'Complete 5 sessions when your energy was low',
    category: 'endurance',
    criteriaType: 'low_energy',
    icon: 'cellular-outline',
    color: C.orange,
  },
  {
    id: 'endurance_10',
    name: 'Iron Resolve',
    description: 'Complete 10 sessions when your energy was low',
    category: 'endurance',
    criteriaType: 'low_energy',
    icon: 'cellular-outline',
    color: C.red,
  },
];

// ─── Exercise-Milestone Badges ────────────────────────────────────────────────
// Celebrate first-time (or repeated) logging of specific signature exercises.
// Evaluated by name-matching in exerciseLogs across completedSessions.
const exerciseMilestoneBadges: Badge[] = [
  // Movement-variety badges (kept here, variety/recovery criteria)
  {
    id: 'exercise_all_three_lifts',
    name: 'Triple Threat',
    description: 'Complete at least one Squat Session, Bench Session, and Deadlift Session',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'barbell-outline',
    color: C.purple,
  },
  {
    id: 'exercise_push_pull_hinge',
    name: 'Pattern Master',
    description: 'Train all three strength types in one week',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'shuffle-outline',
    color: C.emerald,
  },
  {
    id: 'exercise_custom_10',
    name: 'Exercise Architect',
    description: 'Complete 10 custom sessions',
    category: 'session_custom',
    criteriaType: 'session_type_count',
    icon: 'construct-outline',
    color: C.grey,
  },
  {
    id: 'exercise_custom_25',
    name: 'Programme Designer',
    description: 'Complete 25 custom sessions',
    category: 'session_custom',
    criteriaType: 'session_type_count',
    icon: 'construct-outline',
    color: C.teal,
  },
  {
    id: 'exercise_recovery_week',
    name: 'Recovery First',
    description: 'Complete a prehab and a flexibility session in the same week',
    category: 'recovery',
    criteriaType: 'recovery',
    icon: 'medical-outline',
    color: C.teal,
  },
  {
    id: 'exercise_recovery_10',
    name: 'Body Mechanic',
    description: 'Complete 10 total recovery sessions (prehab + flex)',
    category: 'recovery',
    criteriaType: 'recovery',
    icon: 'fitness-outline',
    color: C.mint,
  },
  {
    id: 'exercise_recovery_25',
    name: 'Longevity Mindset',
    description: 'Complete 25 total recovery sessions (prehab + flex)',
    category: 'recovery',
    criteriaType: 'recovery',
    icon: 'leaf-outline',
    color: C.emerald,
  },
  {
    id: 'exercise_full_spectrum',
    name: 'Full Spectrum',
    description: 'Complete at least one session of every available type',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'star-outline',
    color: C.crimson,
  },
  {
    id: 'exercise_strength_variety',
    name: 'Strength Sampler',
    description: 'Complete 5 sessions each of lower, upper and full body',
    category: 'variety',
    criteriaType: 'variety',
    icon: 'layers-outline',
    color: C.blue,
  },
  // ── Specific-exercise milestone badges ──
  {
    id: 'ex_pull_up_first',
    name: 'Gravity Fighter',
    description: 'Log your first Pull-Up or Chin-Up in a session',
    category: 'exercise_milestone',
    criteriaType: 'exercise_specific',
    icon: 'git-pull-request-outline',
    color: C.blue,
  },
  {
    id: 'ex_hip_thrust_first',
    name: 'Throne',
    description: 'Log your first Hip Thrust in a session',
    category: 'exercise_milestone',
    criteriaType: 'exercise_specific',
    icon: 'trending-up-outline',
    color: C.emerald,
  },
  {
    id: 'ex_nordic_first',
    name: 'Nordic Warrior',
    description: 'Log your first Nordic Hamstring Curl',
    category: 'exercise_milestone',
    criteriaType: 'exercise_specific',
    icon: 'snow-outline',
    color: C.sky,
  },
  {
    id: 'ex_farmers_carry_first',
    name: 'Iron Grip',
    description: "Log your first Farmer's Carry or Suitcase Carry",
    category: 'exercise_milestone',
    criteriaType: 'exercise_specific',
    icon: 'briefcase-outline',
    color: C.orange,
  },
  {
    id: 'ex_bird_dog_first',
    name: 'Bird Dog',
    description: 'Log your first Bird Dog exercise',
    category: 'exercise_milestone',
    criteriaType: 'exercise_specific',
    icon: 'eye-outline',
    color: C.teal,
  },
  {
    id: 'ex_dead_hang_first',
    name: 'Dead Weight',
    description: 'Log your first Dead Hang',
    category: 'exercise_milestone',
    criteriaType: 'exercise_specific',
    icon: 'hand-right-outline',
    color: C.grey,
  },
  {
    id: 'ex_ghd_first',
    name: 'GHD Initiate',
    description: 'Log your first Glute Ham Raise',
    category: 'exercise_milestone',
    criteriaType: 'exercise_specific',
    icon: 'body-outline',
    color: C.crimson,
  },
  {
    id: 'ex_seal_row_first',
    name: 'Seal of Approval',
    description: 'Log your first Seal Row',
    category: 'exercise_milestone',
    criteriaType: 'exercise_specific',
    icon: 'ribbon-outline',
    color: C.purple,
  },
  {
    id: 'ex_front_squat_first',
    name: 'Clean Sweep',
    description: 'Log your first Front Squat',
    category: 'exercise_milestone',
    criteriaType: 'exercise_specific',
    icon: 'trophy-outline',
    color: C.amber,
  },
  {
    id: 'ex_landmine_first',
    name: 'Landmine',
    description: 'Log your first Landmine Press',
    category: 'exercise_milestone',
    criteriaType: 'exercise_specific',
    icon: 'flash-outline',
    color: C.red,
  },
  {
    id: 'ex_ab_wheel_first',
    name: 'Roller Derby',
    description: 'Log your first Ab Wheel Rollout',
    category: 'exercise_milestone',
    criteriaType: 'exercise_specific',
    icon: 'radio-button-off-outline',
    color: C.mint,
  },
  {
    id: 'ex_ghd_10_sessions',
    name: 'Hamstring Hero',
    description: 'Log a Nordic or GHR exercise in 10 different sessions',
    category: 'exercise_milestone',
    criteriaType: 'exercise_specific',
    icon: 'medal-outline',
    color: C.amber,
  },
];

// ─── Final catalog assembly ───────────────────────────────────────────────────

export const BADGE_CATALOG: Badge[] = [
  onboardingBadge,
  ...milestoneBadges,
  ...streakBadges,
  ...strengthProgressBadges,
  ...sessionTypeBadges,
  ...consistencyBadges,
  ...goalsBadges,
  ...equipmentBadges,
  ...testWeekBadges,
  ...timeOfDayBadges,
  ...varietyBadges,
  ...exerciseMilestoneBadges,
  ...recoveryBadges,
  ...durationBadges,
  ...comebackBadges,
  ...painWarriorBadges,
  ...enduranceBadges,
];

/** Quick O(1) lookup by ID. Computed once at module load. */
export const BADGE_MAP: ReadonlyMap<string, Badge> = new Map(BADGE_CATALOG.map((b) => [b.id, b]));

export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  milestone: 'Milestones',
  streak: 'Streaks',
  strength_progress: 'Lift Progress',
  session_lower: 'Lower Body Sessions',
  session_upper: 'Upper Body Sessions',
  session_full: 'Full Body Sessions',
  session_conditioning: 'Conditioning',
  session_prehab: 'Prehab',
  session_flex: 'Flexibility',
  session_custom: 'Custom Sessions',
  consistency: 'Consistency',
  goals: 'Goals',
  equipment: 'Equipment',
  test_week: 'Test Weeks',
  time_of_day: 'Time of Day',
  variety: 'Variety',
  recovery: 'Recovery',
  duration: 'Session Duration',
  comeback: 'Comebacks',
  pain_warrior: 'Pain Warrior',
  endurance: 'No Excuses',
  exercise_milestone: 'Exercise Milestones',
};

/** Ordered list of categories for the Achievements screen. */
export const BADGE_CATEGORY_ORDER: BadgeCategory[] = [
  'milestone',
  'streak',
  'consistency',
  'strength_progress',
  'session_lower',
  'session_upper',
  'session_full',
  'session_conditioning',
  'session_prehab',
  'session_flex',
  'session_custom',
  'recovery',
  'duration',
  'variety',
  'goals',
  'test_week',
  'equipment',
  'time_of_day',
  'comeback',
  'pain_warrior',
  'endurance',
  'exercise_milestone',
];
