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
};

const useAppStore = (selector) => selector ? selector(defaultState) : defaultState;
const useStore = useAppStore;

module.exports = {
  __esModule: true,
  useAppStore,
  useStore,
};
