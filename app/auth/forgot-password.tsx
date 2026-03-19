import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === 'web' ? 67 : 0;
  const [email, setEmail] = useState('');

  const handleSend = () => {
    if (!email.trim()) return;
    Alert.alert(
      'Check your inbox',
      'If an account exists for that email address, a password reset link has been sent.',
      [{ text: 'OK', onPress: () => router.back() }],
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, { paddingTop: insets.top + webTop + 24 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>

        <Text style={styles.heading}>Reset password</Text>
        <Text style={styles.sub}>
          Enter your email and we{'\u2019'}ll send you a reset link.
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={Colors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          testID="forgot-email"
        />

        <Pressable
          onPress={handleSend}
          disabled={!email.trim()}
          style={[styles.cta, !email.trim() && styles.ctaDisabled]}
          testID="forgot-submit"
        >
          <Text style={styles.ctaText}>Send reset email</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.cancelRow}>
          <Text style={styles.cancelText}>Back to sign in</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, paddingHorizontal: 24 },
  backBtn: { marginBottom: 24, width: 40, height: 40, justifyContent: 'center' },
  heading: { fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 32 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 6 },
  input: {
    height: 52, borderRadius: 14, backgroundColor: Colors.surface,
    paddingHorizontal: 16, fontSize: 16, fontFamily: 'Inter_400Regular', color: Colors.text,
    borderWidth: 1.5, borderColor: Colors.borderLight,
  },
  cta: {
    height: 54, borderRadius: 16, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.textInverse },
  cancelRow: { marginTop: 20, alignItems: 'center' },
  cancelText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
});
