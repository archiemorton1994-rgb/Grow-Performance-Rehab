import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Modal,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';
import { shadowStyle } from '@/constants/shadows';
import { EmptyState } from '@/components/EmptyState';
import { BadgeMedallion } from '@/components/BadgeMedallion';
import { useAppStore } from '@/lib/store';
import {
  BADGE_CATALOG,
  BADGE_CATEGORY_LABELS,
  BADGE_CATEGORY_ORDER,
  BADGE_MAP,
  Badge,
  BadgeCategory,
  BadgeCriteriaType,
  BadgeTier,
  BADGE_TIER_COLORS,
  BADGE_TIER_LABELS,
} from '@/lib/badges';

type FilterTab = 'all' | 'earned' | 'locked';

const CRITERIA_HINTS: Record<BadgeCriteriaType, string> = {
  session_count: 'Complete more sessions to unlock this.',
  streak_weeks: 'Train consistently each week to build your streak.',
  strength_improvement: 'Log 1RMs across multiple test weeks to track progress.',
  session_type_count: 'Complete more sessions of this type.',
  consistency_habit: 'Train regularly each week to build this habit.',
  goal_progress: 'Keep training toward your selected goals.',
  profile_action: 'Awarded when you complete your first-look tour of the app.',
  equipment_usage: 'Use different equipment tiers in your sessions.',
  test_week: 'Complete a 1RM test week to unlock this.',
  time_based: 'Train at a consistent time of day.',
  variety: 'Mix up your session types and work through them all.',
  recovery: 'Add prehab or flexibility sessions to your routine.',
  // Not "(45 or 60 min)". Quick & Dirty is duration_based and wants thirty
  // minute sessions, so that hint contradicted the description printed two
  // lines above it. This says where the answer is set instead.
  duration_based: 'Session length is chosen on the readiness screen, before you start.',
  comeback: 'Come back after a break and train again.',
  pain_adaptation: 'Complete sessions while managing a pain region.',
  low_energy: 'Log a session even on a low-energy day.',
  exercise_specific: 'Log this specific exercise in one of your sessions.',
};

// A cabinet, not a spreadsheet. The previous layout put 277 badges into a
// four-across grid of 48px tiles with 9pt captions, which meant ~70 rows of
// vertical scroll and no badge ever shown large enough to look like anything.
// Each family now gets a shelf you scroll sideways, so a medallion can be big
// enough to read and the whole collection is ~22 rows deep instead of 70.
const SHELF_MEDAL = 62;
const SHELF_ITEM_W = 78;
const HERO_MEDAL = 92;
const DETAIL_MEDAL = 124;

// ─── Tour overlay callout ──────────────────────────────────────────────────────

function TourCallout({ onDismiss }: { onDismiss: () => void }) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: fadeAnim, zIndex: 100 }]}
      pointerEvents="box-none"
    >
      {/* Semi-transparent backdrop */}
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.52)' }} onPress={handleDismiss} />

      {/* Callout card anchored at the bottom */}
      <View
        style={[
          tourStyles.calloutCard,
          {
            backgroundColor: C.surface,
            borderColor: C.borderLight,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        {/* Handle */}
        <View style={[tourStyles.handle, { backgroundColor: C.border }]} />

        {/* Icon + heading */}
        <View style={tourStyles.calloutHeader}>
          <View style={[tourStyles.calloutIconBadge, { backgroundColor: C.primarySurface }]}>
            <Ionicons name="trophy" size={20} color={C.primaryText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[tourStyles.calloutLabel, { color: C.textTertiary }]}>Achievements</Text>
            <Text style={[tourStyles.calloutHeadline, { color: C.text }]}>
              Your real badge collection
            </Text>
          </View>
        </View>

        {/* Body */}
        <Text style={[tourStyles.calloutBody, { color: C.textSecondary }]}>
          Every badge is struck in one of four metals, and the metal tells you how rare it is.
          Locked ones stay grey until you earn them.
        </Text>

        {/* Tips */}
        <View style={{ gap: 7 }}>
          {[
            `${BADGE_CATALOG.length} badges across milestones, streaks, strength, and more`,
            'Swipe a shelf sideways to see the rest of that family',
            'Tap any badge to see exactly what unlocks it',
          ].map((tip, i) => (
            <View key={i} style={tourStyles.tipRow}>
              <Ionicons name="checkmark-circle" size={15} color={C.primaryText} />
              <Text style={[tourStyles.tipText, { color: C.textSecondary }]}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Got it button */}
        <Pressable
          onPress={handleDismiss}
          style={({ pressed }) => [
            tourStyles.gotItBtn,
            { backgroundColor: C.primary },
            pressed && { opacity: 0.86 },
          ]}
          testID="achievements-tour-got-it"
        >
          <Text style={[tourStyles.gotItText, { color: C.textInverse }]}>Got it</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const tourStyles = StyleSheet.create({
  calloutCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 10,
    gap: 14,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  calloutIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  calloutHeadline: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginTop: 2,
    lineHeight: 23,
  },
  calloutBody: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 21,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  gotItBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  gotItText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
});

// ─── One family's shelf ────────────────────────────────────────────────────────

interface Shelf {
  category: BadgeCategory;
  data: Badge[];
  earnedCount: number;
  totalCount: number;
}

function BadgeShelf({
  shelf,
  earnedSet,
  onPress,
  styles,
}: {
  shelf: Shelf;
  earnedSet: Set<string>;
  onPress: (b: Badge) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHeader}>
        <Text style={styles.shelfTitle}>{BADGE_CATEGORY_LABELS[shelf.category]}</Text>
        <Text style={styles.shelfCount}>
          {shelf.earnedCount}/{shelf.totalCount}
        </Text>
      </View>
      <FlatList
        data={shelf.data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.shelfRow}
        initialNumToRender={6}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: SHELF_ITEM_W,
          offset: SHELF_ITEM_W * index,
          index,
        })}
        renderItem={({ item }) => {
          const isEarned = earnedSet.has(item.id);
          return (
            <Pressable
              onPress={() => onPress(item)}
              style={({ pressed }) => [styles.shelfItem, pressed && { opacity: 0.7 }]}
              testID={`badge-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${isEarned ? 'earned' : 'locked'}`}
            >
              {/* No cast shadow on shelf medals. The medallion carries its own
                  rim and gloss shading, and an elevation on a transparent view
                  wrapping an SVG behaves differently on every platform. */}
              <BadgeMedallion
                category={item.category}
                tier={item.tier}
                badgeId={item.id}
                locked={!isEarned}
                size={SHELF_MEDAL}
              />
              <Text
                style={[styles.shelfItemName, !isEarned && styles.shelfItemNameLocked]}
                numberOfLines={2}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

export default function AchievementsScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();

  const { earnedBadges, testWeekFrequency, setTestWeekFrequency } = useAppStore();

  /**
   * Twenty of the 277 badges need a barbell test week or a 1RM improvement, and
   * five more are worded around squat/bench/deadlift. For someone who has
   * turned test weeks OFF, those twenty-five are unreachable — and the locked
   * hint told them to "Complete a 1RM test week to unlock this", which is the
   * app instructing them to do the exact thing they declined.
   *
   * Two changes, both small and both deliberate about what they do NOT do:
   *
   *   - The badges stay visible. Hiding them would mean the cabinet silently
   *     changed size when the setting changed, and someone who turns test weeks
   *     back on should not have twenty-five badges appear from nowhere.
   *   - The denominator excludes them, so "12 of 252" is a total that can
   *     actually be reached. A progress bar with an unreachable maximum is a
   *     progress bar that can never fill.
   *
   * And the hint becomes an offer rather than an instruction, because the
   * honest answer to "how do I get this" is "turn test weeks on, if you want
   * to" — not "do a test week".
   */
  const testsOff = testWeekFrequency === 'never';
  const isKpiLocked = useCallback(
    (b: Badge) =>
      testsOff && (b.criteriaType === 'test_week' || b.criteriaType === 'strength_improvement'),
    [testsOff]
  );
  const earnedSet = useMemo(() => new Set(earnedBadges), [earnedBadges]);
  const params = useLocalSearchParams<{ tour?: string }>();
  const isTourMode = params.tour === '1';
  const [tourOverlayVisible, setTourOverlayVisible] = useState(isTourMode);

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [detailBadge, setDetailBadge] = useState<Badge | null>(null);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleTourDismiss = () => {
    setTourOverlayVisible(false);
    router.back();
  };

  // One shelf per family, in the catalogue's own order (which is difficulty
  // order, so the left of every shelf is the easiest badge in it).
  const shelves = useMemo<Shelf[]>(() => {
    const byCategory = new Map<BadgeCategory, Badge[]>();
    for (const b of BADGE_CATALOG) {
      const list = byCategory.get(b.category) ?? [];
      list.push(b);
      byCategory.set(b.category, list);
    }
    return BADGE_CATEGORY_ORDER.filter((cat) => byCategory.has(cat))
      .map((cat) => {
        const all = byCategory.get(cat)!;
        const data =
          activeFilter === 'all'
            ? all
            : activeFilter === 'earned'
              ? all.filter((b) => earnedSet.has(b.id))
              : all.filter((b) => !earnedSet.has(b.id));
        return {
          category: cat,
          data,
          earnedCount: all.filter((b) => earnedSet.has(b.id)).length,
          totalCount: all.length,
        };
      })
      .filter((s) => s.data.length > 0);
  }, [activeFilter, earnedSet]);

  const totalEarned = earnedBadges.length;
  // Counts only what this user can actually get — see isKpiLocked.
  const totalBadges = useMemo(
    () => BADGE_CATALOG.filter((b) => !isKpiLocked(b)).length,
    [isKpiLocked]
  );

  // The showcase. earnedBadges is appended to in unlock order, so the last id
  // still present in the catalogue is the most recent thing won.
  const latest = useMemo(() => {
    for (let i = earnedBadges.length - 1; i >= 0; i--) {
      const b = BADGE_MAP.get(earnedBadges[i]);
      if (b) return b;
    }
    return null;
  }, [earnedBadges]);

  // With nothing earned there is no showcase, so name the badge that unlocks
  // first instead — otherwise the screen opens on a wall of grey with no reason
  // to come back. Skip profile_action badges (the guided tour): those are not
  // something you train towards.
  const firstMilestone = useMemo(
    () =>
      BADGE_CATALOG.find(
        (b) =>
          b.category === 'milestone' && b.criteriaType !== 'profile_action' && !earnedSet.has(b.id)
      ),
    [earnedSet]
  );

  // Rarity breakdown. "12/277" alone says almost nothing — twelve could be
  // twelve first-timers or twelve of the hardest badges in the app.
  const tierStats = useMemo(() => {
    const order: BadgeTier[] = ['bronze', 'silver', 'gold', 'grow'];
    return order.map((tier) => {
      const all = BADGE_CATALOG.filter((b) => b.tier === tier);
      return { tier, earned: all.filter((b) => earnedSet.has(b.id)).length, total: all.length };
    });
  }, [earnedSet]);

  const handleBadgePress = (badge: Badge) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDetailBadge(badge);
  };

  const styles = useMemo(() => makeStyles(C), [C]);

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'earned', label: 'Earned' },
    { key: 'locked', label: 'Locked' },
  ];

  const heroBadge = latest ?? firstMilestone ?? null;
  const heroEarned = latest != null;
  const progress = totalBadges > 0 ? totalEarned / totalBadges : 0;

  const detailEarned = detailBadge ? earnedSet.has(detailBadge.id) : false;
  const detailColor = detailBadge ? detailBadge.color : '';

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          testID="achievements-back"
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Achievements</Text>
      </View>

      <FlatList
        data={shelves}
        keyExtractor={(s) => s.category}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        initialNumToRender={5}
        windowSize={5}
        ListHeaderComponent={
          <>
            {/* Showcase: the last thing won, at a size worth looking at */}
            {heroBadge && (
              <View style={styles.hero}>
                <View style={styles.heroTop}>
                  <View style={heroEarned ? styles.heroMedalGlow : undefined}>
                    <BadgeMedallion
                      category={heroBadge.category}
                      tier={heroBadge.tier}
                      badgeId={heroBadge.id}
                      locked={!heroEarned}
                      size={HERO_MEDAL}
                    />
                  </View>
                  <View style={styles.heroText}>
                    <Text style={styles.heroLabel}>
                      {heroEarned ? 'Latest unlock' : 'First up'}
                    </Text>
                    <Text style={styles.heroName} numberOfLines={2}>
                      {heroBadge.name}
                    </Text>
                    <Text style={styles.heroMeta} numberOfLines={2}>
                      {heroEarned
                        ? `${BADGE_TIER_LABELS[heroBadge.tier]} · ${BADGE_CATEGORY_LABELS[heroBadge.category]}`
                        : heroBadge.description}
                    </Text>
                  </View>
                </View>

                {/* Overall progress */}
                <View style={styles.progressRow}>
                  <Text style={styles.progressCount}>
                    {totalEarned}
                    <Text style={styles.progressTotal}> of {totalBadges} earned</Text>
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.max(progress * 100, progress > 0 ? 2 : 0)}%` },
                    ]}
                  />
                </View>

                {/* Rarity breakdown — quiet supporting detail, not a dashboard */}
                <View style={styles.rarityRow}>
                  {tierStats.map(({ tier, earned, total }) => (
                    <View key={tier} style={styles.rarityItem}>
                      <View
                        style={[styles.rarityDot, { backgroundColor: BADGE_TIER_COLORS[tier] }]}
                      />
                      <Text style={styles.rarityCount}>
                        {earned}
                        <Text style={styles.rarityTotal}>/{total}</Text>
                      </Text>
                      <Text style={styles.rarityLabel}>{BADGE_TIER_LABELS[tier]}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Filter */}
            <View style={styles.filterBar}>
              {filterTabs.map((tab) => {
                const active = activeFilter === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => {
                      if (Platform.OS !== 'web')
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          </>
        }
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
            <EmptyState
              icon="trophy-outline"
              title={activeFilter === 'earned' ? 'Nothing unlocked yet' : 'Everything unlocked'}
              subtitle={
                activeFilter === 'earned'
                  ? 'Finish a session and your first badge lands on the summary screen.'
                  : 'There is nothing left to earn. Every badge in the app is yours.'
              }
              testID="achievements-empty"
            />
          </View>
        }
        renderItem={({ item }) => (
          <BadgeShelf
            shelf={item}
            earnedSet={earnedSet}
            onPress={handleBadgePress}
            styles={styles}
          />
        )}
      />

      {/* Tour overlay — shown when navigated from the guided tour */}
      {tourOverlayVisible && <TourCallout onDismiss={handleTourDismiss} />}

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
            <ScrollView
              contentContainerStyle={styles.detailContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={detailEarned ? styles.detailMedalGlow : undefined}>
                <BadgeMedallion
                  category={detailBadge.category}
                  tier={detailBadge.tier}
                  badgeId={detailBadge.id}
                  locked={!detailEarned}
                  size={DETAIL_MEDAL}
                />
              </View>

              <Text style={[styles.detailName, { color: C.text }]}>{detailBadge.name}</Text>

              {/* Earned / Locked status, and what metal it is struck in */}
              <View style={styles.detailPillRow}>
                <View
                  style={[
                    styles.detailStatusPill,
                    detailEarned
                      ? { backgroundColor: detailColor + '22', borderColor: detailColor + '55' }
                      : { backgroundColor: C.surfaceSecondary, borderColor: C.borderLight },
                  ]}
                >
                  <Ionicons
                    name={detailEarned ? 'checkmark-circle' : 'lock-closed-outline'}
                    size={13}
                    color={detailEarned ? detailColor : C.textTertiary}
                  />
                  <Text
                    style={[
                      styles.detailStatusText,
                      { color: detailEarned ? detailColor : C.textTertiary },
                    ]}
                  >
                    {detailEarned ? 'Earned' : 'Locked'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.detailStatusPill,
                    { backgroundColor: C.surfaceSecondary, borderColor: C.borderLight },
                  ]}
                >
                  <View
                    style={[
                      styles.rarityDot,
                      { backgroundColor: BADGE_TIER_COLORS[detailBadge.tier] },
                    ]}
                  />
                  <Text style={[styles.detailStatusText, { color: C.textSecondary }]}>
                    {BADGE_TIER_LABELS[detailBadge.tier]}
                  </Text>
                </View>
              </View>

              <Text style={[styles.detailDesc, { color: C.textSecondary }]}>
                {detailBadge.description}
              </Text>

              {!detailEarned &&
                (isKpiLocked(detailBadge) ? (
                  /* Not "complete a 1RM test week" — this user switched test
                     weeks off, and repeating the instruction is the app arguing
                     with a decision it asked them to make. State the condition,
                     offer the switch, and leave it there. */
                  <View
                    style={[
                      styles.hintBox,
                      { backgroundColor: C.surfaceSecondary, borderColor: C.borderLight },
                    ]}
                  >
                    <Ionicons name="lock-closed-outline" size={15} color={C.textTertiary} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <Text style={[styles.hintText, { color: C.textSecondary }]}>
                        This one needs strength test weeks, which you have turned off. Nothing wrong
                        with that, and it is not counted in your total.
                      </Text>
                      <Pressable
                        onPress={() => {
                          if (Platform.OS !== 'web')
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTestWeekFrequency(12);
                        }}
                        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                        testID="enable-test-weeks"
                      >
                        <Text style={[styles.hintText, { color: C.primaryText }]}>
                          Turn test weeks back on →
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.hintBox,
                      { backgroundColor: C.surfaceSecondary, borderColor: C.borderLight },
                    ]}
                  >
                    <Ionicons name="information-circle-outline" size={15} color={C.primaryText} />
                    <Text style={[styles.hintText, { color: C.textSecondary }]}>
                      {CRITERIA_HINTS[detailBadge.criteriaType]}
                    </Text>
                  </View>
                ))}

              <Text style={[styles.detailCategory, { color: C.textTertiary }]}>
                {BADGE_CATEGORY_LABELS[detailBadge.category]}
              </Text>
            </ScrollView>
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
      paddingBottom: 10,
      gap: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surfaceSecondary,
    },
    headerTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text },

    // ── Showcase ────────────────────────────────────────────────────────────
    hero: {
      marginHorizontal: 16,
      marginTop: 6,
      marginBottom: 18,
      backgroundColor: C.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.borderLight,
      padding: 18,
      ...shadowStyle('#000000', 0.06, 14, 4, 2),
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    heroMedalGlow: shadowStyle('#000000', 0.18, 12, 5, 5),
    heroText: { flex: 1 },
    heroLabel: {
      fontSize: 10.5,
      fontFamily: 'Inter_600SemiBold',
      color: C.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    heroName: {
      fontSize: 19,
      lineHeight: 24,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      marginTop: 3,
    },
    heroMeta: {
      fontSize: 12.5,
      lineHeight: 17,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 3,
    },

    progressRow: { marginTop: 18, marginBottom: 7 },
    progressCount: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },
    progressTotal: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    progressTrack: {
      height: 7,
      borderRadius: 4,
      backgroundColor: C.surfaceTertiary,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 4, backgroundColor: C.primary },

    rarityRow: {
      flexDirection: 'row',
      marginTop: 14,
    },
    rarityItem: { flex: 1, alignItems: 'flex-start', gap: 2 },
    rarityDot: { width: 7, height: 7, borderRadius: 3.5 },
    rarityCount: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: C.text },
    rarityTotal: { fontSize: 10.5, fontFamily: 'Inter_400Regular', color: C.textTertiary },
    rarityLabel: {
      fontSize: 9,
      fontFamily: 'Inter_600SemiBold',
      color: C.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // ── Filter ──────────────────────────────────────────────────────────────
    filterBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingBottom: 4,
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
    filterTabText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    filterTabTextActive: { color: C.primaryText, fontFamily: 'Inter_700Bold' },

    // ── Shelves ─────────────────────────────────────────────────────────────
    shelf: { paddingTop: 18 },
    shelfHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    shelfTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
    shelfCount: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    shelfRow: { paddingHorizontal: 14 },
    shelfItem: {
      width: SHELF_ITEM_W,
      alignItems: 'center',
      paddingVertical: 4,
    },
    shelfItemName: {
      fontSize: 9.5,
      lineHeight: 12,
      fontFamily: 'Inter_500Medium',
      color: C.text,
      textAlign: 'center',
      marginTop: 6,
    },
    shelfItemNameLocked: { color: C.textTertiary },

    // ── Detail sheet ────────────────────────────────────────────────────────
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    detailSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingHorizontal: 24,
      maxHeight: '86%',
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 20,
    },
    detailContent: {
      alignItems: 'center',
      gap: 10,
      paddingBottom: 8,
    },
    detailMedalGlow: shadowStyle('#000000', 0.2, 16, 6, 6),
    detailName: {
      fontSize: 22,
      fontFamily: 'Inter_700Bold',
      textAlign: 'center',
      marginTop: 6,
    },
    detailPillRow: { flexDirection: 'row', gap: 8 },
    detailStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderWidth: 1,
    },
    detailStatusText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
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
    hintText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
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
    detailCloseBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  });
}
