/** @type {import('jest').Config} */
//
// Single source of truth for `npm test`. This used to be split across two
// configs — this one, and a richer jest-component.config.js that nothing ran.
// The component suites were written against that second config, so under
// `npm test` two of them could not even load: their mocks were never mapped.
// Everything is merged here now, so there is exactly one way to run the tests
// and no second config can silently rot again.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],

  setupFiles: ['<rootDir>/jest.setup.js'],

  modulePathIgnorePatterns: ['<rootDir>/.cache/'],

  testTimeout: 15000,

  // react-test-renderer needs this before act() will flush state updates.
  globals: {
    IS_REACT_ACT_ENVIRONMENT: true,
  },

  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },

  transformIgnorePatterns: [
    '/node_modules/(?!(react-native|@react-native|expo|expo-.*|@expo)/)',
  ],

  // ORDER MATTERS: the catch-all '^@/(.*)$' alias must stay LAST, or it wins
  // over the specific '^@/lib/...' mock mappings above it.
  moduleNameMapper: {
    // ── Native / platform packages ──
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^react-native/(.*)$': '<rootDir>/__mocks__/react-native.js',
    '^react-native-svg$': '<rootDir>/__mocks__/react-native-svg.js',
    '^react-native-reanimated$': '<rootDir>/__mocks__/react-native-reanimated.js',
    '^react-native-body-highlighter$': '<rootDir>/__mocks__/react-native-body-highlighter.js',
    '^react-native-keyboard-controller$': '<rootDir>/__mocks__/react-native-keyboard-controller.js',
    '^react-native-safe-area-context$': '<rootDir>/__mocks__/react-native-safe-area-context.js',
    '^expo-haptics$': '<rootDir>/__mocks__/expo-haptics.js',
    '^expo-notifications$': '<rootDir>/__mocks__/expo-notifications.js',
    '^expo-store-review$': '<rootDir>/__mocks__/expo-store-review.js',
    '^expo-router$': '<rootDir>/__mocks__/expo-router.js',
    // The real package reaches expo-font -> expo-modules-core, which wants
    // native EventEmitter bindings jest does not have. __mocks__/expo-vector-icons.js
    // already existed but was never mapped, so three suites died on this import
    // before the component under test ever loaded.
    '^@expo/vector-icons$': '<rootDir>/__mocks__/expo-vector-icons.js',

    // ── App modules with native or network dependencies ──
    // @/lib/sync pulls in expo/fetch -> expo-modules-core, which throws
    // "Cannot read properties of undefined (reading 'EventEmitter')" under jest.
    // app/session.tsx imports it, and that is what stopped both session suites
    // from loading under this config.
    '^@/lib/store$': '<rootDir>/__mocks__/store.js',
    '^@/lib/sync$': '<rootDir>/__mocks__/lib-sync.js',
    '^@/lib/notifications$': '<rootDir>/__mocks__/lib-notifications.js',
    '^@/lib/workout-engine$': '<rootDir>/__mocks__/lib-workout-engine.js',
    '^@/lib/utils$': '<rootDir>/__mocks__/lib-utils.js',

    '\\.(png|jpg|jpeg|gif|svg|webp)$': '<rootDir>/__mocks__/fileMock.js',

    '^@/(.*)$': '<rootDir>/$1',
  },
};
