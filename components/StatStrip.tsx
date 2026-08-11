import React from 'react';
import { Text, View } from 'react-native';
import { useColors } from '@/constants/colors';

/**
 * The three-figure summary card — one number, one label, repeated across a row.
 *
 * This shape existed FIVE times in the app before it was a component: twice
 * verbatim on the Stats Overview tab (the empty state and the populated state
 * each built their own), once on Stats › Strength, once inline in the
 * exercise-progress list, and once on the Profile screen with its own set of
 * style objects and an icon per cell. Five copies of one card is five places to
 * change when it changes, and it had already drifted — the inline copy used a
 * 22px number where the others used 26px, which nobody decided.
 *
 * `hint` is a unit or qualifier that belongs WITH the number rather than in the
 * label. The Strength tab used to glue the unit onto the label ("Squat kg"),
 * which reads as a different statistic from "Squat"; it was written that way
 * only because the shared style had nowhere else to put it.
 */
export interface StatStripItem {
  value: string;
  label: string;
  hint?: string;
}

export function StatStrip({
  items,
  C,
  innerRef,
  testID,
}: {
  items: StatStripItem[];
  /** Palette, passed in by callers that already have it to avoid a second hook
   *  call inside a list. Omit and it resolves its own. */
  C?: ReturnType<typeof useColors>;
  innerRef?: React.RefObject<View | null>;
  testID?: string;
}) {
  const own = useColors();
  const colors = C ?? own;
  return (
    <View
      ref={innerRef}
      collapsable={false}
      testID={testID}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.borderLight,
        alignItems: 'center',
      }}
    >
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <View style={{ width: 1, height: 32, backgroundColor: colors.border }} />}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
              <Text style={{ fontSize: 26, fontFamily: 'Inter_700Bold', color: colors.primaryText }}>
                {item.value}
              </Text>
              {item.hint ? (
                <Text
                  style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primaryText }}
                >
                  {item.hint}
                </Text>
              ) : null}
            </View>
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Inter_500Medium',
                color: colors.textSecondary,
                marginTop: 2,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}
