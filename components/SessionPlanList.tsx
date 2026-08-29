/**
 * The whole session as a list, used in two places on purpose.
 *
 * BEFORE THE SESSION it is the answer to "what am I about to do", which the app
 * never gave. You answered three questions about how you felt and were dropped
 * straight onto exercise one of twenty-five with no idea whether that was ten
 * minutes or an hour, or whether the heavy thing was first or last.
 *
 * DURING THE SESSION it is what the progress strip opens, and it is how you get
 * back to an exercise you think you mis-logged. Each finished row says what was
 * actually recorded, so you can check without leaving the exercise you are on.
 *
 * One component for both, because two lists of the same session that could
 * disagree is worse than either. The only difference is whether rows carry
 * results and whether they can be tapped.
 */
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/colors';
import type { Exercise } from '@/lib/workout-engine';

/**
 * Category to the words and colours a user sees.
 *
 * Exported because app/session.tsx draws the same pills on the exercise card,
 * and two copies of "which green is a warm-up" is a drift waiting to happen.
 */
export function categoryDisplay(C: ReturnType<typeof useColors>) {
  return {
    // Every other row pairs a dark tinted fill with a bright ink token. prep
    // used `primary`, the FILL green, which is dim ink on a dim fill: 1.90:1 in
    // dark mode, on the first four cards of every session.
    prep: { bg: C.primaryMuted, text: C.primaryText, label: 'Warm-Up' },
    mechanical: { bg: C.categoryMechanical, text: C.categoryMechanicalText, label: 'Activation' },
    neuro: { bg: C.categoryNeuro, text: C.categoryNeuroText, label: 'Power Primer' },
    main: { bg: C.primaryMuted, text: C.primaryDark, label: 'KPI Lift' },
    accessory: { bg: C.surfaceTertiary, text: C.textSecondary, label: 'Accessory' },
    prehab: { bg: C.categoryPrehab, text: C.categoryPrehabText, label: 'Prehab' },
    finisher: { bg: C.categoryFinisher, text: C.categoryFinisherText, label: 'Finisher' },
    cooldown: { bg: C.categoryCooldown, text: C.categoryCooldownText, label: 'Cool Down' },
  } as Record<string, { bg: string; text: string; label: string }>;
}

/** What was actually recorded against one exercise, if anything yet. */
export interface PlanRowResult {
  /** Every set logged or skipped. */
  done: boolean;
  /** Sets that were really performed, not skipped. */
  loggedSets: number;
  totalSets: number;
  /** One short line, e.g. "60 kg x 8, 60 kg x 7". Empty before anything is done. */
  summary: string;
}

export interface SessionPlanListProps {
  exercises: Exercise[];
  /** Per-exercise results. Omit entirely before the session starts. */
  results?: PlanRowResult[];
  /** The exercise on screen, highlighted. Omit before the session starts. */
  activeIndex?: number;
  /** Tapping a row. Only called for rows the user is allowed to reach. */
  onSelect?: (index: number) => void;
  /** Groups rows under their phase heading. */
  grouped?: boolean;
  style?: object;
}

export function SessionPlanList({
  exercises,
  results,
  activeIndex,
  onSelect,
  grouped = true,
  style,
}: SessionPlanListProps) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const display = useMemo(() => categoryDisplay(C), [C]);

  /**
   * Rows in order, with a heading inserted wherever the phase changes.
   *
   * Not grouped by sorting into buckets: the order of a session is a
   * prescription, and a warm-up drill that reappears at the end is at the end
   * for a reason. Headings mark the boundaries of the order that exists.
   */
  const rows = useMemo(() => {
    const out: ({ kind: 'heading'; label: string } | { kind: 'row'; index: number })[] = [];
    let lastLabel = '';
    exercises.forEach((ex, index) => {
      const label = display[ex.category]?.label ?? 'Accessory';
      if (grouped && label !== lastLabel) {
        out.push({ kind: 'heading', label });
        lastLabel = label;
      }
      out.push({ kind: 'row', index });
    });
    return out;
  }, [exercises, display, grouped]);

  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {rows.map((item, i) => {
        if (item.kind === 'heading') {
          return (
            <Text key={`h-${item.label}-${i}`} style={styles.heading}>
              {item.label}
            </Text>
          );
        }
        const index = item.index;
        const ex = exercises[index];
        const cat = display[ex.category] ?? display.accessory;
        const result = results?.[index];
        const isActive = activeIndex === index;
        // Reachable means finished, or the one you are on. Nothing lets you
        // jump forward past work you have not done.
        const reachable = !!onSelect && (isActive || !!result?.done);

        const body = (
          <View
            style={[
              styles.row,
              isActive && styles.rowActive,
              result?.done && !isActive && styles.rowDone,
            ]}
          >
            <View style={styles.statusCol}>
              {result?.done ? (
                <View style={styles.tick}>
                  <Ionicons name="checkmark" size={13} color={C.textInverse} />
                </View>
              ) : isActive ? (
                <View style={styles.here}>
                  <Ionicons name="play" size={11} color={C.textInverse} />
                </View>
              ) : (
                <View style={styles.pending} />
              )}
            </View>

            <View style={styles.textCol}>
              <Text
                style={[styles.name, result?.done && !isActive && styles.nameDone]}
                numberOfLines={2}
              >
                {ex.name}
              </Text>
              <View style={styles.metaRow}>
                <View style={[styles.pill, { backgroundColor: cat.bg }]}>
                  <Text style={[styles.pillText, { color: cat.text }]}>{cat.label}</Text>
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  {ex.sets} {ex.sets === 1 ? 'set' : 'sets'} &times; {ex.reps}
                </Text>
              </View>
              {!!result?.summary && (
                <Text style={styles.summary} numberOfLines={2}>
                  {result.summary}
                </Text>
              )}
            </View>

            {reachable && (
              <Ionicons name="chevron-forward" size={17} color={C.textTertiary} />
            )}
          </View>
        );

        if (!reachable) return <View key={ex.id + index}>{body}</View>;
        return (
          <Pressable
            key={ex.id + index}
            onPress={() => onSelect?.(index)}
            testID={`plan-row-${index}`}
            accessibilityRole="button"
            accessibilityLabel={
              isActive ? `Back to ${ex.name}` : `Review ${ex.name}, already finished`
            }
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
          >
            {body}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    scroll: { width: '100%' },
    content: { paddingBottom: 8, gap: 8 },
    heading: {
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: C.textTertiary,
      marginTop: 10,
      marginBottom: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    rowActive: { borderColor: C.primary, backgroundColor: C.primarySurface },
    rowDone: { backgroundColor: C.surfaceSecondary },
    statusCol: { width: 24, alignItems: 'center' },
    tick: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    here: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: C.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pending: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: C.border,
    },
    textCol: { flex: 1, gap: 4 },
    name: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text },
    nameDone: { color: C.textSecondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    pillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
    meta: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    summary: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.primaryText },
  });
}
