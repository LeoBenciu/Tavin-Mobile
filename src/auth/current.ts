import type { Profile, SessionUser } from '@/api/types';

/**
 * The signed-in portal user, readable outside React. Most client-portal
 * endpoints take ?clientUserId=…, and the server checks it matches the token.
 */
let user: SessionUser | null = null;
let profile: Profile | null = null;

export function setCurrentUser(u: SessionUser | null) {
  user = u;
  if (!u) profile = null;
}

export function setCurrentProfile(p: Profile | null) {
  profile = p;
}

export function clientUserId(): number {
  if (!user) throw new Error('Not signed in');
  return user.id;
}

export function clientCompanyId(): number {
  if (!user) throw new Error('Not signed in');
  return user.clientCompany.id;
}

export function accountingClientId(): number | null {
  return profile?.accountingClientId ?? null;
}
