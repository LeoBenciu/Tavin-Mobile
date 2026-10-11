import { API_URL } from '@/lib/config';
import { storage, StorageKeys } from '@/lib/storage';

/**
 * Access tokens live in memory only (1 hour); the rotating refresh token lives
 * in the Keychain/Keystore. Refreshes are single-flight: the backend revokes a
 * whole session if a rotated refresh token is replayed, so two parallel 401s
 * must never both spend the same token.
 */

export type TokenBundle = { accessToken: string; refreshToken: string; expiresIn: number };

let accessToken: string | null = null;
let accessExpiresAt = 0;
let refreshInFlight: Promise<string | null> | null = null;
const sessionEndedListeners = new Set<() => void>();

/** Thrown when the server could not be reached; the session is kept. */
export class OfflineError extends Error {
  constructor() {
    super('offline');
  }
}

export async function saveTokens(t: TokenBundle): Promise<void> {
  accessToken = t.accessToken;
  accessExpiresAt = Date.now() + t.expiresIn * 1000;
  await storage.set(StorageKeys.refreshToken, t.refreshToken);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  accessExpiresAt = 0;
  await storage.remove(StorageKeys.refreshToken);
}

export function getRefreshToken(): Promise<string | null> {
  return storage.get(StorageKeys.refreshToken);
}

/** Called when the server says the session is over (revoked, expired, suspended). */
export function onSessionEnded(listener: () => void): () => void {
  sessionEndedListeners.add(listener);
  return () => sessionEndedListeners.delete(listener);
}

/** A token good for at least another minute, refreshing if needed. */
export async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < accessExpiresAt - 60_000) return accessToken;
  return refreshAccessToken();
}

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/mobile/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    throw new OfflineError();
  }

  if (res.status === 401 || res.status === 403) {
    await clearTokens();
    sessionEndedListeners.forEach((l) => l());
    return null;
  }
  if (!res.ok) throw new OfflineError();

  const data = (await res.json()) as TokenBundle;
  await saveTokens(data);
  return data.accessToken;
}
