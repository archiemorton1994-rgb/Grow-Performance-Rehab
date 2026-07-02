#!/bin/bash
# Regression guard: BodyDiagram hotspot fill must NOT be 'transparent'
#
# react-native-svg on iOS/Android only dispatches touch events to SVG
# elements that have a *painted* fill. Using fill="transparent" makes all
# hotspot zones untappable on real devices while everything appears to work
# in the web preview. The fix: use rgba(0,0,0,0.001) which is visually
# identical to transparent but registers as a painted area for hit-testing.
#
# This script fails if the workaround is missing or the fill has been
# reverted to 'transparent'.

FILE="components/BodyDiagram.tsx"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found"
  exit 1
fi

# 1. Ensure the non-transparent hit-area fill value is present in the h() helper
if ! grep -q "rgba(0,0,0,0.001)" "$FILE"; then
  echo "FAIL: rgba(0,0,0,0.001) not found in $FILE"
  echo ""
  echo "The body diagram hotspot fill has been changed away from the required workaround."
  echo "On iOS/Android, react-native-svg only fires onPress for painted (non-transparent) fills."
  echo "Restore the unselected fill in the h() helper to: rgba(0,0,0,0.001)"
  exit 1
fi

# 2. Extra guard: detect if 'transparent' is now used as a hotspot fill value
# (exclude lines that are comments, stroke values, or silhouette shapes)
TRANSPARENT_HITS=$(grep -n "fill:.*'transparent'" "$FILE" | grep -v "^[[:space:]]*\/\/" | grep -v "stroke:" | grep -v "silhouette" || true)
if [ -n "$TRANSPARENT_HITS" ]; then
  echo "WARNING: Possible transparent hotspot fill detected:"
  echo "$TRANSPARENT_HITS"
  echo ""
  echo "Verify these are not in the h() hotspot helper — transparent fills break native touch events."
fi

echo "OK: BodyDiagram touch-hit workaround intact"
echo "  fill: rgba(0,0,0,0.001) present in $FILE (non-transparent for iOS/Android hit-testing)"
exit 0
