/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],

  setupFiles: ['<rootDir>/jest.setup.js'],

  modulePathIgnorePatterns: ['<rootDir>/.cache/'],

  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },

  transformIgnorePatterns: [
    '/node_modules/(?!(react-native|@react-native|expo|expo-.*|@expo)/)',
  ],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^react-native-svg$': '<rootDir>/__mocks__/react-native-svg.js',
    // The real package reaches expo-font -> expo-modules-core, which wants
    // native EventEmitter bindings jest does not have. __mocks__/expo-vector-icons.js
    // already existed but was never mapped, so three suites died on this import
    // before the component under test ever loaded.
    '^@expo/vector-icons$': '<rootDir>/__mocks__/expo-vector-icons.js',
    '^react-native-reanimated$': '<rootDir>/__mocks__/react-native-reanimated.js',
    '^expo-haptics$': '<rootDir>/__mocks__/expo-haptics.js',
  },
};
