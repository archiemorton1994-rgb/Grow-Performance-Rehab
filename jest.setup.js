// React Native defines __DEV__ as a global. Metro injects it into the bundle;
// jest does not, so any module that reads it at import time — expo-modules-core
// does, which means anything pulling in @expo/vector-icons — died with
// "ReferenceError: __DEV__ is not defined" before the suite could start. Three
// of the four suites were failing this way, which is why a component that
// crashes at runtime could still ship.
global.__DEV__ = true;

/**
 * expo-keep-awake reaches expo-modules-core's EventEmitter at import time, and
 * that needs a native module jest does not have — so importing app/session.tsx
 * at all took three component suites down with it.
 *
 * The hook has no behaviour worth asserting in a unit suite: it asks the
 * operating system not to lock the screen while the session is open. Stubbed
 * here rather than in every suite that reaches the session screen.
 */
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => {},
  activateKeepAwakeAsync: async () => {},
  deactivateKeepAwake: () => {},
}));
