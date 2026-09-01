import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextStyle, View, useWindowDimensions,
  ScrollView,
} from 'react-native';
import { useColors } from '@/constants/colors';
import { elevatedShadow } from '@/constants/shadows';

/**
 * An inline term that reveals a short plain-language definition on tap,
 * dismissed by tapping anywhere else. Used for jargon (AMRAP, 1RM, KPI, PB)
 * that shows up in the UI without explanation - keeps the term itself in
 * place rather than requiring a separate glossary screen no one would find.
 *
 * Renders the popover in a Modal so it always floats above the rest of the
 * screen regardless of where the term sits inside a ScrollView - a plain
 * absolutely-positioned View would risk getting clipped by an ancestor's
 * overflow:hidden depending on which screen it's used on.
 */
export function GlossaryTerm({
  term,
  definition,
  textStyle,
  testID,
}: {
  term: string;
  definition: string;
  textStyle?: TextStyle | TextStyle[];
  testID?: string;
}) {
  const C = useColors();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null
  );

  // Text (not Pressable) so this can sit inline inside a surrounding
  // sentence — "Log a <GlossaryTerm .../> to track..." — without breaking
  // onto its own block. RN's Text supports onPress and a ref to the
  // underlying native node directly, same as any host component.
  const termRef = useRef<Text>(null);
  const reveal = () => {
    termRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const POPOVER_WIDTH = 220;
  const MARGIN = 12;
  /** Enough for a heading and a couple of lines; below this, flip instead. */
  const MIN_POPOVER_HEIGHT = 120;
  let left = (anchor?.x ?? 0) + (anchor?.width ?? 0) / 2 - POPOVER_WIDTH / 2;
  left = Math.max(MARGIN, Math.min(left, windowWidth - POPOVER_WIDTH - MARGIN));
  /**
   * Which way to open, and how tall it may be.
   *
   * The flip threshold used to be a flat 100pt, which is shorter than every
   * definition in the app — so a term near the bottom of the screen opened
   * downward into a box whose last two or three lines ran off the edge. The box
   * did not scroll and could not be moved, so the explanation was simply
   * unreadable: the user had to scroll the page, guess where the word had moved
   * to, and tap it again.
   *
   * Two changes rather than a bigger guess. It flips when the other side has
   * genuinely more room, and whichever side it lands on caps its height and
   * lets the text scroll inside — so it is bounded by real space instead of an
   * assumption about how long a definition is.
   */
  const spaceBelow = windowHeight - ((anchor?.y ?? 0) + (anchor?.height ?? 0));
  const spaceAbove = anchor?.y ?? 0;
  const showAbove = spaceBelow < MIN_POPOVER_HEIGHT && spaceAbove > spaceBelow;
  const top = showAbove ? (anchor?.y ?? 0) - 10 : (anchor?.y ?? 0) + (anchor?.height ?? 0) + 10;
  const maxPopoverHeight = Math.max(
    MIN_POPOVER_HEIGHT,
    (showAbove ? spaceAbove : spaceBelow) - MARGIN * 2
  );

  return (
    <>
      <Text
        ref={termRef}
        testID={testID}
        onPress={reveal}
        style={[
          textStyle,
          {
            textDecorationLine: 'underline',
            textDecorationStyle: 'dotted',
            textDecorationColor: C.textTertiary,
          },
        ]}
      >
        {term}
      </Text>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setOpen(false)}>
          {anchor && (
            <View
              style={[
                styles.popover,
                {
                  width: POPOVER_WIDTH,
                  left,
                  top: showAbove ? undefined : top,
                  bottom: showAbove ? windowHeight - top : undefined,
                  maxHeight: maxPopoverHeight,
                  backgroundColor: C.surface,
                  borderColor: C.border,
                },
                elevatedShadow('#000'),
              ]}
            >
              <Text style={[styles.term, { color: C.text }]}>{term}</Text>
              <ScrollView
                style={{ flexShrink: 1 }}
                showsVerticalScrollIndicator={false}
                // The backdrop closes the popover; without this a scroll gesture
                // that starts on the text would close it instead of scrolling.
                onStartShouldSetResponder={() => true}
              >
                <Text style={[styles.definition, { color: C.textSecondary }]}>{definition}</Text>
              </ScrollView>
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  popover: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  term: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    marginBottom: 3,
  },
  definition: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
});
