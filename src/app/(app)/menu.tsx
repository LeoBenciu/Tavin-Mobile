import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useGetBillsQuery, useGetFirmBalanceQuery } from '@/api/api';
import { useUser } from '@/auth/session';
import { Screen } from '@/components/Screen';
import { Avatar, Card, Divider, ListRow, Pill, SectionTitle, Tap, Txt, type IconName } from '@/components/ui';
import { useT } from '@/i18n';
import { APP_VERSION, WEB_APP_URL } from '@/lib/config';
import { openUrl } from '@/lib/files';
import { formatMoneyShort, initials } from '@/lib/format';
import { space, useColors, type TileTone, type Tone } from '@/theme';

type Item = {
  icon: IconName;
  tone: TileTone;
  title: string;
  subtitle?: string;
  href?: Href;
  onPress?: () => void;
  /** A status beside the title: what is overdue or owed. */
  pill?: { label: string; tone: Tone } | null;
};

/**
 * "Firma mea": everything that is not a daily job. Opened from the company avatar on
 * Acasă; the tabs keep what a client does every day (documents, invoices, the accountant).
 */
export default function MenuScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const user = useUser();
  const { data: bills } = useGetBillsQuery();
  const { data: firm } = useGetFirmBalanceQuery();

  const overdueBills = bills?.stats.overdueCount ?? 0;
  const owed = firm && firm.balance > 0.009 ? firm : null;

  const groups: { title: string; items: Item[] }[] = [
    {
      title: t('Bani', 'Money'),
      items: [
        {
          icon: 'wallet',
          tone: 'accent',
          title: t('Facturi de plătit', 'Bills to pay'),
          href: '/bills',
          pill:
            overdueBills > 0
              ? {
                  label:
                    overdueBills === 1
                      ? t('1 restantă', '1 overdue')
                      : t(`${overdueBills} restante`, `${overdueBills} overdue`),
                  tone: 'urgent',
                }
              : null,
        },
        { icon: 'card', tone: 'accent', title: t('Bancă', 'Bank'), href: '/bank' },
        {
          icon: 'bar-chart',
          tone: 'accent',
          title: t('Rapoarte', 'Reports'),
          subtitle: t('Profit, cash-flow, TVA', 'Profit, cash flow, VAT'),
          href: '/reports',
        },
        {
          icon: 'briefcase',
          tone: 'accent',
          title: t('Sold la contabil', 'Balance with your accountant'),
          href: '/firm',
          pill: owed
            ? {
                label: formatMoneyShort(owed.balance, owed.currency),
                tone: owed.invoices.some((i) => i.overdue) ? 'urgent' : 'accent',
              }
            : null,
        },
      ],
    },
    {
      title: t('Nomenclatoare', 'Lists'),
      items: [
        { icon: 'people', tone: 'neutral', title: t('Clienți și furnizori', 'Clients and suppliers'), href: '/partners' },
        { icon: 'pricetags', tone: 'neutral', title: t('Articole', 'Items'), href: '/articles' },
        { icon: 'cube', tone: 'neutral', title: t('Stocuri', 'Stock'), href: '/stock' },
      ],
    },
    {
      title: t('Cont', 'Account'),
      items: [
        {
          icon: 'settings',
          tone: 'neutral',
          title: t('Setări', 'Settings'),
          subtitle: t('Profil, securitate, notificări', 'Profile, security, notifications'),
          href: '/settings',
        },
        {
          icon: 'globe',
          tone: 'neutral',
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
      <Tap
        onPress={() => router.push('/settings')}
        scaleTo={0.98}
        style={styles.profile}>
        <Avatar text={initials(user.clientCompany.name)} size={52} />
        <View style={{ flex: 1, gap: 1 }}>
          <Txt variant="title" weight="700" numberOfLines={1}>
            {user.clientCompany.name}
          </Txt>
          <Txt variant="small" tone="muted" numberOfLines={1}>
            {user.name}
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
                  title={it.title}
                  subtitle={it.subtitle}
                  numberOfLines={it.subtitle ? 2 : 1}
                  right={it.pill ? <Pill label={it.pill.label} tone={it.pill.tone} /> : undefined}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md + 2,
    padding: space.lg,
  },
});
