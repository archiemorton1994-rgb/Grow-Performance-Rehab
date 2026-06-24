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
import Svg, { Rect, Line, Circle, Path, Text as SvgText, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { EmptyState } from '@/components/EmptyState';
import { CompletedSession, EnergyLevel, SessionType, STRENGTH_SESSION_TYPES, useAppStore } from '@/lib/store';
import { getSessionLabel } from '@/lib/workout-engine';
import { formatDate, formatWeight, kgToDisplayUnit, displayUnitToKg } from '@/lib/utils';
import { SESSION_SHORT_LABELS, SESSION_META as SHARED_SESSION_META } from '@/lib/session-meta';

const BAR_CHART_HEIGHT = 120;
const LINE_CHART_HEIGHT = 90;
const HISTORY_PAGE_SIZE = 30;

function formatSessionDuration(seconds: number): string {
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 60) return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getSessionTypeColors(C: ReturnType<typeof useColors>): Record<SessionType, { bg: string; icon: keyof typeof Ionicons.glyphMap; color: string }> {
  return {
    squat:        { bg: C.primaryMuted,        icon: SHARED_SESSION_META.squat.icon,        color: C.primary },
    bench:        { bg: C.badgeVolume,         icon: SHARED_SESSION_META.bench.icon,        color: C.badgeVolumeText },
    deadlift:     { bg: C.categoryNeuro,       icon: SHARED_SESSION_META.deadlift.icon,     color: C.categoryNeuroText },
    conditioning: { bg: C.categoryPrehab,      icon: SHARED_SESSION_META.conditioning.icon, color: C.categoryPrehabText },
    prehab:       { bg: C.categoryMechanical,  icon: SHARED_SESSION_META.prehab.icon,       color: C.categoryMechanicalText },
    flexibility:  { bg: C.categoryCooldown,    icon: SHARED_SESSION_META.flexibility.icon,  color: C.categoryCooldownText },
    custom:       { bg: C.categoryFinisher,    icon: SHARED_SESSION_META.custom.icon,       color: C.categoryFinisherText },
  };
}

function getEnergyColors(C: ReturnType<typeof useColors>): Record<EnergyLevel, string> {
  return {
    low:    C.textTertiary,
    normal: C.primary,
    high:   C.primaryLight,
  };
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
      const weekSessions = sessions.filter(s => {
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

  const maxVol = Math.max(...weeks.map(w => w.volume), 1);
  const barWidth = chartWidth / weeks.length;
  const barGap = 4;
  const barAreaHeight = BAR_CHART_HEIGHT - 24;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w);
  };

  const maxVal = Math.max(...weeks.map(w => w.volume));
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
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>0 {weightUnit}</Text>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
          peak: {maxVal.toLocaleString()} {weightUnit}
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
    squat:    { line: C.primary,            fill: C.primaryMuted },
    bench:    { line: C.badgeVolumeText,    fill: C.badgeVolume },
    deadlift: { line: C.categoryNeuroText,  fill: C.categoryNeuro },
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
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>1 record - keep training!</Text>
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
  const pad = 6;

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
            <SvgText x={4} y={h - 2} fontSize={9} fill={C.textTertiary} textAnchor="start">{formatWeight(minW, weightUnit)}</SvgText>
            <SvgText x={w - 4} y={12} fontSize={9} fill={C.textTertiary} textAnchor="end">{formatWeight(maxW, weightUnit)}</SvgText>
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
    <View style={{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.borderLight, overflow: 'hidden' }}>
      {visibleSessions.map((session, i) => {
        const meta = sessionTypeColors[session.sessionType];
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
                minHeight: 62,
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
                  {session.durationSeconds != null && session.durationSeconds > 0
                    ? ` · ${formatSessionDuration(session.durationSeconds)}`
                    : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' as const, gap: 4 }}>
                <View style={{ backgroundColor: energyColors[session.energy] + '22', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: energyColors[session.energy] }}>
                    {session.energy.charAt(0).toUpperCase() + session.energy.slice(1)}
                  </Text>
                </View>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.textTertiary} />
              </View>
            </Pressable>
            {isExpanded && (heaviestSets.length > 0 || session.exerciseLogs.some(el => el.note)) && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 }}>
                {heaviestSets.length === 0 && (
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary, paddingVertical: 4 }}>No weight data recorded</Text>
                )}
                {heaviestSets.map((ex, idx) => {
                  const logEntry = session.exerciseLogs.find(el => el.exerciseName === ex.name);
                  return (
                    <View key={idx}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary }}>{ex.name}</Text>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary }}>{formatWeight(ex.weight, weightUnit)}</Text>
                      </View>
                      {logEntry?.note ? (
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5, paddingBottom: 4 }}>
                          <Ionicons name="create-outline" size={12} color={C.textTertiary} />
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary, flex: 1, fontStyle: 'italic' }}>{logEntry.note}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
                {session.exerciseLogs.filter(el => el.note && !heaviestSets.find(h => h.name === el.exerciseName)).map((el, idx) => (
                  <View key={'note-only-' + idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5, paddingVertical: 4 }}>
                    <Ionicons name="create-outline" size={12} color={C.textTertiary} />
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary, flex: 1, fontStyle: 'italic' }}>
                      {el.exerciseName}: {el.note}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {isExpanded && heaviestSets.length === 0 && !session.exerciseLogs.some(el => el.note) && (
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

const SESSION_TYPE_LABELS = SESSION_SHORT_LABELS;

const ALL_SESSION_TYPES: SessionType[] = ['squat', 'bench', 'deadlift', 'conditioning', 'prehab', 'flexibility', 'custom'];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSegmentPath(cx: number, cy: number, R: number, r: number, startAngle: number, endAngle: number): string {
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
      squat: 0, bench: 0, deadlift: 0, conditioning: 0, prehab: 0, flexibility: 0, custom: 0,
    };
    for (const s of sessions) {
      if (map[s.sessionType] !== undefined) map[s.sessionType]++;
    }
    return map;
  }, [sessions]);

  const total = sessions.length;
  const activeTypes = ALL_SESSION_TYPES.filter(t => counts[t] > 0);

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
    <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text }}>Session Breakdown</Text>
        {hasFilter && (
          <Pressable
            onPress={() => onFilterChange(null)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: pressed ? C.primaryMuted : C.primarySurface,
              borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
              borderWidth: 1, borderColor: C.primaryMuted,
            })}
          >
            <Ionicons name="close-circle" size={13} color={C.primary} />
            <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.primary }}>Clear</Text>
          </Pressable>
        )}
      </View>
      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 14 }}>
        {hasFilter ? `Tap another type or clear to reset` : 'Tap a segment or label to filter history'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Svg width={SIZE} height={SIZE}>
          {segments.map(seg => {
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
          <SvgText x={cx} y={cy - 6} textAnchor="middle" fontSize={20} fontWeight="bold" fill={C.text}>{total}</SvgText>
          <SvgText x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill={C.textSecondary}>total</SvgText>
        </Svg>
        <View style={{ flex: 1, gap: 6 }}>
          {activeTypes.map(type => {
            const pct = Math.round((counts[type] / total) * 100);
            const meta = sessionTypeColors[type];
            const isSelected = activeFilter === type;
            const isDimmed = hasFilter && !isSelected;
            return (
              <Pressable
                key={type}
                onPress={() => onFilterChange(isSelected ? null : type)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  borderRadius: 8, paddingVertical: 3, paddingHorizontal: 4,
                  backgroundColor: isSelected ? meta.bg : pressed ? C.surfaceTertiary : 'transparent',
                  opacity: isDimmed ? 0.35 : 1,
                })}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: meta.color }} />
                <Text style={{ flex: 1, fontSize: 12, fontFamily: isSelected ? 'Inter_600SemiBold' : 'Inter_400Regular', color: isSelected ? meta.color : C.textSecondary }} numberOfLines={1}>
                  {SESSION_TYPE_LABELS[type]}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: isSelected ? meta.color : C.text, minWidth: 22, textAlign: 'right' }}>{counts[type]}</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, minWidth: 32, textAlign: 'right' }}>{pct}%</Text>
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
    () => orms.filter(o => LIFT_TYPES.includes(o.lift as SessionType)),
    [orms]
  );

  if (strengthOrms.length === 0) {
    return (
      <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.borderLight, alignItems: 'center', marginBottom: 10 }}>
        <Ionicons name="trophy-outline" size={28} color={C.textTertiary} />
        <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 8 }}>No strength tests yet</Text>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 4, textAlign: 'center' }}>Save your first PB using the calculator below</Text>
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
    grouped[lift] = grouped[lift].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const liftsWithData = LIFT_TYPES.filter(lift => grouped[lift].length > 0);

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.borderLight, overflow: 'hidden', marginBottom: 10 }}>
      {liftsWithData.map((lift, liftIdx) => {
        const entries = grouped[lift];
        const best = allTimeBests[lift];
        return (
          <View key={lift}>
            {liftIdx > 0 && <View style={{ height: 1, backgroundColor: C.borderLight }} />}
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                {LIFT_LABELS[lift]}
              </Text>
              {entries.map((entry, i) => {
                const isAllTimeBest = entry.weight === best;
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 }}>
                    {isAllTimeBest ? (
                      <Ionicons name="trophy" size={14} color={C.warning} />
                    ) : (
                      <View style={{ width: 14 }} />
                    )}
                    <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary }}>
                      {formatDate(entry.date)}
                    </Text>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: isAllTimeBest ? C.primary : C.text }}>
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
      Alert.alert('Invalid input', 'Enter a valid weight and rep count (1–30).');
      return;
    }
    const weightInKg = displayUnitToKg(w, weightUnit);
    const orm = weightInKg * (1 + r / 30);
    setResult(parseFloat(orm.toFixed(2)));
  }, [weightInput, repsInput, weightUnit]);

  const savePB = useCallback(() => {
    if (result === null) return;
    addOneRepMax({ lift: selectedLift, weight: result, date: new Date().toISOString(), unit: 'kg' });
    Alert.alert('Saved!', `${LIFT_LABELS[selectedLift]} PB of ${formatWeight(result, weightUnit)} saved.`);
    setWeightInput('');
    setRepsInput('');
    setResult(null);
  }, [result, selectedLift, weightUnit, addOneRepMax]);

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Ionicons name="calculator-outline" size={18} color={C.primary} />
        <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text }}>1RM Calculator</Text>
      </View>
      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 14 }}>
        Epley formula - enter the weight you lifted and how many reps
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Weight ({weightUnit})
          </Text>
          <TextInput
            style={{
              height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
              backgroundColor: C.surfaceTertiary, paddingHorizontal: 12,
              fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text, textAlign: 'center',
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
          <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Reps
          </Text>
          <TextInput
            style={{
              height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
              backgroundColor: C.surfaceTertiary, paddingHorizontal: 12,
              fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text, textAlign: 'center',
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
          borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12,
        })}
      >
        <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: C.textInverse }}>Calculate</Text>
      </Pressable>

      {result !== null && (
        <View style={{ backgroundColor: C.primarySurface, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: C.primaryMuted, marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.primary, marginBottom: 4, textAlign: 'center' }}>
            Estimated 1RM
          </Text>
          <Text style={{ fontSize: 32, fontFamily: 'Inter_700Bold', color: C.primary, textAlign: 'center' }}>
            {formatWeight(result, weightUnit)}
          </Text>

          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>
              Save as Personal Best for
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
              {LIFT_TYPES.map(lift => (
                <Pressable
                  key={lift}
                  onPress={() => setSelectedLift(lift)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                    backgroundColor: selectedLift === lift ? C.primary : C.surfaceTertiary,
                    borderWidth: 1.5,
                    borderColor: selectedLift === lift ? C.primary : C.borderLight,
                  }}
                >
                  <Text style={{
                    fontSize: 12, fontFamily: 'Inter_700Bold',
                    color: selectedLift === lift ? C.textInverse : C.textSecondary,
                  }}>
                    {LIFT_LABELS[lift]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={savePB}
              style={({ pressed }) => ({
                marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                paddingVertical: 11, borderRadius: 10,
                backgroundColor: pressed ? C.surfaceTertiary : C.surface,
                borderWidth: 1.5, borderColor: C.primary,
              })}
            >
              <Ionicons name="trophy-outline" size={16} color={C.primary} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primary }}>Save as {LIFT_LABELS[selectedLift]} PB</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
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
  } = useAppStore();

  const historyFilter = historyTypeFilter;
  const setHistoryFilter = setHistoryTypeFilter;

  const [activeTab, setActiveTab] = useState<'overview' | 'strength' | 'history'>('overview');
  const [dateFilter, setDateFilter] = useState<'all' | 'this_week' | 'this_month'>('all');
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    if (historyFilter && !completedSessions.some(s => s.sessionType === historyFilter)) {
      setHistoryFilter(null);
    }
  }, [historyFilter, completedSessions, setHistoryFilter]);

  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const styles = useMemo(() => makeStyles(C), [C]);

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
    return completedSessions.filter(s => {
      if (historyFilter && s.sessionType !== historyFilter) return false;
      if (cutoff && new Date(s.date) < cutoff) return false;
      return true;
    });
  }, [completedSessions, historyFilter, dateFilter]);

  const DATE_FILTER_LABELS: Record<typeof dateFilter, string> = {
    all: 'All', this_week: 'This week', this_month: 'This month',
  };
  const DATE_FILTER_SCOPE: Record<typeof dateFilter, string> = {
    all: '', this_week: 'this week', this_month: 'this month',
  };

  const historyHeading = historyFilter ? `${SESSION_TYPE_LABELS[historyFilter]} Sessions` : 'Session History';
  const hasActiveFilter = historyFilter !== null || dateFilter !== 'all';
  const sessionWord = `session${filteredSessions.length !== 1 ? 's' : ''}`;
  const scope = DATE_FILTER_SCOPE[dateFilter];
  const historySubheading = hasActiveFilter
    ? `${filteredSessions.length} ${sessionWord}${scope ? ` ${scope}` : ''} · tap a row for details`
    : 'Tap a row to see exercise details';

  const historyEmptyMessage = (() => {
    const typePart = historyFilter ? ` ${SESSION_TYPE_LABELS[historyFilter].toLowerCase()}` : '';
    if (scope) return `No${typePart} sessions ${scope} yet`;
    if (historyFilter) return `No${typePart} sessions yet`;
    return 'No sessions logged yet';
  })();

  const TABS = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'strength' as const, label: 'Strength' },
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
          {TABS.map(tab => {
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
                {(['squat', 'bench', 'deadlift'] as SessionType[]).map(lift => (
                  <StrengthLineChart key={lift} lift={lift} orms={oneRepMaxes} weightUnit={weightUnit} C={C} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.sectionTitle}>{historyHeading}</Text>
                {hasActiveFilter && (
                  <Pressable
                    onPress={() => { setHistoryFilter(null); setDateFilter('all'); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      backgroundColor: pressed ? C.primaryMuted : C.primarySurface,
                      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                      borderWidth: 1, borderColor: C.primaryMuted,
                    })}
                  >
                    <Ionicons name="close-circle" size={13} color={C.primary} />
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.primary }}>Clear all</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.sectionSub}>{historySubheading}</Text>
              <View style={{
                flexDirection: 'row', backgroundColor: C.surfaceTertiary,
                borderRadius: 10, padding: 3, marginBottom: 12,
                borderWidth: 1, borderColor: C.borderLight,
              }}>
                {(['all', 'this_week', 'this_month'] as const).map(option => {
                  const active = dateFilter === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setDateFilter(option)}
                      style={({ pressed }) => ({
                        flex: 1, alignItems: 'center', justifyContent: 'center',
                        paddingVertical: 8, borderRadius: 8,
                        backgroundColor: active ? C.surface : 'transparent',
                        opacity: pressed && !active ? 0.7 : 1,
                        ...(active ? {
                          shadowColor: C.shadow, shadowOpacity: 0.06,
                          shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
                          elevation: 1,
                        } : {}),
                      })}
                    >
                      <Text style={{
                        fontSize: 13,
                        fontFamily: active ? 'Inter_600SemiBold' : 'Inter_500Medium',
                        color: active ? C.text : C.textSecondary,
                      }}>
                        {DATE_FILTER_LABELS[option]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <SessionHistoryList
                key={`${historyFilter ?? 'all'}-${dateFilter}`}
                sessions={filteredSessions}
                weightUnit={weightUnit}
                emptyMessage={historyEmptyMessage}
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
      flexDirection: 'row', backgroundColor: C.surfaceTertiary,
      borderRadius: 12, padding: 3,
      borderWidth: 1, borderColor: C.borderLight,
    },
    segmentTab: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 9, borderRadius: 10,
    },
    segmentTabActive: {
      backgroundColor: C.surface,
      shadowColor: C.shadow, shadowOpacity: 0.08,
      shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    segmentTabText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    segmentTabTextActive: { fontFamily: 'Inter_700Bold', color: C.text },

    tabContent: { paddingHorizontal: 20, paddingTop: 4 },

    statRow: {
      flexDirection: 'row', backgroundColor: C.surface, borderRadius: 16, padding: 16,
      marginBottom: 14, borderWidth: 1, borderColor: C.borderLight, alignItems: 'center',
    },
    statCell: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.primary },
    statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2, textAlign: 'center' },
    statDiv: { width: 1, height: 32, backgroundColor: C.border },

    sectionBlock: { marginBottom: 16 },
    sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 2 },
    sectionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 12 },

    calcBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.primarySurface, borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 14,
      borderWidth: 1, borderColor: C.primaryMuted, marginBottom: 16,
    },
    calcBtnText: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.primary },

    modalContainer: { flex: 1, backgroundColor: C.background },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: C.borderLight,
    },
    modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
    modalClose: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: C.surfaceTertiary,
      alignItems: 'center', justifyContent: 'center',
    },
  });
}
