/**
 * Minimal mock for lib/store.ts used in jest component tests.
 * Provides a useStore stub that returns a default userProfile with sex='male'.
 * Tests that need a different sex value can override via jest.spyOn or
 * by passing the value directly through component props.
 */
const useStore = (selector) => {
  const defaultState = {
    userProfile: {
      sex: 'male',
      name: 'Test User',
      experienceLevel: 'intermediate',
      goals: [],
      bodyweightKg: 80,
    },
  };
  return selector ? selector(defaultState) : defaultState;
};

module.exports = {
  __esModule: true,
  useStore,
};
