import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  Alert,
  Image,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
// expo-sharing, expo-media-library, and react-native-view-shot are loaded
// lazily inside the functions that use them. Static top-level imports of these
// native modules crash module evaluation in Expo Go (SDK 54), which causes
// Expo Router to report a missing default export and route the screen to +not-found.
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { useAppStore, SetLog, ExerciseCategory, PainRegion } from '@/lib/store';
import { getSessionLabel, getSessionSubtitle } from '@/lib/workout-engine';
import {
  getExerciseCategoryMap,
  getExerciseTargetRegionsMap,
  getRegionsByExerciseNameMap,
} from '@/lib/exercise-db';
import { BodyDiagram, MUSCLE_SET } from '@/components/BodyDiagram';
import { formatDate, formatWeight } from '@/lib/utils';

const WEB_TOP_INSET = 67;
const WEB_BOTTOM_INSET = 34;

const MILESTONE_SESSIONS = [1, 5, 10, 25, 50, 100, 150, 200];

// ── Certificate palette (fixed ecru/parchment — always light regardless of
//    device theme so the shareable card reads as a physical document) ──────────
const CARD_BG = '#F5F0E8'; // warm parchment
const OUTER_BG = '#1A1611'; // dark-warm surround so the card floats visibly
const BRAND_GREEN = '#2f6b46';
const CARD_TEXT = '#1A1A1A'; // near-black ink
const CARD_MUTED = '#5C5248'; // warm dark muted
const CARD_FAINT = '#9C8E82'; // warm medium gray
const CARD_HAIRLINE = 'rgba(60,45,30,0.14)'; // warm dark divider
const PILL_BG = 'rgba(60,45,30,0.06)'; // subtle warm tint for stat strip
const GOLD = '#fbbf24';

type BadgeKind = 'gain-weight' | 'gain-reps' | 'drop' | 'first' | 'matched' | 'none';

interface ExerciseRow {
  exerciseId: string;
  exerciseName: string;
  category: ExerciseCategory | null;
  isWeighted: boolean;
  bestWeight: number;
  bestReps: number;
  totalReps: number;
  setCount: number;
  badge: BadgeKind;
  deltaWeight: number;
  deltaReps: number;
}

const SESSION_TYPE_FALLBACK_REGIONS: Partial<Record<string, PainRegion[]>> = {
  squat: ['quads', 'glutes', 'hamstrings', 'knee', 'hip_groin'],
  bench: ['chest', 'tricep', 'front_shoulder'],
  deadlift: ['lower_back', 'hamstrings', 'glutes', 'lat_mid_back'],
  conditioning: ['core_ribs', 'quads', 'hamstrings'],
  prehab: ['hip_groin', 'lower_back', 'core_ribs'],
  flexibility: [],
  custom: [],
};

function bestCompletedSet(sets: SetLog[]): { weight: number; reps: number } | null {
  const valid = sets.filter((s) => s.completed && !s.skipped && s.weight > 0);
  if (valid.length === 0) return null;
  return valid.reduce(
    (best, s) => {
      if (s.weight > best.weight) return { weight: s.weight, reps: s.reps };
      if (s.weight === best.weight && s.reps > best.reps) return { weight: s.weight, reps: s.reps };
      return best;
    },
    { weight: 0, reps: 0 }
  );
}

export default function SessionSummaryScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const completedSessions = useAppStore((s) => s.completedSessions);
  const getExerciseHistory = useAppStore((s) => s.getExerciseHistory);
  const userName = useAppStore((s) => s.userProfile?.name);
  const profilePhotoUri = useAppStore((s) => s.profilePhotoUri);
  const weightUnit = useAppStore((s) => s.weightUnit);
  const getStreakDays = useAppStore((s) => s.getStreakDays);
  const setExerciseFeedback = useAppStore((s) => s.setExerciseFeedback);
  const updateSessionNotes = useAppStore((s) => s.updateSessionNotes);

  const certRef = useRef<View>(null);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [thumbsRatings, setThumbsRatings] = useState<Record<string, 'up' | 'down'>>({});
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');

  const session = useMemo(() => {
    if (sessionId) {
      const found = completedSessions.find((s) => s.id === sessionId);
      if (found) return found;
    }
    return completedSessions[0] ?? null;
  }, [completedSessions, sessionId]);

  useEffect(() => {
    setSessionNotes(session?.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const categoryMap = useMemo(() => getExerciseCategoryMap(), []);

  const summary = useMemo(() => {
    if (!session) {
      return {
        totalSets: 0,
        totalReps: 0,
        totalVolumeKg: 0,
        rows: [] as ExerciseRow[],
        hasWeighted: false,
      };
    }

    let totalSets = 0;
    let totalReps = 0;
    let totalVolumeKg = 0;
    const rows: ExerciseRow[] = [];

    for (const log of session.exerciseLogs) {
      const completedSets = log.sets.filter((s) => s.completed && !s.skipped);
      if (completedSets.length === 0) continue;

      const setCount = completedSets.length;
      const repsSum = completedSets.reduce((sum, s) => sum + (s.reps || 0), 0);
      totalSets += setCount;
      totalReps += repsSum;

      const thisBest = bestCompletedSet(log.sets);
      const isWeighted = thisBest !== null;

      if (isWeighted) {
        for (const s of completedSets) {
          if (s.weight > 0 && s.reps > 0) totalVolumeKg += s.weight * s.reps;
        }
      }

      let badge: BadgeKind = isWeighted ? 'first' : 'none';
      let deltaWeight = 0;
      let deltaReps = 0;

      if (isWeighted && thisBest) {
        const history = getExerciseHistory(log.exerciseId).filter(
          (h) => h.sessionId !== session.id
        );
        let prevBest: { weight: number; reps: number } | null = null;
        for (const h of history) {
          const pb = bestCompletedSet(h.sets);
          if (pb) {
            prevBest = pb;
            break;
          }
        }

        if (!prevBest) {
          badge = 'first';
        } else if (thisBest.weight > prevBest.weight) {
          badge = 'gain-weight';
          deltaWeight = thisBest.weight - prevBest.weight;
        } else if (thisBest.weight === prevBest.weight && thisBest.reps > prevBest.reps) {
          badge = 'gain-reps';
          deltaReps = thisBest.reps - prevBest.reps;
        } else if (thisBest.weight < prevBest.weight) {
          badge = 'drop';
          deltaWeight = prevBest.weight - thisBest.weight;
        } else {
          badge = 'matched';
        }
      }

      rows.push({
        exerciseId: log.exerciseId,
        exerciseName: log.exerciseName,
        category: categoryMap[log.exerciseId] ?? null,
        isWeighted,
        bestWeight: thisBest?.weight ?? 0,
        bestReps: thisBest?.reps ?? 0,
        totalReps: repsSum,
        setCount,
        badge,
        deltaWeight,
        deltaReps,
      });
    }

    const hasWeighted = rows.some((r) => r.isWeighted);
    return { totalSets, totalReps, totalVolumeKg, rows, hasWeighted };
  }, [session, getExerciseHistory, categoryMap]);

  const sessionNumber = useMemo(() => {
    if (!session) return 0;
    const idx = completedSessions.findIndex((s) => s.id === session.id);
    return idx >= 0 ? completedSessions.length - idx : 0;
  }, [session, completedSessions]);

  const isMilestone = MILESTONE_SESSIONS.includes(sessionNumber);

  const workedRegions = useMemo(() => {
    if (!session || session.exerciseLogs.length === 0) return null;
    const targetMap = getExerciseTargetRegionsMap();
    const nameMap = getRegionsByExerciseNameMap();
    const counts: Record<string, number> = {};

    for (const log of session.exerciseLogs) {
      let regions: PainRegion[] | undefined = targetMap[log.exerciseId];
      if (!regions || regions.length === 0) {
        regions = nameMap[log.exerciseName];
      }
      for (const r of regions ?? []) {
        if (MUSCLE_SET.has(r)) {
          counts[r] = (counts[r] ?? 0) + 1;
        }
      }
    }

    if (Object.keys(counts).length === 0) {
      const fallback = SESSION_TYPE_FALLBACK_REGIONS[session.sessionType] ?? [];
      fallback.forEach((r) => {
        if (MUSCLE_SET.has(r)) counts[r] = 1;
      });
    }

    return Object.keys(counts).length > 0
      ? (counts as Parameters<typeof BodyDiagram>[0]['heatmapCounts'])
      : null;
  }, [session]);

  const handleShare = useCallback(async () => {
    if (isSharing) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSharing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { captureRef } = require('react-native-view-shot') as {
        captureRef: (ref: unknown, opts: unknown) => Promise<string>;
      };
      if (Platform.OS === 'web') {
        const base64 = await captureRef(certRef, {
          format: 'png',
          quality: 1,
          result: 'base64',
        });
        const dataUrl = `data:image/png;base64,${base64}`;
        const dateStr = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `grow-workout-${dateStr}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sharing = require('expo-sharing') as typeof import('expo-sharing');
        const uri = await captureRef(certRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share Your Workout',
          });
        }
      }
    } catch {
    } finally {
      setIsSharing(false);
    }
  }, [isSharing]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { captureRef } = require('react-native-view-shot') as {
        captureRef: (ref: unknown, opts: unknown) => Promise<string>;
      };
      if (Platform.OS === 'web') {
        // Web: trigger a direct PNG download (same as Share on web)
        const base64 = await captureRef(certRef, {
          format: 'png',
          quality: 1,
          result: 'base64',
        });
        const dataUrl = `data:image/png;base64,${base64}`;
        const dateStr = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `grow-workout-${dateStr}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setSaveConfirmed(true);
        setTimeout(() => setSaveConfirmed(false), 2000);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
        // Native: request permission then save to camera roll
        const { status } = await MediaLibrary.requestPermissionsAsync(/* writeOnly */ true);
        if (status !== 'granted') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            'Photo access needed',
            'To save your certificate, allow Grow to add photos in your device Settings.',
            [{ text: 'OK' }]
          );
          return;
        }
        const uri = await captureRef(certRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        await MediaLibrary.saveToLibraryAsync(uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSaveConfirmed(true);
        setTimeout(() => setSaveConfirmed(false), 2000);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Save failed', "Couldn't save photo - please try again");
    } finally {
      setIsSaving(false);
    }
  }, [isSaving]);

  const submitRatings = useCallback(() => {
    Object.entries(thumbsRatings).forEach(([id, thumbs]) => {
      setExerciseFeedback(id, thumbs);
    });
    setShowRatingModal(false);
  }, [thumbsRatings, setExerciseFeedback]);

  const goHome = () => {
    router.dismissAll();
    router.replace('/(tabs)');
  };

  const topPad = Platform.OS === 'web' ? WEB_TOP_INSET : insets.top;
  const bottomPad = Platform.OS === 'web' ? WEB_BOTTOM_INSET : insets.bottom;

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: C.background, paddingTop: topPad + 24 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyWrap}>
          <Ionicons name="document-outline" size={40} color={C.textTertiary} />
          <Text style={[styles.emptyText, { color: C.textSecondary }]}>No session found.</Text>
          <Pressable
            onPress={goHome}
            style={[styles.doneButton, { backgroundColor: C.primary, marginTop: 20 }]}
          >
            <Text style={[styles.doneButtonText, { color: C.textInverse }]}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const durationSeconds = session.durationSeconds ?? 0;
  const durationLabel =
    durationSeconds >= 3600
      ? `${Math.floor(durationSeconds / 3600)}h ${String(Math.floor((durationSeconds % 3600) / 60)).padStart(2, '0')}m`
      : `${Math.floor(durationSeconds / 60)}m`;
  const topWeightKg =
    summary.rows.length > 0 ? Math.max(0, ...summary.rows.map((r) => r.bestWeight)) : 0;
  const topWeightDisplay = topWeightKg > 0 ? formatWeight(topWeightKg, weightUnit) : '-';
  const musclesHit = workedRegions ? Object.keys(workedRegions).length : 0;
  const streakDays = getStreakDays();
  const pbCount = summary.rows.filter((r) => r.badge === 'gain-weight').length;

  const firstInitial =
    userName && userName.trim().length > 0 ? userName.trim()[0].toUpperCase() : '?';

  // Responsive compact-diagram sizing: larger on tall phones, smaller on short
  // ones so the certificate always fits on one screen without scrolling.
  const bodyMaxWidth = Math.min(84, Math.max(58, Math.floor((screenHeight - 560) / 2.4)));

  const heatmap = (workedRegions ?? {}) as Parameters<typeof BodyDiagram>[0]['heatmapCounts'];

  const stats: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Duration', value: durationLabel },
    { label: 'Sets', value: String(summary.totalSets) },
    { label: 'Top Weight', value: topWeightDisplay, accent: topWeightKg > 0 },
    { label: 'Muscles', value: String(musclesHit) },
  ];

  return (
    <View style={[styles.container, { backgroundColor: OUTER_BG }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: topPad + 10,
          paddingHorizontal: 16,
          paddingBottom: bottomPad + 12,
        }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardWrap}>
          {/* ── Certificate card (this View is captured for sharing) ── */}
          <Animated.View entering={FadeIn.duration(450)}>
            <View ref={certRef} collapsable={false} style={styles.card}>
              <View style={styles.accentBar} />

              {/* Header: brand + date */}
              <View style={styles.cardHeader}>
                <View style={styles.brandRow}>
                  <View style={styles.logoCircle}>
                    <Image
                      source={require('@/assets/images/logo.png')}
                      style={styles.logoImg}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.brandText}>GROW</Text>
                </View>
                <Text style={styles.dateText}>{formatDate(session.date)}</Text>
              </View>

              {/* Identity: avatar + headline */}
              <View style={styles.identityRow}>
                <View style={[styles.avatar, isMilestone && styles.avatarMilestone]}>
                  {profilePhotoUri ? (
                    <Image source={{ uri: profilePhotoUri }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarInitial}>{firstInitial}</Text>
                  )}
                </View>
                <View style={styles.identityText}>
                  <View style={styles.tagRow}>
                    <Text style={styles.sessionTag}>SESSION {sessionNumber}</Text>
                    {isMilestone && (
                      <View style={styles.milestonePill}>
                        <Ionicons name="trophy" size={9} color="#0d0d0d" />
                        <Text style={styles.milestonePillText}>MILESTONE</Text>
                      </View>
                    )}
                    {session.isTestWeek && (
                      <View style={styles.testPill}>
                        <Text style={styles.testPillText}>TEST WEEK</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.headline} numberOfLines={1} adjustsFontSizeToFit>
                    {session.displayLabel ?? getSessionLabel(session.sessionType)}
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {getSessionSubtitle(session.sessionType)}
                  </Text>
                </View>
              </View>

              {/* Stat strip */}
              <View style={styles.statStrip}>
                {stats.map((s, i) => (
                  <React.Fragment key={s.label}>
                    {i > 0 && <View style={styles.statSep} />}
                    <View style={styles.statItem}>
                      <Text
                        style={[styles.statValue, s.accent && { color: BRAND_GREEN }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {s.value}
                      </Text>
                      <Text style={styles.statLabel} numberOfLines={1}>
                        {s.label}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>

              {/* PB count — only shown when at least one PB was set */}
              {pbCount > 0 && (
                <View style={styles.pbRow} testID="pb-count-row">
                  <Text style={styles.pbText}>
                    🏆 {pbCount} new personal best{pbCount > 1 ? 's' : ''} this session
                  </Text>
                </View>
              )}

              {/* Dual body diagram — front + back side by side */}
              <View style={styles.diagramRow}>
                <View style={styles.diagramCol}>
                  <BodyDiagram
                    compact
                    lightBg
                    defaultView="front"
                    heatmapCounts={heatmap}
                    maxWidth={bodyMaxWidth}
                    onSelect={() => {}}
                  />
                  <Text style={styles.diagramLabel}>FRONT</Text>
                </View>
                <View style={styles.diagramCol}>
                  <BodyDiagram
                    compact
                    lightBg
                    defaultView="back"
                    heatmapCounts={heatmap}
                    maxWidth={bodyMaxWidth}
                    onSelect={() => {}}
                  />
                  <Text style={styles.diagramLabel}>BACK</Text>
                </View>
              </View>

              {/* Footer */}
              <View style={styles.cardFooter}>
                {streakDays >= 1 ? (
                  <Text style={styles.footerStreak}>
                    🔥 {streakDays} day{streakDays > 1 ? 's' : ''} streak
                  </Text>
                ) : (
                  <Text style={styles.footerStreak}>Keep it going</Text>
                )}
                <Text style={styles.footerBrand}>growperformance.app</Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* ── Actions (not captured) ── */}
        <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.actionRow}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowRatingModal(true);
            }}
            style={[styles.actionBtn, { backgroundColor: C.surface, borderColor: C.borderLight }]}
            testID="open-rate-modal"
          >
            <Ionicons name="thumbs-up-outline" size={18} color={C.primary} />
            <Text style={[styles.actionBtnText, { color: C.text }]}>Rate</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={[
              styles.actionBtn,
              { backgroundColor: C.surface, borderColor: C.borderLight },
              isSaving && { opacity: 0.5 },
            ]}
            testID="save-workout"
          >
            <Ionicons
              name={saveConfirmed ? 'checkmark-circle-outline' : 'download-outline'}
              size={18}
              color={saveConfirmed ? C.primary : C.primary}
            />
            <Text style={[styles.actionBtnText, { color: C.text }]}>
              {isSaving ? '…' : saveConfirmed ? 'Saved!' : 'Save'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleShare}
            disabled={isSharing}
            style={[
              styles.actionBtn,
              { backgroundColor: C.surface, borderColor: C.borderLight },
              isSharing && { opacity: 0.5 },
            ]}
            testID="share-workout"
          >
            <Ionicons name="share-outline" size={18} color={C.primary} />
            <Text style={[styles.actionBtnText, { color: C.text }]}>
              {isSharing ? '…' : 'Share'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Session notes */}
        <View style={{ marginTop: 14 }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Inter_700Bold',
              color: C.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Session notes
          </Text>
          <TextInput
            style={{
              backgroundColor: C.surfaceTertiary,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: C.border,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 14,
              fontFamily: 'Inter_400Regular',
              color: C.text,
              minHeight: 72,
              textAlignVertical: 'top',
            }}
            placeholder="How did it feel? Anything to remember..."
            placeholderTextColor={C.textTertiary}
            multiline
            value={sessionNotes}
            onChangeText={(text) => {
              setSessionNotes(text);
              if (session) updateSessionNotes(session.id, text);
            }}
            returnKeyType="done"
            blurOnSubmit
          />
        </View>

        {/* Done */}
        <Pressable
          onPress={goHome}
          style={[styles.doneButton, { backgroundColor: C.primary }]}
          testID="summary-done"
        >
          <Text style={[styles.doneButtonText, { color: C.textInverse }]}>Done</Text>
        </Pressable>
      </KeyboardAwareScrollView>

      {/* Rate Exercises Modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.borderLight }]}>
              <View style={[styles.modalIconWrap, { backgroundColor: C.primaryMuted }]}>
                <Ionicons name="thumbs-up-outline" size={24} color={C.primary} />
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={[styles.modalTitle, { color: C.text }]}>Rate Exercises</Text>
                <Text style={[styles.modalSubtitle, { color: C.textSecondary }]}>
                  How did each exercise feel?
                </Text>
              </View>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {session.exerciseLogs.map((log) => (
                <View
                  key={log.exerciseId}
                  style={[styles.ratingRow, { borderBottomColor: C.borderLight }]}
                >
                  <Text style={[styles.ratingName, { color: C.text }]} numberOfLines={2}>
                    {log.exerciseName}
                  </Text>
                  <View style={styles.ratingButtons}>
                    <Pressable
                      onPress={() =>
                        setThumbsRatings((prev) => ({ ...prev, [log.exerciseId]: 'up' }))
                      }
                      style={[
                        styles.thumbBtn,
                        { backgroundColor: C.surfaceTertiary, borderColor: C.border },
                        thumbsRatings[log.exerciseId] === 'up' && {
                          backgroundColor: C.primary,
                          borderColor: C.primary,
                        },
                      ]}
                      testID={`thumb-up-${log.exerciseId}`}
                    >
                      <Ionicons
                        name="thumbs-up"
                        size={18}
                        color={
                          thumbsRatings[log.exerciseId] === 'up' ? C.textInverse : C.textSecondary
                        }
                      />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setThumbsRatings((prev) => ({ ...prev, [log.exerciseId]: 'down' }))
                      }
                      style={[
                        styles.thumbBtn,
                        { backgroundColor: C.surfaceTertiary, borderColor: C.border },
                        thumbsRatings[log.exerciseId] === 'down' && {
                          backgroundColor: C.categoryFinisherText,
                          borderColor: C.categoryFinisherText,
                        },
                      ]}
                      testID={`thumb-down-${log.exerciseId}`}
                    >
                      <Ionicons
                        name="thumbs-down"
                        size={18}
                        color={
                          thumbsRatings[log.exerciseId] === 'down' ? C.textInverse : C.textSecondary
                        }
                      />
                    </Pressable>
                  </View>
                </View>
              ))}
              <View style={{ height: 16 }} />
            </ScrollView>
            <View
              style={[
                styles.modalFooter,
                { borderTopColor: C.borderLight, paddingBottom: bottomPad + 16 },
              ]}
            >
              <Pressable
                onPress={submitRatings}
                style={[styles.modalPrimaryBtn, { backgroundColor: C.primary }]}
                testID="submit-ratings"
              >
                <Text style={[styles.modalPrimaryBtnText, { color: C.textInverse }]}>
                  Submit Ratings
                </Text>
              </Pressable>
              <Pressable onPress={() => setShowRatingModal(false)} style={styles.modalSkipBtn}>
                <Text style={[styles.modalSkipText, { color: C.textSecondary }]}>Skip</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    marginTop: 12,
  },

  // ── Certificate card ────────────────────────────────────────────────────────
  cardWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: CARD_HAIRLINE,
  },
  accentBar: {
    height: 5,
    backgroundColor: BRAND_GREEN,
    marginHorizontal: -20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  logoImg: {
    width: 26,
    height: 26,
  },
  brandText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: CARD_TEXT,
    letterSpacing: 2,
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: CARD_MUTED,
  },

  // ── Identity ────────────────────────────────────────────────────────────────
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: BRAND_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarMilestone: {
    borderWidth: 2,
    borderColor: GOLD,
  },
  avatarImg: {
    width: 52,
    height: 52,
  },
  avatarInitial: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  identityText: {
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sessionTag: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: CARD_FAINT,
    letterSpacing: 1.5,
  },
  milestonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: GOLD,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  milestonePillText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    color: '#0d0d0d',
    letterSpacing: 0.8,
  },
  testPill: {
    backgroundColor: 'rgba(47,107,70,0.12)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  testPillText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    color: BRAND_GREEN,
    letterSpacing: 0.8,
  },
  headline: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: CARD_TEXT,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: CARD_MUTED,
    marginTop: 1,
  },

  // ── Stat strip ──────────────────────────────────────────────────────────────
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PILL_BG,
    borderRadius: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statSep: {
    width: 1,
    height: 30,
    backgroundColor: CARD_HAIRLINE,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: CARD_TEXT,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: CARD_FAINT,
    letterSpacing: 0.8,
    marginTop: 3,
    textTransform: 'uppercase',
  },

  // ── PB count row ────────────────────────────────────────────────────────────
  pbRow: {
    alignItems: 'center',
    marginTop: -4,
    marginBottom: 10,
  },
  pbText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: BRAND_GREEN,
    textAlign: 'center',
  },

  // ── Body diagram ────────────────────────────────────────────────────────────
  diagramRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 20,
    marginBottom: 14,
  },
  diagramCol: {
    alignItems: 'center',
  },
  diagramLabel: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: CARD_FAINT,
    letterSpacing: 1.5,
    marginTop: 2,
  },

  // ── Card footer ─────────────────────────────────────────────────────────────
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CARD_HAIRLINE,
  },
  footerStreak: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: CARD_MUTED,
  },
  footerBrand: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: CARD_FAINT,
  },

  // ── Actions ─────────────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },

  // ── Done ────────────────────────────────────────────────────────────────────
  doneButton: {
    marginTop: 10,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },

  // ── Rate modal ──────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
    borderBottomWidth: 1,
  },
  modalIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  modalScroll: {
    paddingHorizontal: 20,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  ratingName: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  thumbBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    gap: 8,
  },
  modalPrimaryBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  modalSkipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSkipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});
