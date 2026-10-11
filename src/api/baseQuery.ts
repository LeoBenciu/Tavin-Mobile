import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

import { getAccessToken, refreshAccessToken } from '@/auth/tokens';
import { getLanguage, translate } from '@/i18n';
import { API_URL } from '@/lib/config';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  timeout: 30_000,
  prepareHeaders: async (headers) => {
    const token = await getAccessToken().catch(() => null);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    // The API localizes its error messages from Accept-Language.
    headers.set('Accept-Language', getLanguage());
    headers.set('Accept', 'application/json');
    return headers;
  },
});

/** Retries once after a refresh when the access token was rejected. */
export const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    const token = await refreshAccessToken().catch(() => null);
    if (token) result = await rawBaseQuery(args, api, extraOptions);
  }
  return result;
};

/** Machine codes some endpoints answer with (the web portal maps them the same way). */
const CODE_MESSAGES: Record<string, [string, string]> = {
  PASSWORD_TOO_WEAK: [
    'Parola trebuie să aibă minim 8 caractere, o majusculă, o cifră și un caracter special.',
    'The password needs 8+ characters, an uppercase letter, a digit and a special character.',
  ],
  PASSWORD_REQUIRED: ['Completează parola actuală și parola nouă.', 'Enter your current and new password.'],
  PASSWORD_UNCHANGED: [
    'Parola nouă trebuie să fie diferită de cea actuală.',
    'The new password must differ from the current one.',
  ],
  CURRENT_PASSWORD_INCORRECT: ['Parola actuală nu este corectă.', 'Your current password is incorrect.'],
  CURRENT_PASSWORD_REQUIRED: [
    'Pentru a schimba emailul, introdu parola actuală.',
    'Enter your current password to change your email.',
  ],
  EMAIL_TAKEN: ['Există deja un cont cu acest email.', 'An account with this email already exists.'],
  INVALID_EMAIL: ['Adresa de email nu este validă.', 'The email address is not valid.'],
  NAME_REQUIRED: ['Completează numele.', 'Enter your name.'],
  SUBSCRIPTION_INACTIVE: [
    'Abonamentul contabilului tău nu este activ.',
    'Your accountant’s subscription is not active.',
  ],
  INVALID_REFRESH_TOKEN: ['Sesiunea a expirat. Conectează-te din nou.', 'Your session expired. Please sign in again.'],
};

/** Human message for any RTK Query / fetch error. */
export function errorMessage(error: unknown, fallback?: string): string {
  const e = error as { status?: unknown; data?: { message?: unknown }; message?: unknown } | undefined;
  if (e?.status === 'FETCH_ERROR' || e?.status === 'TIMEOUT_ERROR' || e?.message === 'offline') {
    return translate('Nu există conexiune la internet.', 'No internet connection.');
  }
  const m = e?.data?.message ?? e?.message;
  if (typeof m === 'string' && CODE_MESSAGES[m]) return translate(...CODE_MESSAGES[m]);
  if (Array.isArray(m) && m.length) return m.map(String).join('\n');
  if (typeof m === 'string' && m.trim()) return m;
  return fallback ?? translate('A apărut o eroare. Încearcă din nou.', 'Something went wrong. Please try again.');
}
