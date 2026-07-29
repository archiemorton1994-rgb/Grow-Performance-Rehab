import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextStyle, View, useWindowDimensions } from 'react-native';
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
}: {
  term: string;
  definition: string;
  textStyle?: TextStyle | TextStyle[];
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
  let left = (anchor?.x ?? 0) + (anchor?.width ?? 0) / 2 - POPOVER_WIDTH / 2;
  left = Math.max(MARGIN, Math.min(left, windowWidth - POPOVER_WIDTH - MARGIN));
  const spaceBelow = windowHeight - ((anchor?.y ?? 0) + (anchor?.height ?? 0));
  const showAbove = spaceBelow < 100;
  const top = showAbove ? (anchor?.y ?? 0) - 10 : (anchor?.y ?? 0) + (anchor?.height ?? 0) + 10;

  return (
    <>
      <Text
        ref={termRef}
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
                  backgroundColor: C.surface,
                  borderColor: C.border,
                },
                elevatedShadow('#000'),
              ]}
            >
              <Text style={[styles.term, { color: C.text }]}>{term}</Text>
              <Text style={[styles.definition, { color: C.textSecondary }]}>{definition}</Text>
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
