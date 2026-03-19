import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Rect, Line, Circle, Path, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { SessionType, useAppStore } from '@/lib/store';
import { getSessionLabel } from '@/lib/workout-engine';

const LIFT_COLORS: Record<string, { line: string; fill: string }> = {
  squat: { line: Colors.primary, fill: Colors.primaryMuted },
  bench: { line: '#4285f4', fill: '#e8f0fe' },
  deadlift: { line: '#ea4335', fill: '#fce8e6' },
};

const BAR_CHART_HEIGHT = 120;
const LINE_CHART_HEIGHT = 90;

function WeeklyBarChart({ sessions }: { sessions: { date: string }[] }) {
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
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Training Frequency</Text>
      <Text style={styles.chartSub}>Sessions per week, last 8 weeks</Text>
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
                  fill={isLast ? Colors.primary : Colors.primaryMuted}
                />
                {isLast && (
                  <SvgText
                    x={x + bw / 2}
                    y={barAreaHeight + 16}
                    textAnchor="middle"
                    fontSize={9}
                    fill={Colors.textSecondary}
                  >
                    This wk
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}
          <Line x1={0} y1={barAreaHeight} x2={chartWidth} y2={barAreaHeight} stroke={Colors.border} strokeWidth={1} />
        </Svg>
      </View>
      <View style={styles.barLegend}>
        <Text style={styles.barLegendText}>0</Text>
        <Text style={styles.barLegendText}>peak: {Math.max(...weeks.map(w => w.count))} sessions</Text>
      </View>
    </View>
  );
}

function StrengthLineChart({ lift, orms }: { lift: SessionType; orms: { lift: SessionType; weight: number; date: string }[] }) {
  const [chartWidth, setChartWidth] = useState(280);

  const data = useMemo(() => {
    return orms
      .filter(o => o.lift === lift)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-8);
  }, [lift, orms]);

  const liftLabel = lift.charAt(0).toUpperCase() + lift.slice(1);
  const colors = LIFT_COLORS[lift] ?? { line: Colors.primary, fill: Colors.primaryMuted };

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w);
  };

  if (data.length === 0) {
    return (
      <View style={styles.miniChartCard}>
        <Text style={styles.miniChartTitle}>{liftLabel}</Text>
        <View style={styles.emptyChart}>
          <Text style={styles.emptyChartText}>No data yet</Text>
        </View>
      </View>
    );
  }

  if (data.length === 1) {
    return (
      <View style={styles.miniChartCard}>
        <View style={styles.miniChartHeader}>
          <Text style={styles.miniChartTitle}>{liftLabel}</Text>
          <Text style={styles.miniChartBest}>{data[0].weight} kg</Text>
        </View>
        <View style={styles.emptyChart}>
          <Text style={styles.emptyChartText}>1 record — keep training!</Text>
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
    return { x, y, weight: d.weight };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillD = `${pathD} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`;

  const best = Math.max(...weights);
  const isImproving = data.length >= 2 && data[data.length - 1].weight >= data[data.length - 2].weight;

  return (
    <View style={styles.miniChartCard}>
      <View style={styles.miniChartHeader}>
        <Text style={styles.miniChartTitle}>{liftLabel}</Text>
        <View style={styles.miniChartRight}>
          <Text style={styles.miniChartBest}>{best} kg</Text>
          {isImproving && (
            <View style={styles.trendBadge}>
              <Ionicons name="trending-up" size={11} color={Colors.primary} />
            </View>
          )}
        </View>
      </View>
      <View onLayout={handleLayout} style={{ width: '100%', marginTop: 4 }}>
        <Svg width={w} height={h}>
          <Path d={fillD} fill={colors.fill} opacity={0.6} />
          <Path d={pathD} stroke={colors.line} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.line} />
          ))}
          <SvgText x={0} y={h - 1} fontSize={9} fill={Colors.textTertiary}>{minW}kg</SvgText>
          <SvgText x={w - 24} y={12} fontSize={9} fill={Colors.textTertiary}>{maxW}kg</SvgText>
        </Svg>
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const {
    completedCount,
    completedSessions,
    oneRepMaxes,
    getStreakDays,
    getThisWeekCount,
  } = useAppStore();

  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

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
        <WeeklyBarChart sessions={completedSessions} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Strength Progression</Text>
        <Text style={styles.sectionSub}>Estimated 1RM over time</Text>
        {(['squat', 'bench', 'deadlift'] as SessionType[]).map(lift => (
          <StrengthLineChart key={lift} lift={lift} orms={oneRepMaxes} />
        ))}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.text },
  subtitle: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2, marginBottom: 20 },

  statRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center' },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.primary },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  statDiv: { width: 1, height: 36, backgroundColor: Colors.border },

  chartContainer: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.borderLight },
  chartTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  chartSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 12 },

  barLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  barLegendText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },

  sectionBlock: { marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 2 },
  sectionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 14 },

  miniChartCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight },
  miniChartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  miniChartTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  miniChartRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniChartBest: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.primary },
  trendBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  emptyChart: { height: LINE_CHART_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  emptyChartText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },
});
