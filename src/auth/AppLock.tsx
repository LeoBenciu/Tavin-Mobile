import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { NavyBackdrop } from '@/components/Hero';
import { Button } from '@/components/ui';
import { translate, useT } from '@/i18n';
import { storage, StorageKeys } from '@/lib/storage';
import { navy, space, tileGradient } from '@/theme';
import { useSession } from './session';

/** Re-lock after the app has been in the background this long. */
const RELOCK_AFTER_MS = 60_000;

export async function isBiometricLockEnabled(): Promise<boolean> {
  return (await storage.get(StorageKeys.biometricLock)) === 'true';
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  await storage.set(StorageKeys.biometricLock, enabled ? 'true' : 'false');
}

export async function canUseBiometrics(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hardware && enrolled;
}

/** Face ID / fingerprint screen over the app, when the user turned it on. */
export function AppLock() {
  const t = useT();
  const { signOut } = useSession();
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: translate('Deblochează Tavin', 'Unlock Tavin'),
      cancelLabel: translate('Anulează', 'Cancel'),
    });
    if (result.success) setLocked(false);
  }, []);

  useEffect(() => {
    const lock = () => {
      setLocked(true);
      void unlock();
    };
    isBiometricLockEnabled().then((enabled) => {
      if (enabled) lock();
    });
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active' && backgroundedAt.current != null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away > RELOCK_AFTER_MS && (await isBiometricLockEnabled())) lock();
      }
    });
    return () => sub.remove();
  }, [unlock]);

  if (!locked) return null;
  return (
    <NavyBackdrop style={[StyleSheet.absoluteFill, styles.wrap]}>
      <StatusBar style="light" />
      <View style={[styles.badge, tileGradient('accent')]}>
        <Ionicons name="lock-closed" size={32} color="#FFFFFF" />
      </View>
      <Text style={styles.title}>{t('Tavin este blocat', 'Tavin is locked')}</Text>
      <Text style={styles.subtitle}>
        {t('Confirmă-ți identitatea ca să continui.', 'Confirm it’s you to continue.')}
      </Text>
      <Button title={t('Deblochează', 'Unlock')} icon="finger-print" onPress={unlock} style={styles.button} />
      <Pressable onPress={signOut} hitSlop={10} style={styles.signOut}>
        <Text style={styles.signOutText}>{t('Deconectare', 'Sign out')}</Text>
      </Pressable>
    </NavyBackdrop>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: space.xl, zIndex: 100 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 14px 36px -10px rgba(70, 95, 233, 0.95)',
  },
  title: {
    marginTop: space.xl,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: { marginTop: space.sm, color: navy.onNavySoft, fontSize: 16, textAlign: 'center' },
  button: { marginTop: space.xl + space.sm, alignSelf: 'stretch' },
  signOut: { marginTop: space.lg, padding: space.sm },
  signOutText: { color: navy.indigoLight, fontSize: 16, fontWeight: '600' },
});
