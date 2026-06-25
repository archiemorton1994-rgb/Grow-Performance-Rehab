import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SectionList,
  Modal,
  ScrollView,
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
} from '@/lib/badges';

const ALL_FILTER = '__all__';

export default function AchievementsScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { earnedBadges } = useAppStore();
  const earnedSet = useMemo(() => new Set(earnedBadges), [earnedBadges]);

  const [activeCategory, setActiveCategory] = useState<BadgeCategory | typeof ALL_FILTER>(ALL_FILTER);
  const [detailBadge, setDetailBadge] = useState<Badge | null>(null);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  // Build sections grouped by category, filtered by active category
  const sections = useMemo(() => {
    const byCategory = new Map<BadgeCategory, Badge[]>();
    for (const b of BADGE_CATALOG) {
      const existing = byCategory.get(b.category) ?? [];
      existing.push(b);
      byCategory.set(b.category, existing);
    }
    const cats = activeCategory === ALL_FILTER
      ? BADGE_CATEGORY_ORDER
      : [activeCategory as BadgeCategory];
    return cats
      .filter(cat => byCategory.has(cat))
      .map(cat => {
        const all = byCategory.get(cat)!;
        const earned = all.filter(b => earnedSet.has(b.id));
        return { title: cat, data: all, earnedCount: earned.length };
      });
  }, [activeCategory, earnedSet]);

  const totalEarned = earnedBadges.length;
  const totalBadges = BADGE_CATALOG.length;

  const handleBadgePress = (badge: Badge) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDetailBadge(badge);
  };

  const styles = useMemo(() => makeStyles(C), [C]);

  const filterCategories = useMemo<(BadgeCategory | typeof ALL_FILTER)[]>(
    () => [ALL_FILTER, ...BADGE_CATEGORY_ORDER],
    []
  );

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

      {/* Category filter bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        style={styles.filterScroll}
      >
        {filterCategories.map(cat => {
          const active = activeCategory === cat;
          const label = cat === ALL_FILTER ? 'All' : BADGE_CATEGORY_LABELS[cat as BadgeCategory];
          return (
            <Pressable
              key={cat}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveCategory(cat);
              }}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Badge sections */}
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {BADGE_CATEGORY_LABELS[section.title as BadgeCategory]}
            </Text>
            <Text style={styles.sectionCount}>
              {section.earnedCount}/{section.data.length}
            </Text>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const sectionData = section.data as Badge[];
          const isRowFirst = index % 3 === 0;

          if (!isRowFirst) return null;

          const rowItems = sectionData.slice(index, index + 3);

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
                      pressed && { opacity: 0.75 },
                    ]}
                    testID={`badge-${badge.id}`}
                  >
                    <View
                      style={[
                        styles.badgeIcon,
                        isEarned
                          ? { backgroundColor: badge.color + '22', borderColor: badge.color + '55' }
                          : { backgroundColor: C.surfaceSecondary, borderColor: C.borderLight },
                      ]}
                    >
                      <Ionicons
                        name={badge.icon as any}
                        size={22}
                        color={isEarned ? badge.color : C.textTertiary}
                      />
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
              {rowItems.length < 3 &&
                Array.from({ length: 3 - rowItems.length }).map((_, i) => (
                  <View key={`empty-${i}`} style={styles.badgeCell} />
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
              {/* Icon */}
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
              </View>
              {/* Name + status */}
              <Text style={[styles.detailName, { color: C.text }]}>{detailBadge.name}</Text>
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

    filterScroll: { flexGrow: 0 },
    filterBar: {
      paddingHorizontal: 20,
      paddingBottom: 14,
      gap: 8,
      flexDirection: 'row',
    },
    filterChip: {
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    filterChipActive: {
      backgroundColor: C.primaryMuted,
      borderColor: C.primary + '55',
    },
    filterChipText: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    filterChipTextActive: {
      color: C.primary,
      fontFamily: 'Inter_600SemiBold',
    },

    listContent: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 18,
      paddingBottom: 10,
    },
    sectionTitle: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
    },
    sectionCount: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
    },

    badgeRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    badgeCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    badgeIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      marginBottom: 6,
    },
    badgeName: {
      fontSize: 10,
      fontFamily: 'Inter_500Medium',
      color: C.text,
      textAlign: 'center',
      lineHeight: 13,
    },
    badgeNameLocked: {
      color: C.textTertiary,
    },
    earnedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 4,
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
    detailCategory: {
      fontSize: 12,
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
