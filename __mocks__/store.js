/**
 * Minimal mock for lib/store.ts used in jest component tests.
 * Provides useAppStore (and legacy useStore alias) stubs that return a default
 * userProfile with sex='male'.
 * Tests that need a different sex value can override via jest.spyOn or
 * by passing the value directly through component props.
 */
const defaultState = {
  userProfile: {
    sex: 'male',
    name: 'Test User',
    experienceLevel: 'intermediate',
    goals: [],
    bodyweightKg: 80,
  },
  weightUnit: 'kg',
  equipmentTiers: ['dumbbells'],
  sessions: [],
  customExercises: [],
  exerciseFeedback: {},
  exerciseNormalStreak: {},
  reviewPromptShown: false,
};

const useAppStore = (selector) => selector ? selector(defaultState) : defaultState;
const useStore = useAppStore;

const STRENGTH_SESSION_TYPES = ['squat', 'bench', 'deadlift'];

module.exports = {
  __esModule: true,
  useAppStore,
  useStore,
  STRENGTH_SESSION_TYPES,
};
