import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView as RNScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useColors } from "@/constants/colors";
import { kgToDisplayUnit, displayUnitToKg } from "@/lib/utils";
import { scheduleWorkoutReminder } from "@/lib/notifications";

if (!__DEV__) {
  type EUType = {
    getGlobalHandler: () => (e: Error, fatal?: boolean) => void;
    setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void;
  };
  const EU = (global as unknown as { ErrorUtils?: EUType }).ErrorUtils;
  if (EU) {
    const defaultHandler = EU.getGlobalHandler();
    EU.setGlobalHandler((error: Error, isFatal?: boolean) => {
      const entry = JSON.stringify({
        ts: new Date().toISOString(),
        fatal: isFatal,
        msg: error?.message,
        stack: error?.stack?.slice(0, 800),
      });
      AsyncStorage.setItem('__last_crash__', entry).then(
        () => defaultHandler(error, isFatal),
        () => defaultHandler(error, isFatal),
      );
    });
  }
}

SplashScreen.preventAutoHideAsync().catch(() => {});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function WeeklyWeightPrompt() {
  const C = useColors();
  const {
    hasHydrated,
    lastWeightPromptedAt,
    setLastWeightPromptedAt,
    userProfile,
    setUserProfile,
    weightUnit,
  } = useAppStore();
  const { isAuthenticated } = useAuth();

  const [showPrompt, setShowPrompt] = useState(false);
  const [weightText, setWeightText] = useState('');

  const isReadyToPrompt = hasHydrated && isAuthenticated;
  const neverSetWeight = userProfile.bodyweightKg === 0;

  useEffect(() => {
    if (!isReadyToPrompt) return;
    const shouldPrompt = !lastWeightPromptedAt || (Date.now() - lastWeightPromptedAt > SEVEN_DAYS_MS);
    if (shouldPrompt && !showPrompt) {
      const display = userProfile.bodyweightKg > 0
        ? String(kgToDisplayUnit(userProfile.bodyweightKg, weightUnit))
        : '';
      setWeightText(display);
      setShowPrompt(true);
    }
  }, [isReadyToPrompt, lastWeightPromptedAt]);

  const trimmed = weightText.trim();
  const parsedWeight = /^\d+(\.\d+)?$/.test(trimmed) ? parseFloat(trimmed) : NaN;
  const isValidInput = !isNaN(parsedWeight) && parsedWeight > 0;
  const hasText = trimmed.length > 0;
  const inputInvalid = hasText && !isValidInput;
  // When no weight has ever been set, require a valid value — cannot skip or confirm empty
  const canConfirm = neverSetWeight ? isValidInput : !inputInvalid;

  const dismiss = () => {
    if (neverSetWeight) return; // no dismissal without a weight when never set
    setLastWeightPromptedAt(Date.now());
    setShowPrompt(false);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const confirm = () => {
    if (!canConfirm) return;
    if (isValidInput) {
      setUserProfile({ bodyweightKg: displayUnitToKg(parsedWeight, weightUnit) });
    }
    setLastWeightPromptedAt(Date.now());
    setShowPrompt(false);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const styles = useMemo(() => makePromptStyles(C), [C]);

  return (
    <Modal visible={showPrompt} transparent animationType="fade" onRequestClose={neverSetWeight ? undefined : dismiss}>
      <Pressable style={styles.overlay} onPress={neverSetWeight ? undefined : dismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>⚖️</Text>
          </View>
          <Text style={styles.title}>Update Your Weight</Text>
          <Text style={styles.sub}>
            {userProfile.bodyweightKg > 0
              ? `Your last recorded weight is ${kgToDisplayUnit(userProfile.bodyweightKg, weightUnit)} ${weightUnit}. Still accurate?`
              : 'Enter your body weight to help calibrate your sessions.'}
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, inputInvalid && styles.inputError]}
              value={weightText}
              onChangeText={setWeightText}
              placeholder={weightUnit === 'kg' ? 'e.g. 80' : 'e.g. 176'}
              placeholderTextColor={C.textTertiary}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={confirm}
              autoFocus
              testID="weight-prompt-input"
            />
            <Text style={styles.unit}>{weightUnit}</Text>
          </View>
          {inputInvalid && (
            <Text style={styles.errorText}>Please enter a positive number</Text>
          )}
          <Pressable
            onPress={confirm}
            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
            disabled={!canConfirm}
            testID="weight-prompt-confirm"
          >
            <Text style={styles.confirmText}>
              {isValidInput ? 'Save & Continue' : (neverSetWeight ? 'Enter your weight' : 'Skip')}
            </Text>
          </Pressable>
          {userProfile.bodyweightKg > 0 && (
            <Pressable onPress={dismiss} style={styles.dismissBtn}>
              <Text style={styles.dismissText}>Skip for this week</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makePromptStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    card: { width: '100%', backgroundColor: C.surface, borderRadius: 20, padding: 24, alignItems: 'center' },
    iconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.primarySurface, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    iconText: { fontSize: 28 },
    title: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 8, textAlign: 'center' },
    sub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginBottom: 6 },
    input: {
      flex: 1, height: 48, backgroundColor: C.surfaceTertiary, borderRadius: 12,
      borderWidth: 1.5, borderColor: C.primary, paddingHorizontal: 14,
      fontSize: 18, fontFamily: 'Inter_600SemiBold', color: C.text, textAlign: 'center',
    },
    inputError: { borderColor: C.error },
    errorText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.error, alignSelf: 'flex-start', marginBottom: 14, marginTop: 2 },
    unit: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, minWidth: 28 },
    confirmBtn: { width: '100%', backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10, marginTop: 14 },
    confirmBtnDisabled: { backgroundColor: C.border, opacity: 0.7 },
    confirmText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
    dismissBtn: { paddingVertical: 10 },
    dismissText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textTertiary },
  });
}

function RootLayoutNav() {
  const { onboardingComplete } = useAppStore();
  const { isLoading, isAuthenticated, hasActiveSubscription } = useAuth();
  useEffect(() => {
    if (isLoading) return;

    if (!onboardingComplete) {
      setTimeout(() => router.replace("/onboarding"), 0);
    } else if (!isAuthenticated) {
      setTimeout(() => router.replace("/auth"), 0);
    } else if (!hasActiveSubscription) {
      setTimeout(() => router.replace("/subscription"), 0);
    } else {
      setTimeout(() => router.replace("/(tabs)"), 0);
    }
  }, [isLoading, onboardingComplete, isAuthenticated, hasActiveSubscription]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      if (isAuthenticated && hasActiveSubscription) {
        router.push('/(tabs)');
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, hasActiveSubscription]);

  const { hasHydrated, reminderEnabled, reminderTime } = useAppStore();

  useEffect(() => {
    if (!hasHydrated || Platform.OS === 'web') return;
    if (reminderEnabled) {
      scheduleWorkoutReminder(reminderTime).catch(() => {});
    }
  }, [hasHydrated]);

  return (
    <>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="subscription" options={{ headerShown: false }} />
        <Stack.Screen name="readiness" options={{ headerShown: false }} />
        <Stack.Screen name="session" options={{ headerShown: false }} />
      </Stack>
      <WeeklyWeightPrompt />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [lastCrash, setLastCrash] = useState<string | null>(null);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    AsyncStorage.getItem('__last_crash__').then((val) => {
      if (val) {
        setLastCrash(val);
        AsyncStorage.removeItem('__last_crash__').catch(() => {});
      }
    }).catch(() => {});
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <AuthProvider>
              <RootLayoutNav />
            </AuthProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
      {lastCrash ? (
        <Modal visible transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, width: '100%', maxHeight: '80%' }}>
              <Text style={{ color: '#ff4444', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Last Crash Log</Text>
              <ScrollViewInline text={lastCrash} />
              <Pressable onPress={() => setLastCrash(null)} style={{ marginTop: 16, backgroundColor: '#333', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </ErrorBoundary>
  );
}

function ScrollViewInline({ text }: { text: string }) {
  return (
    <RNScrollView style={{ maxHeight: 300 }}>
      <Text style={{ color: '#ccc', fontSize: 11, lineHeight: 16 }}>{text}</Text>
    </RNScrollView>
  );
}
