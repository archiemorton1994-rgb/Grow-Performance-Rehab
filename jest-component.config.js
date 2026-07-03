module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^react-native/(.*)$': '<rootDir>/__mocks__/react-native.js',
    '^react-native-svg$': '<rootDir>/__mocks__/react-native-svg.js',
    '^expo-haptics$': '<rootDir>/__mocks__/expo-haptics.js',
    '^react-native-reanimated$': '<rootDir>/__mocks__/react-native-reanimated.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/tests/body-diagram-component.test.tsx',
    '<rootDir>/tests/badge-animation.test.tsx',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.cache/'],
  testTimeout: 15000,
  globals: {
    IS_REACT_ACT_ENVIRONMENT: true,
  },
};
