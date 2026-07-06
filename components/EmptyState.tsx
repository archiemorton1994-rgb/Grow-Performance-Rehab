import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  cta?: {
    label: string;
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    testID?: string;
  };
  testID?: string;
}

export function EmptyState({ icon, title, subtitle, cta, testID }: EmptyStateProps) {
  const C = useColors();

  return (
    <View
      testID={testID}
      style={[styles.card, { backgroundColor: C.surface, borderColor: C.borderLight }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: C.surfaceTertiary }]}>
        <Ionicons name={icon} size={32} color={C.textTertiary} />
      </View>
      <Text style={[styles.title, { color: C.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: C.textTertiary }]}>{subtitle}</Text>
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
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 15, textAlign: 'center' },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 280,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
