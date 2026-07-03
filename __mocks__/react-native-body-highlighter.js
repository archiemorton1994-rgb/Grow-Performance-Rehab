/**
 * Minimal mock for react-native-body-highlighter.
 * The Body component renders nothing in tests; all interactive behaviour
 * is exercised through the custom SVG hotspot paths in BodyDiagram.tsx.
 */
const React = require('react');

const Body = () => React.createElement('View', { testID: 'body-highlighter' });
Body.displayName = 'Body';

module.exports = {
  __esModule: true,
  default: Body,
};
