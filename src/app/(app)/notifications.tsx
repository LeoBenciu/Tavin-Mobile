import { Stack, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { AppNotification } from '@/api/types';
import { Screen } from '@/components/Screen';
import { Card, Divider, EmptyState, ErrorState, ListRow, Loading, Txt, type IconName } from '@/components/ui';
import { useT } from '@/i18n';
import { formatRelative } from '@/lib/format';
import { appRouteForLink } from '@/lib/links';
import { space } from '@/theme';

function iconFor(type: string): IconName {
  if (type.includes('MESSAGE')) return 'chatbubble-outline';
  if (type.includes('CONFIRMATION')) return 'shield-checkmark-outline';
  if (type.includes('TASK')) return 'checkbox-outline';
  if (type.includes('PAYROLL')) return 'people-outline';
  if (type.includes('ANAF') || type.includes('SPV')) return 'cloud-outline';
  if (type.includes('DOCUMENT') || type.includes('KYC')) return 'document-text-outline';
  return 'notifications-outline';
}

export default function NotificationsScreen() {
  const t = useT();
  const router = useRouter();
  const { data, isLoading, isFetching, error, refetch } = useGetNotificationsQuery();
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll] = useMarkAllNotificationsReadMutation();

  const open = (n: AppNotification) => {
    if (!n.readAt) markRead(n.id).catch(() => undefined);
    router.push(appRouteForLink(n.link));
  };

  return (
    <Screen refreshing={isFetching && !isLoading} onRefresh={refetch}>
      <Stack.Screen
        options={{
          headerRight: () =>
            data && data.unreadCount > 0 ? (
              <Pressable onPress={() => markAll()} hitSlop={10}>
                <Txt tone="accent" weight="600">
                  {t('Citite toate', 'Read all')}
                </Txt>
              </Pressable>
            ) : null,
        }}
      />
      {isLoading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title={t('Nicio notificare', 'No notifications')}
          message={t(
            'Aici apar mesajele, sarcinile și cererile de la contabil.',
            'Messages, tasks and requests from your accountant show up here.',
          )}
        />
      ) : (
        <Card padded={false}>
          {data.items.map((n, i) => (
            <View key={n.id}>
              {i > 0 ? <Divider inset={64} /> : null}
              <ListRow
                icon={iconFor(n.type)}
                iconTone={n.readAt ? 'neutral' : 'accent'}
                title={n.title}
                subtitle={[n.body, formatRelative(n.createdAt)].filter(Boolean).join(' · ')}
                numberOfLines={2}
                onPress={() => open(n)}
                right={
                  !n.readAt ? (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#465FE9' }} />
                  ) : null
                }
              />
            </View>
          ))}
        </Card>
      )}
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
