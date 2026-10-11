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
import { space, useColors, type TileTone } from '@/theme';

function iconFor(type: string): { icon: IconName; tone: TileTone } {
  if (type.includes('MESSAGE')) return { icon: 'chatbubble', tone: 'accent' };
  if (type.includes('CONFIRMATION')) return { icon: 'shield-checkmark', tone: 'warn' };
  if (type.includes('TASK')) return { icon: 'checkmark-done', tone: 'good' };
  if (type.includes('PAYROLL')) return { icon: 'people', tone: 'violet' };
  if (type.includes('ANAF') || type.includes('SPV')) return { icon: 'cloud', tone: 'sky' };
  if (type.includes('DOCUMENT') || type.includes('KYC')) return { icon: 'document-text', tone: 'accent' };
  return { icon: 'notifications', tone: 'danger' };
}

export default function NotificationsScreen() {
  const c = useColors();
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
          icon="notifications-off"
          title={t('Nicio notificare', 'No notifications')}
          message={t(
            'Aici apar mesajele, sarcinile și cererile de la contabil.',
            'Messages, tasks and requests from your accountant show up here.',
          )}
        />
      ) : (
        <Card padded={false}>
          {data.items.map((n, i) => {
            const look = iconFor(n.type);
            return (
              <View key={n.id}>
                {i > 0 ? <Divider inset={60} /> : null}
                <ListRow
                  icon={look.icon}
                  iconTone={look.tone}
                  solid={!n.readAt}
                  title={n.title}
                  bold={!n.readAt}
                  subtitle={[n.body, formatRelative(n.createdAt)].filter(Boolean).join(' · ')}
                  numberOfLines={2}
                  onPress={() => open(n)}
                  right={
                    !n.readAt ? (
                      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent }} />
                    ) : null
                  }
                />
              </View>
            );
          })}
        </Card>
      )}
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
