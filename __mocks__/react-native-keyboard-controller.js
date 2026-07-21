const React = require('react');
const { ScrollView } = require('react-native');

const KeyboardAwareScrollView = React.forwardRef(function KeyboardAwareScrollView(props, ref) {
  return React.createElement(ScrollView, { ...props, ref });
});

const KeyboardProvider = ({ children }) => children;

module.exports = {
  KeyboardAwareScrollView,
  KeyboardProvider,
};
