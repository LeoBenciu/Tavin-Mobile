import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

import { APP_VERSION } from '@/lib/config';
import { storage, StorageKeys } from '@/lib/storage';

// Show notifications as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PushRegistration = {
  pushToken: string;
  platform: 'ios' | 'android';
  appVersion: string;
  locale?: string;
  deviceName?: string;
};

/**
 * Asks for permission (once) and returns this phone's Expo push token, or null
 * when push isn't possible (simulator, web, permission denied, no EAS project).
 */
export async function getPushRegistration(askPermission: boolean): Promise<PushRegistration | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Tavin',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#465FE9',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && askPermission) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  const projectId =
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await storage.set(StorageKeys.pushToken, data);
    return {
      pushToken: data,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      appVersion: APP_VERSION,
      locale: getLocales()[0]?.languageTag,
      deviceName: Device.deviceName ?? Device.modelName ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function isPushEnabledByUser(): Promise<boolean> {
  return (await storage.get(StorageKeys.pushEnabled)) !== 'false';
}

export async function setPushEnabledByUser(enabled: boolean): Promise<void> {
  await storage.set(StorageKeys.pushEnabled, enabled ? 'true' : 'false');
}

export async function setAppBadge(count: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.setBadgeCountAsync(count).catch(() => undefined);
}
