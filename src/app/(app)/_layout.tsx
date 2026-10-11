import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { useGetConfigQuery } from '@/api/api';
import { AppLock } from '@/auth/AppLock';
import { NavyBackdrop } from '@/components/Hero';
import { Button } from '@/components/ui';
import { usePushNotifications } from '@/features/usePushNotifications';
import { useT } from '@/i18n';
import { APP_VERSION, compareVersions } from '@/lib/config';
import { navy, space, tileGradient, useColors } from '@/theme';

/** Deep links (notification taps, URLs) land on top of the tabs, so Back always has somewhere to go. */
export const unstable_settings = { initialRouteName: '(tabs)' };

function UpdateRequired({ storeUrl }: { storeUrl: string | null }) {
  const t = useT();
  return (
    <NavyBackdrop style={styles.gate}>
      <StatusBar style="light" />
      <View style={[styles.gateIcon, tileGradient('accent')]}>
        <Ionicons name="arrow-up" size={34} color="#FFFFFF" />
      </View>
      <Text style={styles.gateTitle}>{t('Actualizează aplicația', 'Update the app')}</Text>
      <Text style={styles.gateText}>
        {t(
          'Această versiune a Tavin nu mai este suportată. Instalează ultima versiune ca să continui.',
          'This version of Tavin is no longer supported. Install the latest version to continue.',
        )}
      </Text>
      {storeUrl ? (
        <Button
          title={t('Deschide magazinul', 'Open the store')}
          onPress={() => Linking.openURL(storeUrl)}
          style={styles.gateButton}
        />
      ) : null}
    </NavyBackdrop>
  );
}

export default function AppLayout() {
  const c = useColors();
  const t = useT();
  usePushNotifications();
  const { data: config } = useGetConfigQuery();

  if (config && compareVersions(APP_VERSION, config.minSupportedVersion) < 0) {
    return <UpdateRequired storeUrl={Platform.OS === 'ios' ? config.storeUrls.ios : config.storeUrls.android} />;
  }

  // iOS: list screens get a large title that collapses into the bar on scroll.
  const large = {
    headerLargeTitleEnabled: true,
    headerLargeTitleShadowVisible: false,
    headerLargeStyle: { backgroundColor: c.background },
    headerLargeTitleStyle: { color: c.text, fontWeight: '700' as const },
  };
  // Forms and pickers open as iOS sheets with their own (surface) bar.
  const modal = { presentation: 'modal' as const, headerStyle: { backgroundColor: c.background } };

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.accentText,
          headerTitleStyle: { color: c.text, fontWeight: '600', fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ title: t('Încarcă documente', 'Upload documents'), ...modal }} />
        <Stack.Screen name="approvals" options={{ title: t('De confirmat', 'To confirm'), ...large }} />
        <Stack.Screen name="invoices/new" options={{ title: t('Document nou', 'New document'), ...modal }} />
        <Stack.Screen name="invoices/[id]" options={{ title: '' }} />
        <Stack.Screen name="nir" options={{ title: t('Notă de recepție', 'Goods receipt (NIR)') }} />
        <Stack.Screen name="bills" options={{ title: t('De plătit', 'Bills to pay'), ...large }} />
        <Stack.Screen name="bank" options={{ title: t('Bancă', 'Bank'), ...large }} />
        <Stack.Screen name="reports" options={{ title: t('Rapoarte', 'Reports'), ...large }} />
        <Stack.Screen name="tasks" options={{ title: t('Sarcini', 'Tasks'), ...large }} />
        <Stack.Screen name="partners/index" options={{ title: t('Parteneri', 'Partners'), ...large }} />
        <Stack.Screen name="partners/edit" options={{ title: t('Partener', 'Partner'), ...modal }} />
        <Stack.Screen name="articles/index" options={{ title: t('Articole', 'Items'), ...large }} />
        <Stack.Screen name="articles/edit" options={{ title: t('Articol', 'Item'), ...modal }} />
        <Stack.Screen name="stock" options={{ title: t('Stocuri', 'Stock'), ...large }} />
        <Stack.Screen name="folder" options={{ title: t('Documente', 'Documents'), ...large }} />
        <Stack.Screen name="notifications" options={{ title: t('Notificări', 'Notifications'), ...large }} />
        <Stack.Screen name="settings" options={{ title: t('Setări', 'Settings'), ...large }} />
        <Stack.Screen name="firm" options={{ title: t('Sold la contabil', 'Accountant balance'), ...large }} />
      </Stack>
      <AppLock />
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  gateIcon: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 14px 36px -10px rgba(70, 95, 233, 0.95)',
  },
  gateTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: -0.6, textAlign: 'center' },
  gateText: { color: navy.onNavySoft, fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 340 },
  gateButton: { alignSelf: 'stretch', marginTop: space.sm },
});
