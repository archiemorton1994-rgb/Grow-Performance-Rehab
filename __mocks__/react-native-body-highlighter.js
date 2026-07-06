/**
 * Minimal mock for react-native-body-highlighter.
 * The Body component renders a placeholder View in tests; all interactive
 * behaviour is exercised through the custom SVG hotspot paths in BodyDiagram.tsx.
 *
 * The `data` prop is captured on every render so tests can assert that the
 * heatmap formula produces correct fill/opacity values at runtime.
 *
 * Usage in tests:
 *   const mock = require('../__mocks__/react-native-body-highlighter');
 *   // after act(() => renderer.create(<BodyDiagram heatmapCounts={...} />)):
 *   const data = mock.getCapturedBodyData();
 *   // data is Array<{ slug: string; styles: { fill: string } }>
 */
const React = require('react');

let _capturedData = null;

const Body = ({ data }) => {
  _capturedData = data ?? null;
  return React.createElement('View', { testID: 'body-highlighter' });
};
Body.displayName = 'Body';

module.exports = {
  __esModule: true,
  default: Body,
  /** Returns the most-recently-rendered data array, or null if Body has not rendered. */
  getCapturedBodyData: () => _capturedData,
  /** Resets captured state between tests that need a clean slate. */
  clearCapturedBodyData: () => {
    _capturedData = null;
  },
};
