/**
 * Minimal react-native mock for jest component tests.
 * Maps View/Text/Pressable/Modal to plain React.createElement calls
 * so react-test-renderer can render them in Node.js.
 */
const React = require('react');

const View = ({ children, testID, style, ...rest }) =>
  React.createElement('View', { testID, ...rest }, children);
View.displayName = 'View';

const Text = ({ children, testID, style, ...rest }) =>
  React.createElement('Text', { testID, ...rest }, children);
Text.displayName = 'Text';

const Pressable = ({ children, testID, onPress, style, disabled, ...rest }) =>
  React.createElement('Pressable', { testID, onPress, disabled, ...rest }, children);
Pressable.displayName = 'Pressable';

const Modal = ({
  children,
  visible,
  transparent,
  animationType,
  onRequestClose,
  testID,
  ...rest
}) =>
  visible ? React.createElement('View', { testID: testID ?? 'modal', ...rest }, children) : null;
Modal.displayName = 'Modal';

const ScrollView = ({ children, testID, style, contentContainerStyle, ...rest }) =>
  React.createElement('View', { testID, ...rest }, children);
ScrollView.displayName = 'ScrollView';

const TextInput = ({ testID, style, onChangeText, value, ...rest }) =>
  React.createElement('TextInput', { testID, onChangeText, value, ...rest });
TextInput.displayName = 'TextInput';

const KeyboardAvoidingView = ({ children, testID, style, behavior, ...rest }) =>
  React.createElement('View', { testID, ...rest }, children);
KeyboardAvoidingView.displayName = 'KeyboardAvoidingView';

const Image = ({ testID, style, source, resizeMode, ...rest }) =>
  React.createElement('Image', { testID, ...rest });
Image.displayName = 'Image';

const FlatList = ({ testID, data, renderItem, keyExtractor, style, ...rest }) =>
  React.createElement('View', { testID, ...rest });
FlatList.displayName = 'FlatList';

const TouchableOpacity = ({ children, testID, onPress, style, disabled, ...rest }) =>
  React.createElement('View', { testID, onPress, disabled, ...rest }, children);
TouchableOpacity.displayName = 'TouchableOpacity';

const ActivityIndicator = ({ testID, ...rest }) =>
  React.createElement('View', { testID, ...rest });
ActivityIndicator.displayName = 'ActivityIndicator';

const PanResponder = {
  create: () => ({ panHandlers: {} }),
};

const Alert = { alert: jest.fn() };
const AnimatedValue = function (v) {
  this._value = v;
  this.setValue = (n) => {
    this._value = n;
  };
};

/**
 * FAITHFUL ON THE ONE AXIS THAT MATTERS: what it returns.
 *
 * React Native's Animated.event returns two different things
 * (Libraries/Animated/AnimatedImplementation.js):
 *
 *     if (animatedEvent.__isNative) return animatedEvent;        // OBJECT
 *     else return animatedEvent.__getHandler();                  // FUNCTION
 *
 * Only Animated.createAnimatedComponent unwraps the object. Hand it to a plain
 * ScrollView and React Native calls props.onScroll(e) on an object, which is
 * how five screens crashed with "onScroll is not a function (it is Object)".
 *
 * A mock that always returned a function would make the broken configuration
 * look fine, which is precisely the thing worth catching. So the split is
 * reproduced, and the non-native branch really writes the mapped values so a
 * caller passing a real scroll event gets real behaviour.
 */
const animatedEvent = (argMapping, config) => {
  if (config && config.useNativeDriver) {
    return { __isNative: true, __getHandler: () => () => {} };
  }
  const write = (mapping, value) => {
    if (mapping instanceof AnimatedValue) {
      if (typeof value === 'number') mapping.setValue(value);
      return;
    }
    if (mapping && typeof mapping === 'object' && value && typeof value === 'object') {
      for (const key of Object.keys(mapping)) write(mapping[key], value[key]);
    }
  };
  return (...args) => {
    (argMapping || []).forEach((mapping, i) => write(mapping, args[i]));
  };
};

const Animated = {
  View: ({ children, testID, style, ...rest }) =>
    React.createElement('View', { testID, ...rest }, children),
  ScrollView: ({ children, testID, style, ...rest }) =>
    React.createElement('ScrollView', { testID, ...rest }, children),
  Value: AnimatedValue,
  event: animatedEvent,
  createAnimatedComponent: (Component) => Component,
  timing: () => ({ start: jest.fn() }),
  spring: () => ({ start: jest.fn() }),
  sequence: () => ({ start: jest.fn() }),
  parallel: () => ({ start: jest.fn() }),
  loop: () => ({ start: jest.fn() }),
};

const Switch = ({ testID, value, onValueChange, ...rest }) =>
  React.createElement('View', { testID, ...rest });

const Linking = {
  openURL: jest.fn(() => Promise.resolve()),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
};

const AppState = {
  currentState: 'active',
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

const StyleSheet = {
  create: (s) => s,
  flatten: (s) => s || {},
  hairlineWidth: 1,
  // BodyDiagram spreads this onto the hotspot <Svg> overlay. Leaving it
  // undefined is harmless today (style props are dropped by these mocks) but
  // would break the moment a test asserts on an absolute-fill style.
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
};

// session.tsx and onboarding.tsx call Keyboard.dismiss — both as an event
// handler and directly. Without this export the whole SessionActiveBar render
// threw "Cannot read properties of undefined (reading 'dismiss')", which took
// out every test in tests/session-bar-kav.test.tsx.
const Keyboard = {
  dismiss: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeAllListeners: jest.fn(),
  scheduleLayoutAnimation: jest.fn(),
};

const useWindowDimensions = () => ({ width: 400, height: 720, scale: 1, fontScale: 1 });
const Platform = { OS: 'ios', select: (o) => ('ios' in o ? o.ios : o.default) };
const useColorScheme = () => 'light';
const Dimensions = {
  get: (dim) => (dim === 'window' ? { width: 400, height: 720, scale: 1, fontScale: 1 } : { width: 400, height: 720, scale: 1, fontScale: 1 }),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

module.exports = {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Linking,
  AppState,
  StyleSheet,
  Keyboard,
  useWindowDimensions,
  Dimensions,
  Platform,
  useColorScheme,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  PanResponder,
  Alert,
  Animated,
  Switch,
};
