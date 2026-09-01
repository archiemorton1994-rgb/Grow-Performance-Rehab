/**
 * COMPLETED PROGRAMMES: where the finished blocks are kept.
 *
 * A report you can only read once, on the day you earn it, is not a record. This
 * is the shelf it goes on: every block anybody has finished, newest first, each
 * one opening its own frozen report.
 *
 * It fills up slowly on purpose. Nothing is backfilled from history - the app
 * could look at somebody with ninety sessions and manufacture seven blocks they
 * were never on, and every number in those reports would be a guess dressed up
 * as a record. The first entry here is the first block somebody actually
 * finishes, which is exactly what makes the shelf worth having.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useColors } from '@/constants/colors';
import { useAppStore } from '@/lib/store';
import { SESSION_SHORT_LABELS } from '@/lib/session-meta';
import { formatWeight, kgToDisplayUnit } from '@/lib/utils';

const WEB_TOP_INSET = 67;
const WEB_BOTTOM_INSET = 34;

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

export default function CompletedProgrammesScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const completedProgrammes = useAppStore((s) => s.completedProgrammes);
  const weightUnit = useAppStore((s) => s.weightUnit);
  const styles = useMemo(() => makeStyles(C), [C]);

  const topPad = Platform.OS === 'web' ? WEB_TOP_INSET : insets.top;
  const bottomPad = Platform.OS === 'web' ? WEB_BOTTOM_INSET : insets.bottom;

  // Newest first, without mutating the store's array, which is kept oldest
  // first so the union in mergeServerData has a stable order to sort into.
  const blocks = useMemo(
    () => [...completedProgrammes].reverse(),
    [completedProgrammes]
  );

  /** What every block in here adds up to. The reason the shelf exists. */
  const lifetime = useMemo(() => {
    let sessions = 0;
    let volumeKg = 0;
    let minutes = 0;
    for (const b of blocks) {
      sessions += b.report.onPlan + b.report.offPlan;
      volumeKg += b.report.volumeKg;
      minutes += b.report.minutesTrained;
    }
    return { sessions, volumeKg, hours: Math.round(minutes / 60) };
  }, [blocks]);

  return (
    <View style={[styles.screen, { paddingTop: topPad }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          testID="completed-programmes-back"
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Completed Programmes</Text>
        {blocks.length > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{blocks.length}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
        testID="completed-programmes"
      >
        {blocks.length === 0 ? (
          <View style={styles.empty} testID="completed-programmes-empty">
            <Ionicons name="albums-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>Nothing finished yet</Text>
            <Text style={styles.emptyBody}>
              Finish a block and it is written up here for good: what you did, what moved, and
              what it changed. Blocks you were part way through when this arrived are not counted
              back, so the first one here will be a real one.
            </Text>
            <Pressable
              onPress={() => router.replace('/program')}
              style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}
              testID="completed-programmes-open-hub"
            >
              <Text style={styles.emptyBtnText}>Open your programme</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.lifetime} testID="completed-lifetime">
              <View style={styles.lifetimeStat}>
                <Text style={styles.lifetimeValue}>{blocks.length}</Text>
                <Text style={styles.lifetimeLabel}>
                  {blocks.length === 1 ? 'block finished' : 'blocks finished'}
                </Text>
              </View>
              <View style={styles.lifetimeStat}>
                <Text style={styles.lifetimeValue}>{lifetime.sessions}</Text>
                <Text style={styles.lifetimeLabel}>sessions in them</Text>
              </View>
              <View style={styles.lifetimeStat}>
                <Text style={styles.lifetimeValue}>
                  {lifetime.volumeKg > 0
                    ? Math.round(kgToDisplayUnit(lifetime.volumeKg, weightUnit)).toLocaleString()
                    : lifetime.hours}
                </Text>
                <Text style={styles.lifetimeLabel}>
                  {lifetime.volumeKg > 0 ? `${weightUnit} moved` : 'hours trained'}
                </Text>
              </View>
            </View>

            {blocks.map((b) => {
              const headline =
                b.report.movers[0] && b.report.movers[0].deltaKg > 0
                  ? `Best gain: ${b.report.movers[0].exerciseName}, up ${formatWeight(b.report.movers[0].deltaKg, weightUnit)}`
                  : b.report.volumeKg > 0
                    ? `${Math.round(kgToDisplayUnit(b.report.volumeKg, weightUnit)).toLocaleString()} ${weightUnit} moved`
                    : `${b.report.totalSets} sets logged`;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => {
                    if (Platform.OS !== 'web')
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/programme-report', params: { id: b.id } });
                  }}
                  testID={`completed-block-${b.id}`}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {b.name}
                      </Text>
                      <Text style={styles.cardWhen}>
                        {monthYear(b.startedAt)}
                        {monthYear(b.startedAt) === monthYear(b.finishedAt)
                          ? ''
                          : ` to ${monthYear(b.finishedAt)}`}
                        {' · '}
                        {b.report.onPlan} of {b.sessions} sessions
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
                  </View>

                  {/* The cycle it ran, so two blocks of the same name are still
                      told apart - somebody can build two custom programmes and
                      call them both Winter. */}
                  <Text style={styles.cardCycle} numberOfLines={1}>
                    {b.cycle.map((t) => SESSION_SHORT_LABELS[t]).join(' · ')}
                  </Text>
                  <Text style={styles.cardHeadline} numberOfLines={1}>
                    {headline}
                  </Text>

                  {b.report.step.earned && (
                    <View style={styles.cardStep}>
                      <Ionicons name="trending-up" size={12} color={C.primaryText} />
                      <Text style={styles.cardStepText}>Earned a step up</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingBottom: 10,
      gap: 8,
    },
    backBtn: { padding: 4 },
    topBarTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
    countPill: {
      minWidth: 26,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 9,
      backgroundColor: C.surfaceSecondary,
      alignItems: 'center',
    },
    countPillText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.textSecondary },

    scroll: { paddingHorizontal: 16, gap: 12 },

    lifetime: {
      flexDirection: 'row',
      backgroundColor: C.surfaceSecondary,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      paddingVertical: 14,
    },
    lifetimeStat: { flex: 1, alignItems: 'center', gap: 2 },
    lifetimeValue: {
      fontSize: 21,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      fontVariant: ['tabular-nums'],
    },
    lifetimeLabel: {
      fontSize: 10,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
      textAlign: 'center',
    },

    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: 15,
      gap: 6,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text, letterSpacing: -0.3 },
    cardWhen: { marginTop: 2, fontSize: 11.5, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    cardCycle: { fontSize: 11.5, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    cardHeadline: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: C.text },
    cardStep: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 2,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 7,
      backgroundColor: C.primaryMuted,
    },
    cardStepText: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: C.primaryText },

    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 12, gap: 10 },
    emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
    emptyBody: {
      fontSize: 13,
      lineHeight: 19,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
    },
    emptyBtn: {
      marginTop: 10,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.border,
    },
    emptyBtnText: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: C.text },
  });
