/**
 * GROW Badge Catalog — ~400 badges across 25 categories.
 *
 * Each badge has a stable snake_case `id`, an evocative `name`, a plain-English
 * `description` (what you did to earn it), a `category`, an Ionicons `icon`, and
 * a `color` hex.  The badge engine (`lib/badge-engine.ts`) evaluates which badges
 * a given store snapshot has earned.
 */

export type BadgeCategory =
  | 'milestone'           // total session count
  | 'streak'              // consecutive training days
  | 'strength_squat'      // squat 1RM milestones
  | 'strength_bench'      // bench 1RM milestones
  | 'strength_deadlift'   // deadlift 1RM milestones
  | 'volume'              // cumulative volume lifted (kg)
  | 'session_lower'       // lower body session count
  | 'session_upper'       // upper body session count
  | 'session_full'        // full body session count
  | 'session_conditioning'// conditioning session count
  | 'session_prehab'      // prehab session count
  | 'session_flex'        // flexibility session count
  | 'session_custom'      // custom session count
  | 'consistency'         // weekly / monthly training habits
  | 'goals'               // goal-specific achievements
  | 'profile'             // profile completion actions
  | 'equipment'           // equipment tier usage
  | 'test_week'           // 1RM test week completions
  | 'time_of_day'         // when you train
  | 'variety'             // training variety
  | 'recovery'            // combined prehab + flex
  | 'duration'            // session duration milestones
  | 'comeback'            // returning after a break
  | 'volume_session'      // volume in a single session
  | 'load';               // heaviest single set weight

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  icon: string;   // Ionicons glyph map key (without the suffix style)
  color: string;  // hex
}

// ─── Color palette per category ─────────────────────────────────────────────
const C = {
  green:    '#2f6b46',
  emerald:  '#27ae60',
  orange:   '#e67e22',
  amber:    '#f39c12',
  yellow:   '#d4ac0d',
  blue:     '#2980b9',
  sky:      '#3498db',
  purple:   '#8e44ad',
  violet:   '#9b59b6',
  red:      '#c0392b',
  crimson:  '#e74c3c',
  teal:     '#16a085',
  mint:     '#1abc9c',
  grey:     '#7f8c8d',
  pink:     '#e84393',
  lime:     '#2ecc71',
  brown:    '#7d6608',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sessionMilestones(
  prefix: string,
  category: BadgeCategory,
  icon: string,
  color: string,
  nameFn: (n: number) => string,
  descFn: (n: number) => string,
  counts: number[],
): Badge[] {
  return counts.map((n) => ({
    id: `${prefix}_${n}`,
    name: nameFn(n),
    description: descFn(n),
    category,
    icon,
    color,
  }));
}

function strengthMilestones(
  lift: 'squat' | 'bench' | 'deadlift',
  kgs: number[],
  nameFn: (kg: number) => string,
): Badge[] {
  const catMap: Record<string, BadgeCategory> = {
    squat: 'strength_squat',
    bench: 'strength_bench',
    deadlift: 'strength_deadlift',
  };
  const iconMap: Record<string, string> = {
    squat: 'walk-outline',
    bench: 'person-outline',
    deadlift: 'body-outline',
  };
  const colorMap: Record<string, string> = {
    squat: C.purple,
    bench: C.blue,
    deadlift: C.red,
  };
  const liftLabel = { squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift' }[lift];
  return kgs.map((kg) => ({
    id: `${lift}_${kg}kg`,
    name: nameFn(kg),
    description: `${liftLabel} ${kg} kg on a 1RM test`,
    category: catMap[lift] as BadgeCategory,
    icon: iconMap[lift],
    color: colorMap[lift],
  }));
}

// ─── 1. Milestone Badges (total session count) ───────────────────────────────
const MILESTONE_DATA: [number, string, string][] = [
  [1,   'First Step',         'Complete your first session'],
  [2,   'Back for More',      'Complete 2 sessions'],
  [3,   'Finding My Groove',  'Complete 3 sessions'],
  [5,   'High Five',          'Complete 5 sessions'],
  [7,   'One Week Strong',    'Complete 7 sessions'],
  [10,  'Double Digits',      'Complete 10 sessions'],
  [15,  'Halfway to Twenty',  'Complete 15 sessions'],
  [20,  'Twenty Down',        'Complete 20 sessions'],
  [25,  'Quarter Century',    'Complete 25 sessions'],
  [30,  'One Month',          'Complete 30 sessions'],
  [40,  'Building Momentum',  'Complete 40 sessions'],
  [50,  'Fifty Strong',       'Complete 50 sessions'],
  [60,  'Sixty Reps',         'Complete 60 sessions'],
  [75,  'Grinding Hard',      'Complete 75 sessions'],
  [100, 'Century Club',       'Complete 100 sessions'],
  [125, 'Unstoppable',        'Complete 125 sessions'],
  [150, 'Iron Will',          'Complete 150 sessions'],
  [175, 'Beyond Limits',      'Complete 175 sessions'],
  [200, 'Elite 200',          'Complete 200 sessions'],
  [250, 'Quarter Thousand',   'Complete 250 sessions'],
  [300, 'Tricentennial',      'Complete 300 sessions'],
  [400, '400 Sessions Strong','Complete 400 sessions'],
  [500, 'Legend',             'Complete 500 sessions'],
];
const milestoneBadges: Badge[] = MILESTONE_DATA.map(([n, name, description]) => ({
  id: `milestone_${n}`,
  name,
  description,
  category: 'milestone',
  icon: 'trophy-outline',
  color: C.green,
}));

// ─── 2. Streak Badges (consecutive days trained) ─────────────────────────────
const STREAK_DATA: [number, string][] = [
  [2,   'On a Roll'],
  [3,   'Three in a Row'],
  [5,   'Five Day Fire'],
  [7,   'Week Warrior'],
  [10,  'Ten Day Blaze'],
  [14,  'Fortnight Force'],
  [21,  'Three Week Run'],
  [28,  'Four Week Frenzy'],
  [30,  'Month of Momentum'],
  [42,  'Six Week Grind'],
  [60,  'Two Month Streak'],
  [75,  'Elite Streak'],
  [90,  'Quarter Year'],
  [120, 'Four Month Run'],
  [150, 'Five Month Beast'],
  [180, 'Half Year Hero'],
  [270, 'Nine Month Machine'],
  [365, 'Year of Iron'],
];
const streakBadges: Badge[] = STREAK_DATA.map(([n, name]) => ({
  id: `streak_${n}`,
  name,
  description: `Train ${n} days in a row`,
  category: 'streak',
  icon: 'flame-outline',
  color: C.orange,
}));

// ─── 3. Strength – Squat ─────────────────────────────────────────────────────
const SQUAT_NAMES: Record<number, string> = {
  40: 'Planted', 50: 'Warming Up', 60: 'Legwork', 70: 'Rising', 80: 'Foundation',
  90: 'Gaining Ground', 100: 'Triple Figures', 110: 'Breaking Through',
  120: 'Power Stance', 130: 'Heavy Legs', 140: 'Quad Destroyer',
  150: 'Deep Diver', 160: 'Depth Charge', 170: 'Leg Day King',
  180: 'Half-Rack', 190: 'Near 200', 200: 'Double Century',
  210: 'Serious Squatter', 220: 'Elite Legs', 230: '230 Club',
  240: 'Platform Warrior', 250: 'Quarter Ton', 260: 'Iron Legs',
  270: 'Squat Beast', 280: 'Legendary Squat', 300: 'Three Hundred',
  320: 'Superhuman', 340: 'Absolute Unit', 360: 'Squat God',
};
const squatBadges = strengthMilestones(
  'squat',
  [40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,300,320,340,360],
  (kg) => SQUAT_NAMES[kg] ?? `Squat ${kg}kg`,
);

// ─── 4. Strength – Bench ─────────────────────────────────────────────────────
const BENCH_NAMES: Record<number, string> = {
  20: 'First Press', 40: 'Off the Chest', 60: 'Pushing On', 70: 'Building Base',
  80: 'Chest Activated', 90: 'Press Power', 100: 'Centurion Press',
  110: 'Breaking 100', 120: 'Heavy Hitter', 130: 'Club 130',
  140: 'Chest Champion', 150: 'Power Press', 160: 'Bench Monster',
  170: 'Upper Elite', 180: 'Platform Press', 190: 'Near 200',
  200: 'Double Ton', 210: 'Press Elite', 220: 'Master of Chest',
  240: 'Bench God', 260: 'Superhuman Press', 300: 'Triple Ton Press',
};
const benchBadges = strengthMilestones(
  'bench',
  [20,40,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,240,260,300],
  (kg) => BENCH_NAMES[kg] ?? `Bench ${kg}kg`,
);

// ─── 5. Strength – Deadlift ──────────────────────────────────────────────────
const DEADLIFT_NAMES: Record<number, string> = {
  60: 'Off the Floor', 80: 'Pulling Power', 100: 'First Ton',
  120: 'Hinge Master', 140: 'Back Attack', 160: 'Heavy Pull',
  180: 'Posterior Chain', 200: 'Double Century Pull', 220: 'Deadlift Devotee',
  240: 'Hard Puller', 260: 'Iron Back', 280: 'Platform Ready',
  300: 'Three Ton',  320: 'Elite Pull', 340: 'Deadlift Machine',
  360: 'Unstoppable Force', 380: 'Near 400', 400: 'Four Hundred',
  420: 'Legendary Pull', 440: 'Deadlift God', 460: 'Human Freight Train',
  480: 'The Deadlift', 500: 'Half Ton',
};
const deadliftBadges = strengthMilestones(
  'deadlift',
  [60,80,100,120,140,160,180,200,220,240,260,280,300,320,340,360,380,400,420,440,460,480,500],
  (kg) => DEADLIFT_NAMES[kg] ?? `Deadlift ${kg}kg`,
);

// ─── 6. Volume (cumulative kg lifted across all sessions) ────────────────────
const VOLUME_DATA: [number, string, string][] = [
  [1_000,       'Volume Rookie',      'Lift 1,000 kg total across all sessions'],
  [5_000,       'Five Thousand',      'Lift 5,000 kg total'],
  [10_000,      'Ten Thousand',       'Lift 10,000 kg total'],
  [25_000,      'Quarter Million',    'Lift 25,000 kg total'],
  [50_000,      'Fifty Thousand',     'Lift 50,000 kg total'],
  [100_000,     'One Hundred Tons',   'Lift 100,000 kg total'],
  [200_000,     'Two Hundred Tons',   'Lift 200,000 kg total'],
  [500_000,     'Half Million',       'Lift 500,000 kg total'],
  [1_000_000,   'Million Lifter',     'Lift 1,000,000 kg total'],
  [2_000_000,   'Two Million',        'Lift 2,000,000 kg total'],
  [5_000_000,   'Five Million',       'Lift 5,000,000 kg total'],
  [10_000_000,  'Ten Million',        'Lift 10,000,000 kg total'],
];
const volumeBadges: Badge[] = VOLUME_DATA.map(([n, name, description]) => ({
  id: `volume_${n}`,
  name,
  description,
  category: 'volume',
  icon: 'barbell-outline',
  color: C.emerald,
}));

// ─── 7–13. Session Type Count Badges ─────────────────────────────────────────
type SessionTypeConfig = {
  prefix: string;
  category: BadgeCategory;
  icon: string;
  color: string;
  typeName: string;
};
const SESSION_TYPE_CONFIGS: SessionTypeConfig[] = [
  { prefix: 'lower',        category: 'session_lower',        icon: 'walk-outline',             color: C.purple, typeName: 'lower body' },
  { prefix: 'upper',        category: 'session_upper',        icon: 'person-outline',           color: C.blue,   typeName: 'upper body' },
  { prefix: 'full',         category: 'session_full',         icon: 'body-outline',             color: C.red,    typeName: 'full body' },
  { prefix: 'conditioning', category: 'session_conditioning', icon: 'flame-outline',            color: C.orange, typeName: 'conditioning' },
  { prefix: 'prehab',       category: 'session_prehab',       icon: 'shield-checkmark-outline', color: C.teal,   typeName: 'prehab' },
  { prefix: 'flex',         category: 'session_flex',         icon: 'leaf-outline',             color: C.mint,   typeName: 'flexibility' },
  { prefix: 'custom',       category: 'session_custom',       icon: 'create-outline',           color: C.grey,   typeName: 'custom' },
];

const SESSION_COUNT_NAMES: Record<number, (type: string) => string> = {
  1:   (t) => `First ${capitalize(t)}`,
  3:   (t) => `${capitalize(t)} Trio`,
  5:   (t) => `${capitalize(t)} Five`,
  10:  (t) => `${capitalize(t)} Veteran`,
  15:  (t) => `${capitalize(t)} Regular`,
  20:  (t) => `${capitalize(t)} Machine`,
  25:  (t) => `${capitalize(t)} Quarter`,
  30:  (t) => `${capitalize(t)} Devotee`,
  50:  (t) => `${capitalize(t)} Master`,
  75:  (t) => `${capitalize(t)} Expert`,
  100: (t) => `${capitalize(t)} Legend`,
};

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

const SESSION_COUNTS = [1, 3, 5, 10, 15, 20, 25, 30, 50, 75, 100];
const sessionTypeBadges: Badge[] = SESSION_TYPE_CONFIGS.flatMap(({ prefix, category, icon, color, typeName }) =>
  SESSION_COUNTS.map((n) => ({
    id: `${prefix}_session_${n}`,
    name: (SESSION_COUNT_NAMES[n] ?? ((t: string) => `${capitalize(t)} ${n}`))(typeName),
    description: n === 1
      ? `Complete your first ${typeName} session`
      : `Complete ${n} ${typeName} sessions`,
    category,
    icon,
    color,
  }))
);

// ─── 14. Consistency Badges ───────────────────────────────────────────────────
const consistencyBadges: Badge[] = [
  { id: 'consistent_2x_4wk',  name: 'Twice a Week',      description: 'Train at least 2× per week for 4 consecutive weeks',     category: 'consistency', icon: 'calendar-outline',  color: C.amber },
  { id: 'consistent_2x_8wk',  name: 'Twice Weekly Pro',  description: 'Train at least 2× per week for 8 consecutive weeks',     category: 'consistency', icon: 'calendar-outline',  color: C.amber },
  { id: 'consistent_2x_12wk', name: 'Two Days Locked In',description: 'Train at least 2× per week for 12 consecutive weeks',    category: 'consistency', icon: 'calendar-outline',  color: C.amber },
  { id: 'consistent_3x_4wk',  name: 'Three Times Weekly', description: 'Train at least 3× per week for 4 consecutive weeks',    category: 'consistency', icon: 'calendar-outline',  color: C.yellow },
  { id: 'consistent_3x_8wk',  name: 'Three Days Locked',  description: 'Train at least 3× per week for 8 consecutive weeks',    category: 'consistency', icon: 'calendar-outline',  color: C.yellow },
  { id: 'consistent_3x_12wk', name: 'Disciplined',        description: 'Train at least 3× per week for 12 consecutive weeks',   category: 'consistency', icon: 'calendar-outline',  color: C.yellow },
  { id: 'consistent_4x_4wk',  name: 'Four Day Week',      description: 'Train at least 4× per week for 4 consecutive weeks',    category: 'consistency', icon: 'calendar-outline',  color: C.orange },
  { id: 'consistent_4x_8wk',  name: 'Four Day Force',     description: 'Train at least 4× per week for 8 consecutive weeks',    category: 'consistency', icon: 'calendar-outline',  color: C.orange },
  { id: 'consistent_5x_1wk',  name: 'Five in a Week',     description: 'Train 5 or more times in a single calendar week',       category: 'consistency', icon: 'stats-chart-outline',color: C.red },
  { id: 'consistent_7x_1wk',  name: 'Perfect Week',       description: 'Train every single day of a calendar week',             category: 'consistency', icon: 'star-outline',       color: C.red },
  { id: 'consistent_20_month',name: '20 in a Month',       description: 'Complete 20+ sessions in a single calendar month',     category: 'consistency', icon: 'time-outline',       color: C.crimson },
  { id: 'consistent_30_month',name: '30 in 30',            description: 'Complete 30 sessions across any 30-day window',        category: 'consistency', icon: 'infinite-outline',   color: C.crimson },
  { id: 'consistent_100_year',name: 'Century Year',        description: 'Complete 100 sessions in any 12-month window',         category: 'consistency', icon: 'ribbon-outline',     color: C.green },
  { id: 'consistent_morning_10',name: 'Morning 10',        description: 'Complete 10 sessions before 9am',                      category: 'consistency', icon: 'sunny-outline',      color: C.yellow },
  { id: 'consistent_morning_30',name: 'Morning Devotee',   description: 'Complete 30 sessions before 9am',                      category: 'consistency', icon: 'sunny-outline',      color: C.amber },
];

// ─── 15. Goal-Specific Badges ─────────────────────────────────────────────────
const goalsBadges: Badge[] = [
  // Strength goal
  { id: 'goal_strength_1rm',   name: 'Strength Seeker',   description: 'Log your first strength 1RM test', category: 'goals', icon: 'barbell-outline',         color: C.purple },
  { id: 'goal_strength_10',    name: 'Strong Foundation', description: 'Complete 10 lower/upper/full body sessions with strength goal active', category: 'goals', icon: 'barbell-outline', color: C.purple },
  { id: 'goal_strength_25',    name: 'Strength Builder',  description: 'Complete 25 strength sessions',     category: 'goals', icon: 'barbell-outline',         color: C.purple },
  { id: 'goal_strength_50',    name: 'Strength Focused',  description: 'Complete 50 strength sessions',     category: 'goals', icon: 'barbell-outline',         color: C.purple },
  { id: 'goal_strength_100',   name: 'Strength Legend',   description: 'Complete 100 strength sessions',    category: 'goals', icon: 'trophy-outline',          color: C.purple },
  { id: 'goal_strength_pb',    name: 'Personal Record',   description: 'Set a new 1RM personal best',       category: 'goals', icon: 'medal-outline',           color: C.purple },
  // Muscle goal
  { id: 'goal_muscle_1',       name: 'Muscle Awakens',    description: 'Complete your first session with muscle goal active', category: 'goals', icon: 'body-outline', color: C.teal },
  { id: 'goal_muscle_10',      name: 'Pump Chaser',       description: 'Complete 10 sessions targeting muscle', category: 'goals', icon: 'body-outline',         color: C.teal },
  { id: 'goal_muscle_25',      name: 'Hypertrophy Habit', description: 'Complete 25 sessions targeting muscle', category: 'goals', icon: 'body-outline',         color: C.teal },
  { id: 'goal_muscle_50',      name: 'Mass Builder',      description: 'Complete 50 sessions targeting muscle', category: 'goals', icon: 'body-outline',         color: C.teal },
  { id: 'goal_muscle_100',     name: 'Muscle Machine',    description: 'Complete 100 sessions targeting muscle',category: 'goals', icon: 'trophy-outline',       color: C.teal },
  { id: 'goal_muscle_volume',  name: 'Volume King',       description: 'Lift 50,000 kg total targeting muscle', category: 'goals', icon: 'barbell-outline',      color: C.teal },
  // Fat loss goal
  { id: 'goal_fatloss_1',      name: 'Fat Burner',        description: 'Complete your first conditioning session', category: 'goals', icon: 'flame-outline',    color: C.orange },
  { id: 'goal_fatloss_10',     name: 'Sweat Factory',     description: 'Complete 10 conditioning sessions',    category: 'goals', icon: 'flame-outline',         color: C.orange },
  { id: 'goal_fatloss_25',     name: 'Calorie Crusher',   description: 'Complete 25 conditioning sessions',    category: 'goals', icon: 'flame-outline',         color: C.orange },
  { id: 'goal_fatloss_50',     name: 'Burn Artist',       description: 'Complete 50 conditioning sessions',    category: 'goals', icon: 'flame-outline',         color: C.orange },
  { id: 'goal_fatloss_100',    name: 'Inferno',           description: 'Complete 100 conditioning sessions',   category: 'goals', icon: 'trophy-outline',        color: C.orange },
  { id: 'goal_fatloss_streak', name: 'Cardio Streak',     description: 'Train 5 days in a row with fat loss goal', category: 'goals', icon: 'medal-outline',    color: C.orange },
  // Fitness goal
  { id: 'goal_fitness_1',      name: 'All-Rounder',       description: 'Complete your first session with fitness goal', category: 'goals', icon: 'heart-outline', color: C.mint },
  { id: 'goal_fitness_10',     name: 'Well-Rounded',      description: 'Complete 10 sessions with fitness goal',  category: 'goals', icon: 'heart-outline',      color: C.mint },
  { id: 'goal_fitness_variety',name: 'Fitness Variety',   description: 'Complete 4 different session types in one week', category: 'goals', icon: 'grid-outline', color: C.mint },
  { id: 'goal_fitness_50',     name: 'Fitness Fanatic',   description: 'Complete 50 sessions with fitness goal',  category: 'goals', icon: 'heart-outline',      color: C.mint },
  { id: 'goal_fitness_100',    name: 'Health Hero',       description: 'Complete 100 sessions with fitness goal', category: 'goals', icon: 'trophy-outline',     color: C.mint },
  { id: 'goal_fitness_all',    name: 'Jack of All',       description: 'Complete at least 5 sessions of every type', category: 'goals', icon: 'star-outline',    color: C.mint },
  // Rehab goal
  { id: 'goal_rehab_1',        name: 'Healing Begins',    description: 'Complete your first prehab session',   category: 'goals', icon: 'medical-outline',      color: C.sky },
  { id: 'goal_rehab_5',        name: 'Recovery Routine',  description: 'Complete 5 prehab sessions',           category: 'goals', icon: 'medical-outline',      color: C.sky },
  { id: 'goal_rehab_10',       name: 'Rehab Committed',   description: 'Complete 10 prehab sessions',          category: 'goals', icon: 'medical-outline',      color: C.sky },
  { id: 'goal_rehab_25',       name: 'Joint Guardian',    description: 'Complete 25 prehab sessions',          category: 'goals', icon: 'shield-outline',       color: C.sky },
  { id: 'goal_rehab_50',       name: 'Body Mechanic',     description: 'Complete 50 prehab sessions',          category: 'goals', icon: 'construct-outline',    color: C.sky },
  { id: 'goal_rehab_adapt',    name: 'Adaptive Athlete',  description: 'Complete 10 sessions with pain adaptation active', category: 'goals', icon: 'fitness-outline', color: C.sky },
  // Power goal
  { id: 'goal_power_1',        name: 'Power Awakens',     description: 'Complete your first session with power goal', category: 'goals', icon: 'flash-outline',   color: C.violet },
  { id: 'goal_power_5',        name: 'Explosive Start',   description: 'Complete 5 sessions with power goal',  category: 'goals', icon: 'flash-outline',         color: C.violet },
  { id: 'goal_power_10',       name: 'Power Output',      description: 'Complete 10 sessions with power goal', category: 'goals', icon: 'flash-outline',         color: C.violet },
  { id: 'goal_power_25',       name: 'Athletic Dynamo',   description: 'Complete 25 sessions with power goal', category: 'goals', icon: 'flash-outline',         color: C.violet },
  { id: 'goal_power_50',       name: 'Power Specialist',  description: 'Complete 50 sessions with power goal', category: 'goals', icon: 'flash-outline',         color: C.violet },
  { id: 'goal_power_max',      name: 'Peak Power',        description: 'Set a new 1RM on all three major lifts',category: 'goals', icon: 'trophy-outline',       color: C.violet },
];

// ─── 16. Profile Badges ───────────────────────────────────────────────────────
const profileBadges: Badge[] = [
  { id: 'profile_photo',       name: 'Face of Grow',     description: 'Add a profile photo',                  category: 'profile', icon: 'camera-outline',     color: C.sky },
  { id: 'profile_goals_set',   name: 'Goal Setter',      description: 'Set at least one fitness goal',        category: 'profile', icon: 'flag-outline',       color: C.sky },
  { id: 'profile_goals_multi', name: 'Multi-Goal',       description: 'Have 3 or more fitness goals active',  category: 'profile', icon: 'list-outline',       color: C.sky },
  { id: 'profile_1rm_squat',   name: 'Know Your Squat',  description: 'Log a squat 1RM',                      category: 'profile', icon: 'analytics-outline',  color: C.sky },
  { id: 'profile_1rm_bench',   name: 'Know Your Bench',  description: 'Log a bench 1RM',                      category: 'profile', icon: 'analytics-outline',  color: C.sky },
  { id: 'profile_1rm_all',     name: 'Fully Calibrated', description: 'Log 1RM for squat, bench and deadlift',category: 'profile', icon: 'checkmark-circle-outline', color: C.sky },
  { id: 'profile_bodyweight_updated', name: 'Weight Checked',  description: 'Update your logged bodyweight', category: 'profile', icon: 'scale-outline',      color: C.sky },
  { id: 'profile_onboarding',  name: 'Profile Built',    description: 'Complete the onboarding profile setup',category: 'profile', icon: 'person-circle-outline', color: C.sky },
];

// ─── 17. Equipment Badges ─────────────────────────────────────────────────────
const equipmentBadges: Badge[] = [
  { id: 'equip_bodyweight',  name: 'Bodyweight Boss',    description: 'Complete a session using bodyweight only',   category: 'equipment', icon: 'body-outline',    color: C.grey },
  { id: 'equip_bands',       name: 'Band Aid',           description: 'Complete a session with resistance bands',   category: 'equipment', icon: 'git-compare-outline', color: C.grey },
  { id: 'equip_dumbbells',   name: 'Dumbbell Days',      description: 'Complete a session with dumbbells',          category: 'equipment', icon: 'barbell-outline', color: C.grey },
  { id: 'equip_kettlebells', name: 'Bell Ringer',        description: 'Complete a session with kettlebells',        category: 'equipment', icon: 'fitness-outline', color: C.grey },
  { id: 'equip_barbell',     name: 'Bar Life',           description: 'Complete a session with a barbell',          category: 'equipment', icon: 'barbell-outline', color: C.grey },
  { id: 'equip_fullgym',     name: 'Gym Rat',            description: 'Complete a session with full gym access',    category: 'equipment', icon: 'business-outline',color: C.grey },
  { id: 'equip_all',         name: 'Equipment Explorer', description: 'Use 4 or more different equipment tiers',    category: 'equipment', icon: 'grid-outline',    color: C.amber },
  { id: 'equip_upgraded',    name: 'Levelled Up',        description: 'Upgrade your equipment access level',        category: 'equipment', icon: 'arrow-up-outline',color: C.amber },
];

// ─── 18. Test Week Badges ─────────────────────────────────────────────────────
const testWeekBadges: Badge[] = [
  { id: 'test_1',  name: 'First Test',        description: 'Complete your first 1RM test week',          category: 'test_week', icon: 'analytics-outline', color: C.violet },
  { id: 'test_3',  name: 'Tested',            description: 'Complete 3 test weeks',                      category: 'test_week', icon: 'analytics-outline', color: C.violet },
  { id: 'test_5',  name: 'Five Tests Strong', description: 'Complete 5 test weeks',                      category: 'test_week', icon: 'analytics-outline', color: C.violet },
  { id: 'test_10', name: 'Benchmark Master',  description: 'Complete 10 test weeks',                     category: 'test_week', icon: 'ribbon-outline',    color: C.violet },
  { id: 'test_20', name: 'Testing Legend',    description: 'Complete 20 test weeks',                     category: 'test_week', icon: 'trophy-outline',    color: C.violet },
];

// ─── 19. Time of Day Badges ───────────────────────────────────────────────────
const timeOfDayBadges: Badge[] = [
  { id: 'time_5am',       name: '5am Club',          description: 'Complete a session before 6am',             category: 'time_of_day', icon: 'moon-outline',   color: C.yellow },
  { id: 'time_early_5',   name: 'Early Riser',       description: 'Complete 5 sessions before 7am',            category: 'time_of_day', icon: 'sunny-outline',  color: C.yellow },
  { id: 'time_early_20',  name: 'Morning Warrior',   description: 'Complete 20 sessions before 7am',           category: 'time_of_day', icon: 'sunny-outline',  color: C.amber },
  { id: 'time_noon_10',   name: 'Lunch Lifter',      description: 'Complete 10 sessions between 12–2pm',       category: 'time_of_day', icon: 'restaurant-outline', color: C.yellow },
  { id: 'time_evening_5', name: 'After Work Hero',   description: 'Complete 5 sessions between 5–7pm',         category: 'time_of_day', icon: 'briefcase-outline',  color: C.amber },
  { id: 'time_night_1',   name: 'Night Owl',         description: 'Complete a session after 9pm',              category: 'time_of_day', icon: 'moon-outline',   color: C.violet },
  { id: 'time_night_10',  name: 'Night Grinder',     description: 'Complete 10 sessions after 9pm',            category: 'time_of_day', icon: 'moon-outline',   color: C.violet },
  { id: 'time_midnight',  name: 'Midnight Mover',    description: 'Complete a session after midnight',         category: 'time_of_day', icon: 'star-outline',   color: C.violet },
  { id: 'time_weekend_10',name: 'Weekend Warrior',   description: 'Complete 10 sessions on a Saturday or Sunday', category: 'time_of_day', icon: 'sunny-outline', color: C.sky },
  { id: 'time_weekend_30',name: 'Weekend Champion',  description: 'Complete 30 sessions on a Saturday or Sunday', category: 'time_of_day', icon: 'trophy-outline', color: C.sky },
];

// ─── 20. Variety Badges ───────────────────────────────────────────────────────
const varietyBadges: Badge[] = [
  { id: 'variety_3_types',     name: 'Well Rounded',     description: 'Complete sessions of 3 different types',      category: 'variety', icon: 'grid-outline',        color: C.crimson },
  { id: 'variety_5_types',     name: 'Versatile',        description: 'Complete sessions of 5 different types',      category: 'variety', icon: 'grid-outline',        color: C.crimson },
  { id: 'variety_all_types',   name: 'Complete Athlete', description: 'Complete at least one session of every type', category: 'variety', icon: 'star-outline',        color: C.crimson },
  { id: 'variety_3_in_week',   name: 'Big Week',         description: 'Complete 3 different session types in one week', category: 'variety', icon: 'calendar-outline', color: C.orange },
  { id: 'variety_5_in_week',   name: 'Full Spectrum',    description: 'Complete 5 different session types in one week', category: 'variety', icon: 'calendar-outline', color: C.orange },
  { id: 'variety_strength_cond', name: 'Hybrid Athlete', description: 'Complete 10 strength and 10 conditioning sessions', category: 'variety', icon: 'flash-outline',  color: C.red },
  { id: 'variety_recovery_balance',name: 'Balanced',     description: 'Log 5 prehab + 5 flexibility sessions',       category: 'variety', icon: 'scale-outline',       color: C.teal },
  { id: 'variety_all_in_month', name: 'Month of All',    description: 'Complete 4+ different session types in a single month', category: 'variety', icon: 'ribbon-outline', color: C.emerald },
  { id: 'variety_50_per_type', name: 'Specialist Range',   description: 'Complete 50 sessions across 5 different types',               category: 'variety', icon: 'bar-chart-outline', color: C.green },
  { id: 'variety_strength_trio', name: 'Triathlon of Iron', description: 'Complete at least 10 lower, upper AND full body sessions', category: 'variety', icon: 'trophy-outline',    color: C.purple },
];

// ─── 21. Recovery Badges ─────────────────────────────────────────────────────
const recoveryBadges: Badge[] = [
  { id: 'recovery_5',   name: 'Recovery Starter',  description: 'Complete 5 prehab or flexibility sessions combined', category: 'recovery', icon: 'leaf-outline',  color: C.mint },
  { id: 'recovery_15',  name: 'Body Maintenance',  description: 'Complete 15 recovery sessions',                       category: 'recovery', icon: 'leaf-outline',  color: C.mint },
  { id: 'recovery_30',  name: 'Mobility Mover',    description: 'Complete 30 recovery sessions',                       category: 'recovery', icon: 'leaf-outline',  color: C.mint },
  { id: 'recovery_50',  name: 'Mobility Master',   description: 'Complete 50 recovery sessions',                       category: 'recovery', icon: 'shield-checkmark-outline', color: C.teal },
  { id: 'recovery_100', name: 'Body Architect',    description: 'Complete 100 recovery sessions',                      category: 'recovery', icon: 'trophy-outline',color: C.teal },
  { id: 'recovery_week', name: 'Recovery Week',     description: 'Complete 3+ recovery sessions in a single week',      category: 'recovery', icon: 'calendar-outline', color: C.mint },
];

// ─── 22. Duration Badges ─────────────────────────────────────────────────────
const durationBadges: Badge[] = [
  { id: 'duration_60min_1',  name: 'Full Hour',      description: 'Complete your first 60-minute session',       category: 'duration', icon: 'time-outline',    color: C.lime },
  { id: 'duration_60min_5',  name: 'Hour Power',     description: 'Complete 5 sessions of 60 minutes',           category: 'duration', icon: 'time-outline',    color: C.lime },
  { id: 'duration_60min_20', name: 'Hour Machine',   description: 'Complete 20 sessions of 60 minutes',          category: 'duration', icon: 'time-outline',    color: C.emerald },
  { id: 'duration_60min_50', name: 'Full-Hour Elite',description: 'Complete 50 sessions of 60 minutes',          category: 'duration', icon: 'ribbon-outline',  color: C.emerald },
  { id: 'duration_45min_10', name: '45 Minute Club', description: 'Complete 10 sessions of 45 minutes or more',  category: 'duration', icon: 'time-outline',    color: C.lime },
  { id: 'duration_30_30',    name: 'Quick & Dirty',  description: 'Complete 30 sessions of exactly 30 minutes',  category: 'duration', icon: 'flash-outline',   color: C.amber },
  { id: 'duration_total_50h',name: 'Fifty Hours',    description: 'Accumulate 50 total hours of training',        category: 'duration', icon: 'hourglass-outline',color: C.green },
  { id: 'duration_total_100h',name:'Century of Hours',description: 'Accumulate 100 total hours of training',      category: 'duration', icon: 'trophy-outline',  color: C.green },
];

// ─── 23. Comeback Badges ─────────────────────────────────────────────────────
const comebackBadges: Badge[] = [
  { id: 'comeback_7d',  name: 'Back in Action',  description: 'Train again after a 7+ day rest',              category: 'comeback', icon: 'refresh-outline',    color: C.pink },
  { id: 'comeback_14d', name: 'Resurrection',    description: 'Train again after a 14+ day break',            category: 'comeback', icon: 'refresh-outline',    color: C.pink },
  { id: 'comeback_30d', name: 'Phoenix Rising',  description: 'Train again after a 30+ day break',            category: 'comeback', icon: 'flame-outline',      color: C.crimson },
  { id: 'comeback_3x',  name: 'Serial Returner', description: 'Make a comeback (return after 7+ days) 3 times',category: 'comeback', icon: 'repeat-outline',     color: C.pink },
  { id: 'comeback_5x',  name: 'Resilient',       description: 'Make a comeback (return after 7+ days) 5 times',category: 'comeback', icon: 'medal-outline',      color: C.crimson },
];

// ─── 24. Volume Per Session Badges ───────────────────────────────────────────
const volumeSessionBadges: Badge[] = [
  { id: 'vol_session_500',    name: 'Five Hundred',      description: 'Lift 500 kg in a single session',          category: 'volume_session', icon: 'barbell-outline', color: C.emerald },
  { id: 'vol_session_1000',   name: 'One Ton Session',   description: 'Lift 1,000 kg in a single session',        category: 'volume_session', icon: 'barbell-outline', color: C.emerald },
  { id: 'vol_session_2000',   name: 'Two Ton Day',       description: 'Lift 2,000 kg in a single session',        category: 'volume_session', icon: 'barbell-outline', color: C.green },
  { id: 'vol_session_3000',   name: 'Three Tons',        description: 'Lift 3,000 kg in a single session',        category: 'volume_session', icon: 'barbell-outline', color: C.green },
  { id: 'vol_session_5000',   name: 'Five Ton Session',  description: 'Lift 5,000 kg in a single session',        category: 'volume_session', icon: 'trophy-outline',  color: C.green },
  { id: 'vol_session_7500',   name: 'Volume Monster',    description: 'Lift 7,500 kg in a single session',        category: 'volume_session', icon: 'trophy-outline',  color: C.emerald },
  { id: 'vol_session_10000',  name: 'Ten Ton Beast',     description: 'Lift 10,000 kg in a single session',       category: 'volume_session', icon: 'star-outline',    color: C.emerald },
  { id: 'vol_session_15000',  name: 'Freight Train',     description: 'Lift 15,000 kg in a single session',       category: 'volume_session', icon: 'train-outline',   color: C.emerald },
];

// ─── 25. Load (heaviest single-set weight) Badges ────────────────────────────
const loadBadges: Badge[] = [
  { id: 'load_50kg',   name: 'Half Ton Set',    description: 'Log a set with 50 kg on the bar',     category: 'load', icon: 'barbell-outline', color: C.blue },
  { id: 'load_75kg',   name: 'Heavy Work',      description: 'Log a set with 75 kg on the bar',     category: 'load', icon: 'barbell-outline', color: C.blue },
  { id: 'load_100kg',  name: 'One Plate',       description: 'Log a set with 100 kg on the bar',    category: 'load', icon: 'barbell-outline', color: C.blue },
  { id: 'load_120kg',  name: 'Serious Load',    description: 'Log a set with 120 kg on the bar',    category: 'load', icon: 'barbell-outline', color: C.blue },
  { id: 'load_140kg',  name: 'Two Plates',      description: 'Log a set with 140 kg on the bar',    category: 'load', icon: 'barbell-outline', color: C.sky },
  { id: 'load_160kg',  name: 'Iron Overload',   description: 'Log a set with 160 kg on the bar',    category: 'load', icon: 'barbell-outline', color: C.sky },
  { id: 'load_180kg',  name: 'Three Plates',    description: 'Log a set with 180 kg on the bar',    category: 'load', icon: 'barbell-outline', color: C.sky },
  { id: 'load_200kg',  name: 'Two Hundred',     description: 'Log a set with 200 kg on the bar',    category: 'load', icon: 'trophy-outline',  color: C.sky },
  { id: 'load_250kg',  name: 'Heavy Iron',      description: 'Log a set with 250 kg on the bar',    category: 'load', icon: 'trophy-outline',  color: C.blue },
  { id: 'load_300kg',  name: 'Three Hundred',   description: 'Log a set with 300 kg on the bar',    category: 'load', icon: 'ribbon-outline',  color: C.violet },
];

// ─── Final catalog assembly ───────────────────────────────────────────────────

export const BADGE_CATALOG: Badge[] = [
  ...milestoneBadges,
  ...streakBadges,
  ...squatBadges,
  ...benchBadges,
  ...deadliftBadges,
  ...volumeBadges,
  ...sessionTypeBadges,
  ...consistencyBadges,
  ...goalsBadges,
  ...profileBadges,
  ...equipmentBadges,
  ...testWeekBadges,
  ...timeOfDayBadges,
  ...varietyBadges,
  ...recoveryBadges,
  ...durationBadges,
  ...comebackBadges,
  ...volumeSessionBadges,
  ...loadBadges,
];

/** Quick lookup by ID. Computed once at module load. */
export const BADGE_MAP: ReadonlyMap<string, Badge> = new Map(
  BADGE_CATALOG.map((b) => [b.id, b])
);

export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  milestone:            'Milestones',
  streak:               'Streaks',
  strength_squat:       'Squat Strength',
  strength_bench:       'Bench Strength',
  strength_deadlift:    'Deadlift Strength',
  volume:               'Total Volume',
  session_lower:        'Lower Body',
  session_upper:        'Upper Body',
  session_full:         'Full Body',
  session_conditioning: 'Conditioning',
  session_prehab:       'Prehab',
  session_flex:         'Flexibility',
  session_custom:       'Custom Sessions',
  consistency:          'Consistency',
  goals:                'Goals',
  profile:              'Profile',
  equipment:            'Equipment',
  test_week:            'Test Weeks',
  time_of_day:          'Time of Day',
  variety:              'Variety',
  recovery:             'Recovery',
  duration:             'Session Duration',
  comeback:             'Comebacks',
  volume_session:       'Session Volume',
  load:                 'Heavy Lifts',
};

/** Ordered list of categories for display in the Achievements screen. */
export const BADGE_CATEGORY_ORDER: BadgeCategory[] = [
  'milestone',
  'streak',
  'consistency',
  'strength_squat',
  'strength_bench',
  'strength_deadlift',
  'volume',
  'volume_session',
  'load',
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
  'profile',
  'equipment',
  'time_of_day',
  'comeback',
];
