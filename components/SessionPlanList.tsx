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
 *
 * IT IS PRINTED ON THE PAGE, like the exercise card and the summary
 * certificate: "the full list of exercises before the session should be on the
 * ecru theme colour not black boxes." One sheet with ruled rows rather than a
 * stack of little cards - it is a programme for one session, not a menu of
 * separate things, and the sheet says so. Which session it is comes through in
 * the accent: the tick, the rail beside the exercise you are on, every block
 * pill.
 */
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/colors';
import { PAGE, type SessionIdentity } from '@/lib/session-identity';
import type { Exercise } from '@/lib/workout-engine';

/**
 * Category to the words and colours a user sees.
 *
 * Exported because app/session.tsx draws the same pills on the exercise card,
 * and two copies of "which green is a warm-up" is a drift waiting to happen.
 *
 * The colours here are for a pill on the app's own surfaces. On the page this
 * list uses the session's accent for every pill instead, exactly as the card
 * does, so only the label is read from this.
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
  /** The session's colour. Required: this list only ever renders in a session. */
  accent: SessionIdentity;
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
  accent,
  results,
  activeIndex,
  onSelect,
  grouped = true,
  style,
}: SessionPlanListProps) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(accent), [accent]);
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
    <View style={[styles.sheet, style]}>
      <ScrollView
        style={styles.scroll}
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
                    <Ionicons name="checkmark" size={13} color={PAGE.bg} />
                  </View>
                ) : isActive ? (
                  <View style={styles.here}>
                    <Ionicons name="play" size={11} color={PAGE.bg} />
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
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{cat.label}</Text>
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

              {reachable && <Ionicons name="chevron-forward" size={17} color={PAGE.inkFaint} />}
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
    </View>
  );
}

function makeStyles(accent: SessionIdentity) {
  return StyleSheet.create({
    sheet: {
      width: '100%',
      backgroundColor: PAGE.bg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: PAGE.hairline,
      overflow: 'hidden',
    },
    scroll: { width: '100%' },
    content: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 12 },
    heading: {
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: PAGE.inkFaint,
      marginTop: 14,
      marginBottom: 4,
    },
    // A ruled sheet rather than a stack of cards: no fill and no border on an
    // ordinary row, so the eye reads one page of work rather than nine objects.
    // The rail on the left is transparent and coloured in only for the exercise
    // you are on, which keeps every row exactly the same width.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    rowActive: {
      backgroundColor: accent.wash,
      borderLeftColor: accent.deep,
    },
    rowDone: { opacity: 0.72 },
    statusCol: { width: 24, alignItems: 'center' },
    tick: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: accent.deep,
      alignItems: 'center',
      justifyContent: 'center',
    },
    here: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: accent.deep,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pending: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: PAGE.hairline,
    },
    textCol: { flex: 1, gap: 4 },
    name: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: PAGE.ink },
    nameDone: { color: PAGE.inkMuted },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: accent.wash,
    },
    pillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: accent.deep },
    meta: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: PAGE.inkMuted },
    summary: { fontSize: 12, fontFamily: 'Inter_500Medium', color: accent.deep },
  });
}
