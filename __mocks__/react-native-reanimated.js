/**
 * Minimal react-native-reanimated mock for jest component tests.
 * Replaces animation primitives with synchronous no-ops so the component
 * renders in Node.js without native modules.
 */
const React = require('react');

const useSharedValue = (initial) => ({ value: initial });

const useAnimatedStyle = (fn) => {
  try { return fn(); } catch (_) { return {}; }
};

const withSequence = (...args) => args[args.length - 1];
const withTiming   = (toValue) => toValue;
const withRepeat   = (animation) => animation;
const cancelAnimation = () => {};

const Easing = {
  inOut: (fn) => fn,
  ease:  (t) => t,
  out:   (fn) => fn,
  in:    (fn) => fn,
  linear: (t) => t,
  bezier: () => (t) => t,
};

const AnimatedView = ({ children, style, testID, ...rest }) =>
  React.createElement('View', { testID, ...rest }, children);
AnimatedView.displayName = 'AnimatedView';

const Animated = {
  View: AnimatedView,
  Text: ({ children, style, testID, ...rest }) =>
    React.createElement('Text', { testID, ...rest }, children),
  createAnimatedComponent: (Component) => Component,
};

module.exports = {
  __esModule: true,
  default: Animated,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
};
