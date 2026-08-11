import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';
import { shadowStyle } from '@/constants/shadows';
import type { CoachAction, CoachMessage } from '@/lib/coach';

/**
 * The assistant: one button, and a bubble of whatever the app has to say.
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
 */

const TAIL = 9;

export function CoachButton({
  onPress,
  hasAdvice,
  open,
}: {
  onPress: () => void;
  hasAdvice: boolean;
  open: boolean;
}) {
  const C = useColors();
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: open ? C.primary : C.primarySurface,
          borderColor: open ? C.primary : C.primaryMuted,
        },
        pressed && { opacity: 0.85 },
      ]}
      testID="coach-button"
      accessibilityLabel="Training tips"
      accessibilityRole="button"
    >
      <Ionicons
        name="chatbubble-ellipses"
        size={18}
        color={open ? C.textInverse : C.primaryText}
      />
      {/* A dot, not a count. A number implies a queue to clear; this is just
          "there is something here". Suppressed while open, since you are
          looking at it. */}
      {hasAdvice && !open && (
        <View style={[styles.dot, { backgroundColor: C.warning, borderColor: C.background }]} />
      )}
    </Pressable>
  );
}

export function CoachBubble({
  messages,
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
  onClose: () => void;
  onAction: (action: CoachAction) => void;
  /** Called for messages that carry `dismissible`. See the note on the field. */
  onDismiss: (id: string) => void;
  top: number;
  tailRight: number;
}) {
  const C = useColors();
  const toneColor = (tone: CoachMessage['tone']) =>
    tone === 'caution' ? C.warning : tone === 'good' ? C.primaryText : C.textSecondary;

  return (
    <>
      {/* Tap-anywhere-to-close. Deliberately covers the whole screen and
          deliberately transparent: a dimmed scrim would make this feel like the
          modal it is carefully not. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Close tips"
        testID="coach-scrim"
      />
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(100)}
        style={[styles.bubbleWrap, { top }]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.tail,
            {
              right: tailRight,
              borderBottomColor: C.surface,
            },
          ]}
        />
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: C.surface,
              borderColor: C.borderLight,
              ...shadowStyle(C.shadow, 0.22, 20, 8, 12),
            },
          ]}
          testID="coach-bubble"
        >
          {messages.map((m, i) => (
            <View key={m.id}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: C.borderLight }]} />}
              <View style={styles.row}>
                <View
                  style={[
                    styles.rowIcon,
                    {
                      backgroundColor:
                        m.tone === 'caution' ? C.surfaceTertiary : C.primarySurface,
                    },
                  ]}
                >
                  <Ionicons name={m.icon as never} size={16} color={toneColor(m.tone)} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.title, { color: C.text }]}>{m.title}</Text>
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
                        { backgroundColor: C.primarySurface, borderColor: C.primaryMuted },
                        pressed && { opacity: 0.8 },
                      ]}
                      testID={`coach-action-${m.id}`}
                    >
                      <Text style={[styles.actionText, { color: C.primaryText }]}>{m.action.label}</Text>
                      <Ionicons name="arrow-forward" size={12} color={C.primaryText} />
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
          ))}
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
  dot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  bubbleWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 60,
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
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1 },
  title: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
  body: { fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 17.5 },
  action: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
