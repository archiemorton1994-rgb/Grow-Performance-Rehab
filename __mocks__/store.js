/**
 * Minimal mock for lib/store.ts used in jest component tests.
 * Provides useAppStore (and legacy useStore alias) stubs that return a default
 * state covering all fields destructured by SessionScreen, ReadinessScreen, and
 * other tested components.
 *
 * Tests that need a different state can call __setStoreOverride({ ...fields }) before
 * rendering and __clearStoreOverride() in afterEach to restore defaults.
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
  // Fields used by SessionScreen
  getEffectiveTier: jest.fn(() => 'dumbbells'),
  completeSession: jest.fn(),
  addOneRepMax: jest.fn(),
  setExerciseFeedback: jest.fn(),
  applyTooEasyAdjustment: jest.fn(),
  getBestORM: jest.fn(() => undefined),
  completedSessions: [],
  activeSession: null,
  setActiveSession: jest.fn(),
  clearActiveSession: jest.fn(),
  updateLastLoggedWeights: jest.fn(),
  lastLoggedWeights: {},
  setReviewPromptShown: jest.fn(),
  lastSessionPerformance: {},
  pendingCustomExercises: [],
  clearPendingCustomExercises: jest.fn(),
  // Fields used by ReadinessScreen
  lastReadinessEnergy: 'normal',
  lastReadinessTime: '60',
  lastPainRegion: undefined,
  setLastReadiness: jest.fn(),
};

let _storeOverride = null;

const useAppStore = (selector) => {
  const state = _storeOverride ?? defaultState;
  return selector ? selector(state) : state;
};
const useStore = useAppStore;

/** Override store state for a single test. Call __clearStoreOverride() in afterEach. */
const __setStoreOverride = (state) => { _storeOverride = state; };
/** Restore default store state after a test that called __setStoreOverride. */
const __clearStoreOverride = () => { _storeOverride = null; };

const STRENGTH_SESSION_TYPES = ['squat', 'bench', 'deadlift'];

module.exports = {
  __esModule: true,
  useAppStore,
  useStore,
  STRENGTH_SESSION_TYPES,
  __setStoreOverride,
  __clearStoreOverride,
};
