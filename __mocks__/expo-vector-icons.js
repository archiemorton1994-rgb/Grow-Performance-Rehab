const React = require('react');
const Ionicons = ({ name, size, color, testID, style }) =>
  React.createElement('View', { testID: testID ?? `icon-${name}`, style });
Ionicons.displayName = 'Ionicons';
module.exports = { Ionicons };
