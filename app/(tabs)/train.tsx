import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { EmptyState } from '@/components/EmptyState';
import { EquipmentTier, SessionType, TIER_ORDER, useAppStore } from '@/lib/store';
import {
  getSessionSubtitle,
  getEquipmentLabel,
  getEquipmentIcon,
  getEffectiveTier,
} from '@/lib/workout-engine';
import { daysSince } from '@/lib/utils';
import {
  SESSION_META as SESSION_META_LABELS,
  SESSION_DISPLAY_NAMES,
  getSessionColors,
} from '@/lib/session-meta';

const SESSION_ORDER: SessionType[] = ['squat', 'bench', 'deadlift'];

const ALL_SESSION_TYPES: SessionType[] = ['squat', 'bench', 'deadlift', 'custom'];

const SESSION_IMAGES: Record<SessionType, any> = {
  squat: require('@/assets/images/sessions/lower-body.png'),
  bench: require('@/assets/images/sessions/upper-body.png'),
  deadlift: require('@/assets/images/sessions/full-body.png'),
  conditioning: require('@/assets/images/sessions/conditioning.png'),
  prehab: require('@/assets/images/sessions/targeted-prehab.png'),
  flexibility: require('@/assets/images/sessions/mobility.png'),
  custom: require('@/assets/images/sessions/custom.png'),
};

const ALL_TIERS: EquipmentTier[] = [
  'bodyweight',
  'bands',
  'dumbbells',
  'kettlebells',
  'barbell',
  'fullgym',
];

const TIER_DESCRIPTIONS: Record<EquipmentTier, string> = {
  bodyweight: 'No equipment needed',
  bands: 'Resistance bands only',
  dumbbells: 'Dumbbells available',
  kettlebells: 'Kettlebells available',
  barbell: 'Barbell and squat rack',
  fullgym: 'Everything — cables, machines, full setup',
};

function getContextMessage(
  completedCount: number,
  testWeekFrequency: number,
  testWeek: boolean
): string {
  if (completedCount === 0) {
    return "Welcome to your program. Let's build something lasting.";
  }
  if (testWeek) {
    return "Test week is here - show yourself how far you've come.";
  }
  const sessionsToTest = testWeekFrequency - (completedCount % testWeekFrequency);
  if (sessionsToTest <= 2) {
    const s = sessionsToTest === 1 ? 'session' : 'sessions';
    return `${sessionsToTest} ${s} until your next strength test - finish strong.`;
  }
  if (completedCount === 1) {
    return 'First session in the books. The habit has begun.';
  }
  const cycleSession = completedCount % 9;
  if (cycleSession === 0) {
    return 'New cycle started. Each one builds on the last.';
  }
  if (cycleSession >= 7) {
    return 'Final stretch of this cycle - finish it strong.';
  }
  if (completedCount < 6) {
    return 'Early days - this is where the foundations are laid.';
  }
  return 'Momentum is building. Every session moves the needle.';
}

function getLastTrainedText(completedSessions: any[], sessionType: SessionType): string {
  const matches = completedSessions.filter((s) => s.sessionType === sessionType);
  if (matches.length === 0) return 'Not done yet';
  const days = daysSince(matches[0].date);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default function TrainScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const {
    completedSessions,
    isTestWeekDue,
    testWeekFrequency,
    activeSession,
    clearActiveSession,
    equipmentTiers,
    userProfile,
    sessionEquipmentOverride,
    setSessionEquipmentOverride,
    clearSessionEquipmentOverride,
  } = useAppStore();

  const prevSessionCount = useRef(completedSessions.length);
  useEffect(() => {
    if (completedSessions.length > prevSessionCount.current) {
      clearSessionEquipmentOverride();
    }
    prevSessionCount.current = completedSessions.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSessions.length]);

  const isBeginnerExperience = userProfile?.experienceLevel === 'beginner';
  const availableTiers: EquipmentTier[] = isBeginnerExperience
    ? ['bodyweight', 'bands']
    : ALL_TIERS;

  const profileEquipment: EquipmentTier[] =
    equipmentTiers && equipmentTiers.length > 0 ? equipmentTiers : ['bodyweight'];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<EquipmentTier[]>([]);

  const todayTiers = sessionEquipmentOverride ?? profileEquipment;
  const todayEffectiveTier = getEffectiveTier(todayTiers);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const testWeek = isTestWeekDue();

  const strengthCount = useMemo(
    () => completedSessions.filter((s) => SESSION_ORDER.includes(s.sessionType)).length,
    [completedSessions]
  );

  const cycleNumber = Math.floor(strengthCount / 3) + 1;
  const sessionsToTest =
    strengthCount > 0 ? testWeekFrequency - (strengthCount % testWeekFrequency) : testWeekFrequency;

  const contextMessage = useMemo(
    () => getContextMessage(strengthCount, testWeekFrequency, testWeek),
    [strengthCount, testWeekFrequency, testWeek]
  );

  const cyclePosition = strengthCount % testWeekFrequency;
  const cycleLength = testWeekFrequency;

  const timelineItems: {
    sessionType: SessionType;
    status: 'completed' | 'current' | 'upcoming';
    isTestMarker: boolean;
  }[] = [];

  const timelineLength = Math.min(testWeekFrequency, 9);
  const cyclePos = strengthCount % timelineLength;

  for (let i = 0; i < timelineLength; i++) {
    const sessionType = SESSION_ORDER[i % 3];
    let status: 'completed' | 'current' | 'upcoming';
    if (i < cyclePos) {
      status = 'completed';
    } else if (i === cyclePos) {
      status = 'current';
    } else {
      status = 'upcoming';
    }
    const sessionNumber = strengthCount - cyclePos + i + 1;
    const isTestMarker = sessionNumber % testWeekFrequency === 0;
    timelineItems.push({ sessionType, status, isTestMarker });
  }

  const lastTrainedByType = useMemo(() => {
    const result = {} as Record<SessionType, string>;
    for (const type of SESSION_ORDER) {
      result[type] = getLastTrainedText(completedSessions, type);
    }
    return result;
  }, [completedSessions]);

  const SESSION_META = useMemo(() => {
    const colors = getSessionColors(C);
    const result = {} as Record<
      SessionType,
      {
        label: string;
        subtitle: string;
        icon: keyof typeof Ionicons.glyphMap;
        color: string;
        bg: string;
      }
    >;
    (Object.keys(SESSION_META_LABELS) as SessionType[]).forEach((type) => {
      result[type] = { ...SESSION_META_LABELS[type], ...colors[type] };
    });
    return result;
  }, [C]);

  const SESSION_COLORS = useMemo(() => {
    const colors = getSessionColors(C);
    const result = {} as Record<SessionType, { bg: string; accent: string }>;
    (Object.keys(colors) as SessionType[]).forEach((type) => {
      result[type] = { bg: colors[type].bg, accent: colors[type].color };
    });
    return result;
  }, [C]);

  const openEquipmentSheet = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetDraft([...todayTiers]);
    setSheetOpen(true);
  };

  const handleDraftToggle = (tier: EquipmentTier) => {
    if (!availableTiers.includes(tier)) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetDraft((prev) => {
      if (tier === 'fullgym') {
        if (prev.includes('fullgym')) {
          return prev.filter((t) => t !== 'fullgym');
        } else {
          return [...TIER_ORDER];
        }
      }
      if (prev.includes(tier)) {
        const next = prev.filter((t) => t !== tier && t !== 'fullgym');
        return next.length > 0 ? next : [tier];
      }
      return [...prev, tier];
    });
  };

  const confirmEquipment = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSessionEquipmentOverride(sheetDraft);
    setSheetOpen(false);
  };

  const resetToProfile = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearSessionEquipmentOverride();
    setSheetOpen(false);
  };

  const handleResume = () => {
    if (!activeSession) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/session',
      params: {
        sessionType: activeSession.sessionType,
        hasAches: activeSession.hasAches ? 'true' : 'false',
        painRegion: activeSession.painRegion ?? '',
        energy: activeSession.energy,
        timeAvailable: activeSession.timeAvailable,
        isTestWeek: activeSession.isTestWeek ? 'true' : 'false',
        equipment: activeSession.equipmentTier,
      },
    });
  };

  const showActiveSessionPrompt = (onDiscard: () => void) => {
    Alert.alert(
      'Session in progress',
      'You have an unfinished session. Resume it or discard it to start a new one.',
      [
        { text: 'Resume', onPress: handleResume },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            clearActiveSession();
            onDiscard();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const equipmentOverrideParam = sessionEquipmentOverride
    ? JSON.stringify(sessionEquipmentOverride)
    : undefined;

  const handleStart = (sessionType: SessionType, isTest: boolean) => {
    if (activeSession) {
      showActiveSessionPrompt(() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({
          pathname: '/readiness',
          params: {
            sessionType,
            isTestWeek: isTest ? 'true' : 'false',
            equipmentOverride: equipmentOverrideParam,
          },
        });
      });
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/readiness',
      params: {
        sessionType,
        isTestWeek: isTest ? 'true' : 'false',
        equipmentOverride: equipmentOverrideParam,
      },
    });
  };

  const handleSelect = (sessionType: SessionType) => {
    const navigate = () => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (sessionType === 'custom') {
        router.push({ pathname: '/custom-session' });
      } else if (sessionType === 'prehab') {
        router.push({
          pathname: '/readiness',
          params: { sessionType, isTestWeek: 'false', equipmentOverride: equipmentOverrideParam },
        });
      } else if (sessionType === 'flexibility') {
        router.push({
          pathname: '/session',
          params: {
            sessionType,
            hasAches: 'false',
            painRegion: '',
            energy: 'normal',
            timeAvailable: '60',
            isTestWeek: 'false',
            equipment: todayEffectiveTier,
          },
        });
      } else if (sessionType === 'conditioning') {
        router.push({
          pathname: '/readiness',
          params: { sessionType, isTestWeek: 'false', equipmentOverride: equipmentOverrideParam },
        });
      } else {
        router.push({
          pathname: '/readiness',
          params: {
            sessionType,
            isTestWeek: testWeek ? 'true' : 'false',
            equipmentOverride: equipmentOverrideParam,
          },
        });
      }
    };
    if (activeSession) {
      showActiveSessionPrompt(navigate);
      return;
    }
    navigate();
  };

  const styles = useMemo(() => makeStyles(C), [C]);

  const draftEffectiveTier = getEffectiveTier(sheetDraft.length > 0 ? sheetDraft : ['bodyweight']);
  const isOverrideActive = sessionEquipmentOverride !== null;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + webTopInset + 16,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Train</Text>
        <Text style={styles.subtitle}>Choose a session to start</Text>

        {/* Equipment chip */}
        <View style={styles.equipmentChipRow}>
          <Pressable
            onPress={openEquipmentSheet}
            style={({ pressed }) => [
              styles.equipmentChip,
              isOverrideActive && styles.equipmentChipOverride,
              pressed && { opacity: 0.8 },
            ]}
            testID="train-equipment-chip"
          >
            <Ionicons
              name={getEquipmentIcon(todayEffectiveTier) as keyof typeof Ionicons.glyphMap}
              size={13}
              color={isOverrideActive ? C.primary : C.textSecondary}
            />
            <Text
              style={[
                styles.equipmentChipText,
                isOverrideActive && styles.equipmentChipTextOverride,
              ]}
            >
              {isOverrideActive ? 'Today: ' : ''}
              {getEquipmentLabel(todayEffectiveTier)}
            </Text>
            {isOverrideActive && <View style={styles.overrideDot} />}
            <Ionicons
              name="chevron-down"
              size={12}
              color={isOverrideActive ? C.primary : C.textTertiary}
            />
          </Pressable>
          {isOverrideActive && (
            <Pressable
              onPress={() => {
                clearSessionEquipmentOverride();
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              hitSlop={8}
              style={styles.equipmentDismissBtn}
              testID="train-equipment-dismiss"
            >
              <Ionicons name="close-circle" size={18} color={C.textTertiary} />
            </Pressable>
          )}
        </View>

        {/* Resume banner */}
        {activeSession && (
          <Animated.View entering={FadeInDown.duration(350)} style={styles.resumeBanner}>
            <View style={styles.resumeBannerLeft}>
              <Ionicons name="time-outline" size={20} color={C.warning} />
              <View>
                <Text style={styles.resumeBannerTitle}>Session in progress</Text>
                <Text style={styles.resumeBannerSub}>
                  {SESSION_META_LABELS[activeSession.sessionType]?.label} ·{' '}
                  {activeSession.completedSetsCount}/{activeSession.totalSets} sets
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleResume}
              style={({ pressed }) => [styles.resumeBannerBtn, pressed && { opacity: 0.85 }]}
              testID="train-resume-session"
            >
              <Text style={styles.resumeBannerBtnText}>Resume</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Session selection cards */}
        <Animated.View entering={FadeInDown.delay(0).duration(380)} style={styles.sessionGrid}>
          {ALL_SESSION_TYPES.map((type) => {
            const meta = SESSION_META[type];
            return (
              <Pressable
                key={type}
                onPress={() => handleSelect(type)}
                style={({ pressed }) => [
                  styles.sessionCard,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
                ]}
                testID={`train-session-${type}`}
              >
                <View style={[styles.sessionCardIcon, { backgroundColor: meta.bg }]}>
                  <Image
                    source={SESSION_IMAGES[type]}
                    style={styles.sessionCardImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.sessionCardLabel} numberOfLines={1}>
                  {meta.label}
                </Text>
                <Text style={styles.sessionCardSub} numberOfLines={1}>
                  {meta.subtitle}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>

        <View style={styles.programDivider}>
          <View style={[styles.programDividerLine, { backgroundColor: C.borderLight }]} />
          <Text style={styles.programDividerText}>Your Program</Text>
          <View style={[styles.programDividerLine, { backgroundColor: C.borderLight }]} />
        </View>

        {strengthCount === 0 ? (
          <EmptyState
            icon="barbell-outline"
            title="Your program starts here"
            subtitle={`Complete your first session from the Home tab to begin your progress timeline - Squat · Bench · Deadlift on ${getEquipmentLabel(todayEffectiveTier)}.`}
            testID="train-empty-state"
          />
        ) : (
          <>
            <Text style={styles.programSubtitle}>
              Squat · Bench · Deadlift · {getEquipmentLabel(todayEffectiveTier)}
            </Text>

            <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.cycleInfo}>
              <View style={styles.cycleCard}>
                <Text style={styles.cycleValue}>Cycle {cycleNumber}</Text>
                <Text style={styles.cycleLabel}>of your program</Text>
              </View>
              <View style={styles.cycleDivider} />
              <View style={styles.cycleCard}>
                <Text style={styles.cycleNumber}>{completedSessions.length}</Text>
                <Text style={styles.cycleLabel}>sessions completed</Text>
              </View>
              <View style={styles.cycleDivider} />
              <View style={styles.cycleCard}>
                <Text style={styles.cycleNumber}>{sessionsToTest}</Text>
                <Text style={styles.cycleLabel}>until test week</Text>
              </View>
            </Animated.View>

            {/* Programme Arc */}
            <Animated.View entering={FadeInDown.delay(40).duration(400)} style={styles.arcCard}>
              <View style={styles.arcHeader}>
                <Text style={styles.arcLabel}>
                  Session {cyclePosition + 1} of {cycleLength}
                </Text>
                <Text style={styles.arcSublabel}>current cycle</Text>
              </View>
              <View style={styles.arcDots}>
                {Array.from({ length: cycleLength }, (_, i) => {
                  const isDone = i < cyclePosition;
                  const isCur = i === cyclePosition;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.arcDot,
                        isDone && styles.arcDotDone,
                        isCur && styles.arcDotCurrent,
                      ]}
                    />
                  );
                })}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.contextRow}>
              <View style={styles.contextDot} />
              <Text style={styles.contextText}>{contextMessage}</Text>
            </Animated.View>

            <View style={styles.timeline}>
              {timelineItems.map((item, index) => {
                const colors = SESSION_COLORS[item.sessionType];
                const isCurrent = item.status === 'current';
                const isCompleted = item.status === 'completed';

                return (
                  <Animated.View
                    key={index}
                    entering={FadeInDown.delay(120 + index * 40).duration(400)}
                  >
                    <View style={styles.timelineRow}>
                      <View style={styles.timelineTrack}>
                        <View
                          style={[
                            styles.timelineDot,
                            isCompleted && styles.timelineDotDone,
                            isCurrent && styles.timelineDotCurrent,
                            isCurrent && testWeek && styles.timelineDotTest,
                          ]}
                        >
                          {isCompleted && (
                            <Ionicons name="checkmark" size={12} color={C.textInverse} />
                          )}
                          {isCurrent && (
                            <View
                              style={[
                                styles.currentPulse,
                                testWeek && { backgroundColor: C.categoryPrehabText },
                              ]}
                            />
                          )}
                        </View>
                        {index < timelineItems.length - 1 && (
                          <View
                            style={[styles.timelineLine, isCompleted && styles.timelineLineDone]}
                          />
                        )}
                      </View>

                      <Pressable
                        onPress={() => (isCurrent ? handleStart(item.sessionType, testWeek) : null)}
                        disabled={!isCurrent}
                        style={({ pressed }) => [
                          styles.timelineCard,
                          isCurrent && styles.timelineCardCurrent,
                          isCurrent && testWeek && styles.timelineCardTest,
                          isCompleted && styles.timelineCardDone,
                          pressed && isCurrent && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                        ]}
                      >
                        <View style={[styles.cardIcon, { backgroundColor: colors.bg }]}>
                          <Ionicons
                            name={
                              isCurrent && testWeek
                                ? 'trophy'
                                : SESSION_META_LABELS[item.sessionType].icon
                            }
                            size={20}
                            color={isCurrent && testWeek ? C.categoryPrehabText : colors.accent}
                          />
                        </View>
                        <View style={styles.cardContent}>
                          <Text style={[styles.cardTitle, isCompleted && styles.cardTitleDone]}>
                            {SESSION_DISPLAY_NAMES[item.sessionType]}
                          </Text>
                          <Text style={styles.cardSub}>
                            {isCurrent && testWeek
                              ? 'Strength Test'
                              : getSessionSubtitle(item.sessionType)}
                          </Text>
                          {!isCompleted && (
                            <Text style={styles.cardRecency}>
                              {lastTrainedByType[item.sessionType]}
                            </Text>
                          )}
                        </View>
                        {isCurrent && !activeSession && (
                          <View style={[styles.startPill, testWeek && styles.startPillTest]}>
                            <Ionicons name="play" size={16} color={C.textInverse} />
                          </View>
                        )}
                        {isCurrent && !!activeSession && (
                          <View style={[styles.startPill, { backgroundColor: C.warning }]}>
                            <Ionicons name="time-outline" size={16} color={C.textInverse} />
                          </View>
                        )}
                        {isCompleted && (
                          <Ionicons name="checkmark-circle" size={22} color={C.primary} />
                        )}
                        {item.isTestMarker && !isCurrent && (
                          <View style={styles.testMarker}>
                            <Ionicons
                              name="trophy-outline"
                              size={14}
                              color={C.categoryPrehabText}
                            />
                          </View>
                        )}
                      </Pressable>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Equipment picker sheet */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Equipment today</Text>
              <Text style={styles.sheetSubtitle}>This only affects the current session</Text>
            </View>
            {isOverrideActive && (
              <Pressable onPress={resetToProfile} style={styles.resetBtn}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
            )}
          </View>

          {sheetDraft.length > 0 && (
            <View style={styles.bestMatchRow}>
              <Text style={styles.bestMatchText}>
                Best match:{' '}
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primary }}>
                  {getEquipmentLabel(draftEffectiveTier)}
                </Text>
              </Text>
            </View>
          )}

          {isBeginnerExperience && (
            <View style={styles.beginnerNote}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.primary} />
              <Text style={styles.beginnerNoteText}>
                Bodyweight & Bands — unlock more in profile
              </Text>
            </View>
          )}

          {ALL_TIERS.map((tier) => {
            const isAvailable = availableTiers.includes(tier);
            const isActive = sheetDraft.includes(tier);
            return (
              <Pressable
                key={tier}
                onPress={() => handleDraftToggle(tier)}
                style={({ pressed }) => [
                  styles.tierRow,
                  isActive && styles.tierRowActive,
                  !isAvailable && styles.tierRowLocked,
                  pressed && isAvailable && { opacity: 0.8 },
                ]}
                testID={`sheet-equipment-${tier}`}
              >
                <View
                  style={[
                    styles.tierIcon,
                    {
                      backgroundColor: isActive
                        ? C.primary
                        : isAvailable
                          ? C.primaryMuted
                          : C.surfaceTertiary,
                    },
                  ]}
                >
                  <Ionicons
                    name={getEquipmentIcon(tier) as keyof typeof Ionicons.glyphMap}
                    size={16}
                    color={isActive ? C.textInverse : isAvailable ? C.primary : C.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.tierLabel,
                      isActive && { color: C.primary },
                      !isAvailable && { color: C.textTertiary },
                    ]}
                  >
                    {getEquipmentLabel(tier)}
                  </Text>
                  <Text style={styles.tierSub}>
                    {isAvailable ? TIER_DESCRIPTIONS[tier] : 'Unlock in profile'}
                  </Text>
                </View>
                {!isAvailable ? (
                  <Ionicons name="lock-closed-outline" size={14} color={C.textTertiary} />
                ) : (
                  <View style={[styles.tierCheck, isActive && styles.tierCheckActive]}>
                    {isActive && <Ionicons name="checkmark" size={11} color={C.textInverse} />}
                  </View>
                )}
              </Pressable>
            );
          })}

          <Pressable
            onPress={confirmEquipment}
            disabled={sheetDraft.length === 0}
            style={({ pressed }) => [
              styles.confirmBtn,
              sheetDraft.length === 0 && { opacity: 0.4 },
              pressed && sheetDraft.length > 0 && { opacity: 0.88, transform: [{ scale: 0.98 }] },
            ]}
            testID="sheet-equipment-confirm"
          >
            <Ionicons name="checkmark-circle" size={18} color={C.textInverse} />
            <Text style={styles.confirmBtnText}>Use this equipment</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { paddingHorizontal: 20 },
    title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.text },
    subtitle: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginTop: 2,
      marginBottom: 10,
    },

    equipmentChipRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      alignSelf: 'flex-start' as const,
      gap: 6,
      marginBottom: 16,
    },
    equipmentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: C.surface,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    equipmentDismissBtn: { padding: 2 },
    equipmentChipOverride: {
      borderColor: C.primary,
      backgroundColor: C.primarySurface,
    },
    equipmentChipText: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    equipmentChipTextOverride: {
      color: C.primary,
      fontFamily: 'Inter_600SemiBold',
    },
    overrideDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: C.primary,
    },

    resumeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.warningLight,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: C.warning,
    },
    resumeBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    resumeBannerTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.warning },
    resumeBannerSub: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.warning,
      marginTop: 1,
    },
    resumeBannerBtn: {
      backgroundColor: C.warning,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    resumeBannerBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.textInverse },

    sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    sessionCard: {
      width: '47%',
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 14,
      minHeight: 106,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    sessionCardIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    sessionCardImage: { width: 38, height: 38 },
    sessionCardLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 3 },
    sessionCardSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary },

    programDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    programDividerLine: { flex: 1, height: 1 },
    programDividerText: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      color: C.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    programSubtitle: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginBottom: 14,
    },

    cycleInfo: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.borderLight,
      alignItems: 'center',
    },
    cycleCard: { flex: 1, alignItems: 'center' },
    cycleValue: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.primary },
    cycleNumber: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.primary },
    cycleLabel: {
      fontSize: 10,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginTop: 3,
      textAlign: 'center',
    },
    cycleDivider: { width: 1, height: 36, backgroundColor: C.border },

    arcCard: {
      backgroundColor: C.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.borderLight,
      marginBottom: 12,
    },
    arcHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 10 },
    arcLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
    arcSublabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary },
    arcDots: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    arcDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.surfaceTertiary,
      borderWidth: 1,
      borderColor: C.border,
    },
    arcDotDone: { backgroundColor: C.primary, borderColor: C.primary },
    arcDotCurrent: {
      backgroundColor: C.primary,
      borderColor: C.primary,
      width: 10,
      height: 10,
      borderRadius: 5,
    },

    contextRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 20,
      gap: 8,
      paddingHorizontal: 2,
    },
    contextDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: C.primary,
      marginTop: 6,
      flexShrink: 0,
    },
    contextText: {
      flex: 1,
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      lineHeight: 19,
    },

    timeline: {},
    timelineRow: { flexDirection: 'row' },
    timelineTrack: { width: 30, alignItems: 'center' },
    timelineDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: C.surfaceTertiary,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    timelineDotDone: { backgroundColor: C.primary, borderColor: C.primary },
    timelineDotCurrent: { backgroundColor: C.surface, borderColor: C.primary, borderWidth: 3 },
    timelineDotTest: { borderColor: C.categoryPrehabText },
    currentPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
    timelineLine: { width: 2, flex: 1, backgroundColor: C.border, marginVertical: -2 },
    timelineLineDone: { backgroundColor: C.primary },

    timelineCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 14,
      marginLeft: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    timelineCardCurrent: {
      borderColor: C.primary,
      borderWidth: 2,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: Platform.OS !== 'web' ? 5 : 0,
    },
    timelineCardTest: { borderColor: C.categoryPrehabText },
    timelineCardDone: { opacity: 0.65 },

    cardIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text },
    cardTitleDone: { textDecorationLine: 'line-through' as const, color: C.textSecondary },
    cardSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
    cardRecency: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginTop: 2,
    },

    startPill: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.45,
      shadowRadius: 7,
      elevation: Platform.OS !== 'web' ? 7 : 0,
    },
    startPillTest: { backgroundColor: C.categoryPrehabText },
    testMarker: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: C.categoryPrehab,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Equipment sheet
    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 20,
      paddingTop: 10,
      gap: 8,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginBottom: 6,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    sheetTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
    sheetSubtitle: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },
    resetBtn: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      backgroundColor: C.surfaceTertiary,
      borderRadius: 10,
    },
    resetBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    bestMatchRow: {
      backgroundColor: C.primarySurface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    bestMatchText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    beginnerNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.primarySurface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    beginnerNoteText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.primary, flex: 1 },
    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    tierRowActive: { borderColor: C.primary, backgroundColor: C.primarySurface },
    tierRowLocked: { opacity: 0.45 },
    tierIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
    tierSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },
    tierCheck: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierCheckActive: { backgroundColor: C.primary, borderColor: C.primary },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.primary,
      borderRadius: 14,
      paddingVertical: 14,
      marginTop: 4,
    },
    confirmBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.textInverse },
  });
}
