import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { useGetApprovalsQuery, useGetNotificationsQuery, useGetTasksQuery } from '@/api/api';
import { useUser } from '@/auth/session';
import { Screen } from '@/components/Screen';
import { Avatar, Card, Divider, ListRow, SectionTitle, Txt, type IconName } from '@/components/ui';
import { useT } from '@/i18n';
import { APP_VERSION, WEB_APP_URL } from '@/lib/config';
import { openUrl } from '@/lib/files';
import { initials } from '@/lib/format';
import { space } from '@/theme';

type Item = { icon: IconName; title: string; subtitle?: string; href?: Href; onPress?: () => void; badge?: number };

export default function MoreScreen() {
  const t = useT();
  const router = useRouter();
  const user = useUser();
  const { data: approvals } = useGetApprovalsQuery();
  const { data: tasks } = useGetTasksQuery();
  const { data: notifications } = useGetNotificationsQuery();

  const openTasks = (tasks?.tasks ?? []).filter((x) => x.status === 'PENDING' || x.status === 'IN_PROGRESS').length;
  const pendingApprovals = approvals?.data.length ?? 0;

  const groups: { title: string; items: Item[] }[] = [
    {
      title: t('Bani', 'Money'),
      items: [
        { icon: 'wallet-outline', title: t('Facturi de plătit', 'Bills to pay'), href: '/bills' },
        { icon: 'card-outline', title: t('Bancă', 'Bank'), href: '/bank' },
        {
          icon: 'bar-chart-outline',
          title: t('Rapoarte', 'Reports'),
          subtitle: t('Profit, cash-flow, TVA', 'Profit, cash flow, VAT'),
          href: '/reports',
        },
        { icon: 'briefcase-outline', title: t('Sold la contabil', 'Balance with your accountant'), href: '/firm' },
      ],
    },
    {
      title: t('Cu contabilul', 'With your accountant'),
      items: [
        {
          icon: 'shield-checkmark-outline',
          title: t('Facturi de confirmat', 'Invoices to confirm'),
          href: '/approvals',
          badge: pendingApprovals,
        },
        { icon: 'checkbox-outline', title: t('Sarcini', 'Tasks'), href: '/tasks', badge: openTasks },
        {
          icon: 'notifications-outline',
          title: t('Notificări', 'Notifications'),
          href: '/notifications',
          badge: notifications?.unreadCount,
        },
      ],
    },
    {
      title: t('Nomenclatoare', 'Lists'),
      items: [
        { icon: 'people-outline', title: t('Clienți și furnizori', 'Clients and suppliers'), href: '/partners' },
        { icon: 'pricetags-outline', title: t('Articole', 'Items'), href: '/articles' },
        { icon: 'cube-outline', title: t('Stocuri', 'Stock'), href: '/stock' },
      ],
    },
    {
      title: t('Cont', 'Account'),
      items: [
        { icon: 'settings-outline', title: t('Setări', 'Settings'), href: '/settings' },
        {
          icon: 'globe-outline',
          title: t('Deschide tavin.eu', 'Open tavin.eu'),
          subtitle: t(
            'Salarii, setări facturare, e-Transport și restul portalului',
            'Payroll, invoice settings, e-Transport and the rest of the portal',
          ),
          onPress: () => openUrl(`${WEB_APP_URL}/client/dashboard`),
        },
      ],
    },
  ];

  return (
    <Screen>
      <Card onPress={() => router.push('/settings')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar text={initials(user.name)} size={48} />
          <View style={{ flex: 1 }}>
            <Txt variant="title">{user.name}</Txt>
            <Txt variant="small" tone="muted" numberOfLines={1}>
              {user.clientCompany.name}
            </Txt>
          </View>
        </View>
      </Card>
      {groups.map((g) => (
        <View key={g.title}>
          <SectionTitle title={g.title} />
          <Card padded={false}>
            {g.items.map((it, i) => (
              <View key={it.title}>
                {i > 0 ? <Divider inset={64} /> : null}
                <ListRow
                  icon={it.icon}
                  title={it.title}
                  subtitle={it.subtitle}
                  value={it.badge ? String(it.badge) : null}
                  valueTone="danger"
                  onPress={it.onPress ?? (() => it.href && router.push(it.href))}
                />
              </View>
            ))}
          </Card>
        </View>
      ))}
      <Txt variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: space.xl }}>
        Tavin {APP_VERSION}
      </Txt>
    </Screen>
  );
}
