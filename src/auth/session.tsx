import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { api } from '@/api/api';
import { store } from '@/api/store';
import type { LoginResponse, SessionUser } from '@/api/types';
import { getLanguage, translate } from '@/i18n';
import { API_URL } from '@/lib/config';
import { storage, StorageKeys } from '@/lib/storage';
import { setCurrentUser } from './current';
import { clearTokens, getAccessToken, getRefreshToken, onSessionEnded, saveTokens } from './tokens';

type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

type SessionContextValue = {
  status: SessionStatus;
  user: SessionUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<SessionUser>) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export class SignInError extends Error {}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  const endLocally = useCallback(async () => {
    await clearTokens();
    await storage.remove(StorageKeys.user);
    setCurrentUser(null);
    store.dispatch(api.util.resetApiState());
    setUser(null);
    setStatus('signedOut');
  }, []);

  // Restore: a stored refresh token + cached user means signed in, even offline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [refreshToken, cached] = await Promise.all([getRefreshToken(), storage.get(StorageKeys.user)]);
      if (cancelled) return;
      if (refreshToken && cached) {
        try {
          const u = JSON.parse(cached) as SessionUser;
          setCurrentUser(u);
          setUser(u);
          setStatus('signedIn');
          // Warm an access token; a dead session ends through onSessionEnded.
          getAccessToken().catch(() => undefined);
          return;
        } catch {
          // corrupt cache — fall through to signed out
        }
      }
      setStatus('signedOut');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => onSessionEnded(() => void endLocally()), [endLocally]);

  const signIn = useCallback(async (email: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/mobile/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Language': getLanguage() },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          platform: Platform.OS === 'web' ? 'web' : Platform.OS,
          deviceName: Device.deviceName ?? Device.modelName ?? undefined,
        }),
      });
    } catch {
      throw new SignInError(translate('Nu există conexiune la internet.', 'No internet connection.'));
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 429) {
        throw new SignInError(
          translate('Prea multe încercări. Așteaptă un minut.', 'Too many attempts. Wait a minute.'),
        );
      }
      const m = (body as { message?: unknown }).message;
      throw new SignInError(
        (Array.isArray(m) ? m.join('\n') : typeof m === 'string' ? m : '') ||
          translate('Autentificarea a eșuat.', 'Sign-in failed.'),
      );
    }
    const data = body as LoginResponse;
    await saveTokens(data);
    await storage.set(StorageKeys.user, JSON.stringify(data.user));
    setCurrentUser(data.user);
    setUser(data.user);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    const [refreshToken, pushToken] = await Promise.all([getRefreshToken(), storage.get(StorageKeys.pushToken)]);
    if (refreshToken) {
      // Best effort: revoke the session server-side and stop pushes to this phone.
      fetch(`${API_URL}/mobile/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, ...(pushToken ? { pushToken } : {}) }),
      }).catch(() => undefined);
    }
    await endLocally();
  }, [endLocally]);

  const updateUser = useCallback((patch: Partial<SessionUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setCurrentUser(next);
      void storage.set(StorageKeys.user, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, updateUser }),
    [status, user, signIn, signOut, updateUser],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** For screens inside the signed-in area, where the user is always present. */
export function useUser(): SessionUser {
  const { user } = useSession();
  if (!user) throw new Error('No signed-in user');
  return user;
}
