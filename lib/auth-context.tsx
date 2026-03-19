import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { apiRequest } from '@/lib/query-client';
import { setAuthToken } from '@/lib/auth-token';

const TOKEN_KEY = 'grow_auth_token';
const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasActiveSubscription: boolean;
  isOnTrial: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  hasActiveSubscription: false,
  isOnTrial: false,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  refreshSubscription: async () => {},
});

async function storeToken(token: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
  setAuthToken(token);
}

async function loadToken(): Promise<string | null> {
  try {
    let token: string | null;
    if (Platform.OS === 'web') {
      token = await AsyncStorage.getItem(TOKEN_KEY);
    } else {
      token = await SecureStore.getItemAsync(TOKEN_KEY);
    }
    if (token) setAuthToken(token);
    return token;
  } catch {
    return null;
  }
}

async function clearToken() {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
  setAuthToken(null);
}

let rcConfigured = false;
function configureRevenueCat(userId?: string) {
  if (!RC_API_KEY) return;
  try {
    if (!rcConfigured) {
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey: RC_API_KEY });
      rcConfigured = true;
    }
    if (userId) {
      Purchases.logIn(userId).catch(() => {});
    }
  } catch {}
}

async function getSubscriptionStatus(): Promise<{ isActive: boolean; isOnTrial: boolean }> {
  if (!RC_API_KEY) return { isActive: true, isOnTrial: false };
  try {
    const info = await Purchases.getCustomerInfo();
    const active = Object.keys(info.entitlements.active).length > 0;
    const onTrial = active && info.entitlements.active['premium']?.periodType === 'TRIAL';
    return { isActive: active, isOnTrial: onTrial };
  } catch {
    return { isActive: false, isOnTrial: false };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [isOnTrial, setIsOnTrial] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  const refreshSubscription = useCallback(async () => {
    const { isActive, isOnTrial: trial } = await getSubscriptionStatus();
    setHasActiveSubscription(isActive);
    setIsOnTrial(trial);
  }, []);

  useEffect(() => {
    configureRevenueCat();

    (async () => {
      const token = await loadToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await apiRequest('GET', '/api/auth/me');
        const data = await res.json();
        setUser(data.user);
        configureRevenueCat(data.user.id);
        await refreshSubscription();
      } catch {
        await clearToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshSubscription]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        if (user) await refreshSubscription();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [user, refreshSubscription]);

  const signUp = useCallback(async (email: string, password: string) => {
    const res = await apiRequest('POST', '/api/auth/signup', { email, password });
    const data = await res.json();
    await storeToken(data.token);
    setUser(data.user);
    configureRevenueCat(data.user.id);
    await refreshSubscription();
  }, [refreshSubscription]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiRequest('POST', '/api/auth/signin', { email, password });
    const data = await res.json();
    await storeToken(data.token);
    setUser(data.user);
    configureRevenueCat(data.user.id);
    await refreshSubscription();
  }, [refreshSubscription]);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
    setHasActiveSubscription(false);
    setIsOnTrial(false);
    if (RC_API_KEY && rcConfigured) {
      try { await Purchases.logOut(); } catch {}
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        hasActiveSubscription,
        isOnTrial,
        signUp,
        signIn,
        signOut,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
