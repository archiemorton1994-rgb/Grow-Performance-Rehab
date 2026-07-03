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

const Modal = ({ children, visible, transparent, animationType, onRequestClose, testID, ...rest }) =>
  visible ? React.createElement('View', { testID: testID ?? 'modal', ...rest }, children) : null;
Modal.displayName = 'Modal';

const StyleSheet = {
  create: (s) => s,
  flatten: (s) => s || {},
  hairlineWidth: 1,
};

const useWindowDimensions = () => ({ width: 400, height: 720, scale: 1, fontScale: 1 });
const Platform = { OS: 'ios', select: (o) => ('ios' in o ? o.ios : o.default) };
const useColorScheme = () => 'light';

module.exports = {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  useWindowDimensions,
  Platform,
  useColorScheme,
};
