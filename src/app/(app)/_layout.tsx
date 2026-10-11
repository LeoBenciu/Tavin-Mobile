import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { useGetConfigQuery } from '@/api/api';
import { AppLock } from '@/auth/AppLock';
import { Button, Txt } from '@/components/ui';
import { usePushNotifications } from '@/features/usePushNotifications';
import { useT } from '@/i18n';
import { APP_VERSION, compareVersions } from '@/lib/config';
import { space, useColors } from '@/theme';

function UpdateRequired({ storeUrl }: { storeUrl: string | null }) {
  const c = useColors();
  const t = useT();
  return (
    <View style={[styles.gate, { backgroundColor: c.background }]}>
      <Ionicons name="arrow-up-circle" size={56} color={c.accent} />
      <Txt variant="heading" style={styles.center}>
        {t('Actualizează aplicația', 'Update the app')}
      </Txt>
      <Txt tone="muted" style={styles.center}>
        {t(
          'Această versiune a Tavin nu mai este suportată. Instalează ultima versiune ca să continui.',
          'This version of Tavin is no longer supported. Install the latest version to continue.',
        )}
      </Txt>
      {storeUrl ? (
        <Button title={t('Deschide magazinul', 'Open the store')} onPress={() => Linking.openURL(storeUrl)} />
      ) : null}
    </View>
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

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.accentText,
          headerTitleStyle: { color: c.text, fontWeight: '600' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="scan"
          options={{ title: t('Încarcă documente', 'Upload documents'), presentation: 'modal' }}
        />
        <Stack.Screen name="approvals" options={{ title: t('Facturi de confirmat', 'Invoices to confirm') }} />
        <Stack.Screen
          name="invoices/new"
          options={{ title: t('Document nou', 'New document'), presentation: 'modal' }}
        />
        <Stack.Screen name="invoices/[id]" options={{ title: '' }} />
        <Stack.Screen name="nir" options={{ title: t('Notă de recepție', 'Goods receipt (NIR)') }} />
        <Stack.Screen name="bills" options={{ title: t('Facturi de plătit', 'Bills to pay') }} />
        <Stack.Screen name="bank" options={{ title: t('Bancă', 'Bank') }} />
        <Stack.Screen name="reports" options={{ title: t('Rapoarte', 'Reports') }} />
        <Stack.Screen name="tasks" options={{ title: t('Sarcini', 'Tasks') }} />
        <Stack.Screen name="partners/index" options={{ title: t('Parteneri', 'Partners') }} />
        <Stack.Screen name="partners/edit" options={{ title: t('Partener', 'Partner'), presentation: 'modal' }} />
        <Stack.Screen name="articles/index" options={{ title: t('Articole', 'Items') }} />
        <Stack.Screen name="articles/edit" options={{ title: t('Articol', 'Item'), presentation: 'modal' }} />
        <Stack.Screen name="stock" options={{ title: t('Stocuri', 'Stock') }} />
        <Stack.Screen name="notifications" options={{ title: t('Notificări', 'Notifications') }} />
        <Stack.Screen name="settings" options={{ title: t('Setări', 'Settings') }} />
        <Stack.Screen name="firm" options={{ title: t('Sold la contabil', 'Balance with your accountant') }} />
      </Stack>
      <AppLock />
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  center: { textAlign: 'center' },
});
