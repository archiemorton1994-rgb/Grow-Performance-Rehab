import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';
import { shadowStyle } from '@/constants/shadows';
import { messageSignature } from '@/lib/coach';
import type { CoachAction, CoachMessage, CoachSnapshot } from '@/lib/coach';

/**
 * The assistant: one button, and a hub of whatever the app has to say.
 *
 * WHY THIS IS NOT A MODAL
 * ───────────────────────
 * Same reason as AchievementBanner. Two native Modals presented at once break
 * touch routing on both and the whole app reads as frozen — this app has hit
 * that twice. This is an absolutely-positioned View inside the home screen's own
 * tree, so it can never collide with anything. The scrim behind it is a plain
 * Pressable, and everything it covers stays mounted and live.
 *
 * WHY A BUBBLE RATHER THAN CARDS IN THE SCROLL
 * ────────────────────────────────────────────
 * The five advisory cards this replaces were each individually reasonable and
 * collectively pushed the session card off the screen. Advice that competes
 * with the thing you opened the app to do is advice in the wrong place. Behind
 * a button it can be as detailed as it likes and cost nothing until asked for.
 *
 * WHY IT IS SAPPHIRE, AND THE ONLY SAPPHIRE THING IN THE APP
 * ─────────────────────────────────────────────────────────
 * Everything else on the home screen is the app talking about your session.
 * This is something talking to you ABOUT your training, and in the brand green
 * it read as one more panel among panels. A colour used nowhere else means the
 * button is findable without looking for it and the panel says what it is
 * before a word has been read. The palette is defined once in
 * constants/colors.ts under `assistant*` and is not to be borrowed by anything
 * that is not this.
 *
 * WHAT IT SHOWS, IN ORDER
 * ───────────────────────
 *   1. Where the week stands, the streak, and how the work is trending. Three
 *      facts a user checks every time, which as sentences would be three
 *      messages nobody needed told.
 *   2. What to train next and why in one clause.
 *   3. The messages, most urgent first, each marked if it is new since the
 *      panel was last opened.
 */

const TAIL = 9;

/**
 * The button changes SHAPE, not just colour, when there is something new.
 *
 * A coloured dot is the convention and it is nearly invisible on a 38pt circle
 * at arm's length in a gym. A different glyph reads at a glance and survives
 * being looked at by somebody who has never noticed the dot convention in their
 * life. Filled when there is something new, outlined when there is not.
 */
export function CoachButton({
  onPress,
  hasNews,
  open,
}: {
  onPress: () => void;
  /** Something in the panel has changed since it was last opened. */
  hasNews: boolean;
  open: boolean;
}) {
  const C = useColors();
  const filled = open || hasNews;
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: filled ? C.assistantFill : C.assistantSurface,
          borderColor: filled ? C.assistantFill : C.assistantMuted,
        },
        pressed && { opacity: 0.85 },
      ]}
      testID="coach-button"
      accessibilityLabel={hasNews ? 'Assistant, new information' : 'Assistant'}
      accessibilityRole="button"
    >
      <Ionicons
        name={hasNews && !open ? 'sparkles' : 'chatbubble-ellipses-outline'}
        size={18}
        color={filled ? C.assistantOnFill : C.assistantInk}
      />
    </Pressable>
  );
}

function GlanceStat({
  value,
  label,
  C,
}: {
  value: string;
  label: string;
  C: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>
      <Text style={[styles.glanceValue, { color: C.assistantOnFill }]}>{value}</Text>
      <Text style={[styles.glanceLabel, { color: C.assistantOnFill }]}>{label}</Text>
    </View>
  );
}

export function CoachBubble({
  messages,
  snapshot,
  seen,
  onClose,
  onAction,
  onDismiss,
  /** Distance from the top of the home screen's content to the button's bottom
   *  edge, so the tail lines up with whatever laid the button out. */
  top,
  /** Distance from the RIGHT edge to the button's centre, for the tail. */
  tailRight,
}: {
  messages: CoachMessage[];
  snapshot: CoachSnapshot;
  /** Signatures already shown to this user; see messageSignature. */
  seen: Record<string, number>;
  onClose: () => void;
  onAction: (action: CoachAction) => void;
  /** Called for messages that carry `dismissible`. See the note on the field. */
  onDismiss: (id: string) => void;
  top: number;
  tailRight: number;
}) {
  const C = useColors();
  const toneColor = (tone: CoachMessage['tone']) =>
    tone === 'caution' ? C.warning : tone === 'good' ? C.primaryText : C.assistantInk;

  const trend =
    snapshot.volumeDeltaPct === null
      ? '-'
      : `${snapshot.volumeDeltaPct > 0 ? '+' : ''}${snapshot.volumeDeltaPct}%`;

  return (
    <>
      {/* Tap-anywhere-to-close. Deliberately covers the whole screen and
          deliberately transparent: a dimmed scrim would make this feel like the
          modal it is carefully not. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Close assistant"
        testID="coach-scrim"
      />
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(100)}
        style={[styles.bubbleWrap, { top }]}
        pointerEvents="box-none"
      >
        <View
          style={[styles.tail, { right: tailRight, borderBottomColor: C.assistantFill }]}
        />
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: C.assistantSurface,
              borderColor: C.assistantMuted,
              ...shadowStyle(C.shadow, 0.22, 20, 8, 12),
            },
          ]}
          testID="coach-bubble"
        >
          {/* ── Header, and the three numbers ─────────────────────────────── */}
          <View style={[styles.header, { backgroundColor: C.assistantFill }]}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="sparkles" size={14} color={C.assistantOnFill} />
              <Text style={[styles.headerTitle, { color: C.assistantOnFill }]}>Assistant</Text>
            </View>
            <View style={styles.glanceRow} testID="coach-glance">
              <GlanceStat
                value={`${snapshot.weekCount}/${snapshot.weeklyGoal}`}
                label="THIS WEEK"
                C={C}
              />
              <View style={[styles.glanceDivider, { backgroundColor: C.assistantOnFill }]} />
              <GlanceStat value={String(snapshot.streak)} label="WEEK STREAK" C={C} />
              <View style={[styles.glanceDivider, { backgroundColor: C.assistantOnFill }]} />
              <GlanceStat value={trend} label="VS LAST MONTH" C={C} />
            </View>
          </View>

          <ScrollView
            /* Ends well above the fold on the shortest phone the app targets,
               so the panel reads as a card with more inside it rather than as
               something that ran off the bottom of the screen. */
            style={{ maxHeight: 340 }}
            contentContainerStyle={{ paddingBottom: 4 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ── What to train next ───────────────────────────────────────── */}
            {snapshot.nextSession && (
              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web')
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onAction({
                    label: snapshot.nextSession!.label,
                    kind: 'start-session',
                    sessionType: snapshot.nextSession!.type,
                  });
                }}
                style={({ pressed }) => [
                  styles.suggestion,
                  { borderBottomColor: C.assistantMuted },
                  pressed && { opacity: 0.8 },
                ]}
                testID="coach-next-session"
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={[styles.suggestionLabel, { color: C.assistantInk }]}>
                    SUGGESTED NEXT
                  </Text>
                  <Text style={[styles.suggestionTitle, { color: C.text }]}>
                    {snapshot.nextSession.label}
                  </Text>
                  <Text style={[styles.suggestionReason, { color: C.textSecondary }]}>
                    {snapshot.nextSession.reason}
                  </Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={26} color={C.assistantInk} />
              </Pressable>
            )}

            {/* ── The messages ─────────────────────────────────────────────── */}
            {messages.map((m, i) => {
              const isNew = seen[messageSignature(m)] === undefined;
              return (
                <View key={m.id}>
                  {i > 0 && <View style={[styles.divider, { backgroundColor: C.assistantMuted }]} />}
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.rowIcon,
                        {
                          backgroundColor:
                            m.tone === 'caution' ? C.surfaceTertiary : C.assistantMuted,
                        },
                      ]}
                    >
                      <Ionicons name={m.icon as never} size={16} color={toneColor(m.tone)} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.title, { color: C.text }]}>{m.title}</Text>
                        {isNew && (
                          <View
                            style={[styles.newPill, { backgroundColor: C.assistantFill }]}
                            testID={`coach-new-${m.id}`}
                          >
                            <Text style={[styles.newPillText, { color: C.assistantOnFill }]}>
                              NEW
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.body, { color: C.textSecondary }]}>{m.body}</Text>
                      {m.action && (
                        <Pressable
                          onPress={() => {
                            if (Platform.OS !== 'web')
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            onAction(m.action!);
                          }}
                          style={({ pressed }) => [
                            styles.action,
                            { backgroundColor: C.assistantMuted, borderColor: C.assistantMuted },
                            pressed && { opacity: 0.8 },
                          ]}
                          testID={`coach-action-${m.id}`}
                        >
                          <Text style={[styles.actionText, { color: C.assistantInk }]}>
                            {m.action.label}
                          </Text>
                          <Ionicons name="arrow-forward" size={12} color={C.assistantInk} />
                        </Pressable>
                      )}
                    </View>
                    {m.dismissible && (
                      <Pressable
                        onPress={() => onDismiss(m.id)}
                        hitSlop={10}
                        testID={`coach-dismiss-${m.id}`}
                        accessibilityLabel="Dismiss this tip"
                        accessibilityRole="button"
                      >
                        <Ionicons name="close" size={15} color={C.textTertiary} />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bubbleWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
  },
  tail: {
    position: 'absolute',
    top: -TAIL + 1,
    width: 0,
    height: 0,
    borderLeftWidth: TAIL,
    borderRightWidth: TAIL,
    borderBottomWidth: TAIL,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 12,
    gap: 10,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  glanceRow: { flexDirection: 'row', alignItems: 'center' },
  glanceDivider: { width: 1, height: 22, opacity: 0.25 },
  glanceValue: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  glanceLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 0.5, opacity: 0.75 },

  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  suggestionLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  suggestionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  suggestionReason: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  divider: { height: 1, marginHorizontal: 14 },
  row: { flexDirection: 'row', gap: 10, padding: 14, alignItems: 'flex-start' },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  newPill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  newPillText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  body: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  action: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  actionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
