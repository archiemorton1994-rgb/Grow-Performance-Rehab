import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Platform, Image } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, AppColors } from '@/constants/colors';
import { useAppStore, CompletedSession } from '@/lib/store';
import { getSessionImage } from '@/lib/session-images';
import { getSessionLabel } from '@/lib/workout-engine';
import { formatDate, formatWeight } from '@/lib/utils';

const WEB_TOP_INSET = 67;
const WEB_BOTTOM_INSET = 34;

function formatDuration(seconds: number): string {
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 60) return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function topWeightKg(session: CompletedSession): number {
  let max = 0;
  for (const log of session.exerciseLogs) {
    for (const set of log.sets) {
      if (set.completed && !set.skipped && set.weight > max) max = set.weight;
    }
  }
  return max;
}

export default function PastSessionsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C), [C]);
  const completedSessions = useAppStore((s) => s.completedSessions);
  const weightUnit = useAppStore((s) => s.weightUnit);
  const sex = useAppStore((s) => s.userProfile?.sex);
  const topPad = Platform.OS === 'web' ? WEB_TOP_INSET : insets.top;
  const bottomPad = Platform.OS === 'web' ? WEB_BOTTOM_INSET : insets.bottom;
  const total = completedSessions.length;

  const renderItem = ({ item }: { item: CompletedSession }) => {
    const tw = topWeightKg(item);
    const duration =
      item.durationSeconds && item.durationSeconds > 0
        ? formatDuration(item.durationSeconds)
        : null;

    return (
      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/session-summary', params: { sessionId: item.id } });
        }}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        testID={`past-session-${item.id}`}
      >
        <View style={styles.iconBadge}>
          <Image
            source={getSessionImage(item.sessionType, sex)}
            style={styles.iconBadgeImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.rowMid}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.displayLabel ?? getSessionLabel(item.sessionType)}
            {item.isTestWeek ? '  · Test Week' : ''}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {formatDate(item.date)}
            {duration ? ` · ${duration}` : ''}
            {tw > 0 ? ` · ${formatWeight(tw, weightUnit)}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad + 10 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          testID="past-sessions-back"
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Session History</Text>
        </View>
        {total > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{total}</Text>
          </View>
        )}
      </View>

      {total === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="calendar-outline" size={44} color={C.textTertiary} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyText}>
            Complete your first workout and it&apos;ll show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={completedSessions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: bottomPad + 24,
          }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 12,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
    countPill: {
      backgroundColor: C.primaryMuted,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
      minWidth: 34,
      alignItems: 'center',
    },
    countPillText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    iconBadge: {
      width: 44,
      height: 44,
      borderRadius: 12,
      overflow: 'hidden',
    },
    iconBadgeImage: { width: '100%' as any, height: '100%' as any },
    rowMid: { flex: 1, gap: 3 },
    rowTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text },
    rowMeta: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      gap: 6,
    },
    emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: C.text, marginTop: 6 },
    emptyText: {
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
