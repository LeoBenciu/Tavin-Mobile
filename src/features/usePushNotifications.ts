import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { api, useGetNotificationsQuery, useRegisterDeviceMutation } from '@/api/api';
import { store } from '@/api/store';
import { appRouteForLink } from '@/lib/links';
import { getPushRegistration, isPushEnabledByUser, setAppBadge } from './push';

/**
 * Registers this phone for push once signed in, routes notification taps to
 * the right screen, refreshes data when a push arrives in the foreground, and
 * keeps the app icon badge equal to the unread count.
 */
export function usePushNotifications() {
  const router = useRouter();
  const [registerDevice] = useRegisterDeviceMutation();
  const { data } = useGetNotificationsQuery(undefined, { pollingInterval: 120_000 });
  const handledResponse = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      if (!(await isPushEnabledByUser())) return;
      const reg = await getPushRegistration(true);
      if (reg)
        await registerDevice(reg)
          .unwrap()
          .catch(() => undefined);
    })();
  }, [registerDevice]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handledResponse.current === id) return;
      handledResponse.current = id;
      const link = response.notification.request.content.data?.link as string | null | undefined;
      router.push(appRouteForLink(link));
    };
    // Cold start: the app was opened by tapping a notification.
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const tapSub = Notifications.addNotificationResponseReceivedListener(open);
    const receiveSub = Notifications.addNotificationReceivedListener(() => {
      store.dispatch(
        api.util.invalidateTags(['Notifications', 'Dashboard', 'Messages', 'Approvals', 'Tasks', 'Documents']),
      );
    });
    return () => {
      tapSub.remove();
      receiveSub.remove();
    };
  }, [router]);

  useEffect(() => {
    if (data) void setAppBadge(data.unreadCount);
  }, [data]);
}
