import * as Application from 'expo-application';
import Constants from 'expo-constants';

/**
 * Tavin API (the same backend as tavin.eu). Override per build with
 * EXPO_PUBLIC_API_URL, e.g. a staging or local server.
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  'https://finova-6eeu.onrender.com'
).replace(/\/+$/, '');

export const APP_VERSION = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';

export const WEB_APP_URL = 'https://tavin.eu';

/** "1.10.0" > "1.9.3" — numeric, segment by segment. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}
