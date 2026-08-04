/**
 * Minimal react-native-svg mock for jest component tests.
 * SVG elements forward testID, onPress, fill, and style so react-test-renderer
 * can find hotspots, trigger press handlers, and inspect visual fill values.
 *
 * Every element the app imports must be exported here. An element missing from
 * this mock renders as `undefined`, which React rejects with "Element type is
 * invalid" — a failure that looks like a bug in the component under test rather
 * than a gap in the mock.
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

const container = (name) => {
  const El = ({ children }) => React.createElement(name, null, children);
  El.displayName = name;
  return El;
};

module.exports = {
  __esModule: true,
  default: Svg,
  Svg,
  G,
  Path: makeEl('Path'),
  Circle: makeEl('Circle'),
  Ellipse: makeEl('Ellipse'),
  Rect: makeEl('Rect'),
  Line: makeEl('Line'),
  Polygon: makeEl('Polygon'),
  Polyline: makeEl('Polyline'),
  Text: makeEl('SvgText'),
  Defs: container('Defs'),
  ClipPath: container('ClipPath'),
  Mask: container('Mask'),
  LinearGradient: container('LinearGradient'),
  RadialGradient: container('RadialGradient'),
  Stop: makeEl('Stop'),
};
