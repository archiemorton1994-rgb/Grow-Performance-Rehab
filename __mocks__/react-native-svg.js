/**
 * Minimal react-native-svg mock for jest component tests.
 * SVG elements forward testID, onPress, fill, and style so react-test-renderer
 * can find hotspots, trigger press handlers, and inspect visual fill values.
 */
const React = require('react');

const makeEl = (name) => {
  const El = (props) =>
    React.createElement(
      name,
      {
        testID: props.testID,
        onPress: props.onPress,
        fill: props.fill,
        style: props.style,
      },
      props.children || null
    );
  El.displayName = name;
  return El;
};

const Svg = ({ children, width, height, viewBox }) =>
  React.createElement('Svg', { width, height, viewBox }, children);
Svg.displayName = 'Svg';

const G = ({ children }) => React.createElement('G', null, children);
G.displayName = 'G';

module.exports = {
  __esModule: true,
  default: Svg,
  Svg,
  G,
  Path: makeEl('Path'),
  Circle: makeEl('Circle'),
  Ellipse: makeEl('Ellipse'),
  Rect: makeEl('Rect'),
};
