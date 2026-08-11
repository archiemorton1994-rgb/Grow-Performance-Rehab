import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { apiRequest } from '@/lib/query-client';
import { setAuthToken } from '@/lib/auth-token';
import { uploadUserData, downloadUserData } from '@/lib/sync';
import { useAppStore } from '@/lib/store';

const TOKEN_KEY = 'grow_auth_token';
const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
// Automatically bypass the paywall in Expo Go / Metro dev builds.
// __DEV__ is false in production (TestFlight / App Store), so this never
// affects real users.
const RC_DEV_BYPASS = __DEV__;

export interface AuthUser {
  id: string;
  email: string;
}

interface SubscriptionStatus {
  isActive: boolean;
  isOnTrial: boolean;
  expiryDate: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasActiveSubscription: boolean;
  isOnTrial: boolean;
  expiryDate: string | null;
  hasSignedOut: boolean;
  requestCode: (email: string) => Promise<{ devCode?: string }>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  uploadData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  hasActiveSubscription: false,
  isOnTrial: false,
  expiryDate: null,
  hasSignedOut: false,
  requestCode: async () => ({}),
  verifyCode: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
  refreshSubscription: async () => {},
  uploadData: async () => {},
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

/**
 * Record which account the data on this device belongs to.
 *
 * Held back until the persisted store has finished loading: writing to the
 * store before then flushes the still-empty initial state over the top of
 * what is on disk, which is a real chance of losing the very history this is
 * meant to protect.
 */
function tagDeviceOwner(userId: string) {
  if (useAppStore.persist.hasHydrated()) {
    useAppStore.getState().setDataOwnerId(userId);
    return;
  }
  const stopWaiting = useAppStore.persist.onFinishHydration(() => {
    stopWaiting();
    useAppStore.getState().setDataOwnerId(userId);
  });
}

let rcConfigured = false;
export async function configureRevenueCat(userId?: string) {
  if (!RC_API_KEY) return;
  if (Platform.OS === 'web') return;
  try {
    if (!rcConfigured) {
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey: RC_API_KEY });
      rcConfigured = true;
    }
    if (userId) {
      const timeout = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('RC logIn timeout')), 5000)
      );
      await Promise.race([Purchases.logIn(userId), timeout]);
    }
  } catch {}
}

type SubscriptionCheckResult = SubscriptionStatus & { checkFailed?: boolean };

async function getSubscriptionStatus(): Promise<SubscriptionCheckResult> {
  if (RC_DEV_BYPASS) {
    if (__DEV__) console.warn('[Auth] RC_DEV_BYPASS active - subscription gate skipped');
    return { isActive: true, isOnTrial: true, expiryDate: null };
  }
  if (!RC_API_KEY) {
    return { isActive: false, isOnTrial: false, expiryDate: null };
  }
  try {
    const info = await Purchases.getCustomerInfo();
    const active = Object.keys(info.entitlements.active).length > 0;
    const entitlement = info.entitlements.active['premium'];
    const onTrial = active && entitlement?.periodType === 'TRIAL';
    const expiryDate = entitlement?.expirationDate ?? null;
    return { isActive: active, isOnTrial: onTrial, expiryDate };
  } catch (e) {
    if (__DEV__)
      console.warn('[Auth] getCustomerInfo failed - keeping existing subscription state', e);
    return { isActive: false, isOnTrial: false, expiryDate: null, checkFailed: true };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [isOnTrial, setIsOnTrial] = useState(false);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [hasSignedOut, setHasSignedOut] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  const refreshSubscription = useCallback(async () => {
    const status = await getSubscriptionStatus();
    if (status.checkFailed) return;
    setHasActiveSubscription(status.isActive);
    setIsOnTrial(status.isOnTrial);
    setExpiryDate(status.expiryDate);
  }, []);

  useEffect(() => {
    void configureRevenueCat();

    void (async () => {
      const token = await loadToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await apiRequest('GET', '/api/auth/me');
        const data = await res.json();
        setUser(data.user);
        // Whatever is on the device belongs to this account, by definition - it
        // is the account holding the stored token. Recording it on every launch
        // means a device that has simply been signed in for a long time is
        // still recognised later, when a lost token sends it back to the
        // sign-in screen with all of its data still on it.
        tagDeviceOwner(data.user.id);
        await configureRevenueCat(data.user.id);
        await refreshSubscription();
        // Restore progress from server if server has more sessions (new device scenario)
        const serverData = await downloadUserData();
        if (serverData) {
          useAppStore.getState().mergeServerData(serverData);
        } else {
          // First time this account is seen on any device - upload local data
          void uploadUserData(useAppStore.getState().getDataForSync());
        }
      } catch {
        try {
          await clearToken();
        } catch {}
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshSubscription]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        if (user) {
          await refreshSubscription();
          void uploadUserData(useAppStore.getState().getDataForSync());
        }
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [user, refreshSubscription]);

  const requestCode = useCallback(async (email: string): Promise<{ devCode?: string }> => {
    const res = await apiRequest('POST', '/api/auth/request-code', { email });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message ?? 'Failed to send code.');
    }
    const data = await res.json();
    return { devCode: data.devCode };
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      const res = await apiRequest('POST', '/api/auth/verify-code', { email, code });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Verification failed.');
      }
      const data = await res.json();
      await storeToken(data.token);
      // Training history left on the device by anyone other than the account
      // now signing in must go before that account can touch it. A sign-out
      // wipes the device, but a session can also end without one - an expired
      // token, or a cold start where /api/auth/me fails - and the upload below
      // would write the previous person's sessions, one-rep maxes and body
      // weight permanently into this account, which then prescribes their
      // working weights to someone else. History that cannot be proved to
      // belong here counts as somebody else's, because dropping a device copy
      // costs at most what the server has not seen yet, while writing it into
      // the wrong account cannot be undone.
      const local = useAppStore.getState();
      if (local.completedSessions.length > 0 && local.dataOwnerId !== data.user.id) {
        await useAppStore.persist.clearStorage();
        await reloadAppAsync();
        return;
      }
      tagDeviceOwner(data.user.id);
      setUser(data.user);
      setHasSignedOut(false);
      await configureRevenueCat(data.user.id);
      await refreshSubscription();
      // On login: download server data and merge; if nothing on server, upload local
      const serverData = await downloadUserData();
      if (serverData) {
        useAppStore.getState().mergeServerData(serverData);
      } else {
        void uploadUserData(useAppStore.getState().getDataForSync());
      }
    },
    [refreshSubscription]
  );

  const uploadData = useCallback(async () => {
    void uploadUserData(useAppStore.getState().getDataForSync());
  }, []);

  const signOut = useCallback(async () => {
    // Last chance to get anything logged since the last successful sync onto
    // the server, because the wipe below is unconditional. Capped the same way
    // as the RevenueCat login above so a dead network cannot leave the user
    // holding a Sign out button that appears to do nothing.
    await Promise.race([
      uploadUserData(useAppStore.getState().getDataForSync()),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);
    await clearToken();
    setHasSignedOut(true);
    setUser(null);
    setHasActiveSubscription(false);
    setIsOnTrial(false);
    setExpiryDate(null);
    if (RC_API_KEY && rcConfigured) {
      try {
        await Purchases.logOut();
      } catch {}
    }
    // Clearing the token alone leaves every session, badge, one-rep max and the
    // user's name sitting in the persisted store, so the next person to sign in
    // on this device is greeted by the last person's name and trains on their
    // strength. Wipe it and reload to a guaranteed clean slate, the same way
    // deleteAccount does - the device goes back to looking like a fresh
    // install, which is what signing out is supposed to mean.
    await useAppStore.persist.clearStorage();
    await reloadAppAsync();
  }, []);

  const deleteAccount = useCallback(async () => {
    const res = await apiRequest('DELETE', '/api/user/account');
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message ?? 'Failed to delete account.');
    }
    await clearToken();
    if (RC_API_KEY && rcConfigured) {
      try {
        await Purchases.logOut();
      } catch {}
    }
    // Wipe all locally persisted app data too, then reload to a guaranteed
    // clean slate rather than trying to manually reset every store field.
    await useAppStore.persist.clearStorage();
    await reloadAppAsync();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        hasActiveSubscription,
        isOnTrial,
        expiryDate,
        hasSignedOut,
        requestCode,
        verifyCode,
        signOut,
        deleteAccount,
        refreshSubscription,
        uploadData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useSubscription(): SubscriptionStatus & { refresh: () => Promise<void> } {
  const { hasActiveSubscription, isOnTrial, expiryDate, refreshSubscription } =
    useContext(AuthContext);
  return {
    isActive: hasActiveSubscription,
    isOnTrial,
    expiryDate,
    refresh: refreshSubscription,
  };
}
