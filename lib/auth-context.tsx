import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { apiRequest, type ApiError } from '@/lib/query-client';
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
  await AsyncStorage.removeItem(CACHED_USER_KEY);
}

/**
 * The last identity the server confirmed for the token on this device.
 *
 * `isAuthenticated` is `!!user`, and `user` only ever came from a live call to
 * /api/auth/me. So keeping the token when that call fails is not on its own
 * enough to keep someone signed in offline — they would still be shown the
 * sign-in screen, just with the token intact behind it. This is what lets a
 * launch with no signal carry on with the data already on the phone.
 *
 * Not a credential and not trusted as one: it is only ever used when a VALID
 * token is present but unverifiable, every request still carries that token, and
 * the server remains the only thing that decides what the account may do. It is
 * cleared with the token, so signing out leaves nothing behind.
 */
const CACHED_USER_KEY = 'grow_cached_user';

async function cacheUser(user: AuthUser) {
  try {
    await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
  } catch {}
}

async function loadCachedUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === 'string' && typeof parsed?.email === 'string' ? parsed : null;
  } catch {
    return null;
  }
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
      /**
       * ONLY a server that says the token is bad may clear the token.
       *
       * This used to be one try/catch around the identity check, the
       * subscription refresh AND the data sync, with `clearToken()` in the
       * catch. So ANY failure signed the user out: no signal on the Underground,
       * a plane, a gym basement, a sync hiccup, or — worst — one cold start of a
       * sleeping server returning a 502, which would have signed out every user
       * who happened to open the app during it, all at once.
       *
       * Being signed out is not a soft failure here. The stored token is gone,
       * so getting back in needs working internet AND an email code, neither of
       * which the user has in the situation that caused it. Leaving a stale
       * token in place costs nothing by comparison: the next request that really
       * is unauthorised will clear it.
       */
      let confirmedUserId: string | null = null;
      try {
        const res = await apiRequest('GET', '/api/auth/me');
        const data = await res.json();
        setUser(data.user);
        confirmedUserId = data.user.id;
        void cacheUser(data.user);
        // Whatever is on the device belongs to this account, by definition - it
        // is the account holding the stored token. Recording it on every launch
        // means a device that has simply been signed in for a long time is
        // still recognised later, when a lost token sends it back to the
        // sign-in screen with all of its data still on it.
        tagDeviceOwner(data.user.id);
      } catch (err) {
        const status = (err as ApiError | null)?.status;
        // 401 unauthorised / 403 forbidden are the server's word that this
        // credential is no good. Everything else — no network, 5xx, a timeout, a
        // response that would not parse — leaves the user signed in on their
        // local data, and the foreground listener below retries later.
        if (status === 401 || status === 403) {
          try {
            await clearToken();
          } catch {}
          setIsLoading(false);
          return;
        }
        // Unreachable server, not a rejected credential. Carry on with the
        // identity this token last confirmed, so the app opens on the user's own
        // data rather than on the sign-in screen. Subscription state is NOT
        // assumed — it stays whatever getSubscriptionStatus last established,
        // and RevenueCat is still the only thing that grants access.
        const cached = await loadCachedUser();
        if (cached) {
          setUser(cached);
          tagDeviceOwner(cached.id);
          try {
            await configureRevenueCat(cached.id);
            await refreshSubscription();
          } catch {}
        }
        setIsLoading(false);
        return;
      }

      // Subscription and sync are separate concerns, deliberately outside the
      // block above: a failure in either is not evidence about the credential
      // and must never be able to sign anyone out.
      if (confirmedUserId !== null) {
        try {
          await configureRevenueCat(confirmedUserId);
          await refreshSubscription();
        } catch {}
        try {
          // Restore progress from server if server has more sessions (new device scenario)
          const serverData = await downloadUserData();
          if (serverData) {
            useAppStore.getState().mergeServerData(serverData);
          } else {
            // First time this account is seen on any device - upload local data
            void uploadUserData(useAppStore.getState().getDataForSync());
          }
        } catch {}
      }
      setIsLoading(false);
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
