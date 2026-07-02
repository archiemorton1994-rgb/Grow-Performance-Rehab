#!/bin/bash
# Regression guard: BodyDiagram hotspot fill must NOT be 'transparent'
#
# react-native-svg on iOS/Android only dispatches touch events to SVG
# elements that have a *painted* fill. Using fill="transparent" makes all
# hotspot zones untappable on real devices while everything appears to work
# in the web preview. The fix: use rgba(0,0,0,0.001) which is visually
# identical to transparent but registers as a painted area for hit-testing.
#
# Exit codes:
#   0 — workaround is intact
#   1 — workaround is missing or transparent fill detected in hotspot code

FILE="components/BodyDiagram.tsx"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found"
  exit 1
fi

FAIL=0

# 1. Ensure the non-transparent hit-area fill value is present in the h() helper
if ! grep -q "rgba(0,0,0,0.001)" "$FILE"; then
  echo "FAIL: rgba(0,0,0,0.001) not found in $FILE"
  echo ""
  echo "The body diagram hotspot fill has been changed away from the required workaround."
  echo "On iOS/Android, react-native-svg only fires onPress for painted (non-transparent) fills."
  echo "Restore the unselected fill in the h() helper to: rgba(0,0,0,0.001)"
  FAIL=1
fi

# 2. Extract the h() helper block and check it does NOT use 'transparent' as a fill value.
# (stroke: 'transparent' is acceptable; only fill: 'transparent' breaks touch hit-testing)
H_BLOCK=$(awk '/const h = \(r: PainRegion\)/,/^[[:space:]]*\}\);/' "$FILE" 2>/dev/null)
if echo "$H_BLOCK" | grep -E "fill:.*['\"]transparent['\"]" > /dev/null 2>&1; then
  echo "FAIL: 'transparent' detected as a fill value inside the h() hotspot helper:"
  echo "$H_BLOCK" | grep -n -E "fill:.*['\"]transparent['\"]"
  echo ""
  echo "Transparent fills break native touch hit-testing on iOS/Android."
  echo "Use rgba(0,0,0,0.001) instead."
  FAIL=1
fi

if [ "$FAIL" -eq 1 ]; then
  exit 1
fi

echo "OK: BodyDiagram touch-hit workaround intact"
echo "  fill: rgba(0,0,0,0.001) present in $FILE (non-transparent for iOS/Android hit-testing)"
exit 0
