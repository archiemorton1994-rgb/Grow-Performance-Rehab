import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  LayoutChangeEvent,
  Pressable,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Rect, Line, Circle, Path, Polyline, Text as SvgText, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { EmptyState } from '@/components/EmptyState';
import {
  CompletedSession,
  EnergyLevel,
  ExerciseProgress,
  PainRegion,
  SessionType,
  STRENGTH_SESSION_TYPES,
  useAppStore,
} from '@/lib/store';
import {
  BodyDiagram,
  BODY_DIAGRAM_LABELS,
  MUSCLE_SET,
  heatmapBucketColor,
} from '@/components/BodyDiagram';
import { PainInsightSheet } from '@/components/PainInsightSheet';
import { getExerciseTargetRegionsMap, getExerciseNameMap } from '@/lib/exercise-db';
import { getSessionLabel } from '@/lib/workout-engine';
import { formatDate, formatWeight, kgToDisplayUnit, displayUnitToKg } from '@/lib/utils';
import { SESSION_SHORT_LABELS, SESSION_META as SHARED_SESSION_META } from '@/lib/session-meta';

const BAR_CHART_HEIGHT = 100;
const LINE_CHART_HEIGHT = 90;
const HISTORY_PAGE_SIZE = 30;

function formatSessionDuration(seconds: number): string {
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 60) return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getSessionTypeColors(
  C: ReturnType<typeof useColors>
): Record<SessionType, { bg: string; icon: keyof typeof Ionicons.glyphMap; color: string }> {
  return {
    squat: { bg: C.primaryMuted, icon: SHARED_SESSION_META.squat.icon, color: C.primary },
    bench: { bg: C.badgeVolume, icon: SHARED_SESSION_META.bench.icon, color: C.badgeVolumeText },
    deadlift: {
      bg: C.categoryNeuro,
      icon: SHARED_SESSION_META.deadlift.icon,
      color: C.categoryNeuroText,
    },
    conditioning: {
      bg: C.categoryPrehab,
      icon: SHARED_SESSION_META.conditioning.icon,
      color: C.categoryPrehabText,
    },
    prehab: {
      bg: C.categoryMechanical,
      icon: SHARED_SESSION_META.prehab.icon,
      color: C.categoryMechanicalText,
    },
    flexibility: {
      bg: C.categoryCooldown,
      icon: SHARED_SESSION_META.flexibility.icon,
      color: C.categoryCooldownText,
    },
    custom: {
      bg: C.categoryFinisher,
      icon: SHARED_SESSION_META.custom.icon,
      color: C.categoryFinisherText,
    },
    lower_body: { bg: C.primaryMuted, icon: SHARED_SESSION_META.lower_body.icon, color: C.primary },
    upper_body: {
      bg: C.badgeVolume,
      icon: SHARED_SESSION_META.upper_body.icon,
      color: C.badgeVolumeText,
    },
    full_body: {
      bg: C.categoryNeuro,
      icon: SHARED_SESSION_META.full_body.icon,
      color: C.categoryNeuroText,
    },
  };
}

function getEnergyColors(C: ReturnType<typeof useColors>): Record<EnergyLevel, string> {
  return {
    low: C.textTertiary,
    normal: C.primary,
    high: C.primaryLight,
  };
}

// ─── Muscle Progress data layer ───────────────────────────────────────────────
// Maps each MUSCLE_SET region to a heatmapCounts value:
//   0     → inactive (grey)   — not trained in 14 days
//   1     → progressing (green) — trained 1–4 days in last 7 days
//   2     → attention (orange)  — trained 8–14 days ago only
//   4     → overloaded (red)    — trained 5+ days in last 7 days
function getMuscleProgressCounts(
  sessions: CompletedSession[]
): Partial<Record<PainRegion, number>> {
  const targetRegionsMap = getExerciseTargetRegionsMap();
  const now = new Date();
  const cutoff7 = new Date(now);
  cutoff7.setDate(now.getDate() - 7);
  const cutoff14 = new Date(now);
  cutoff14.setDate(now.getDate() - 14);

  const regionDays7 = new Map<PainRegion, Set<string>>();
  const regionDays8to14 = new Map<PainRegion, Set<string>>();

  for (const session of sessions) {
    const sessionDate = new Date(session.date);
    if (sessionDate < cutoff14) continue;
    const dateKey = session.date.slice(0, 10);
    const inLast7 = sessionDate >= cutoff7;
    for (const log of session.exerciseLogs) {
      const regions = targetRegionsMap[log.exerciseId] ?? [];
      for (const region of regions) {
        if (!MUSCLE_SET.has(region)) continue;
        if (inLast7) {
          if (!regionDays7.has(region)) regionDays7.set(region, new Set());
          regionDays7.get(region)!.add(dateKey);
        } else {
          if (!regionDays8to14.has(region)) regionDays8to14.set(region, new Set());
          regionDays8to14.get(region)!.add(dateKey);
        }
      }
    }
  }

  const counts: Partial<Record<PainRegion, number>> = {};
  for (const region of MUSCLE_SET) {
    const days7 = regionDays7.get(region)?.size ?? 0;
    const days8to14 = regionDays8to14.get(region)?.size ?? 0;
    if (days7 >= 5) {
      counts[region] = 4; // overloaded — red
    } else if (days7 >= 1) {
      counts[region] = 1; // progressing — green
    } else if (days8to14 >= 1) {
      counts[region] = 2; // attention — orange
    }
    // else leave undefined → 0 = inactive (grey)
  }
  return counts;
}

const MUSCLE_INSIGHT_STATUS: Record<number, { label: string; color: string; message: string }> = {
  0: {
    label: 'Not Trained',
    color: '#6b7280',
    message: 'No sessions targeting this muscle in the last 2 weeks.',
  },
  1: { label: 'Progressing', color: '#2f6b46', message: 'Good training frequency - keep it up!' },
  2: {
    label: 'Attention',
    color: '#d97706',
    message: 'Last trained 8-14 days ago - consider adding a session this week.',
  },
  4: {
    label: 'High Load',
    color: '#dc2626',
    message: 'Trained on 5+ days this week. Allow some recovery time.',
  },
};

function MuscleProgressPanel({
  completedSessions,
  C,
}: {
  completedSessions: CompletedSession[];
  C: ReturnType<typeof useColors>;
}) {
  const [insightRegion, setInsightRegion] = useState<PainRegion | null>(null);

  const progressCounts = useMemo(
    () => getMuscleProgressCounts(completedSessions),
    [completedSessions]
  );

  const insightData = useMemo(() => {
    if (!insightRegion) return null;
    const targetRegionsMap = getExerciseTargetRegionsMap();
    const nameMap = getExerciseNameMap();
    const cutoff7 = new Date();
    cutoff7.setDate(cutoff7.getDate() - 7);
    const daySet = new Set<string>();
    let totalSets = 0;
    const exSets = new Map<string, { name: string; sets: number }>();
    for (const session of completedSessions) {
      if (new Date(session.date) < cutoff7) continue;
      for (const log of session.exerciseLogs) {
        const regions = targetRegionsMap[log.exerciseId] ?? [];
        if (regions.includes(insightRegion)) {
          daySet.add(session.date.slice(0, 10));
          const completed = log.sets.filter((s) => s.completed).length;
          totalSets += completed;
          const entry = exSets.get(log.exerciseId);
          if (entry) {
            entry.sets += completed;
          } else {
            exSets.set(log.exerciseId, {
              name: nameMap[log.exerciseId] ?? log.exerciseId,
              sets: completed,
            });
          }
        }
      }
    }
    const topExercises = Array.from(exSets.entries())
      .map(([id, { name, sets }]) => ({ id, name, sets }))
      .sort((a, b) => b.sets - a.sets)
      .slice(0, 3);
    const count = progressCounts[insightRegion] ?? 0;
    const statusKey = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 4;
    const status = MUSCLE_INSIGHT_STATUS[statusKey] ?? MUSCLE_INSIGHT_STATUS[0];
    return {
      days: daySet.size,
      avgSets: daySet.size > 0 ? Math.round(totalSets / daySet.size) : 0,
      status,
      topExercises,
    };
  }, [insightRegion, completedSessions, progressCounts]);

  const handleSelect = useCallback((r: PainRegion | undefined) => {
    setInsightRegion((prev) => (r ? (prev === r ? null : r) : null));
  }, []);

  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
      }}
    >
      <Text
        style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 2 }}
      >
        Muscle Progress
      </Text>
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Inter_400Regular',
          color: C.textSecondary,
          marginBottom: 12,
        }}
      >
        Last 14 days · tap a region for details
      </Text>

      {/* Dark panel — front + back side by side */}
      <View
        style={{
          backgroundColor: '#0d0d0d',
          borderRadius: 16,
          paddingVertical: 10,
          paddingHorizontal: 6,
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 10,
              fontFamily: 'Inter_600SemiBold',
              color: 'rgba(255,255,255,0.35)',
              marginBottom: 4,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            Front
          </Text>
          <BodyDiagram
            selected={insightRegion ?? undefined}
            onSelect={handleSelect}
            heatmapCounts={progressCounts}
            defaultView="front"
            compact={true}
            maxWidth={120}
          />
        </View>
        <View
          style={{
            width: 1,
            alignSelf: 'stretch',
            backgroundColor: 'rgba(255,255,255,0.06)',
            marginVertical: 8,
          }}
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 10,
              fontFamily: 'Inter_600SemiBold',
              color: 'rgba(255,255,255,0.35)',
              marginBottom: 4,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            Back
          </Text>
          <BodyDiagram
            selected={insightRegion ?? undefined}
            onSelect={handleSelect}
            heatmapCounts={progressCounts}
            defaultView="back"
            compact={true}
            maxWidth={120}
          />
        </View>
      </View>

      {/* Legend */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginTop: 10,
        }}
      >
        {[
          { color: '#2f6b46', label: 'Progressing' },
          { color: '#d97706', label: 'Attention' },
          { color: '#dc2626', label: 'Too much' },
          { color: '#3a3a3a', label: 'Not trained', border: true },
        ].map((item) => (
          <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: item.color,
                ...(item.border ? { borderWidth: 1, borderColor: '#666' } : {}),
              }}
            />
            <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary }}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Tap-to-insight callout */}
      {insightData && insightRegion && (
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={{
            marginTop: 10,
            backgroundColor: C.surfaceTertiary,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: C.borderLight,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: insightData.status.color,
              flexShrink: 0,
              marginTop: 3,
            }}
          />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>
                {BODY_DIAGRAM_LABELS[insightRegion]}
              </Text>
              <View
                style={{
                  backgroundColor: insightData.status.color + '22',
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: 'Inter_600SemiBold',
                    color: insightData.status.color,
                  }}
                >
                  {insightData.status.label}
                </Text>
              </View>
            </View>
            {insightData.days > 0 && (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Inter_400Regular',
                  color: C.textSecondary,
                  marginBottom: 2,
                }}
              >
                {insightData.days} training day{insightData.days !== 1 ? 's' : ''} this week · avg{' '}
                {insightData.avgSets} set{insightData.avgSets !== 1 ? 's' : ''}/day
              </Text>
            )}
            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
              {insightData.status.message}
            </Text>
            {insightData.topExercises.length > 0 && (
              <View
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: C.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: 'Inter_600SemiBold',
                    color: C.textTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginBottom: 6,
                  }}
                >
                  Top exercises this week
                </Text>
                {insightData.topExercises.map((ex, i) => (
                  <View
                    key={ex.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 3,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Inter_500Medium',
                        color: C.text,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {i + 1}. {ex.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Inter_400Regular',
                        color: C.textSecondary,
                        marginLeft: 8,
                      }}
                    >
                      {ex.sets} set{ex.sets !== 1 ? 's' : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <Pressable onPress={() => setInsightRegion(null)} hitSlop={8} style={{ paddingTop: 2 }}>
            <Ionicons name="close" size={16} color={C.textTertiary} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

function WeeklyBarChart({
  sessions,
  C,
}: {
  sessions: { date: string }[];
  C: ReturnType<typeof useColors>;
}) {
  const [chartWidth, setChartWidth] = useState(280);

  const weeks = useMemo(() => {
    const now = new Date();
    const result: { label: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const count = sessions.filter((s) => {
        const d = new Date(s.date);
        return d >= weekStart && d < weekEnd;
      }).length;
      result.push({ label: '', count });
    }
    return result;
  }, [sessions]);

  const maxCount = Math.max(...weeks.map((w) => w.count), 1);
  const barWidth = chartWidth / weeks.length;
  const barGap = 4;
  const chartHeight = BAR_CHART_HEIGHT;
  const barAreaHeight = chartHeight - 24;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w);
  };

  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
      }}
    >
      <Text
        style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 2 }}
      >
        Training Frequency
      </Text>
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Inter_400Regular',
          color: C.textSecondary,
          marginBottom: 12,
        }}
      >
        Sessions per week, last 8 weeks
      </Text>
      <View onLayout={handleLayout} style={{ width: '100%' }}>
        <Svg width={chartWidth} height={chartHeight + 4}>
          {weeks.map((week, i) => {
            const barH = maxCount > 0 ? (week.count / maxCount) * barAreaHeight : 0;
            const x = i * barWidth + barGap / 2;
            const y = barAreaHeight - barH;
            const bw = barWidth - barGap;
            const isLast = i === weeks.length - 1;
            return (
              <React.Fragment key={i}>
                <Rect
                  x={x}
                  y={y}
                  width={bw}
                  height={barH || 2}
                  rx={4}
                  fill={isLast ? C.primary : C.primaryMuted}
                />
                {isLast && (
                  <SvgText
                    x={x + bw / 2}
                    y={barAreaHeight + 16}
                    textAnchor="middle"
                    fontSize={9}
                    fill={C.textSecondary}
                  >
                    This wk
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}
          <Line
            x1={0}
            y1={barAreaHeight}
            x2={chartWidth}
            y2={barAreaHeight}
            stroke={C.border}
            strokeWidth={1}
          />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
          0
        </Text>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
          peak: {Math.max(...weeks.map((w) => w.count))} sessions
        </Text>
      </View>
    </View>
  );
}

function WeeklyVolumeChart({
  sessions,
  weightUnit,
  C,
}: {
  sessions: CompletedSession[];
  weightUnit: 'kg' | 'lbs';
  C: ReturnType<typeof useColors>;
}) {
  const [chartWidth, setChartWidth] = useState(280);

  const weeks = useMemo(() => {
    const now = new Date();
    const result: { label: string; volume: number }[] = [];
    // Volume = kg × reps. Only strength sessions (squat/bench/deadlift) carry
    // load data. Conditioning, prehab, and flexibility never have weighted sets,
    // so including them would just register as 0-volume entries that drag the
    // weekly bars down. Test Week strength sessions still use these same types
    // and are included naturally.
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const weekSessions = sessions.filter((s) => {
        const d = new Date(s.date);
        return d >= weekStart && d < weekEnd && STRENGTH_SESSION_TYPES.includes(s.sessionType);
      });
      let volKg = 0;
      for (const s of weekSessions) {
        for (const ex of s.exerciseLogs) {
          for (const set of ex.sets) {
            if (set.completed && set.weight > 0) {
              volKg += set.weight * set.reps;
            }
          }
        }
      }
      // Convert to display unit so bar heights and labels are consistent
      result.push({ label: '', volume: Math.round(kgToDisplayUnit(volKg, weightUnit)) });
    }
    return result;
  }, [sessions, weightUnit]);

  const maxVol = Math.max(...weeks.map((w) => w.volume), 1);
  const barWidth = chartWidth / weeks.length;
  const barGap = 4;
  const barAreaHeight = BAR_CHART_HEIGHT - 24;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w);
  };

  const maxVal = Math.max(...weeks.map((w) => w.volume));
  if (maxVal === 0) {
    return (
      <View style={{ marginBottom: 16 }}>
        <EmptyState
          icon="barbell-outline"
          title="No volume yet"
          subtitle="Log a strength session to start tracking weekly volume."
        />
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
      }}
    >
      <Text
        style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 2 }}
      >
        Weekly Volume
      </Text>
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Inter_400Regular',
          color: C.textSecondary,
          marginBottom: 12,
        }}
      >
        Total {weightUnit} lifted per week
      </Text>
      <View onLayout={handleLayout} style={{ width: '100%' }}>
        <Svg width={chartWidth} height={BAR_CHART_HEIGHT + 4}>
          {weeks.map((week, i) => {
            const barH = maxVol > 0 ? (week.volume / maxVol) * barAreaHeight : 0;
            const x = i * barWidth + barGap / 2;
            const y = barAreaHeight - barH;
            const bw = barWidth - barGap;
            const isLast = i === weeks.length - 1;
            return (
              <React.Fragment key={i}>
                <Rect
                  x={x}
                  y={y}
                  width={bw}
                  height={barH || 2}
                  rx={4}
                  fill={isLast ? C.primary : C.primaryMuted}
                />
                {isLast && (
                  <SvgText
                    x={x + bw / 2}
                    y={barAreaHeight + 16}
                    textAnchor="middle"
                    fontSize={9}
                    fill={C.textSecondary}
                  >
                    This wk
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}
          <Line
            x1={0}
            y1={barAreaHeight}
            x2={chartWidth}
            y2={barAreaHeight}
            stroke={C.border}
            strokeWidth={1}
          />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
          0 {weightUnit}
        </Text>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
          peak: {maxVal.toLocaleString()} {weightUnit}
        </Text>
      </View>
    </View>
  );
}

function MonthCalendar({
  sessions,
  C,
}: {
  sessions: CompletedSession[];
  C: ReturnType<typeof useColors>;
}) {
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [displayMonth, setDisplayMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [cellSize, setCellSize] = useState(40);

  const { dayMap, volumeMap, maxVolume } = useMemo(() => {
    const dMap = new Map<string, CompletedSession[]>();
    const vMap = new Map<string, number>();
    let maxVol = 0;
    for (const session of sessions) {
      const dk = session.date.slice(0, 10);
      const arr = dMap.get(dk) ?? [];
      arr.push(session);
      dMap.set(dk, arr);
    }
    for (const [dk, ss] of dMap.entries()) {
      let vol = 0;
      for (const s of ss) {
        for (const ex of s.exerciseLogs) {
          for (const set of ex.sets) {
            if (set.completed && set.weight > 0) vol += set.weight * set.reps;
          }
        }
      }
      vMap.set(dk, vol);
      if (vol > maxVol) maxVol = vol;
    }
    return { dayMap: dMap, volumeMap: vMap, maxVolume: maxVol };
  }, [sessions]);

  const monthLabel = useMemo(
    () => displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [displayMonth]
  );

  const cells = useMemo(() => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0..Sun=6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: { day: number | null; dateKey: string | null }[] = [];
    for (let i = 0; i < firstWeekday; i++) result.push({ day: null, dateKey: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dk = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      result.push({ day: d, dateKey: dk });
    }
    while (result.length % 7 !== 0) result.push({ day: null, dateKey: null });
    return result;
  }, [displayMonth]);

  const isCurrentMonth =
    new Date().getFullYear() === displayMonth.getFullYear() &&
    new Date().getMonth() === displayMonth.getMonth();

  const prevMonth = () => {
    setDisplayMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (!isCurrentMonth) {
      setDisplayMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
      setSelectedDate(null);
    }
  };

  const getCellColor = (dk: string): string | null => {
    const ss = dayMap.get(dk);
    if (!ss || ss.length === 0) return null;
    const vol = volumeMap.get(dk) ?? 0;
    if (maxVolume === 0 || vol === 0) return C.primaryMuted;
    const ratio = vol / maxVolume;
    if (ratio < 0.4) return C.primaryMuted;
    if (ratio < 0.75) return C.primaryLight;
    return C.primary;
  };

  const selectedSessions = selectedDate ? (dayMap.get(selectedDate) ?? []) : [];

  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
      }}
    >
      {/* Month nav header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text }}>
          Training Calendar
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Pressable
            onPress={prevMonth}
            hitSlop={8}
            style={({ pressed }) => ({
              padding: 6,
              borderRadius: 8,
              backgroundColor: pressed ? C.primaryMuted : 'transparent',
            })}
          >
            <Ionicons name="chevron-back" size={16} color={C.primary} />
          </Pressable>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Inter_600SemiBold',
              color: C.text,
              minWidth: 116,
              textAlign: 'center',
            }}
          >
            {monthLabel}
          </Text>
          <Pressable
            onPress={nextMonth}
            disabled={isCurrentMonth}
            hitSlop={8}
            style={({ pressed }) => ({
              padding: 6,
              borderRadius: 8,
              backgroundColor: pressed && !isCurrentMonth ? C.primaryMuted : 'transparent',
              opacity: isCurrentMonth ? 0.3 : 1,
            })}
          >
            <Ionicons name="chevron-forward" size={16} color={C.primary} />
          </Pressable>
        </View>
      </View>

      {/* Day-of-week labels */}
      <View style={{ flexDirection: 'row', marginBottom: 2 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((lbl, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', paddingBottom: 6 }}>
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'Inter_600SemiBold',
                color: i >= 5 ? C.textTertiary : C.textSecondary,
              }}
            >
              {lbl}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setCellSize(Math.floor(w / 7));
        }}
        style={{ flexDirection: 'row', flexWrap: 'wrap' }}
      >
        {cells.map((cell, i) => {
          if (!cell.dateKey || cell.day === null) {
            return <View key={i} style={{ width: cellSize, height: cellSize }} />;
          }
          const color = getCellColor(cell.dateKey);
          const hasSession = color !== null;
          const isToday = cell.dateKey === todayKey;
          const isSelected = cell.dateKey === selectedDate;
          const bgColor = isSelected ? C.primary : hasSession ? color : 'transparent';
          const darkBg = bgColor === C.primary || bgColor === C.primaryLight;
          const textColor =
            isSelected || darkBg ? C.textInverse : hasSession ? C.primary : C.textTertiary;

          return (
            <Pressable
              key={i}
              onPress={() => {
                if (!hasSession) return;
                setSelectedDate(isSelected ? null : cell.dateKey);
              }}
              style={({ pressed }) => ({
                width: cellSize,
                height: cellSize,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                backgroundColor: bgColor,
                borderWidth: isToday && !isSelected ? 1.5 : 0,
                borderColor: C.primary,
                opacity: pressed && hasSession ? 0.75 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: isToday ? 'Inter_700Bold' : 'Inter_500Medium',
                  color: textColor,
                }}
              >
                {cell.day}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tapped-day inline summary */}
      {selectedDate !== null && selectedSessions.length > 0 && (
        <View
          style={{
            marginTop: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: C.borderLight,
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Inter_600SemiBold',
              color: C.textSecondary,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
          {selectedSessions.map((s, idx) => (
            <View
              key={idx}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: C.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={(SHARED_SESSION_META[s.sessionType]?.icon ?? 'fitness-outline') as any}
                  size={14}
                  color={C.primary}
                />
              </View>
              <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text }}>
                {s.displayLabel ?? getSessionLabel(s.sessionType)}
              </Text>
              {s.durationSeconds != null && s.durationSeconds > 0 && (
                <Text
                  style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary }}
                >
                  {formatSessionDuration(s.durationSeconds)}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Volume intensity legend */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
        <Text
          style={{ flex: 1, fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}
        >
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} total
        </Text>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
          Light
        </Text>
        {[C.primaryMuted, C.primaryLight, C.primary].map((col, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: col }} />
        ))}
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
          Heavy
        </Text>
      </View>
    </View>
  );
}

function StrengthLineChart({
  lift,
  orms,
  weightUnit,
  C,
}: {
  lift: SessionType;
  orms: { lift: SessionType; weight: number; date: string }[];
  weightUnit: 'kg' | 'lbs';
  C: ReturnType<typeof useColors>;
}) {
  const [chartWidth, setChartWidth] = useState(280);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Keep these aligned with the session-type colors in `getSessionTypeColors`
  // and the home-screen `SESSION_TYPE_META` so each lift reads the same colour
  // wherever it appears.
  const LIFT_COLORS: Record<string, { line: string; fill: string }> = {
    squat: { line: C.primary, fill: C.primaryMuted },
    bench: { line: C.badgeVolumeText, fill: C.badgeVolume },
    deadlift: { line: C.categoryNeuroText, fill: C.categoryNeuro },
  };

  const data = useMemo(() => {
    return orms
      .filter((o) => o.lift === lift)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-8);
  }, [lift, orms]);

  const liftLabel = lift.charAt(0).toUpperCase() + lift.slice(1);
  const colors = LIFT_COLORS[lift] ?? { line: C.primary, fill: C.primaryMuted };

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w);
  };

  if (data.length === 0) {
    return (
      <View
        style={{
          backgroundColor: C.surface,
          borderRadius: 14,
          padding: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: C.borderLight,
        }}
      >
        <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>
          {liftLabel}
        </Text>
        <View style={{ height: LINE_CHART_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
            No data yet
          </Text>
        </View>
      </View>
    );
  }

  if (data.length === 1) {
    return (
      <View
        style={{
          backgroundColor: C.surface,
          borderRadius: 14,
          padding: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: C.borderLight,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>
            {liftLabel}
          </Text>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: C.primary }}>
            {formatWeight(data[0].weight, weightUnit)}
          </Text>
        </View>
        <View style={{ height: LINE_CHART_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
            1 record - keep training!
          </Text>
        </View>
      </View>
    );
  }

  const weights = data.map((d) => d.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const w = chartWidth;
  const h = LINE_CHART_HEIGHT;
  const pad = 6;

  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d.weight - minW) / range) * (h - pad * 2);
    return { x, y, weight: d.weight, date: d.date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillD = `${pathD} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`;

  const best = Math.max(...weights);
  const isImproving =
    data.length >= 2 && data[data.length - 1].weight >= data[data.length - 2].weight;
  const selectedPoint = selectedIdx !== null ? points[selectedIdx] : null;

  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: C.borderLight,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>
          {liftLabel}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: C.primary }}>
            {formatWeight(best, weightUnit)}
          </Text>
          {isImproving && (
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: C.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="trending-up" size={11} color={C.primary} />
            </View>
          )}
        </View>
      </View>
      <View onLayout={handleLayout} style={{ width: '100%', marginTop: 4 }}>
        <Pressable onPress={() => setSelectedIdx(null)}>
          <Svg width={w} height={h}>
            <Path d={fillD} fill={colors.fill} opacity={0.6} />
            <Path
              d={pathD}
              stroke={colors.line}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <G key={i}>
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={10}
                  fill="transparent"
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedIdx(selectedIdx === i ? null : i);
                  }}
                />
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={selectedIdx === i ? 5 : 3}
                  fill={selectedIdx === i ? colors.line : colors.line}
                  stroke={selectedIdx === i ? C.surface : 'none'}
                  strokeWidth={selectedIdx === i ? 2 : 0}
                />
              </G>
            ))}
            <SvgText x={4} y={h - 2} fontSize={9} fill={C.textTertiary} textAnchor="start">
              {formatWeight(minW, weightUnit)}
            </SvgText>
            <SvgText x={w - 4} y={12} fontSize={9} fill={C.textTertiary} textAnchor="end">
              {formatWeight(maxW, weightUnit)}
            </SvgText>
          </Svg>
        </Pressable>
        {selectedPoint && selectedIdx !== null && (
          <View
            style={{
              position: 'absolute',
              left: Math.max(0, Math.min(selectedPoint.x - 45, w - 90)),
              top: Math.max(0, selectedPoint.y - 40),
              backgroundColor: C.text,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.background }}>
              {formatWeight(selectedPoint.weight, weightUnit)}
            </Text>
            <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: C.textSecondary }}>
              {formatDate(selectedPoint.date)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function SessionHistoryList({
  sessions,
  weightUnit,
  emptyMessage,
  C,
}: {
  sessions: CompletedSession[];
  weightUnit: 'kg' | 'lbs';
  emptyMessage?: string;
  C: ReturnType<typeof useColors>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCount, setShowCount] = useState(HISTORY_PAGE_SIZE);
  const sessionTypeColors = useMemo(() => getSessionTypeColors(C), [C]);
  const energyColors = useMemo(() => getEnergyColors(C), [C]);

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="calendar-outline"
        title={emptyMessage ?? 'No sessions logged yet'}
        subtitle="Try clearing the filter, or start a new session to see it here."
        cta={{
          label: 'Start a session',
          icon: 'flash',
          onPress: () => router.push('/(tabs)/train'),
          testID: 'history-empty-cta',
        }}
        testID="history-empty"
      />
    );
  }

  const visibleSessions = sessions.slice(0, showCount);

  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
        overflow: 'hidden',
      }}
    >
      {visibleSessions.map((session, i) => {
        const meta = sessionTypeColors[session.sessionType];
        const isExpanded = expanded === session.id;
        const heaviestSets = session.exerciseLogs
          .filter((el) => el.sets.some((s) => s.weight > 0))
          .map((el) => {
            const best = el.sets.reduce((b, s) => (s.completed && s.weight > b ? s.weight : b), 0);
            return { name: el.exerciseName, weight: best };
          })
          .filter((el) => el.weight > 0)
          .slice(0, 4);

        return (
          <View key={session.id}>
            {i > 0 && (
              <View style={{ height: 1, backgroundColor: C.borderLight, marginHorizontal: 16 }} />
            )}
            <Pressable
              onPress={() => setExpanded(isExpanded ? null : session.id)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row' as const,
                  alignItems: 'center' as const,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  gap: 12,
                  minHeight: 62,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: meta.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={meta.icon} size={18} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>
                  {session.displayLabel ?? getSessionLabel(session.sessionType)}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Inter_400Regular',
                    color: C.textSecondary,
                    marginTop: 1,
                  }}
                >
                  {formatDate(session.date)}
                  {session.durationSeconds != null && session.durationSeconds > 0
                    ? ` · ${formatSessionDuration(session.durationSeconds)}`
                    : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' as const, gap: 4 }}>
                <View
                  style={{
                    backgroundColor: energyColors[session.energy] + '22',
                    borderRadius: 6,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: 'Inter_600SemiBold',
                      color: energyColors[session.energy],
                    }}
                  >
                    {session.energy.charAt(0).toUpperCase() + session.energy.slice(1)}
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={C.textTertiary}
                />
              </View>
            </Pressable>
            {isExpanded &&
              (heaviestSets.length > 0 || session.exerciseLogs.some((el) => el.note)) && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 }}>
                  {heaviestSets.length === 0 && (
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Inter_400Regular',
                        color: C.textTertiary,
                        paddingVertical: 4,
                      }}
                    >
                      No weight data recorded
                    </Text>
                  )}
                  {heaviestSets.map((ex, idx) => {
                    const logEntry = session.exerciseLogs.find((el) => el.exerciseName === ex.name);
                    return (
                      <View key={idx}>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            paddingVertical: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontFamily: 'Inter_400Regular',
                              color: C.textSecondary,
                            }}
                          >
                            {ex.name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 13,
                              fontFamily: 'Inter_600SemiBold',
                              color: C.primary,
                            }}
                          >
                            {formatWeight(ex.weight, weightUnit)}
                          </Text>
                        </View>
                        {logEntry?.note ? (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'flex-start',
                              gap: 5,
                              paddingBottom: 4,
                            }}
                          >
                            <Ionicons name="create-outline" size={12} color={C.textTertiary} />
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: 'Inter_400Regular',
                                color: C.textTertiary,
                                flex: 1,
                                fontStyle: 'italic',
                              }}
                            >
                              {logEntry.note}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                  {session.exerciseLogs
                    .filter(
                      (el) => el.note && !heaviestSets.find((h) => h.name === el.exerciseName)
                    )
                    .map((el, idx) => (
                      <View
                        key={'note-only-' + idx}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          gap: 5,
                          paddingVertical: 4,
                        }}
                      >
                        <Ionicons name="create-outline" size={12} color={C.textTertiary} />
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: 'Inter_400Regular',
                            color: C.textTertiary,
                            flex: 1,
                            fontStyle: 'italic',
                          }}
                        >
                          {el.exerciseName}: {el.note}
                        </Text>
                      </View>
                    ))}
                </View>
              )}
            {isExpanded &&
              heaviestSets.length === 0 &&
              !session.exerciseLogs.some((el) => el.note) && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  <Text
                    style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary }}
                  >
                    No weight data recorded
                  </Text>
                </View>
              )}
          </View>
        );
      })}
      {sessions.length > showCount && (
        <Pressable
          onPress={() => setShowCount((c) => c + HISTORY_PAGE_SIZE)}
          style={{
            paddingVertical: 14,
            alignItems: 'center',
            borderTopWidth: 1,
            borderTopColor: C.borderLight,
          }}
        >
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary }}>
            Show more ({sessions.length - showCount} remaining)
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const SESSION_TYPE_LABELS = SESSION_SHORT_LABELS;

const ALL_SESSION_TYPES: SessionType[] = [
  'squat',
  'bench',
  'deadlift',
  'lower_body',
  'upper_body',
  'full_body',
  'conditioning',
  'prehab',
  'flexibility',
  'custom',
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSegmentPath(
  cx: number,
  cy: number,
  R: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToCartesian(cx, cy, R, startAngle);
  const outerEnd = polarToCartesian(cx, cy, R, endAngle);
  const innerStart = polarToCartesian(cx, cy, r, endAngle);
  const innerEnd = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${R} ${R} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function SessionTypeBreakdown({
  sessions,
  activeFilter,
  onFilterChange,
  C,
}: {
  sessions: CompletedSession[];
  activeFilter: SessionType | null;
  onFilterChange: (type: SessionType | null) => void;
  C: ReturnType<typeof useColors>;
}) {
  const sessionTypeColors = useMemo(() => getSessionTypeColors(C), [C]);

  const counts = useMemo(() => {
    const map: Record<SessionType, number> = {
      squat: 0,
      bench: 0,
      deadlift: 0,
      conditioning: 0,
      prehab: 0,
      flexibility: 0,
      custom: 0,
      lower_body: 0,
      upper_body: 0,
      full_body: 0,
    };
    for (const s of sessions) {
      if (map[s.sessionType] !== undefined) map[s.sessionType]++;
    }
    return map;
  }, [sessions]);

  const total = sessions.length;
  const activeTypes = ALL_SESSION_TYPES.filter((t) => counts[t] > 0);

  const SIZE = 140;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 58;
  const r = 36;
  const GAP = 2;

  const segments = useMemo(() => {
    const result: { type: SessionType; startAngle: number; endAngle: number }[] = [];
    let angle = 0;
    for (const type of activeTypes) {
      const fraction = counts[type] / total;
      const sweep = fraction * 360;
      const segGap = Math.min(GAP, sweep * 0.4);
      const startAngle = angle + segGap / 2;
      const endAngle = angle + sweep - segGap / 2;
      if (endAngle > startAngle) {
        result.push({ type, startAngle, endAngle });
      }
      angle += sweep;
    }
    return result;
  }, [counts, total, activeTypes]);

  if (total === 0) return null;

  const hasFilter = activeFilter !== null;

  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 2,
        }}
      >
        <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text }}>
          Session Breakdown
        </Text>
        {hasFilter && (
          <Pressable
            onPress={() => onFilterChange(null)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: pressed ? C.primaryMuted : C.primarySurface,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: C.primaryMuted,
            })}
          >
            <Ionicons name="close-circle" size={13} color={C.primary} />
            <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.primary }}>
              Clear
            </Text>
          </Pressable>
        )}
      </View>
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Inter_400Regular',
          color: C.textSecondary,
          marginBottom: 14,
        }}
      >
        {hasFilter
          ? `Tap another type or clear to reset`
          : 'Tap a segment or label to filter history'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Svg width={SIZE} height={SIZE}>
          {segments.map((seg) => {
            const isSelected = activeFilter === seg.type;
            const isDimmed = hasFilter && !isSelected;
            return (
              <Path
                key={seg.type}
                d={donutSegmentPath(cx, cy, R, r, seg.startAngle, seg.endAngle)}
                fill={sessionTypeColors[seg.type].color}
                opacity={isDimmed ? 0.25 : isSelected ? 1 : 0.9}
                onPress={() => onFilterChange(isSelected ? null : seg.type)}
              />
            );
          })}
          <SvgText
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fontSize={20}
            fontWeight="bold"
            fill={C.text}
          >
            {total}
          </SvgText>
          <SvgText x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill={C.textSecondary}>
            total
          </SvgText>
        </Svg>
        <View style={{ flex: 1, gap: 6 }}>
          {activeTypes.map((type) => {
            const pct = Math.round((counts[type] / total) * 100);
            const meta = sessionTypeColors[type];
            const isSelected = activeFilter === type;
            const isDimmed = hasFilter && !isSelected;
            return (
              <Pressable
                key={type}
                onPress={() => onFilterChange(isSelected ? null : type)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 8,
                  paddingVertical: 3,
                  paddingHorizontal: 4,
                  backgroundColor: isSelected
                    ? meta.bg
                    : pressed
                      ? C.surfaceTertiary
                      : 'transparent',
                  opacity: isDimmed ? 0.35 : 1,
                })}
              >
                <View
                  style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: meta.color }}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontFamily: isSelected ? 'Inter_600SemiBold' : 'Inter_400Regular',
                    color: isSelected ? meta.color : C.textSecondary,
                  }}
                  numberOfLines={1}
                >
                  {SESSION_TYPE_LABELS[type]}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Inter_600SemiBold',
                    color: isSelected ? meta.color : C.text,
                    minWidth: 22,
                    textAlign: 'right',
                  }}
                >
                  {counts[type]}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: 'Inter_400Regular',
                    color: C.textTertiary,
                    minWidth: 32,
                    textAlign: 'right',
                  }}
                >
                  {pct}%
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const LIFT_LABELS: Record<string, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
};

const LIFT_TYPES: SessionType[] = ['squat', 'bench', 'deadlift'];

function PBHistorySection({
  orms,
  weightUnit,
  C,
}: {
  orms: { lift: SessionType; weight: number; date: string }[];
  weightUnit: 'kg' | 'lbs';
  C: ReturnType<typeof useColors>;
}) {
  const strengthOrms = useMemo(
    () => orms.filter((o) => LIFT_TYPES.includes(o.lift as SessionType)),
    [orms]
  );

  if (strengthOrms.length === 0) {
    return (
      <View
        style={{
          backgroundColor: C.surface,
          borderRadius: 16,
          padding: 20,
          borderWidth: 1,
          borderColor: C.borderLight,
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <Ionicons name="trophy-outline" size={28} color={C.textTertiary} />
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Inter_400Regular',
            color: C.textTertiary,
            marginTop: 8,
          }}
        >
          No strength tests yet
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Inter_400Regular',
            color: C.textTertiary,
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          Save your first PB using the calculator below
        </Text>
      </View>
    );
  }

  const allTimeBests: Record<string, number> = {};
  for (const o of strengthOrms) {
    if (!allTimeBests[o.lift] || o.weight > allTimeBests[o.lift]) {
      allTimeBests[o.lift] = o.weight;
    }
  }

  const grouped: Record<string, typeof strengthOrms> = { squat: [], bench: [], deadlift: [] };
  for (const o of strengthOrms) {
    if (grouped[o.lift]) {
      grouped[o.lift].push(o);
    }
  }
  for (const lift of LIFT_TYPES) {
    grouped[lift] = grouped[lift].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  const liftsWithData = LIFT_TYPES.filter((lift) => grouped[lift].length > 0);

  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
        overflow: 'hidden',
        marginBottom: 10,
      }}
    >
      {liftsWithData.map((lift, liftIdx) => {
        const entries = grouped[lift];
        const best = allTimeBests[lift];
        return (
          <View key={lift}>
            {liftIdx > 0 && <View style={{ height: 1, backgroundColor: C.borderLight }} />}
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Inter_700Bold',
                  color: C.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 8,
                }}
              >
                {LIFT_LABELS[lift]}
              </Text>
              {entries.map((entry, i) => {
                const isAllTimeBest = entry.weight === best;
                return (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 6,
                      gap: 8,
                    }}
                  >
                    {isAllTimeBest ? (
                      <Ionicons name="trophy" size={14} color={C.warning} />
                    ) : (
                      <View style={{ width: 14 }} />
                    )}
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontFamily: 'Inter_400Regular',
                        color: C.textSecondary,
                      }}
                    >
                      {formatDate(entry.date)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: 'Inter_700Bold',
                        color: isAllTimeBest ? C.primary : C.text,
                      }}
                    >
                      {formatWeight(entry.weight, weightUnit)}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={{ height: 8 }} />
          </View>
        );
      })}
    </View>
  );
}

function OneRMCalculator({
  weightUnit,
  addOneRepMax,
  C,
}: {
  weightUnit: 'kg' | 'lbs';
  addOneRepMax: (orm: { lift: SessionType; weight: number; date: string; unit: 'kg' }) => void;
  C: ReturnType<typeof useColors>;
}) {
  const [weightInput, setWeightInput] = useState('');
  const [repsInput, setRepsInput] = useState('');
  const [selectedLift, setSelectedLift] = useState<SessionType>('squat');
  const [result, setResult] = useState<number | null>(null);

  const calculate = useCallback(() => {
    const w = parseFloat(weightInput);
    const r = parseInt(repsInput, 10);
    if (!w || !r || w <= 0 || r <= 0 || r > 30) {
      Alert.alert('Invalid input', 'Enter a valid weight and rep count (1-30).');
      return;
    }
    const weightInKg = displayUnitToKg(w, weightUnit);
    const orm = weightInKg * (1 + r / 30);
    setResult(parseFloat(orm.toFixed(2)));
  }, [weightInput, repsInput, weightUnit]);

  const savePB = useCallback(() => {
    if (result === null) return;
    addOneRepMax({
      lift: selectedLift,
      weight: result,
      date: new Date().toISOString(),
      unit: 'kg',
    });
    Alert.alert(
      'Saved!',
      `${LIFT_LABELS[selectedLift]} PB of ${formatWeight(result, weightUnit)} saved.`
    );
    setWeightInput('');
    setRepsInput('');
    setResult(null);
  }, [result, selectedLift, weightUnit, addOneRepMax]);

  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Ionicons name="calculator-outline" size={18} color={C.primary} />
        <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text }}>
          1RM Calculator
        </Text>
      </View>
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Inter_400Regular',
          color: C.textSecondary,
          marginBottom: 14,
        }}
      >
        Epley formula - enter the weight you lifted and how many reps
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Inter_600SemiBold',
              color: C.textSecondary,
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Weight ({weightUnit})
          </Text>
          <TextInput
            style={{
              height: 44,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: C.border,
              backgroundColor: C.surfaceTertiary,
              paddingHorizontal: 12,
              fontSize: 16,
              fontFamily: 'Inter_600SemiBold',
              color: C.text,
              textAlign: 'center',
            }}
            value={weightInput}
            onChangeText={setWeightInput}
            placeholder="0"
            placeholderTextColor={C.textTertiary}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Inter_600SemiBold',
              color: C.textSecondary,
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Reps
          </Text>
          <TextInput
            style={{
              height: 44,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: C.border,
              backgroundColor: C.surfaceTertiary,
              paddingHorizontal: 12,
              fontSize: 16,
              fontFamily: 'Inter_600SemiBold',
              color: C.text,
              textAlign: 'center',
            }}
            value={repsInput}
            onChangeText={setRepsInput}
            placeholder="0"
            placeholderTextColor={C.textTertiary}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </View>
      </View>

      <Pressable
        onPress={calculate}
        style={({ pressed }) => ({
          backgroundColor: pressed ? C.primaryDark : C.primary,
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: 'center',
          marginBottom: 12,
        })}
      >
        <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: C.textInverse }}>
          Calculate
        </Text>
      </Pressable>

      {result !== null && (
        <View
          style={{
            backgroundColor: C.surfaceSecondary,
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: C.border,
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Inter_400Regular',
              color: C.primary,
              marginBottom: 4,
              textAlign: 'center',
            }}
          >
            Estimated 1RM
          </Text>
          <Text
            style={{
              fontSize: 32,
              fontFamily: 'Inter_700Bold',
              color: C.primary,
              textAlign: 'center',
            }}
          >
            {formatWeight(result, weightUnit)}
          </Text>

          <View style={{ marginTop: 14 }}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Inter_600SemiBold',
                color: C.textSecondary,
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                textAlign: 'center',
              }}
            >
              Save as Personal Best for
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
              {LIFT_TYPES.map((lift) => (
                <Pressable
                  key={lift}
                  onPress={() => setSelectedLift(lift)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    alignItems: 'center',
                    backgroundColor: selectedLift === lift ? C.primary : C.surfaceTertiary,
                    borderWidth: 1.5,
                    borderColor: selectedLift === lift ? C.primary : C.borderLight,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Inter_700Bold',
                      color: selectedLift === lift ? C.textInverse : C.textSecondary,
                    }}
                  >
                    {LIFT_LABELS[lift]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={savePB}
              style={({ pressed }) => ({
                marginTop: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 11,
                borderRadius: 10,
                backgroundColor: pressed ? C.surfaceTertiary : C.surface,
                borderWidth: 1.5,
                borderColor: C.primary,
              })}
            >
              <Ionicons name="trophy-outline" size={16} color={C.primary} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primary }}>
                Save as {LIFT_LABELS[selectedLift]} PB
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const PROGRESS_GROUP_ORDER: SessionType[] = [
  'squat',
  'bench',
  'deadlift',
  'conditioning',
  'prehab',
  'flexibility',
  'custom',
];

type TrendDirection = 'up' | 'down' | 'flat' | null;

function computeTrend(appearances: { avgWorkingWeight: number }[]): TrendDirection {
  if (appearances.length < 3) return null;
  const recent = appearances.slice(-3);
  const prior = appearances.slice(-6, -3);
  if (prior.length === 0) return 'flat';
  const mean = (arr: { avgWorkingWeight: number }[]) =>
    arr.reduce((sum, a) => sum + a.avgWorkingWeight, 0) / arr.length;
  const recentAvg = mean(recent);
  const priorAvg = mean(prior);
  const threshold = priorAvg * 0.01;
  if (recentAvg - priorAvg > threshold) return 'up';
  if (recentAvg - priorAvg < -threshold) return 'down';
  return 'flat';
}

function ExerciseSparkline({
  appearances,
  color,
  C,
}: {
  appearances: { avgWorkingWeight: number }[];
  color: string;
  C: ReturnType<typeof useColors>;
}) {
  const W = 78;
  const H = 32;
  const pad = 4;
  const data = appearances.slice(-8).map((a) => a.avgWorkingWeight);

  if (data.length < 2) {
    return (
      <View style={{ width: W, height: H, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
          1 log
        </Text>
      </View>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return { x, y };
  });
  const polyPoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <Svg width={W} height={H}>
      <Polyline
        points={polyPoints}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={last.x} cy={last.y} r={2.75} fill={color} />
    </Svg>
  );
}

function TrendArrow({ trend, C }: { trend: TrendDirection; C: ReturnType<typeof useColors> }) {
  if (trend === null) return <View style={{ width: 18 }} />;
  const config: Record<
    'up' | 'down' | 'flat',
    { icon: keyof typeof Ionicons.glyphMap; color: string }
  > = {
    up: { icon: 'arrow-up', color: C.primary },
    flat: { icon: 'remove', color: C.textTertiary },
    down: { icon: 'arrow-down', color: C.warning },
  };
  const c = config[trend];
  return <Ionicons name={c.icon} size={16} color={c.color} />;
}

function ExerciseProgressRow({
  progress,
  weightUnit,
  onPress,
  C,
}: {
  progress: ExerciseProgress;
  weightUnit: 'kg' | 'lbs';
  onPress: () => void;
  C: ReturnType<typeof useColors>;
}) {
  const pb = useMemo(
    () => progress.appearances.reduce((b, a) => (a.bestSetWeight > b ? a.bestSetWeight : b), 0),
    [progress.appearances]
  );
  const trend = useMemo(() => computeTrend(progress.appearances), [progress.appearances]);
  const count = progress.appearances.length;

  return (
    <Pressable
      onPress={onPress}
      testID={`progress-row-${progress.exerciseId}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        minHeight: 64,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}
          numberOfLines={1}
        >
          {progress.exerciseName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <View
            style={{
              backgroundColor: C.primaryMuted,
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: C.primary }}>
              PB {formatWeight(pb, weightUnit)}
            </Text>
          </View>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
            ×{count} session{count !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      <ExerciseSparkline appearances={progress.appearances} color={C.primary} C={C} />
      <TrendArrow trend={trend} C={C} />
      <Ionicons name="chevron-forward" size={15} color={C.textTertiary} />
    </Pressable>
  );
}

function ExerciseProgressList({
  weightUnit,
  totalSessions,
  onSelect,
  C,
}: {
  weightUnit: 'kg' | 'lbs';
  totalSessions: number;
  onSelect: (p: ExerciseProgress) => void;
  C: ReturnType<typeof useColors>;
}) {
  const getAllExerciseProgress = useAppStore((s) => s.getAllExerciseProgress);
  const completedSessions = useAppStore((s) => s.completedSessions);

  // completedSessions triggers recompute when session data changes; getAllExerciseProgress is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const progress = useMemo(
    () => getAllExerciseProgress(),
    [getAllExerciseProgress, completedSessions]
  );

  const totalVolumeKg = useMemo(() => {
    let vol = 0;
    for (const s of completedSessions) {
      for (const ex of s.exerciseLogs) {
        for (const set of ex.sets) {
          if (set.completed && set.weight > 0) vol += set.weight * set.reps;
        }
      }
    }
    return vol;
  }, [completedSessions]);

  const grouped = useMemo(() => {
    const map = new Map<SessionType, ExerciseProgress[]>();
    for (const p of progress) {
      const arr = map.get(p.sessionType) ?? [];
      arr.push(p);
      map.set(p.sessionType, arr);
    }
    // Heaviest PB first within each group.
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const pbA = a.appearances.reduce((m, ap) => Math.max(m, ap.bestSetWeight), 0);
        const pbB = b.appearances.reduce((m, ap) => Math.max(m, ap.bestSetWeight), 0);
        return pbB - pbA;
      });
    }
    return PROGRESS_GROUP_ORDER.filter((t) => map.has(t)).map((t) => ({
      type: t,
      items: map.get(t)!,
    }));
  }, [progress]);

  const totalVolumeDisplay = Math.round(kgToDisplayUnit(totalVolumeKg, weightUnit));

  if (progress.length === 0) {
    return (
      <EmptyState
        icon="trending-up-outline"
        title="No weighted exercises yet"
        subtitle="Log a strength session with weights to start tracking lifetime progress for each exercise."
        cta={{
          label: 'Start a session',
          icon: 'flash',
          onPress: () => router.push('/(tabs)/train'),
          testID: 'progress-empty-cta',
        }}
        testID="progress-empty"
      />
    );
  }

  return (
    <View>
      {/* Quick stats */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: C.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: C.borderLight,
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: C.primary }}>
            {progress.length}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Inter_500Medium',
              color: C.textSecondary,
              marginTop: 2,
              textAlign: 'center',
            }}
          >
            Exercises
          </Text>
        </View>
        <View style={{ width: 1, height: 32, backgroundColor: C.border }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: C.primary }}>
            {totalSessions}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Inter_500Medium',
              color: C.textSecondary,
              marginTop: 2,
              textAlign: 'center',
            }}
          >
            Sessions
          </Text>
        </View>
        <View style={{ width: 1, height: 32, backgroundColor: C.border }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: C.primary }}>
            {totalVolumeDisplay.toLocaleString()}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Inter_500Medium',
              color: C.textSecondary,
              marginTop: 2,
              textAlign: 'center',
            }}
          >
            {weightUnit} lifted
          </Text>
        </View>
      </View>

      {grouped.map((group) => (
        <View key={group.type} style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Inter_700Bold',
              color: C.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 8,
              marginLeft: 2,
            }}
          >
            {SHARED_SESSION_META[group.type].label}
          </Text>
          <View
            style={{
              backgroundColor: C.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: C.borderLight,
              overflow: 'hidden',
            }}
          >
            {group.items.map((p, i) => (
              <View key={p.exerciseId}>
                {i > 0 && (
                  <View
                    style={{ height: 1, backgroundColor: C.borderLight, marginHorizontal: 14 }}
                  />
                )}
                <ExerciseProgressRow
                  progress={p}
                  weightUnit={weightUnit}
                  onPress={() => onSelect(p)}
                  C={C}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const EG_H = 190;
const EG_LEFT = 44;
const EG_RIGHT = 8;
const EG_TOP = 14;
const EG_BOTTOM = 28;

function ExerciseGraph({
  appearances,
  weightUnit,
  C,
}: {
  appearances: { date: string; bestSetWeight: number }[];
  weightUnit: 'kg' | 'lbs';
  C: ReturnType<typeof useColors>;
}) {
  const [chartWidth, setChartWidth] = useState(300);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (appearances.length < 2) {
    return (
      <View
        style={{
          height: EG_H,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Ionicons name="trending-up-outline" size={28} color={C.textTertiary} />
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Inter_500Medium',
            color: C.textSecondary,
            textAlign: 'center',
          }}
        >
          Keep training to see your progression
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Inter_400Regular',
            color: C.textTertiary,
            textAlign: 'center',
          }}
        >
          Graph needs at least 2 sessions
        </Text>
      </View>
    );
  }

  const innerW = chartWidth - EG_LEFT - EG_RIGHT;
  const innerH = EG_H - EG_TOP - EG_BOTTOM;

  const weights = appearances.map((a) => a.bestSetWeight);
  const pbWeight = Math.max(...weights);
  const minWeight = Math.min(...weights);
  const range = pbWeight - minWeight || 1;

  const toX = (i: number) =>
    EG_LEFT + (appearances.length > 1 ? (i / (appearances.length - 1)) * innerW : innerW / 2);
  const toY = (w: number) => EG_TOP + innerH - ((w - minWeight) / range) * innerH;

  const points = appearances.map((a, i) => ({ x: toX(i), y: toY(a.bestSetWeight), ...a }));
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const yTicks = 4;
  const yTickWeights = Array.from(
    { length: yTicks },
    (_, i) => minWeight + (range / (yTicks - 1)) * i
  );

  const maxXLabels = Math.min(5, appearances.length);
  const xLabelIndices =
    appearances.length <= 5
      ? appearances.map((_, i) => i)
      : Array.from({ length: maxXLabels }, (_, i) =>
          Math.round((i / (maxXLabels - 1)) * (appearances.length - 1))
        );

  const pbIdx = weights.indexOf(pbWeight);
  const selectedPoint = selectedIdx !== null ? points[selectedIdx] : null;

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setChartWidth(w);
      }}
      style={{ width: '100%' }}
    >
      <Pressable onPress={() => setSelectedIdx(null)}>
        <Svg width={chartWidth} height={EG_H}>
          {yTickWeights.map((w, i) => {
            const y = toY(w);
            return (
              <G key={i}>
                <Line
                  x1={EG_LEFT}
                  y1={y}
                  x2={chartWidth - EG_RIGHT}
                  y2={y}
                  stroke={C.borderLight}
                  strokeWidth={1}
                  strokeDasharray={i === 0 ? undefined : '3 3'}
                />
                <SvgText
                  x={EG_LEFT - 4}
                  y={y + 3.5}
                  fontSize={9}
                  fill={C.textTertiary}
                  textAnchor="end"
                >
                  {Math.round(kgToDisplayUnit(w, weightUnit))}
                </SvgText>
              </G>
            );
          })}

          <Path
            d={pathD}
            stroke={C.primary}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p, i) => {
            const isPB = i === pbIdx;
            const isSelected = i === selectedIdx;
            return (
              <G key={i}>
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={16}
                  fill="transparent"
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedIdx(selectedIdx === i ? null : i);
                  }}
                />
                {isPB && <Circle cx={p.x} cy={p.y} r={8} fill={C.achievementGold} opacity={0.18} />}
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? 6 : isPB ? 5.5 : 4}
                  fill={isPB ? C.achievementGold : C.primary}
                  stroke={isSelected ? C.surface : 'none'}
                  strokeWidth={isSelected ? 2 : 0}
                />
              </G>
            );
          })}

          {xLabelIndices.map((idx) => (
            <SvgText
              key={idx}
              x={points[idx].x}
              y={EG_H - 2}
              fontSize={9}
              fill={C.textTertiary}
              textAnchor={idx === 0 ? 'start' : idx === appearances.length - 1 ? 'end' : 'middle'}
            >
              {formatShortDate(appearances[idx].date)}
            </SvgText>
          ))}
        </Svg>
      </Pressable>

      {selectedPoint !== null && selectedIdx !== null && (
        <View
          style={{
            position: 'absolute',
            left: Math.max(EG_LEFT, Math.min(selectedPoint.x - 38, chartWidth - 84)),
            top: Math.max(0, selectedPoint.y - 48),
            backgroundColor: C.text,
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
          pointerEvents="none"
        >
          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: C.background }}>
            {formatWeight(selectedPoint.bestSetWeight, weightUnit)}
          </Text>
          <Text
            style={{
              fontSize: 9,
              fontFamily: 'Inter_400Regular',
              color: C.background,
              opacity: 0.7,
            }}
          >
            {formatShortDate(selectedPoint.date)}
          </Text>
        </View>
      )}
    </View>
  );
}

function ExerciseDetailSheet({
  progress,
  weightUnit,
  insets,
  onClose,
  C,
}: {
  progress: ExerciseProgress | null;
  weightUnit: 'kg' | 'lbs';
  insets: { top: number; bottom: number };
  onClose: () => void;
  C: ReturnType<typeof useColors>;
}) {
  const styles = useMemo(() => makeStyles(C), [C]);
  const pb = useMemo(
    () =>
      progress
        ? progress.appearances.reduce((b, a) => (a.bestSetWeight > b ? a.bestSetWeight : b), 0)
        : 0,
    [progress]
  );
  const count = progress?.appearances.length ?? 0;
  const firstDate = progress?.appearances[0]?.date ?? null;

  return (
    <Modal
      visible={progress !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { paddingTop: insets.top + 16 }]}>
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {progress?.exerciseName ?? ''}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Inter_500Medium',
                color: C.textSecondary,
                marginTop: 2,
              }}
            >
              All-time best {formatWeight(pb, weightUnit)} · {count} session
              {count !== 1 ? 's' : ''}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.modalClose, pressed && { opacity: 0.7 }]}
            testID="progress-detail-close"
          >
            <Ionicons name="close" size={20} color={C.text} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary stats */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: C.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: C.borderLight,
              padding: 16,
              marginBottom: 16,
              alignItems: 'center',
            }}
          >
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="trophy" size={13} color={C.primary} />
                <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: C.primary }}>
                  {formatWeight(pb, weightUnit)}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Inter_500Medium',
                  color: C.textSecondary,
                  marginTop: 3,
                }}
              >
                Personal Best
              </Text>
            </View>
            <View style={{ width: 1, height: 32, backgroundColor: C.border }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text }}>
                {count}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Inter_500Medium',
                  color: C.textSecondary,
                  marginTop: 3,
                }}
              >
                Sessions
              </Text>
            </View>
            <View style={{ width: 1, height: 32, backgroundColor: C.border }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text }}>
                {firstDate ? formatShortDate(firstDate) : '-'}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Inter_500Medium',
                  color: C.textSecondary,
                  marginTop: 3,
                }}
              >
                First logged
              </Text>
            </View>
          </View>

          {/* Progression graph */}
          <View
            style={{
              backgroundColor: C.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: C.borderLight,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Inter_700Bold',
                color: C.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 12,
              }}
            >
              Best set per session · {weightUnit}
            </Text>
            {progress && (
              <ExerciseGraph appearances={progress.appearances} weightUnit={weightUnit} C={C} />
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const {
    completedSessions,
    oneRepMaxes,
    getStreakDays,
    getThisWeekCount,
    weightUnit,
    addOneRepMax,
    historyTypeFilter,
    setHistoryTypeFilter,
    getEffectiveTier,
  } = useAppStore();

  const historyFilter = historyTypeFilter;
  const setHistoryFilter = setHistoryTypeFilter;

  const [activeTab, setActiveTab] = useState<'overview' | 'strength' | 'history' | 'progress'>(
    'overview'
  );
  const [dateFilter, setDateFilter] = useState<'all' | 'this_week' | 'this_month'>('all');
  const [showCalculator, setShowCalculator] = useState(false);
  const [selectedProgress, setSelectedProgress] = useState<ExerciseProgress | null>(null);
  const [painRegionFilter, setPainRegionFilter] = useState<PainRegion | null>(null);
  const [painInsightRegion, setPainInsightRegion] = useState<PainRegion | null>(null);
  const [painHeatmapMode, setPainHeatmapMode] = useState<'all' | 'recent'>('all');
  const [painOverviewSelected, setPainOverviewSelected] = useState<PainRegion | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [painPatternsExpanded, setPainPatternsExpanded] = useState(false);

  useEffect(() => {
    if (historyFilter && !completedSessions.some((s) => s.sessionType === historyFilter)) {
      setHistoryFilter(null);
    }
  }, [historyFilter, completedSessions, setHistoryFilter]);

  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const styles = useMemo(() => makeStyles(C), [C]);

  const painRegionCounts = useMemo(() => {
    const counts: Partial<Record<PainRegion, number>> = {};
    for (const s of completedSessions) {
      if (s.painRegion) {
        counts[s.painRegion] = (counts[s.painRegion] ?? 0) + 1;
      }
    }
    return counts;
  }, [completedSessions]);

  const recentPainCounts = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const counts: Partial<Record<PainRegion, number>> = {};
    for (const s of completedSessions) {
      if (s.painRegion && new Date(s.date) >= cutoff) {
        counts[s.painRegion] = (counts[s.painRegion] ?? 0) + 1;
      }
    }
    return counts;
  }, [completedSessions]);

  const previousPainCounts = useMemo(() => {
    const now = new Date();
    const recentCutoff = new Date(now);
    recentCutoff.setDate(now.getDate() - 28);
    const prevCutoff = new Date(now);
    prevCutoff.setDate(now.getDate() - 56);
    const counts: Partial<Record<PainRegion, number>> = {};
    for (const s of completedSessions) {
      if (s.painRegion) {
        const d = new Date(s.date);
        if (d >= prevCutoff && d < recentCutoff) {
          counts[s.painRegion] = (counts[s.painRegion] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [completedSessions]);

  const painTrends = useMemo((): Partial<Record<PainRegion, '↑' | '↓' | '→'>> => {
    const allRegions = new Set([
      ...Object.keys(recentPainCounts),
      ...Object.keys(previousPainCounts),
    ]) as Set<PainRegion>;
    const trends: Partial<Record<PainRegion, '↑' | '↓' | '→'>> = {};
    for (const region of allRegions) {
      const recent = recentPainCounts[region] ?? 0;
      const prev = previousPainCounts[region] ?? 0;
      if (recent > prev) trends[region] = '↑';
      else if (recent < prev) trends[region] = '↓';
      else trends[region] = '→';
    }
    return trends;
  }, [recentPainCounts, previousPainCounts]);

  const hasAnyPainHistory = Object.keys(painRegionCounts).length > 0;

  const filteredSessions = useMemo(() => {
    const now = new Date();
    let cutoff: Date | null = null;
    if (dateFilter === 'this_week') {
      cutoff = new Date(now);
      cutoff.setDate(now.getDate() - now.getDay());
      cutoff.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'this_month') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return completedSessions.filter((s) => {
      if (historyFilter && s.sessionType !== historyFilter) return false;
      if (cutoff && new Date(s.date) < cutoff) return false;
      if (painRegionFilter && s.painRegion !== painRegionFilter) return false;
      return true;
    });
  }, [completedSessions, historyFilter, dateFilter, painRegionFilter]);

  const DATE_FILTER_LABELS: Record<typeof dateFilter, string> = {
    all: 'All',
    this_week: 'This week',
    this_month: 'This month',
  };
  const DATE_FILTER_SCOPE: Record<typeof dateFilter, string> = {
    all: '',
    this_week: 'this week',
    this_month: 'this month',
  };

  const historyHeading = painRegionFilter
    ? `${BODY_DIAGRAM_LABELS[painRegionFilter]} Pain`
    : historyFilter
      ? `${SESSION_TYPE_LABELS[historyFilter]} Sessions`
      : 'Session History';
  const hasActiveFilter =
    historyFilter !== null || dateFilter !== 'all' || painRegionFilter !== null;
  const sessionWord = `session${filteredSessions.length !== 1 ? 's' : ''}`;
  const scope = DATE_FILTER_SCOPE[dateFilter];
  const historySubheading = hasActiveFilter
    ? `${filteredSessions.length} ${sessionWord}${scope ? ` ${scope}` : ''} · tap a row for details`
    : 'Tap a row to see exercise details';

  const historyEmptyMessage = (() => {
    if (painRegionFilter) {
      const regionName = BODY_DIAGRAM_LABELS[painRegionFilter];
      return `No sessions with ${regionName} flagged${scope ? ` ${scope}` : ''}`;
    }
    const typePart = historyFilter ? ` ${SESSION_TYPE_LABELS[historyFilter].toLowerCase()}` : '';
    if (scope) return `No${typePart} sessions ${scope} yet`;
    if (historyFilter) return `No${typePart} sessions yet`;
    return 'No sessions logged yet';
  })();

  const TABS = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'strength' as const, label: 'Strength' },
    { key: 'progress' as const, label: 'Progress' },
    { key: 'history' as const, label: 'History' },
  ];

  const tabPaddingBottom = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 80;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>Your training progress at a glance</Text>
      </View>

      {/* Segment control */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={({ pressed }) => [
                  styles.segmentTab,
                  active && styles.segmentTabActive,
                  pressed && !active && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.segmentTabText, active && styles.segmentTabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Empty state */}
      {completedSessions.length === 0 && (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="stats-chart-outline"
            title="No sessions yet"
            subtitle="Your charts and personal bests show up here once you log your first session."
            cta={{
              label: 'Start your first session',
              icon: 'flash',
              onPress: () => router.push('/(tabs)/train'),
              testID: 'stats-empty-cta',
            }}
            testID="stats-empty"
          />
        </View>
      )}

      {completedSessions.length > 0 && (
        <View style={{ flex: 1 }}>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.tabContent, { paddingBottom: tabPaddingBottom }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.statRow}>
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{completedSessions.length}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statDiv} />
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{streak}</Text>
                  <Text style={styles.statLabel}>Day Streak</Text>
                </View>
                <View style={styles.statDiv} />
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{weekCount}</Text>
                  <Text style={styles.statLabel}>This Week</Text>
                </View>
              </View>

              {/* Training Calendar — compact row, opens modal */}
              <Pressable
                onPress={() => setShowCalendar(true)}
                style={({ pressed }) => ({
                  backgroundColor: C.surface,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: C.borderLight,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: C.primaryMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="calendar-outline" size={18} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text }}>
                    Training Calendar
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Inter_400Regular',
                      color: C.textSecondary,
                      marginTop: 1,
                    }}
                  >
                    {completedSessions.length} session{completedSessions.length !== 1 ? 's' : ''}{' '}
                    logged · tap to view
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
              </Pressable>

              {/* Muscle Progress — front + back body view */}
              <MuscleProgressPanel completedSessions={completedSessions} C={C} />

              <WeeklyBarChart sessions={completedSessions} C={C} />
              <WeeklyVolumeChart sessions={completedSessions} weightUnit={weightUnit} C={C} />
              <SessionTypeBreakdown
                sessions={completedSessions}
                activeFilter={historyFilter}
                onFilterChange={(type) => {
                  setHistoryFilter(type);
                  if (type !== null) setActiveTab('history');
                }}
                C={C}
              />
              {hasAnyPainHistory && (
                <Animated.View entering={FadeInDown.delay(120).duration(380)}>
                  <View
                    style={{
                      backgroundColor: C.surface,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: C.borderLight,
                      overflow: 'hidden',
                      marginBottom: 16,
                    }}
                  >
                    {/* Collapsible header row */}
                    <Pressable
                      onPress={() => setPainPatternsExpanded((e) => !e)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        paddingTop: 14,
                        paddingBottom: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 15,
                            fontFamily: 'Inter_600SemiBold',
                            color: C.text,
                            marginBottom: 2,
                          }}
                        >
                          Pain Patterns
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: 'Inter_400Regular',
                            color: C.textSecondary,
                          }}
                        >
                          {Object.keys(painRegionCounts).length} region
                          {Object.keys(painRegionCounts).length !== 1 ? 's' : ''} flagged · tap to{' '}
                          {painPatternsExpanded ? 'collapse' : 'expand'}
                        </Text>
                      </View>
                      <Ionicons
                        name={painPatternsExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={C.textTertiary}
                      />
                    </Pressable>

                    {painPatternsExpanded && (
                      <>
                        {/* Mode toggle */}
                        <View
                          style={{
                            paddingHorizontal: 16,
                            paddingBottom: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: 'Inter_400Regular',
                              color: C.textSecondary,
                              flex: 1,
                            }}
                          >
                            {painHeatmapMode === 'all'
                              ? 'Darker = flagged more often · tap to act'
                              : 'Last 4 weeks · ↑ worse · ↓ better · → stable'}
                          </Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              backgroundColor: C.surfaceTertiary,
                              borderRadius: 8,
                              padding: 2,
                              borderWidth: 1,
                              borderColor: C.borderLight,
                              marginLeft: 10,
                            }}
                          >
                            {(['all', 'recent'] as const).map((mode) => {
                              const active = painHeatmapMode === mode;
                              return (
                                <Pressable
                                  key={mode}
                                  onPress={() => {
                                    setPainHeatmapMode(mode);
                                    setPainOverviewSelected(null);
                                  }}
                                  style={({ pressed }) => ({
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 6,
                                    backgroundColor: active ? C.surface : 'transparent',
                                    opacity: pressed && !active ? 0.7 : 1,
                                    ...(active
                                      ? {
                                          shadowColor: C.shadow,
                                          shadowOpacity: 0.06,
                                          shadowRadius: 2,
                                          shadowOffset: { width: 0, height: 1 },
                                          elevation: 1,
                                        }
                                      : {}),
                                  })}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
                                      color: active ? C.text : C.textSecondary,
                                    }}
                                  >
                                    {mode === 'all' ? 'All time' : 'Last 4 wks'}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>

                        <BodyDiagram
                          selected={painOverviewSelected ?? undefined}
                          onSelect={(r) => {
                            if (r) {
                              setPainInsightRegion(r);
                              setPainOverviewSelected((prev) => (prev === r ? null : r));
                            } else {
                              setPainOverviewSelected(null);
                            }
                          }}
                          heatmapCounts={
                            painHeatmapMode === 'recent' ? recentPainCounts : painRegionCounts
                          }
                          legendLabels={['Occasional', 'Regular', 'Frequent']}
                          maxWidth={160}
                        />

                        {/* Detail strip — shown when a region is tapped */}
                        {painOverviewSelected && (
                          <View
                            style={{
                              marginHorizontal: 12,
                              marginBottom: 12,
                              marginTop: -4,
                              backgroundColor: C.surfaceTertiary,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: C.borderLight,
                              paddingHorizontal: 12,
                              paddingVertical: 9,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6,
                                  marginBottom: 1,
                                }}
                              >
                                {(() => {
                                  const activeCount =
                                    painHeatmapMode === 'recent'
                                      ? (recentPainCounts[painOverviewSelected] ?? 0)
                                      : (painRegionCounts[painOverviewSelected] ?? 0);
                                  const bucketColor = heatmapBucketColor(activeCount);
                                  const bucketLabel =
                                    activeCount === 0
                                      ? 'No pain'
                                      : activeCount === 1
                                        ? 'Occasional'
                                        : activeCount <= 3
                                          ? 'Regular'
                                          : 'Frequent';
                                  return (
                                    <>
                                      <View
                                        style={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: 4,
                                          backgroundColor: bucketColor,
                                        }}
                                      />
                                      <Text
                                        style={{
                                          fontSize: 10,
                                          fontFamily: 'Inter_600SemiBold',
                                          color: bucketColor,
                                          textTransform: 'uppercase',
                                          letterSpacing: 0.4,
                                        }}
                                      >
                                        {bucketLabel}
                                      </Text>
                                    </>
                                  );
                                })()}
                              </View>
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontFamily: 'Inter_600SemiBold',
                                  color: C.text,
                                }}
                              >
                                {BODY_DIAGRAM_LABELS[painOverviewSelected]}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontFamily: 'Inter_400Regular',
                                  color: C.textSecondary,
                                  marginTop: 2,
                                }}
                              >
                                {painRegionCounts[painOverviewSelected] ?? 0} all-time ·{' '}
                                {recentPainCounts[painOverviewSelected] ?? 0} last 4 wks
                              </Text>
                            </View>
                            {(() => {
                              const trend = painTrends[painOverviewSelected];
                              if (!trend) return null;
                              const isUp = trend === '↑';
                              const isDown = trend === '↓';
                              const trendColor = isDown
                                ? '#2f6b46'
                                : isUp
                                  ? '#c0392b'
                                  : C.textSecondary;
                              const trendLabel = isDown
                                ? 'Improving'
                                : isUp
                                  ? 'Worsening'
                                  : 'Stable';
                              const recentVal = recentPainCounts[painOverviewSelected] ?? 0;
                              const prevVal = previousPainCounts[painOverviewSelected] ?? 0;
                              const hasComparison = recentVal > 0 || prevVal > 0;
                              if (!hasComparison) return null;
                              return (
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    backgroundColor: isDown
                                      ? '#e8f5ee'
                                      : isUp
                                        ? '#fdecea'
                                        : C.surfaceTertiary,
                                    borderRadius: 8,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                  }}
                                >
                                  <Text style={{ fontSize: 14, color: trendColor, lineHeight: 18 }}>
                                    {trend}
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontFamily: 'Inter_600SemiBold',
                                      color: trendColor,
                                    }}
                                  >
                                    {trendLabel}
                                  </Text>
                                </View>
                              );
                            })()}
                            <Pressable
                              onPress={() => {
                                setPainRegionFilter(painOverviewSelected);
                                setActiveTab('history');
                              }}
                              hitSlop={8}
                              style={({ pressed }) => ({
                                marginLeft: 8,
                                backgroundColor: pressed ? C.primaryMuted : C.primarySurface,
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderWidth: 1,
                                borderColor: C.primaryMuted,
                              })}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontFamily: 'Inter_600SemiBold',
                                  color: C.primary,
                                }}
                              >
                                History
                              </Text>
                            </Pressable>
                          </View>
                        )}

                        {/* Trend chips — shown in "Last 4 wks" mode for active regions */}
                        {painHeatmapMode === 'recent' &&
                          Object.keys(painTrends).length > 0 &&
                          !painOverviewSelected && (
                            <View
                              style={{
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                gap: 6,
                                paddingHorizontal: 12,
                                paddingBottom: 12,
                                paddingTop: 0,
                              }}
                            >
                              {(Object.entries(painTrends) as [PainRegion, '↑' | '↓' | '→'][])
                                .sort((a, b) => {
                                  const order = { '↑': 0, '→': 1, '↓': 2 };
                                  return order[a[1]] - order[b[1]];
                                })
                                .map(([region, trend]) => {
                                  const isUp = trend === '↑';
                                  const isDown = trend === '↓';
                                  const trendColor = isDown
                                    ? '#2f6b46'
                                    : isUp
                                      ? '#c0392b'
                                      : C.textSecondary;
                                  const chipBg = isDown
                                    ? '#e8f5ee'
                                    : isUp
                                      ? '#fdecea'
                                      : C.surfaceTertiary;
                                  return (
                                    <Pressable
                                      key={region}
                                      onPress={() => setPainOverviewSelected(region)}
                                      style={({ pressed }) => ({
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 3,
                                        backgroundColor: pressed ? C.borderLight : chipBg,
                                        borderRadius: 20,
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        borderWidth: 1,
                                        borderColor: isDown
                                          ? '#b7deca'
                                          : isUp
                                            ? '#f5bdb8'
                                            : C.borderLight,
                                      })}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 11,
                                          fontFamily: 'Inter_500Medium',
                                          color: trendColor,
                                        }}
                                      >
                                        {BODY_DIAGRAM_LABELS[region]}
                                      </Text>
                                      <Text style={{ fontSize: 12, color: trendColor }}>
                                        {trend}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                            </View>
                          )}
                      </>
                    )}
                  </View>
                </Animated.View>
              )}
            </ScrollView>
          )}

          {/* STRENGTH TAB */}
          {activeTab === 'strength' && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.tabContent, { paddingBottom: tabPaddingBottom }]}
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                onPress={() => setShowCalculator(true)}
                style={({ pressed }) => [styles.calcBtn, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="calculator-outline" size={18} color={C.primary} />
                <Text style={styles.calcBtnText}>1RM Calculator</Text>
                <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
              </Pressable>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Strength Progression</Text>
                <Text style={styles.sectionSub}>Estimated 1RM - tap a dot for details</Text>
                {(['squat', 'bench', 'deadlift'] as SessionType[]).map((lift) => (
                  <StrengthLineChart
                    key={lift}
                    lift={lift}
                    orms={oneRepMaxes}
                    weightUnit={weightUnit}
                    C={C}
                  />
                ))}
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Personal Bests</Text>
                <Text style={styles.sectionSub}>All-time bests highlighted with a trophy</Text>
                <PBHistorySection orms={oneRepMaxes} weightUnit={weightUnit} C={C} />
              </View>
            </ScrollView>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.tabContent, { paddingBottom: tabPaddingBottom }]}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <Text style={styles.sectionTitle}>{historyHeading}</Text>
                {hasActiveFilter && (
                  <Pressable
                    onPress={() => {
                      setHistoryFilter(null);
                      setDateFilter('all');
                      setPainRegionFilter(null);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: pressed ? C.primaryMuted : C.primarySurface,
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderWidth: 1,
                      borderColor: C.primaryMuted,
                    })}
                  >
                    <Ionicons name="close-circle" size={13} color={C.primary} />
                    <Text
                      style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.primary }}
                    >
                      Clear all
                    </Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.sectionSub}>{historySubheading}</Text>
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: C.surfaceTertiary,
                  borderRadius: 10,
                  padding: 3,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: C.borderLight,
                }}
              >
                {(['all', 'this_week', 'this_month'] as const).map((option) => {
                  const active = dateFilter === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setDateFilter(option)}
                      style={({ pressed }) => ({
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: active ? C.surface : 'transparent',
                        opacity: pressed && !active ? 0.7 : 1,
                        ...(active
                          ? {
                              shadowColor: C.shadow,
                              shadowOpacity: 0.06,
                              shadowRadius: 3,
                              shadowOffset: { width: 0, height: 1 },
                              elevation: 1,
                            }
                          : {}),
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: active ? 'Inter_600SemiBold' : 'Inter_500Medium',
                          color: active ? C.text : C.textSecondary,
                        }}
                      >
                        {DATE_FILTER_LABELS[option]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {/* Pain Region Heatmap Filter */}
              {hasAnyPainHistory && (
                <View
                  style={{
                    backgroundColor: C.surface,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: C.borderLight,
                    marginBottom: 12,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: 16,
                      paddingTop: 14,
                      paddingBottom: 4,
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}
                      >
                        Body Region
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'Inter_400Regular',
                          color: C.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {painRegionFilter
                          ? `Filtering by ${BODY_DIAGRAM_LABELS[painRegionFilter]} - tap again to clear`
                          : 'Tap a zone to filter sessions by pain area'}
                      </Text>
                    </View>
                    {painRegionFilter && (
                      <Pressable
                        onPress={() => setPainRegionFilter(null)}
                        hitSlop={8}
                        style={({ pressed }) => ({
                          marginTop: 2,
                          backgroundColor: pressed ? C.primaryMuted : C.primarySurface,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderWidth: 1,
                          borderColor: C.primaryMuted,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        })}
                      >
                        <Ionicons name="close-circle" size={13} color={C.primary} />
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: 'Inter_600SemiBold',
                            color: C.primary,
                          }}
                        >
                          Clear
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <BodyDiagram
                    selected={painRegionFilter ?? undefined}
                    onSelect={(r) =>
                      setPainRegionFilter((prev) => (r === prev ? null : (r ?? null)))
                    }
                    heatmapCounts={painRegionCounts}
                    legendLabels={['Occasional', 'Regular', 'Frequent']}
                    maxWidth={150}
                  />
                </View>
              )}

              <SessionHistoryList
                key={`${historyFilter ?? 'all'}-${dateFilter}-${painRegionFilter ?? 'none'}`}
                sessions={filteredSessions}
                weightUnit={weightUnit}
                emptyMessage={historyEmptyMessage}
                C={C}
              />
            </ScrollView>
          )}

          {/* PROGRESS TAB */}
          {activeTab === 'progress' && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.tabContent, { paddingBottom: tabPaddingBottom }]}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sectionTitle}>Exercise Progress</Text>
              <Text style={styles.sectionSub}>
                Every weighted lift you&apos;ve logged · tap one for full history
              </Text>
              <ExerciseProgressList
                weightUnit={weightUnit}
                totalSessions={completedSessions.length}
                onSelect={setSelectedProgress}
                C={C}
              />
            </ScrollView>
          )}
        </View>
      )}

      {/* 1RM Calculator Modal */}
      <Modal
        visible={showCalculator}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCalculator(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>1RM Calculator</Text>
            <Pressable
              onPress={() => setShowCalculator(false)}
              style={({ pressed }) => [styles.modalClose, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close" size={20} color={C.text} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
            showsVerticalScrollIndicator={false}
          >
            <OneRMCalculator weightUnit={weightUnit} addOneRepMax={addOneRepMax} C={C} />
          </ScrollView>
        </View>
      </Modal>

      {/* Exercise progress detail sheet */}
      <ExerciseDetailSheet
        progress={selectedProgress}
        weightUnit={weightUnit}
        insets={{ top: insets.top, bottom: insets.bottom }}
        onClose={() => setSelectedProgress(null)}
        C={C}
      />

      {/* Training Calendar Modal */}
      <Modal
        visible={showCalendar}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Training Calendar</Text>
            <Pressable onPress={() => setShowCalendar(false)} style={styles.modalClose} hitSlop={8}>
              <Ionicons name="close" size={18} color={C.text} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingVertical: 16,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <MonthCalendar sessions={completedSessions} C={C} />
          </ScrollView>
        </View>
      </Modal>

      {/* Pain Insight sheet — appears when user taps a region on the Pain Patterns heatmap */}
      <PainInsightSheet
        region={painInsightRegion}
        sessionCount={painInsightRegion ? (painRegionCounts[painInsightRegion] ?? 0) : 0}
        onStartPrehab={(region) => {
          setPainInsightRegion(null);
          const effectiveTier = getEffectiveTier();
          router.push({
            pathname: '/session',
            params: {
              sessionType: 'prehab',
              hasAches: 'false',
              painRegion: region,
              energy: 'normal',
              timeAvailable: '60',
              isTestWeek: 'false',
              equipment: effectiveTier,
              displayLabel: 'Targeted Prehab',
            },
          });
        }}
        onViewHistory={(region) => {
          setPainInsightRegion(null);
          setPainRegionFilter(region);
          setActiveTab('history');
        }}
        onDismiss={() => setPainInsightRegion(null)}
        insets={insets}
      />
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
    title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.text },
    subtitle: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2 },

    segmentWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    segment: {
      flexDirection: 'row',
      backgroundColor: C.surfaceTertiary,
      borderRadius: 12,
      padding: 3,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    segmentTab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      borderRadius: 10,
    },
    segmentTabActive: {
      backgroundColor: C.surface,
      shadowColor: C.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    segmentTabText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    segmentTabTextActive: { fontFamily: 'Inter_700Bold', color: C.text },

    tabContent: { paddingHorizontal: 20, paddingTop: 4 },

    statRow: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: C.borderLight,
      alignItems: 'center',
    },
    statCell: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.primary },
    statLabel: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginTop: 2,
      textAlign: 'center',
    },
    statDiv: { width: 1, height: 32, backgroundColor: C.border },

    sectionBlock: { marginBottom: 16 },
    sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 2 },
    sectionSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginBottom: 12,
    },

    calcBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: C.primarySurface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: C.primaryMuted,
      marginBottom: 16,
    },
    calcBtnText: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.primary },

    modalContainer: { flex: 1, backgroundColor: C.background },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.borderLight,
    },
    modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
    modalClose: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: C.surfaceTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
