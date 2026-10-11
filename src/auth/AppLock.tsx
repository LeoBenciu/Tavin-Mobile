import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { Button, Txt } from '@/components/ui';
import { translate, useT } from '@/i18n';
import { storage, StorageKeys } from '@/lib/storage';
import { space, useColors } from '@/theme';
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
  const c = useColors();
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
    <View style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: c.background }]}>
      <View style={[styles.badge, { backgroundColor: c.accent }]}>
        <Ionicons name="lock-closed" size={32} color={c.onAccent} />
      </View>
      <Txt variant="heading" style={styles.title}>
        {t('Tavin este blocat', 'Tavin is locked')}
      </Txt>
      <Txt tone="muted" style={styles.subtitle}>
        {t('Confirmă-ți identitatea ca să continui.', 'Confirm it’s you to continue.')}
      </Txt>
      <Button title={t('Deblochează', 'Unlock')} icon="finger-print" onPress={unlock} style={styles.button} />
      <Button title={t('Deconectare', 'Sign out')} variant="ghost" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: space.xl, zIndex: 100 },
  badge: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: space.xl, textAlign: 'center' },
  subtitle: { marginTop: space.sm, textAlign: 'center' },
  button: { marginTop: space.xl, alignSelf: 'stretch' },
});
