/**
 * The route for the custom programme builder.
 *
 * A root-level screen rather than a tab, for the same reason /custom-session is:
 * it is a thing you do once, it wants the whole screen, and coming back from it
 * should put you where you were.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/colors';
import { BuildProgramme } from '@/components/BuildProgramme';

const WEB_TOP_INSET = 67;

export default function BuildProgrammeScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? WEB_TOP_INSET : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: C.background, paddingTop: topPad + 10 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
          testID="build-programme-back"
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={[styles.title, { color: C.text }]}>Build a programme</Text>
      </View>
      <BuildProgramme />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingBottom: 10 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
});
