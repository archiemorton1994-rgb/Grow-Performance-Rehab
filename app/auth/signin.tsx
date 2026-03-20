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
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth-context';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const webTop = Platform.OS === 'web' ? 67 : 0;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length >= 1;

  const handleSignIn = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password.';
      Alert.alert('Sign in failed', msg);
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
        <Image
          source={require('@/assets/images/logo.jpeg')}
          style={styles.logoImage}
          resizeMode="cover"
        />

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to your account</Text>

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
          testID="signin-email"
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.pwdWrap}>
          <TextInput
            style={[styles.input, styles.pwdInput]}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={Colors.textTertiary}
            secureTextEntry={!showPwd}
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
            testID="signin-password"
          />
          <Pressable onPress={() => setShowPwd(v => !v)} style={styles.eyeBtn}>
            <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textTertiary} />
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/auth/forgot-password')} style={styles.forgotRow}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>

        <Pressable
          onPress={handleSignIn}
          disabled={!canSubmit || loading}
          style={[styles.cta, (!canSubmit || loading) && styles.ctaDisabled]}
          testID="signin-submit"
        >
          {loading
            ? <ActivityIndicator color={Colors.textInverse} />
            : <Text style={styles.ctaText}>Sign in</Text>
          }
        </Pressable>

        <Pressable onPress={() => router.replace('/auth/signup')} style={styles.switchRow}>
          <Text style={styles.switchText}>
            Don{'\u2019'}t have an account?{' '}
            <Text style={styles.switchLink}>Get started</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  inner: { paddingHorizontal: 24 },

  logoImage: {
    width: 88, height: 88, borderRadius: 44,
    marginBottom: 32,
  },

  heading: { fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 32 },

  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 6, marginTop: 16 },
  input: {
    height: 52, borderRadius: 14, backgroundColor: Colors.surface,
    paddingHorizontal: 16, fontSize: 16, fontFamily: 'Inter_400Regular', color: Colors.text,
    borderWidth: 1.5, borderColor: Colors.borderLight,
  },
  pwdWrap: { position: 'relative' },
  pwdInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 14, top: 15 },

  forgotRow: { alignSelf: 'flex-end', marginTop: 8 },
  forgotText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.primary },

  cta: {
    height: 54, borderRadius: 16, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 28,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.textInverse },

  switchRow: { marginTop: 20, alignItems: 'center' },
  switchText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  switchLink: { color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
});
