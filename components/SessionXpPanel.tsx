/**
 * WHAT THIS SESSION WAS WORTH, on the summary and nowhere else in the session.
 *
 * The brief was "a cool additional feature" that is "definitely not
 * overbearing", and the way to have both is to show it once, at the moment it
 * is earned, as part of the record of what just happened. There is no XP
 * counter ticking during a session, nothing pops when a set is logged, and
 * nothing interrupts. You finish, and the summary tells you what it came to.
 *
 * ITEMISED, NOT TOTALLED. A bare "+184 XP" is a number to take on trust. Every
 * line here names a real thing that happened, so the panel reads as a receipt
 * rather than a slot machine - which is also what stops it feeling like a
 * mobile game bolted onto a clinical tool.
 *
 * IT TAKES THE CERTIFICATE'S PALETTE, not the app's.
 * The first version used the ordinary surface tokens and photographing it
 * settled that too: a black card, dropped into the middle of an ecru document,
 * announcing that a different part of the app had been bolted on. The summary
 * is deliberately one continuous piece of paper - see CardPalette in
 * app/session-summary.tsx - and anything landing on it has to be printed on the
 * same stock.
 *
 * THE HEADLINE IS THE FROZEN NUMBER. The total comes from the session itself,
 * stamped when it was logged; only the breakdown is recomputed.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { xpStanding, sessionXp, type SessionXp } from '@/lib/xp';

/** The subset of the summary's CardPalette this panel needs. */
export interface XpPanelPalette {
  pillBg: string;
  text: string;
  muted: string;
  faint: string;
  hairline: string;
  accent: string;
}

interface Props {
  P: XpPanelPalette;
  /** Total XP the account had BEFORE this session, so the bar shows the move. */
  xpBefore: number;
  /** The frozen figure from the session. Undefined for sessions logged before XP. */
  xpEarned?: number;
  /** Everything the breakdown needs, straight from the session being viewed. */
  breakdown: Parameters<typeof sessionXp>[0];
}

export default function SessionXpPanel({ P, xpBefore, xpEarned, breakdown }: Props) {
  // Nothing to say about a session logged before any of this existed. Showing
  // "+0 XP" on somebody's history would read as a punishment for having been
  // here first.
  if (xpEarned === undefined || xpEarned <= 0) return null;

  const computed: SessionXp = sessionXp(breakdown);
  /**
   * THE BREAKDOWN IS SHOWN ONLY WHEN IT ADDS UP.
   *
   * The headline is the frozen total - what was actually banked - and the lines
   * are recomputed from the session's own data. They agree today, because both
   * come from the same function. If the XP table is ever retuned they will not.
   *
   * The first version scaled the lines to fit the headline, and photographing
   * it settled the question: it printed "Session complete +109" and "Personal
   * best +131", numbers nobody ever earned, invented to make a column sum.
   * A receipt that rounds its own line items is not a receipt. When the two
   * disagree the honest thing is to show the total on its own.
   */
  const lines = computed.total === xpEarned ? computed.lines : [];

  const after = xpStanding(xpBefore + xpEarned);
  const before = xpStanding(xpBefore);
  const levelledUp = after.level > before.level;
  const styles = makeStyles(P);

  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(190)}
      style={styles.panel}
      testID="summary-xp-panel"
    >
      <View style={styles.head}>
        <Text style={styles.eyebrow}>EARNED</Text>
        <Text style={styles.total} testID="summary-xp-total">
          +{xpEarned.toLocaleString()} XP
        </Text>
      </View>

      {lines.length > 0 && (
        <View style={styles.lines}>
          {lines.map((l) => (
            <View key={l.label} style={styles.line}>
              <Text style={styles.lineLabel} numberOfLines={1}>
                {l.label}
              </Text>
              <Text style={styles.lineAmount}>+{l.amount}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.rule} />

      {levelledUp ? (
        <Text style={styles.levelUp} testID="summary-xp-levelup">
          Level {after.level} reached
        </Text>
      ) : null}
      <View style={styles.barRow}>
        {/* The number is already in the line above on a level-up, so the bar
            just gets its ends rather than repeating it. */}
        <Text style={styles.barLabel}>{levelledUp ? '' : `Level ${after.level}`}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.round(after.fraction * 100)}%` }]} />
        </View>
        <Text style={styles.barLabelEnd}>{after.atCeiling ? '' : after.level + 1}</Text>
      </View>
      <Text style={styles.toNext}>
        {after.atCeiling
          ? 'The top of the ladder.'
          : `${after.toNext.toLocaleString()} XP to level ${after.level + 1}`}
      </Text>
    </Animated.View>
  );
}

const makeStyles = (P: XpPanelPalette) =>
  StyleSheet.create({
    panel: {
      backgroundColor: P.pillBg,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: P.hairline,
    },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    eyebrow: {
      fontSize: 9,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 0.8,
      color: P.faint,
    },
    total: { fontSize: 24, fontFamily: 'Inter_700Bold', color: P.accent },
    lines: { marginTop: 10, gap: 4 },
    line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    lineLabel: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: P.muted },
    lineAmount: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: P.text,
      fontVariant: ['tabular-nums'],
    },
    rule: { height: 1, backgroundColor: P.hairline, marginVertical: 12 },
    levelUp: {
      fontSize: 14.5,
      fontFamily: 'Inter_700Bold',
      color: P.accent,
      marginBottom: 8,
    },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    barLabel: {
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      color: P.faint,
      minWidth: 44,
    },
    barLabelEnd: {
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      color: P.faint,
      minWidth: 14,
      textAlign: 'right',
    },
    barTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: P.hairline,
      overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 3, backgroundColor: P.accent },
    toNext: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: P.muted,
      marginTop: 6,
    },
  });
