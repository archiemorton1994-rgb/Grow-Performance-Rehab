import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';

type Variant = 'card' | 'inline';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  cta?: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; testID?: string };
  variant?: Variant;
  testID?: string;
}

export function EmptyState({ icon, title, subtitle, cta, variant = 'card', testID }: EmptyStateProps) {
  const C = useColors();
  const isInline = variant === 'inline';

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        isInline ? styles.inline : { backgroundColor: C.surface, borderColor: C.borderLight, ...styles.card },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          isInline ? styles.iconWrapInline : { backgroundColor: C.surfaceTertiary, ...styles.iconWrapCard },
        ]}
      >
        <Ionicons name={icon} size={isInline ? 24 : 32} color={C.textTertiary} />
      </View>
      <Text style={[styles.title, { color: C.text, fontSize: isInline ? 14 : 15 }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: C.textTertiary, fontSize: isInline ? 12 : 13 }]}>{subtitle}</Text>
      ) : null}
      {cta ? (
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            cta.onPress();
          }}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: C.primary },
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          testID={cta.testID}
        >
          {cta.icon ? <Ionicons name={cta.icon} size={15} color={C.textInverse} /> : null}
          <Text style={[styles.ctaText, { color: C.textInverse }]}>{cta.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, borderWidth: 1, paddingVertical: 28, paddingHorizontal: 20 },
  inline: { paddingVertical: 16, paddingHorizontal: 16 },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconWrapCard: { width: 56, height: 56, borderRadius: 28, marginBottom: 12 },
  iconWrapInline: { marginBottom: 8 },
  title: { fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  subtitle: { fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 4, lineHeight: 18, maxWidth: 280 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 16, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12,
  },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
