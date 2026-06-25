import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SectionList,
  Modal,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';
import { useAppStore } from '@/lib/store';
import {
  BADGE_CATALOG,
  BADGE_CATEGORY_LABELS,
  BADGE_CATEGORY_ORDER,
  Badge,
  BadgeCategory,
  BadgeCriteriaType,
} from '@/lib/badges';

type FilterTab = 'all' | 'earned' | 'locked';

const CRITERIA_HINTS: Record<BadgeCriteriaType, string> = {
  session_count:      'Complete more sessions to unlock this.',
  streak_days:        'Train on consecutive days to build your streak.',
  strength_orm:       'Hit a new 1RM on a test week to unlock this.',
  cumulative_volume:  'Keep logging sets — volume adds up over time.',
  session_type_count: 'Complete more sessions of this type.',
  consistency_habit:  'Train regularly each week to build this habit.',
  goal_progress:      'Keep training toward your selected goals.',
  profile_action:     'Update your profile to unlock this.',
  equipment_usage:    'Use different equipment tiers in your sessions.',
  test_week:          'Complete a 1RM test week to unlock this.',
  time_based:         'Train at a consistent time of day.',
  variety:            'Mix up your session types — try them all.',
  recovery:           'Add prehab or flexibility sessions to your routine.',
  duration_based:     'Complete a longer session (45 or 60 min) to unlock.',
  comeback:           'Come back after a break and train again.',
  session_volume:     'Log heavy sets to hit the volume target for this.',
  heavy_set:          'Log a heavy weight on any exercise set.',
  pain_adaptation:    'Complete sessions while managing a pain region.',
  low_energy:         'Log a session even on a low-energy day.',
};

const COLS = 4;

export default function AchievementsScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { earnedBadges } = useAppStore();
  const earnedSet = useMemo(() => new Set(earnedBadges), [earnedBadges]);

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [detailBadge, setDetailBadge] = useState<Badge | null>(null);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  // Build sections grouped by category, filtered by earned state
  const sections = useMemo(() => {
    const byCategory = new Map<BadgeCategory, Badge[]>();
    for (const b of BADGE_CATALOG) {
      const list = byCategory.get(b.category) ?? [];
      list.push(b);
      byCategory.set(b.category, list);
    }
    return BADGE_CATEGORY_ORDER
      .filter(cat => byCategory.has(cat))
      .map(cat => {
        const all = byCategory.get(cat)!;
        const filtered = activeFilter === 'all'
          ? all
          : activeFilter === 'earned'
            ? all.filter(b => earnedSet.has(b.id))
            : all.filter(b => !earnedSet.has(b.id));
        const earnedCount = all.filter(b => earnedSet.has(b.id)).length;
        return { title: cat, data: filtered, earnedCount, totalCount: all.length };
      })
      .filter(s => s.data.length > 0);
  }, [activeFilter, earnedSet]);

  const totalEarned = earnedBadges.length;
  const totalBadges = BADGE_CATALOG.length;

  const handleBadgePress = (badge: Badge) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDetailBadge(badge);
  };

  const styles = useMemo(() => makeStyles(C), [C]);

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all',    label: 'All' },
    { key: 'earned', label: 'Earned' },
    { key: 'locked', label: 'Locked' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          testID="achievements-back"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Achievements</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{totalEarned}/{totalBadges}</Text>
        </View>
      </View>

      {/* Filter tabs: All / Earned / Locked */}
      <View style={styles.filterBar}>
        {filterTabs.map(tab => {
          const active = activeFilter === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveFilter(tab.key);
              }}
              style={[styles.filterTab, active && styles.filterTabActive]}
              testID={`achievements-filter-${tab.key}`}
            >
              <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Badge sections */}
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: C.background }]}>
            <Text style={styles.sectionTitle}>
              {BADGE_CATEGORY_LABELS[section.title as BadgeCategory]}
            </Text>
            <Text style={styles.sectionCount}>
              {section.earnedCount}/{section.totalCount}
            </Text>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const sectionData = section.data as Badge[];
          const isRowStart = index % COLS === 0;
          if (!isRowStart) return null;

          const rowItems = sectionData.slice(index, index + COLS);

          return (
            <View style={styles.badgeRow}>
              {rowItems.map(badge => {
                const isEarned = earnedSet.has(badge.id);
                return (
                  <Pressable
                    key={badge.id}
                    onPress={() => handleBadgePress(badge)}
                    style={({ pressed }) => [
                      styles.badgeCell,
                      pressed && { opacity: 0.72 },
                    ]}
                    testID={`badge-${badge.id}`}
                  >
                    <View
                      style={[
                        styles.badgeIconWrap,
                        isEarned
                          ? { backgroundColor: badge.color + '22', borderColor: badge.color + '55' }
                          : { backgroundColor: C.surfaceSecondary, borderColor: C.borderLight },
                        !isEarned && styles.badgeIconLocked,
                      ]}
                    >
                      <Ionicons
                        name={badge.icon as any}
                        size={20}
                        color={isEarned ? badge.color : C.textTertiary}
                      />
                      {!isEarned && (
                        <View style={styles.lockOverlay}>
                          <Ionicons name="lock-closed" size={9} color={C.textTertiary} />
                        </View>
                      )}
                    </View>
                    <Text
                      style={[styles.badgeName, !isEarned && styles.badgeNameLocked]}
                      numberOfLines={2}
                    >
                      {badge.name}
                    </Text>
                    {isEarned && <View style={[styles.earnedDot, { backgroundColor: badge.color }]} />}
                  </Pressable>
                );
              })}
              {rowItems.length < COLS &&
                Array.from({ length: COLS - rowItems.length }).map((_, i) => (
                  <View key={`pad-${i}`} style={styles.badgeCell} />
                ))}
            </View>
          );
        }}
      />

      {/* Badge detail sheet */}
      {detailBadge && (
        <Modal
          visible={!!detailBadge}
          transparent
          animationType="slide"
          onRequestClose={() => setDetailBadge(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setDetailBadge(null)} />
          <View
            style={[
              styles.detailSheet,
              { paddingBottom: insets.bottom + 24, backgroundColor: C.surface },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
            <View style={styles.detailContent}>
              {/* Large icon */}
              <View
                style={[
                  styles.detailIconWrap,
                  earnedSet.has(detailBadge.id)
                    ? { backgroundColor: detailBadge.color + '22', borderColor: detailBadge.color + '55' }
                    : { backgroundColor: C.surfaceSecondary, borderColor: C.borderLight },
                ]}
              >
                <Ionicons
                  name={detailBadge.icon as any}
                  size={40}
                  color={earnedSet.has(detailBadge.id) ? detailBadge.color : C.textTertiary}
                />
                {!earnedSet.has(detailBadge.id) && (
                  <View style={styles.detailLockOverlay}>
                    <Ionicons name="lock-closed" size={14} color={C.textTertiary} />
                  </View>
                )}
              </View>

              {/* Name */}
              <Text style={[styles.detailName, { color: C.text }]}>{detailBadge.name}</Text>

              {/* Earned / Locked status pill */}
              <View
                style={[
                  styles.detailStatusPill,
                  earnedSet.has(detailBadge.id)
                    ? { backgroundColor: detailBadge.color + '22', borderColor: detailBadge.color + '55' }
                    : { backgroundColor: C.surfaceSecondary, borderColor: C.borderLight },
                ]}
              >
                <Ionicons
                  name={earnedSet.has(detailBadge.id) ? 'checkmark-circle' : 'lock-closed-outline'}
                  size={13}
                  color={earnedSet.has(detailBadge.id) ? detailBadge.color : C.textTertiary}
                />
                <Text
                  style={[
                    styles.detailStatusText,
                    { color: earnedSet.has(detailBadge.id) ? detailBadge.color : C.textTertiary },
                  ]}
                >
                  {earnedSet.has(detailBadge.id) ? 'Earned' : 'Locked'}
                </Text>
              </View>

              {/* Description */}
              <Text style={[styles.detailDesc, { color: C.textSecondary }]}>
                {detailBadge.description}
              </Text>

              {/* Locked hint */}
              {!earnedSet.has(detailBadge.id) && (
                <View style={[styles.hintBox, { backgroundColor: C.surfaceSecondary, borderColor: C.borderLight }]}>
                  <Ionicons name="information-circle-outline" size={15} color={C.primary} />
                  <Text style={[styles.hintText, { color: C.textSecondary }]}>
                    {CRITERIA_HINTS[detailBadge.criteriaType]}
                  </Text>
                </View>
              )}

              {/* Category */}
              <Text style={[styles.detailCategory, { color: C.textTertiary }]}>
                {BADGE_CATEGORY_LABELS[detailBadge.category]}
              </Text>
            </View>
            <Pressable
              onPress={() => setDetailBadge(null)}
              style={({ pressed }) => [
                styles.detailCloseBtn,
                { backgroundColor: C.primary },
                pressed && { opacity: 0.86 },
              ]}
              testID="badge-detail-close"
            >
              <Text style={[styles.detailCloseBtnText, { color: C.textInverse }]}>Done</Text>
            </Pressable>
          </View>
        </Modal>
      )}
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 14,
      gap: 12,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.surfaceSecondary,
    },
    headerTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text },
    countPill: {
      backgroundColor: C.primaryMuted,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: C.primary + '40',
    },
    countPillText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary },

    filterBar: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingBottom: 12,
      gap: 8,
    },
    filterTab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    filterTabActive: {
      backgroundColor: C.primaryMuted,
      borderColor: C.primary + '55',
    },
    filterTabText: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    filterTabTextActive: {
      color: C.primary,
      fontFamily: 'Inter_700Bold',
    },

    listContent: {
      paddingHorizontal: 16,
      paddingTop: 4,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 16,
      paddingBottom: 8,
      paddingHorizontal: 4,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
    },
    sectionCount: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
    },

    badgeRow: {
      flexDirection: 'row',
      marginBottom: 2,
    },
    badgeCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 2,
    },
    badgeIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      marginBottom: 5,
      position: 'relative',
    },
    badgeIconLocked: {
      opacity: 0.55,
    },
    lockOverlay: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeName: {
      fontSize: 9,
      fontFamily: 'Inter_500Medium',
      color: C.text,
      textAlign: 'center',
      lineHeight: 12,
    },
    badgeNameLocked: {
      color: C.textTertiary,
    },
    earnedDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      marginTop: 3,
    },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    detailSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingHorizontal: 24,
    },
    sheetHandle: {
      width: 36, height: 4, borderRadius: 2,
      alignSelf: 'center', marginBottom: 24,
    },
    detailContent: {
      alignItems: 'center',
      gap: 10,
      paddingBottom: 8,
    },
    detailIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      marginBottom: 4,
      position: 'relative',
    },
    detailLockOverlay: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: C.surface,
      borderWidth: 1.5,
      borderColor: C.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailName: {
      fontSize: 22,
      fontFamily: 'Inter_700Bold',
      textAlign: 'center',
    },
    detailStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderWidth: 1,
    },
    detailStatusText: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
    },
    detailDesc: {
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
      textAlign: 'center',
      lineHeight: 22,
      marginTop: 4,
    },
    hintBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      alignSelf: 'stretch',
    },
    hintText: {
      flex: 1,
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      lineHeight: 19,
    },
    detailCategory: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 2,
    },
    detailCloseBtn: {
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    detailCloseBtnText: {
      fontSize: 16,
      fontFamily: 'Inter_700Bold',
    },
  });
}
