/**
 * Minimal react-native-reanimated mock for jest component tests.
 * Replaces animation primitives with synchronous no-ops so the component
 * renders in Node.js without native modules.
 */
const React = require('react');

const useSharedValue = (initial) => ({ value: initial });

const useAnimatedStyle = (fn) => {
  try {
    return fn();
  } catch (_) {
    return {};
  }
};

const useAnimatedProps = (fn) => {
  try {
    return fn();
  } catch (_) {
    return {};
  }
};

const withSequence = (...args) => args[args.length - 1];
const withTiming = (toValue) => toValue;
const withRepeat = (animation) => animation;
const withSpring = (toValue) => toValue;
const cancelAnimation = () => {};
const interpolateColor = () => 'transparent';

const makeEntryAnimation = () => {
  const self = {
    duration: () => self,
    delay: () => self,
    easing: () => self,
    springify: () => self,
    damping: () => self,
    stiffness: () => self,
    mass: () => self,
    withInitialValues: () => self,
    build: () => undefined,
  };
  return self;
};

const FadeInDown = makeEntryAnimation();
const FadeInUp = makeEntryAnimation();
const FadeIn = makeEntryAnimation();

const Easing = {
  inOut: (fn) => fn,
  ease: (t) => t,
  out: (fn) => fn,
  in: (fn) => fn,
  linear: (t) => t,
  bezier: () => (t) => t,
};

const AnimatedView = ({ children, style, testID, entering, exiting, ...rest }) =>
  React.createElement('View', { testID, ...rest }, children);
AnimatedView.displayName = 'AnimatedView';

const Animated = {
  View: AnimatedView,
  Text: ({ children, style, testID, entering, exiting, ...rest }) =>
    React.createElement('Text', { testID, ...rest }, children),
  createAnimatedComponent: (Component) => Component,
};

const explicit = {
  __esModule: true,
  default: Animated,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSequence,
  withTiming,
  withSpring,
  withRepeat,
  cancelAnimation,
  interpolateColor,
  FadeInDown,
  FadeInUp,
  FadeIn,
  Easing,
};

/**
 * Any OTHER capitalised export is an entry animation.
 *
 * The fixed list above went stale the moment the session screen started
 * turning pages: SlideInRight and three siblings were not on it, and twenty-one
 * component tests failed on `.duration` of undefined - not because anything was
 * broken but because a mock had a list. FadeOut had been missing for longer and
 * escaped notice only because its one use sits behind a flag that is false in
 * every test.
 *
 * The trade is that a MISSPELLED import would now resolve here instead of
 * throwing. tsc runs before jest in `npm run check` and catches exactly that,
 * so the trade is worth making.
 */
module.exports = new Proxy(explicit, {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (typeof prop === 'string' && /^[A-Z]/.test(prop)) return makeEntryAnimation();
    return undefined;
  },
  has(target, prop) {
    return prop in target || (typeof prop === 'string' && /^[A-Z]/.test(prop));
  },
});
