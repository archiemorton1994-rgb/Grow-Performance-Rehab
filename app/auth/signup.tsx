import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth-context';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const webTop = Platform.OS === 'web' ? 67 : 0;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length >= 8 && confirm === password;

  const handleSignUp = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      await signUp(email.trim(), password);
    } catch (err: any) {
      Alert.alert('Sign up failed', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + webTop + 24, paddingBottom: insets.bottom + 48 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Ionicons name="leaf" size={26} color={Colors.textInverse} />
          </View>
          <View>
            <Text style={styles.wordmark}>GROW</Text>
            <Text style={styles.tagline}>Performance & Rehab</Text>
          </View>
        </View>

        <Text style={styles.heading}>Create your account</Text>
        <Text style={styles.sub}>Start your 1-month free trial</Text>

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
          returnKeyType="next"
          testID="signup-email"
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.pwdWrap}>
          <TextInput
            style={[styles.input, styles.pwdInput]}
            value={password}
            onChangeText={setPassword}
            placeholder="Min. 8 characters"
            placeholderTextColor={Colors.textTertiary}
            secureTextEntry={!showPwd}
            returnKeyType="next"
            testID="signup-password"
          />
          <Pressable onPress={() => setShowPwd(v => !v)} style={styles.eyeBtn}>
            <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textTertiary} />
          </Pressable>
        </View>

        <Text style={styles.label}>Confirm password</Text>
        <TextInput
          style={[
            styles.input,
            confirm.length > 0 && confirm !== password && styles.inputError,
          ]}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Repeat your password"
          placeholderTextColor={Colors.textTertiary}
          secureTextEntry={!showPwd}
          returnKeyType="done"
          onSubmitEditing={handleSignUp}
          testID="signup-confirm"
        />
        {confirm.length > 0 && confirm !== password && (
          <Text style={styles.errorText}>Passwords do not match</Text>
        )}

        <Pressable
          onPress={handleSignUp}
          disabled={!canSubmit || loading}
          style={[styles.cta, (!canSubmit || loading) && styles.ctaDisabled]}
          testID="signup-submit"
        >
          {loading
            ? <ActivityIndicator color={Colors.textInverse} />
            : <Text style={styles.ctaText}>Create account</Text>
          }
        </Pressable>

        <Pressable onPress={() => router.replace('/auth/signin')} style={styles.switchRow}>
          <Text style={styles.switchText}>
            Already have an account?{' '}
            <Text style={styles.switchLink}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  inner: { paddingHorizontal: 24 },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 36 },
  logoMark: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  wordmark: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text, letterSpacing: 3 },
  tagline: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },

  heading: { fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 32 },

  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 6, marginTop: 16 },
  input: {
    height: 52, borderRadius: 14, backgroundColor: Colors.surface,
    paddingHorizontal: 16, fontSize: 16, fontFamily: 'Inter_400Regular', color: Colors.text,
    borderWidth: 1.5, borderColor: Colors.borderLight,
  },
  inputError: { borderColor: Colors.error },
  pwdWrap: { position: 'relative' },
  pwdInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 14, top: 15 },

  errorText: { fontSize: 12, color: Colors.error, fontFamily: 'Inter_400Regular', marginTop: 4 },

  cta: {
    height: 54, borderRadius: 16, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 32,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.textInverse },

  switchRow: { marginTop: 20, alignItems: 'center' },
  switchText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  switchLink: { color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
});
