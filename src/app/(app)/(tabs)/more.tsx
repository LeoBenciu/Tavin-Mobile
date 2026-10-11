import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useGetApprovalsQuery, useGetNotificationsQuery, useGetTasksQuery } from '@/api/api';
import { useUser } from '@/auth/session';
import { THEME_OPTIONS, themeIcon, themeLabel } from '@/components/AppearancePicker';
import { TabScreen } from '@/components/LargeTitle';
import { ActionSheet } from '@/components/Sheet';
import { Avatar, Card, Divider, ListRow, SectionTitle, Tap, Txt, type IconName } from '@/components/ui';
import { useT } from '@/i18n';
import { APP_VERSION, WEB_APP_URL } from '@/lib/config';
import { openUrl } from '@/lib/files';
import { initials } from '@/lib/format';
import { space, useColors, useThemePreference, type TileTone } from '@/theme';

type Item = {
  icon: IconName;
  tone: TileTone;
  title: string;
  subtitle?: string;
  href?: Href;
  onPress?: () => void;
  badge?: number;
  /** Current value, shown grey on the right (iOS Settings). */
  detail?: string;
};

export default function MoreScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const user = useUser();
  const { data: approvals } = useGetApprovalsQuery();
  const { data: tasks } = useGetTasksQuery();
  const { data: notifications } = useGetNotificationsQuery();

  const { preference, setPreference } = useThemePreference();
  const [themeMenu, setThemeMenu] = useState(false);
  const openTasks = (tasks?.tasks ?? []).filter((x) => x.status === 'PENDING' || x.status === 'IN_PROGRESS').length;
  const pendingApprovals = approvals?.data.length ?? 0;

  const groups: { title: string; items: Item[] }[] = [
    {
      title: t('Bani', 'Money'),
      items: [
        { icon: 'wallet', tone: 'warn', title: t('Facturi de plătit', 'Bills to pay'), href: '/bills' },
        { icon: 'card', tone: 'good', title: t('Bancă', 'Bank'), href: '/bank' },
        {
          icon: 'bar-chart',
          tone: 'accent',
          title: t('Rapoarte', 'Reports'),
          subtitle: t('Profit, cash-flow, TVA', 'Profit, cash flow, VAT'),
          href: '/reports',
        },
        {
          icon: 'briefcase',
          tone: 'slate',
          title: t('Sold la contabil', 'Balance with your accountant'),
          href: '/firm',
        },
      ],
    },
    {
      title: t('Cu contabilul', 'With your accountant'),
      items: [
        {
          icon: 'shield-checkmark',
          tone: 'accent',
          title: t('Facturi de confirmat', 'Invoices to confirm'),
          href: '/approvals',
          badge: pendingApprovals,
        },
        { icon: 'checkmark-done', tone: 'good', title: t('Sarcini', 'Tasks'), href: '/tasks', badge: openTasks },
        {
          icon: 'notifications',
          tone: 'danger',
          title: t('Notificări', 'Notifications'),
          href: '/notifications',
          badge: notifications?.unreadCount,
        },
      ],
    },
    {
      title: t('Nomenclatoare', 'Lists'),
      items: [
        { icon: 'people', tone: 'sky', title: t('Clienți și furnizori', 'Clients and suppliers'), href: '/partners' },
        { icon: 'pricetags', tone: 'violet', title: t('Articole', 'Items'), href: '/articles' },
        { icon: 'cube', tone: 'warn', title: t('Stocuri', 'Stock'), href: '/stock' },
      ],
    },
    {
      title: t('Cont', 'Account'),
      items: [
        {
          icon: themeIcon(preference),
          tone: 'slate',
          title: t('Aspect', 'Appearance'),
          detail: themeLabel(t, preference),
          onPress: () => setThemeMenu(true),
        },
        { icon: 'settings', tone: 'neutral', title: t('Setări', 'Settings'), href: '/settings' },
        {
          icon: 'globe',
          tone: 'sky',
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
    <TabScreen title={t('Mai mult', 'More')}>
      <Tap
        onPress={() => router.push('/settings')}
        scaleTo={0.98}
        style={[styles.profile, { backgroundColor: c.surface, boxShadow: c.cardShadow }]}>
        <Avatar text={initials(user.name)} size={58} />
        <View style={{ flex: 1, gap: 1 }}>
          <Txt variant="heading" numberOfLines={1}>
            {user.name}
          </Txt>
          <Txt variant="small" tone="muted" numberOfLines={1}>
            {user.clientCompany.name}
          </Txt>
          <Txt variant="footnote" tone="accent" weight="600" numberOfLines={1}>
            {t('Profil, securitate, aspect', 'Profile, security, appearance')}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={17} color={c.faint} />
      </Tap>

      {groups.map((g) => (
        <View key={g.title}>
          <SectionTitle title={g.title} size="small" />
          <Card padded={false}>
            {g.items.map((it, i) => (
              <View key={it.title}>
                {i > 0 ? <Divider inset={60} /> : null}
                <ListRow
                  icon={it.icon}
                  iconTone={it.tone}
                  solid
                  title={it.title}
                  subtitle={it.subtitle}
                  numberOfLines={it.subtitle ? 2 : 1}
                  badge={it.badge}
                  right={it.detail ? <Txt tone="muted">{it.detail}</Txt> : undefined}
                  onPress={it.onPress ?? (() => it.href && router.push(it.href))}
                />
              </View>
            ))}
          </Card>
        </View>
      ))}
      <Txt variant="footnote" tone="faint" style={{ textAlign: 'center', marginTop: space.xl }}>
        Tavin {APP_VERSION}
      </Txt>
      <ActionSheet
        visible={themeMenu}
        onClose={() => setThemeMenu(false)}
        title={t('Aspect', 'Appearance')}
        actions={THEME_OPTIONS.map((p) => ({
          label: themeLabel(t, p),
          icon: p === preference ? 'checkmark-circle' : 'ellipse-outline',
          onPress: () => setPreference(p),
        }))}
      />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md + 2,
    padding: space.lg,
    borderRadius: 20,
  },
});
