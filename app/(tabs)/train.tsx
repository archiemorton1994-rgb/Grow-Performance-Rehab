import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { SessionType, useAppStore } from '@/lib/store';
import { getSessionSubtitle, getEquipmentLabel } from '@/lib/workout-engine';
import { daysSince } from '@/lib/utils';

const SESSION_ORDER: SessionType[] = ['squat', 'bench', 'deadlift'];

const SESSION_DISPLAY_NAMES: Record<SessionType, string> = {
  squat: 'Lower Body Strength',
  bench: 'Upper Body Press',
  deadlift: 'Full Body Pull',
  conditioning: 'Conditioning',
  prehab: 'Prehab',
  flexibility: 'Flexibility',
};

const SESSION_ICONS: Record<SessionType, keyof typeof Ionicons.glyphMap> = {
  squat: 'fitness',
  bench: 'body',
  deadlift: 'barbell',
  conditioning: 'flame-outline',
  prehab: 'shield-checkmark-outline',
  flexibility: 'leaf-outline',
};

function getContextMessage(
  completedCount: number,
  testWeekFrequency: number,
  testWeek: boolean,
): string {
  if (completedCount === 0) {
    return "Welcome to your program. Let's build something lasting.";
  }
  if (testWeek) {
    return "Test week is here — show yourself how far you've come.";
  }
  const sessionsToTest = testWeekFrequency - (completedCount % testWeekFrequency);
  if (sessionsToTest <= 2) {
    const s = sessionsToTest === 1 ? 'session' : 'sessions';
    return `${sessionsToTest} ${s} until your next strength test — finish strong.`;
  }
  if (completedCount === 1) {
    return "First session in the books. The habit has begun.";
  }
  const cycleSession = completedCount % 9;
  if (cycleSession === 0) {
    return "New cycle started. Each one builds on the last.";
  }
  if (cycleSession >= 7) {
    return "Final stretch of this cycle — finish it strong.";
  }
  if (completedCount < 6) {
    return "Early days — this is where the foundations are laid.";
  }
  return "Momentum is building. Every session moves the needle.";
}

function getLastTrainedText(completedSessions: any[], sessionType: SessionType): string {
  const matches = completedSessions.filter(s => s.sessionType === sessionType);
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
    completedCount,
    completedSessions,
    getEffectiveTier,
    isTestWeekDue,
    testWeekFrequency,
  } = useAppStore();

  const equipmentTier = getEffectiveTier();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const testWeek = isTestWeekDue();
  const cycleNumber = Math.floor(completedCount / 3) + 1;
  const sessionsToTest = completedCount > 0
    ? testWeekFrequency - (completedCount % testWeekFrequency)
    : testWeekFrequency;

  const contextMessage = useMemo(
    () => getContextMessage(completedCount, testWeekFrequency, testWeek),
    [completedCount, testWeekFrequency, testWeek],
  );

  const cyclePosition = completedCount % testWeekFrequency;
  const cycleLength = testWeekFrequency;

  const timelineItems: {
    sessionType: SessionType;
    status: 'completed' | 'current' | 'upcoming';
    isTestMarker: boolean;
  }[] = [];

  for (let i = 0; i < 9; i++) {
    const sessionType = SESSION_ORDER[i % 3];
    let status: 'completed' | 'current' | 'upcoming';
    if (i < completedCount % 9) {
      status = 'completed';
    } else if (i === completedCount % 9) {
      status = 'current';
    } else {
      status = 'upcoming';
    }
    const sessionNumber = completedCount - (completedCount % 9) + i + 1;
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

  const SESSION_COLORS = useMemo(() => ({
    squat: { bg: C.primaryMuted, accent: C.primary },
    bench: { bg: '#e8f0fe', accent: '#4285f4' },
    deadlift: { bg: '#fce8e6', accent: '#ea4335' },
    conditioning: { bg: '#fbe9e7', accent: '#e65100' },
    prehab: { bg: '#fff3e0', accent: '#e65100' },
    flexibility: { bg: '#e8f5e9', accent: '#2e7d32' },
  }), [C]);

  const handleStart = (sessionType: SessionType, isTest: boolean) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/readiness', params: { sessionType, isTestWeek: isTest ? 'true' : 'false' } });
  };

  const styles = useMemo(() => makeStyles(C), [C]);

  return (
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
      <Text style={styles.title}>Your Program</Text>
      <Text style={styles.subtitle}>
        Squat · Bench · Deadlift · {getEquipmentLabel(equipmentTier)}
      </Text>

      <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.cycleInfo}>
        <View style={styles.cycleCard}>
          <Text style={styles.cycleValue}>Cycle {cycleNumber}</Text>
          <Text style={styles.cycleLabel}>of your program</Text>
        </View>
        <View style={styles.cycleDivider} />
        <View style={styles.cycleCard}>
          <Text style={styles.cycleNumber}>{completedCount}</Text>
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
          <Text style={styles.arcLabel}>Session {cyclePosition + 1} of {cycleLength}</Text>
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
            <Animated.View key={index} entering={FadeInDown.delay(120 + index * 40).duration(400)}>
              <View style={styles.timelineRow}>
                <View style={styles.timelineTrack}>
                  <View style={[
                    styles.timelineDot,
                    isCompleted && styles.timelineDotDone,
                    isCurrent && styles.timelineDotCurrent,
                    isCurrent && testWeek && styles.timelineDotTest,
                  ]}>
                    {isCompleted && <Ionicons name="checkmark" size={12} color={C.textInverse} />}
                    {isCurrent && (
                      <View style={[styles.currentPulse, testWeek && { backgroundColor: '#e65100' }]} />
                    )}
                  </View>
                  {index < timelineItems.length - 1 && (
                    <View style={[styles.timelineLine, isCompleted && styles.timelineLineDone]} />
                  )}
                </View>

                <Pressable
                  onPress={() => isCurrent ? handleStart(item.sessionType, testWeek) : null}
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
                      name={isCurrent && testWeek ? 'trophy' : SESSION_ICONS[item.sessionType]}
                      size={20}
                      color={isCurrent && testWeek ? '#e65100' : colors.accent}
                    />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, isCompleted && styles.cardTitleDone]}>
                      {SESSION_DISPLAY_NAMES[item.sessionType]}
                    </Text>
                    <Text style={styles.cardSub}>
                      {isCurrent && testWeek ? 'Strength Test' : getSessionSubtitle(item.sessionType)}
                    </Text>
                    {!isCompleted && (
                      <Text style={styles.cardRecency}>
                        {lastTrainedByType[item.sessionType]}
                      </Text>
                    )}
                  </View>
                  {isCurrent && (
                    <View style={[styles.startPill, testWeek && styles.startPillTest]}>
                      <Ionicons name="play" size={16} color={C.textInverse} />
                    </View>
                  )}
                  {isCompleted && (
                    <Ionicons name="checkmark-circle" size={22} color={C.primary} />
                  )}
                  {item.isTestMarker && !isCurrent && (
                    <View style={styles.testMarker}>
                      <Ionicons name="trophy-outline" size={14} color="#e65100" />
                    </View>
                  )}
                </Pressable>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { paddingHorizontal: 20 },
    title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.text },
    subtitle: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2, marginBottom: 20 },

    cycleInfo: {
      flexDirection: 'row', backgroundColor: C.surface,
      borderRadius: 16, padding: 18, marginBottom: 12,
      borderWidth: 1, borderColor: C.borderLight, alignItems: 'center',
    },
    cycleCard: { flex: 1, alignItems: 'center' },
    cycleValue: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.primary },
    cycleNumber: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.primary },
    cycleLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 3, textAlign: 'center' },
    cycleDivider: { width: 1, height: 36, backgroundColor: C.border },

    arcCard: {
      backgroundColor: C.surface, borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 12,
      borderWidth: 1, borderColor: C.borderLight, marginBottom: 12,
    },
    arcHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 10 },
    arcLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
    arcSublabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary },
    arcDots: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    arcDot: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: C.surfaceTertiary,
      borderWidth: 1, borderColor: C.border,
    },
    arcDotDone: { backgroundColor: C.primary, borderColor: C.primary },
    arcDotCurrent: { backgroundColor: C.primary, borderColor: C.primary, width: 10, height: 10, borderRadius: 5 },

    contextRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 8, paddingHorizontal: 2 },
    contextDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary, marginTop: 6, flexShrink: 0 },
    contextText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary, lineHeight: 19 },

    timeline: {},
    timelineRow: { flexDirection: 'row' },
    timelineTrack: { width: 30, alignItems: 'center' },
    timelineDot: {
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: C.surfaceTertiary, borderWidth: 2, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center', zIndex: 1,
    },
    timelineDotDone: { backgroundColor: C.primary, borderColor: C.primary },
    timelineDotCurrent: { backgroundColor: C.surface, borderColor: C.primary, borderWidth: 3 },
    timelineDotTest: { borderColor: '#e65100' },
    currentPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
    timelineLine: { width: 2, flex: 1, backgroundColor: C.border, marginVertical: -2 },
    timelineLineDone: { backgroundColor: C.primary },

    timelineCard: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, borderRadius: 14, padding: 14,
      marginLeft: 12, marginBottom: 8, borderWidth: 1, borderColor: C.borderLight,
    },
    timelineCardCurrent: {
      borderColor: C.primary, borderWidth: 2,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
    },
    timelineCardTest: { borderColor: '#e65100' },
    timelineCardDone: { opacity: 0.65 },

    cardIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text },
    cardTitleDone: { textDecorationLine: 'line-through' as const, color: C.textSecondary },
    cardSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
    cardRecency: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 2 },

    startPill: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 7, elevation: 7,
    },
    startPillTest: { backgroundColor: '#e65100' },
    testMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff3e0', alignItems: 'center', justifyContent: 'center' },
  });
}
