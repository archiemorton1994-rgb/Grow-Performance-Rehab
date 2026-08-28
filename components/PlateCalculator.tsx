import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors, { useColors, PLATE_COLORS } from '@/constants/colors';
import { calculatePlates, groupPlates, BAR_WEIGHT } from '@/lib/plate-math';
import type { WeightUnit } from '@/lib/store';

/**
 * What to actually put on the bar.
 *
 * The app has always told people to lift 87.5 kg and never once told them that
 * is a 20 kg bar with 15, 15, 2.5 and 1.25 a side. It is easy arithmetic and
 * everybody gets it wrong occasionally, usually while tired and mid-session.
 *
 * Drawn rather than listed: a column of numbers is another thing to decode, and
 * the plates on a real bar go biggest-to-smallest outwards from the collar,
 * which is what this shows. Heights are proportional to real plate diameters so
 * the picture matches what you are about to pick up.
 */

/** Relative plate heights, keyed by weight. Roughly true to real diameters. */
const PLATE_HEIGHT: Record<number, number> = {
  25: 74,
  20: 70,
  15: 62,
  10: 54,
  5: 44,
  2.5: 36,
  1.25: 30,
  45: 74,
  35: 66,
};

export function PlateCalculator({
  visible,
  onClose,
  targetKg,
  weightUnit,
  exerciseName,
}: {
  visible: boolean;
  onClose: () => void;
  /** Always kg — the app's canonical unit. Converted for display below. */
  targetKg: number;
  weightUnit: WeightUnit;
  exerciseName: string;
}) {
  const C = useColors();
  const target =
    weightUnit === 'lbs' ? Math.round(targetKg * 2.20462 * 10) / 10 : targetKg;
  const plan = calculatePlates(target, weightUnit);
  const groups = groupPlates(plan.perSide);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: C.surface, borderColor: C.borderLight }]}
          onPress={(e) => e.stopPropagation()}
          testID="plate-calculator"
        >
          <Text style={[styles.name, { color: C.textSecondary }]} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text style={[styles.target, { color: C.text }]}>
            {target} {weightUnit}
          </Text>

          {plan.belowBar ? (
            <Text style={[styles.note, { color: C.textSecondary }]}>
              That is at or below an empty {BAR_WEIGHT[weightUnit]} {weightUnit} bar.
            </Text>
          ) : (
            <>
              {/* The bar, then the plates going outwards — the order you load them. */}
              <View style={styles.barRow}>
                <View style={[styles.collar, { backgroundColor: C.border }]} />
                {plan.perSide.length === 0 ? (
                  <Text style={[styles.note, { color: C.textSecondary, marginLeft: 10 }]}>
                    Empty bar
                  </Text>
                ) : (
                  plan.perSide.map((w, i) => (
                    <View
                      key={`${w}-${i}`}
                      style={[
                        styles.plate,
                        {
                          height: PLATE_HEIGHT[w] ?? 40,
                          backgroundColor: PLATE_COLORS[w] ?? C.textTertiary,
                          borderColor: C.borderLight,
                        },
                      ]}
                    >
                      {/* The 5 kg plate is white, so white-on-white is nothing.
                          C.text rather than a literal: this one IS a text
                          colour and belongs to the theme, even though the plate
                          under it does not. */}
                      <Text style={[styles.plateText, w === 5 && { color: Colors.text }]}>
                        {w}
                      </Text>
                    </View>
                  ))
                )}
              </View>
              <Text style={[styles.perSide, { color: C.textTertiary }]}>per side</Text>

              <ScrollView style={{ maxHeight: 130 }} showsVerticalScrollIndicator={false}>
                <View style={[styles.summary, { borderColor: C.borderLight }]}>
                  <View style={styles.row}>
                    <Text style={[styles.rowLabel, { color: C.textSecondary }]}>Bar</Text>
                    <Text style={[styles.rowValue, { color: C.text }]}>
                      {plan.bar} {weightUnit}
                    </Text>
                  </View>
                  {groups.map((g) => (
                    <View key={g.weight} style={styles.row}>
                      <Text style={[styles.rowLabel, { color: C.textSecondary }]}>
                        {g.weight} {weightUnit}
                      </Text>
                      <Text style={[styles.rowValue, { color: C.text }]}>
                        ×{g.count} a side
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Not every number is loadable. Saying so beats silently rounding
                  and letting someone wonder why the maths does not work. */}
              {plan.shortfall > 0 && (
                <View style={[styles.shortfall, { backgroundColor: C.surfaceTertiary }]}>
                  <Ionicons name="information-circle-outline" size={14} color={C.textSecondary} />
                  <Text style={[styles.shortfallText, { color: C.textSecondary }]}>
                    Closest you can load is {plan.achievable} {weightUnit}, which is {plan.shortfall}{' '}
                    {weightUnit} under.
                  </Text>
                </View>
              )}
            </>
          )}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.done,
              { backgroundColor: C.primaryDark },
              pressed && { opacity: 0.9 },
            ]}
            testID="plate-calculator-close"
          >
            <Text style={[styles.doneText, { color: C.primaryDarkText }]}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { width: '100%', borderRadius: 20, borderWidth: 1, padding: 18, gap: 4 },
  name: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  note: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  target: { fontSize: 32, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 80,
    marginBottom: 2,
  },
  collar: { width: 22, height: 12, borderRadius: 3 },
  plate: {
    width: 15,
    marginLeft: 3,
    borderRadius: 3,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#ffffff',
    transform: [{ rotate: '-90deg' }],
    width: 30,
    textAlign: 'center',
  },
  perSide: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 12 },
  summary: { borderTopWidth: 1, paddingTop: 10, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  rowValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  shortfall: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
    borderRadius: 8,
    padding: 9,
    marginTop: 10,
  },
  shortfallText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  done: { borderRadius: 13, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  doneText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
