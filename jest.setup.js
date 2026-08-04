// React Native defines __DEV__ as a global. Metro injects it into the bundle;
// jest does not, so any module that reads it at import time — expo-modules-core
// does, which means anything pulling in @expo/vector-icons — died with
// "ReferenceError: __DEV__ is not defined" before the suite could start. Three
// of the four suites were failing this way, which is why a component that
// crashes at runtime could still ship.
global.__DEV__ = true;
