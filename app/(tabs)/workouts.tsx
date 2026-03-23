import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  LayoutChangeEvent,
  Pressable,
} from 'react-native';
import Svg, { Rect, Line, Circle, Path, Text as SvgText, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { CompletedSession, EnergyLevel, SessionType, useAppStore } from '@/lib/store';
import { getSessionLabel } from '@/lib/workout-engine';
import { formatDate, formatWeight } from '@/lib/utils';

const BAR_CHART_HEIGHT = 120;
const LINE_CHART_HEIGHT = 90;
const HISTORY_PAGE_SIZE = 30;

const SESSION_TYPE_COLORS: Record<SessionType, { bg: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  squat: { bg: '#e8f2ec', icon: 'fitness-outline', color: '#2f6b46' },
  bench: { bg: '#e8f0fe', icon: 'body-outline', color: '#4285f4' },
  deadlift: { bg: '#f3e5f5', icon: 'barbell-outline', color: '#9c27b0' },
  conditioning: { bg: '#fbe9e7', icon: 'flame-outline', color: '#e65100' },
  prehab: { bg: '#e0f2f1', icon: 'shield-checkmark-outline', color: '#00897b' },
  flexibility: { bg: '#f1f8e9', icon: 'leaf-outline', color: '#558b2f' },
};

const ENERGY_COLORS: Record<EnergyLevel, string> = {
  low: '#9ca5a0',
  normal: '#2f6b46',
  high: '#3d8a5c',
};

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
      const count = sessions.filter(s => {
        const d = new Date(s.date);
        return d >= weekStart && d < weekEnd;
      }).length;
      result.push({ label: '', count });
    }
    return result;
  }, [sessions]);

  const maxCount = Math.max(...weeks.map(w => w.count), 1);
  const barWidth = chartWidth / weeks.length;
  const barGap = 4;
  const chartHeight = BAR_CHART_HEIGHT;
  const barAreaHeight = chartHeight - 24;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w);
  };

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.borderLight }}>
      <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 2 }}>Training Frequency</Text>
      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 12 }}>Sessions per week, last 8 weeks</Text>
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
                <Rect x={x} y={y} width={bw} height={barH || 2} rx={4}
                  fill={isLast ? C.primary : C.primaryMuted} />
                {isLast && (
                  <SvgText x={x + bw / 2} y={barAreaHeight + 16}
                    textAnchor="middle" fontSize={9} fill={C.textSecondary}>
                    This wk
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}
          <Line x1={0} y1={barAreaHeight} x2={chartWidth} y2={barAreaHeight} stroke={C.border} strokeWidth={1} />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>0</Text>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>peak: {Math.max(...weeks.map(w => w.count))} sessions</Text>
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
    const strengthTypes: SessionType[] = ['squat', 'bench', 'deadlift', 'conditioning'];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const weekSessions = sessions.filter(s => {
        const d = new Date(s.date);
        return d >= weekStart && d < weekEnd && strengthTypes.includes(s.sessionType);
      });
      let vol = 0;
      for (const s of weekSessions) {
        for (const ex of s.exerciseLogs) {
          for (const set of ex.sets) {
            if (set.completed && set.weight > 0) {
              vol += set.weight * set.reps;
            }
          }
        }
      }
      result.push({ label: '', volume: Math.round(vol) });
    }
    return result;
  }, [sessions]);

  const maxVol = Math.max(...weeks.map(w => w.volume), 1);
  const barWidth = chartWidth / weeks.length;
  const barGap = 4;
  const barAreaHeight = BAR_CHART_HEIGHT - 24;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w);
  };

  const maxVal = Math.max(...weeks.map(w => w.volume));
  if (maxVal === 0) return null;

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.borderLight }}>
      <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 2 }}>Weekly Volume</Text>
      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 12 }}>Total {weightUnit} lifted per week</Text>
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
                <Rect x={x} y={y} width={bw} height={barH || 2} rx={4}
                  fill={isLast ? '#4285f4' : '#e8f0fe'} />
                {isLast && (
                  <SvgText x={x + bw / 2} y={barAreaHeight + 16}
                    textAnchor="middle" fontSize={9} fill={C.textSecondary}>
                    This wk
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}
          <Line x1={0} y1={barAreaHeight} x2={chartWidth} y2={barAreaHeight} stroke={C.border} strokeWidth={1} />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>0 {weightUnit}</Text>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
          peak: {weightUnit === 'lbs' ? Math.round(maxVal * 2.20462).toLocaleString() : maxVal.toLocaleString()} {weightUnit}
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

  const LIFT_COLORS: Record<string, { line: string; fill: string }> = {
    squat: { line: C.primary, fill: C.primaryMuted },
    bench: { line: '#4285f4', fill: '#e8f0fe' },
    deadlift: { line: '#ea4335', fill: '#fce8e6' },
  };

  const data = useMemo(() => {
    return orms
      .filter(o => o.lift === lift)
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
      <View style={{ backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.borderLight }}>
        <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>{liftLabel}</Text>
        <View style={{ height: LINE_CHART_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>No data yet</Text>
        </View>
      </View>
    );
  }

  if (data.length === 1) {
    return (
      <View style={{ backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.borderLight }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>{liftLabel}</Text>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: C.primary }}>{formatWeight(data[0].weight, weightUnit)}</Text>
        </View>
        <View style={{ height: LINE_CHART_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>1 record — keep training!</Text>
        </View>
      </View>
    );
  }

  const weights = data.map(d => d.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const w = chartWidth;
  const h = LINE_CHART_HEIGHT;
  const pad = 8;

  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d.weight - minW) / range) * (h - pad * 2);
    return { x, y, weight: d.weight, date: d.date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillD = `${pathD} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`;

  const best = Math.max(...weights);
  const isImproving = data.length >= 2 && data[data.length - 1].weight >= data[data.length - 2].weight;
  const selectedPoint = selectedIdx !== null ? points[selectedIdx] : null;

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.borderLight }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>{liftLabel}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: C.primary }}>{formatWeight(best, weightUnit)}</Text>
          {isImproving && (
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trending-up" size={11} color={C.primary} />
            </View>
          )}
        </View>
      </View>
      <View onLayout={handleLayout} style={{ width: '100%', marginTop: 4 }}>
        <Pressable onPress={() => setSelectedIdx(null)}>
          <Svg width={w} height={h}>
            <Path d={fillD} fill={colors.fill} opacity={0.6} />
            <Path d={pathD} stroke={colors.line} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <G key={i}>
                <Circle cx={p.x} cy={p.y} r={10} fill="transparent"
                  onPress={(e) => { e.stopPropagation(); setSelectedIdx(selectedIdx === i ? null : i); }}
                />
                <Circle cx={p.x} cy={p.y} r={selectedIdx === i ? 5 : 3}
                  fill={selectedIdx === i ? colors.line : colors.line}
                  stroke={selectedIdx === i ? C.surface : 'none'} strokeWidth={selectedIdx === i ? 2 : 0}
                />
              </G>
            ))}
            <SvgText x={0} y={h - 1} fontSize={9} fill={C.textTertiary}>{formatWeight(minW, weightUnit)}</SvgText>
            <SvgText x={w - 32} y={12} fontSize={9} fill={C.textTertiary}>{formatWeight(maxW, weightUnit)}</SvgText>
          </Svg>
        </Pressable>
        {selectedPoint && selectedIdx !== null && (
          <View style={{
            position: 'absolute',
            left: Math.max(0, Math.min(selectedPoint.x - 45, w - 90)),
            top: Math.max(0, selectedPoint.y - 40),
            backgroundColor: C.text, borderRadius: 6,
            paddingHorizontal: 8, paddingVertical: 4,
          }}>
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
  C,
}: {
  sessions: CompletedSession[];
  weightUnit: 'kg' | 'lbs';
  C: ReturnType<typeof useColors>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCount, setShowCount] = useState(HISTORY_PAGE_SIZE);

  if (sessions.length === 0) {
    return (
      <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.borderLight, alignItems: 'center' }}>
        <Ionicons name="calendar-outline" size={28} color={C.textTertiary} />
        <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 8 }}>No sessions logged yet</Text>
      </View>
    );
  }

  const visibleSessions = sessions.slice(0, showCount);

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.borderLight, overflow: 'hidden' }}>
      {visibleSessions.map((session, i) => {
        const meta = SESSION_TYPE_COLORS[session.sessionType];
        const isExpanded = expanded === session.id;
        const heaviestSets = session.exerciseLogs
          .filter(el => el.sets.some(s => s.weight > 0))
          .map(el => {
            const best = el.sets.reduce((b, s) => s.completed && s.weight > b ? s.weight : b, 0);
            return { name: el.exerciseName, weight: best };
          })
          .filter(el => el.weight > 0)
          .slice(0, 4);

        return (
          <View key={session.id}>
            {i > 0 && <View style={{ height: 1, backgroundColor: C.borderLight, marginHorizontal: 16 }} />}
            <Pressable
              onPress={() => setExpanded(isExpanded ? null : session.id)}
              style={({ pressed }) => [{
                flexDirection: 'row' as const, alignItems: 'center' as const,
                paddingHorizontal: 14, paddingVertical: 12, gap: 12,
                opacity: pressed ? 0.8 : 1,
              }]}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: meta.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={meta.icon} size={18} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>
                  {getSessionLabel(session.sessionType)}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 }}>
                  {formatDate(session.date)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' as const, gap: 4 }}>
                <View style={{ backgroundColor: ENERGY_COLORS[session.energy] + '22', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: ENERGY_COLORS[session.energy] }}>
                    {session.energy.charAt(0).toUpperCase() + session.energy.slice(1)}
                  </Text>
                </View>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.textTertiary} />
              </View>
            </Pressable>
            {isExpanded && heaviestSets.length > 0 && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 }}>
                {heaviestSets.map((ex, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary }}>{ex.name}</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary }}>{formatWeight(ex.weight, weightUnit)}</Text>
                  </View>
                ))}
              </View>
            )}
            {isExpanded && heaviestSets.length === 0 && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>No weight data recorded</Text>
              </View>
            )}
          </View>
        );
      })}
      {sessions.length > showCount && (
        <Pressable
          onPress={() => setShowCount(c => c + HISTORY_PAGE_SIZE)}
          style={{ paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: C.borderLight }}
        >
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary }}>
            Show more ({sessions.length - showCount} remaining)
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const {
    completedCount,
    completedSessions,
    oneRepMaxes,
    getStreakDays,
    getThisWeekCount,
    weightUnit,
  } = useAppStore();

  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
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
      <Text style={styles.title}>Stats</Text>
      <Text style={styles.subtitle}>Your training progress at a glance</Text>

      <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.statRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{completedCount}</Text>
          <Text style={styles.statLabel}>Total Sessions</Text>
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
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(400)}>
        <WeeklyBarChart sessions={completedSessions} C={C} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <WeeklyVolumeChart sessions={completedSessions} weightUnit={weightUnit} C={C} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(400)} style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Strength Progression</Text>
        <Text style={styles.sectionSub}>Estimated 1RM — tap a dot for details</Text>
        {(['squat', 'bench', 'deadlift'] as SessionType[]).map(lift => (
          <StrengthLineChart key={lift} lift={lift} orms={oneRepMaxes} weightUnit={weightUnit} C={C} />
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Session History</Text>
        <Text style={styles.sectionSub}>Tap a row to see exercise details</Text>
        <View style={{ marginTop: 8 }}>
          <SessionHistoryList sessions={completedSessions} weightUnit={weightUnit} C={C} />
        </View>
      </Animated.View>
    </ScrollView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { paddingHorizontal: 20 },
    title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.text },
    subtitle: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2, marginBottom: 20 },

    statRow: {
      flexDirection: 'row', backgroundColor: C.surface, borderRadius: 16, padding: 18,
      marginBottom: 20, borderWidth: 1, borderColor: C.borderLight, alignItems: 'center',
    },
    statCell: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 28, fontFamily: 'Inter_700Bold', color: C.primary },
    statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2, textAlign: 'center' },
    statDiv: { width: 1, height: 36, backgroundColor: C.border },

    sectionBlock: { marginBottom: 20 },
    sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 2 },
    sectionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 14 },
  });
}
