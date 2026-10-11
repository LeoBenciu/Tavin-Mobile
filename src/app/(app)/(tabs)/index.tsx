import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Animated, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useGetApprovalsQuery,
  useGetConversationsQuery,
  useGetDashboardQuery,
  useGetFirmBalanceQuery,
  useGetHealthQuery,
  useGetNotificationsQuery,
  useGetTasksQuery,
  useGetVatDueQuery,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { useUser } from '@/auth/session';
import { splitMoney } from '@/components/charts';
import { GlassChip, NavyBackdrop } from '@/components/Hero';
import { NAV_BAR_HEIGHT, NavBar, useCollapsingTitle } from '@/components/LargeTitle';
import { useTabBarSpace } from '@/components/TabBar';
import {
  ActionTile,
  Amount,
  Avatar,
  Banner,
  Card,
  Divider,
  ErrorState,
  HeaderButton,
  Kpi,
  ListRow,
  Loading,
  SectionTitle,
  Txt,
} from '@/components/ui';
import { useT, type Translate } from '@/i18n';
import { documentTypeLabel } from '@/lib/domain';
import { daysUntil, formatDate, formatMoneyShort, initials } from '@/lib/format';
import { gradient, navy, radius, space, useColors, useIsDark } from '@/theme';

function greeting(t: Translate): string {
  const h = new Date().getHours();
  if (h < 12) return t('Bună dimineața', 'Good morning');
  if (h < 18) return t('Bună ziua', 'Good afternoon');
  return t('Bună seara', 'Good evening');
}

export default function HomeScreen() {
  const c = useColors();
  const dark = useIsDark();
  const t = useT();
  const router = useRouter();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const tabSpace = useTabBarSpace();
  const user = useUser();
  const { scrollY, onScroll } = useCollapsingTitle();
  const [heroHeight, setHeroHeight] = useState(320);
  const [overHero, setOverHero] = useState(true);

  const dashboard = useGetDashboardQuery();
  const vatDue = useGetVatDueQuery();
  const health = useGetHealthQuery();
  const firmBalance = useGetFirmBalanceQuery();
  const approvals = useGetApprovalsQuery();
  const tasks = useGetTasksQuery();
  const notifications = useGetNotificationsQuery();
  const conversations = useGetConversationsQuery();

  // Light status bar over the navy hero; the theme's own once the bar takes over.
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => setOverHero(value < heroHeight - 17));
    return () => scrollY.removeListener(id);
  }, [scrollY, heroHeight]);

  const refreshing = dashboard.isFetching && !dashboard.isLoading;
  const refresh = () => {
    dashboard.refetch();
    vatDue.refetch();
    health.refetch();
    firmBalance.refetch();
    approvals.refetch();
    tasks.refetch();
    notifications.refetch();
  };

  const firstName = user.name.split(' ')[0] || user.name;
  const pendingApprovals = approvals.data?.data.length ?? 0;
  const openTasks = (tasks.data?.tasks ?? []).filter((x) => x.status === 'PENDING' || x.status === 'IN_PROGRESS');
  const unreadMessages = conversations.data?.conversations[0]?.unreadCount ?? 0;
  const unreadNotifications = notifications.data?.unreadCount ?? 0;
  const stats = dashboard.data?.stats;
  const vat = vatDue.data && vatDue.data.applies ? vatDue.data : null;
  const owedToFirm = firmBalance.data && firmBalance.data.balance > 0.009 ? firmBalance.data : null;
  const deadline = health.data?.nextDeadline;
  const deadlineDays = deadline ? daysUntil(deadline.dueDate) : null;
  const [balance, balanceCurrency] = splitMoney(formatMoneyShort(stats?.bankBalance ?? 0));

  const headerButtons = (tone: 'glass' | 'plain') => (
    <>
      <HeaderButton
        icon="notifications-outline"
        tone={tone}
        dot={unreadNotifications > 0}
        label={t('Notificări', 'Notifications')}
        onPress={() => router.push('/notifications')}
      />
      <Pressable
        onPress={() => router.push('/settings')}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('Setări', 'Settings')}
        style={tone === 'glass' ? styles.avatarRing : null}>
        <Avatar text={initials(user.name)} size={36} />
      </Pressable>
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {focused ? <StatusBar style={overHero || dark ? 'light' : 'dark'} /> : null}
      {/* Fixed navy ground: the hero copy scrolls over it and the content sheet slides up across it. */}
      <NavyBackdrop style={[styles.ground, { height: insets.top + heroHeight + 80 }]} />

      <Animated.ScrollView
        style={{ marginTop: insets.top }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#FFFFFF" colors={[c.accent]} />
        }>
        <View style={styles.hero} onLayout={(e) => setHeroHeight(Math.round(e.nativeEvent.layout.height))}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1, paddingRight: space.md }}>
              <GlassChip label={user.clientCompany.name} />
            </View>
            {headerButtons('glass')}
          </View>

          <Text style={styles.greeting} numberOfLines={2}>
            {`${greeting(t)}, ${firstName}`}
          </Text>

          <Pressable onPress={() => router.push('/bank')} style={styles.balance} accessibilityRole="button">
            <View style={styles.balanceLabel}>
              <Text style={styles.balanceLabelText}>{t('Sold în bancă', 'Bank balance')}</Text>
              <Ionicons name="chevron-forward" size={14} color={navy.onNavyMuted} />
            </View>
            {stats ? (
              <Amount
                value={balance}
                currency={balanceCurrency}
                size="largeTitle"
                color="#FFFFFF"
                style={styles.balanceValue}
              />
            ) : (
              <Text style={[styles.balanceValue, styles.balancePlaceholder]}>—</Text>
            )}
          </Pressable>

          <View style={styles.actions}>
            <ActionTile
              variant="glass"
              icon="camera"
              label={t('Scanează', 'Scan')}
              onPress={() => router.push('/scan')}
            />
            <ActionTile
              variant="glass"
              icon="add"
              label={t('Factură', 'Invoice')}
              onPress={() => router.push('/invoices/new')}
            />
            <ActionTile
              variant="glass"
              icon="shield-checkmark-outline"
              label={t('Confirmări', 'Approvals')}
              badge={pendingApprovals}
              onPress={() => router.push('/approvals')}
            />
            <ActionTile
              variant="glass"
              icon="chatbubble-ellipses-outline"
              label={t('Contabil', 'Accountant')}
              badge={unreadMessages}
              onPress={() => router.push('/messages')}
            />
          </View>
        </View>

        <View
          style={[
            styles.sheet,
            { backgroundColor: c.background, minHeight: windowHeight - insets.top, paddingBottom: tabSpace + space.xl },
          ]}>
          {pendingApprovals > 0 ? (
            <View style={{ marginBottom: space.lg }}>
              <Banner
                tone="warn"
                icon="shield-checkmark"
                title={
                  pendingApprovals === 1
                    ? t('O factură așteaptă confirmarea ta', 'One invoice is waiting for you')
                    : t(
                        `${pendingApprovals} facturi așteaptă confirmarea ta`,
                        `${pendingApprovals} invoices are waiting for you`,
                      )
                }
                message={
                  pendingApprovals === 1
                    ? t(
                        'Confirmă că o recunoști, ca să poată fi înregistrată.',
                        'Confirm you recognise it so it can be booked.',
                      )
                    : t(
                        'Confirmă că le recunoști, ca să poată fi înregistrate.',
                        'Confirm you recognise them so they can be booked.',
                      )
                }
                onPress={() => router.push('/approvals')}
              />
            </View>
          ) : null}

          {dashboard.isLoading ? (
            <Loading />
          ) : dashboard.error && !stats ? (
            <ErrorState message={errorMessage(dashboard.error)} onRetry={dashboard.refetch} />
          ) : stats ? (
            <>
              <View style={styles.kpiRow}>
                <Kpi
                  icon="arrow-down"
                  iconTone="accent"
                  label={t('De încasat', 'To collect')}
                  value={formatMoneyShort(stats.unpaidInvoices.total)}
                  hint={t(`${stats.unpaidInvoices.count} facturi`, `${stats.unpaidInvoices.count} invoices`)}
                  onPress={() => router.push('/invoices')}
                />
                <Kpi
                  icon="arrow-up"
                  iconTone={stats.pendingBills.total > 0 ? 'warn' : 'neutral'}
                  label={t('De plătit', 'To pay')}
                  value={formatMoneyShort(stats.pendingBills.total)}
                  hint={t(`${stats.pendingBills.count} facturi`, `${stats.pendingBills.count} bills`)}
                  onPress={() => router.push('/bills')}
                />
              </View>

              <MonthCard
                revenue={stats.revenue}
                expenses={stats.expenses}
                vat={vat ? { net: vat.netVat, dueDate: vat.dueDate } : null}
                onPress={() => router.push('/reports')}
              />
            </>
          ) : null}

          {deadline || owedToFirm || openTasks.length > 0 ? (
            <>
              <SectionTitle title={t('De urmărit', 'Coming up')} />
              <Card padded={false}>
                {deadline ? (
                  <ListRow
                    icon="calendar"
                    solid
                    iconTone={deadlineDays != null && deadlineDays <= 3 ? 'danger' : 'accent'}
                    title={t(`Termen ${deadline.code}`, `${deadline.code} deadline`)}
                    subtitle={
                      deadlineDays == null
                        ? formatDate(deadline.dueDate)
                        : deadlineDays <= 0
                          ? t('azi', 'today')
                          : t(
                              `în ${deadlineDays} zile · ${formatDate(deadline.dueDate)}`,
                              `in ${deadlineDays} days · ${formatDate(deadline.dueDate)}`,
                            )
                    }
                  />
                ) : null}
                {openTasks.length > 0 ? (
                  <>
                    {deadline ? <Divider inset={60} /> : null}
                    <ListRow
                      icon="checkmark-done"
                      solid
                      iconTone="good"
                      title={t(
                        `${openTasks.length} sarcini de la contabil`,
                        `${openTasks.length} tasks from your accountant`,
                      )}
                      subtitle={openTasks[0]?.title}
                      onPress={() => router.push('/tasks')}
                    />
                  </>
                ) : null}
                {owedToFirm ? (
                  <>
                    {deadline || openTasks.length > 0 ? <Divider inset={60} /> : null}
                    <ListRow
                      icon="briefcase"
                      solid
                      iconTone={owedToFirm.invoices.some((i) => i.overdue) ? 'danger' : 'warn'}
                      title={t('Sold la contabil', 'Owed to your accountant')}
                      value={formatMoneyShort(owedToFirm.balance, owedToFirm.currency)}
                      onPress={() => router.push('/firm')}
                    />
                  </>
                ) : null}
              </Card>
            </>
          ) : null}

          {dashboard.data && dashboard.data.recentActivity.length > 0 ? (
            <>
              <SectionTitle
                title={t('Activitate recentă', 'Recent activity')}
                action={{ label: t('Vezi tot', 'See all'), onPress: () => router.push('/documents') }}
              />
              <Card padded={false}>
                {dashboard.data.recentActivity.slice(0, 6).map((a, i) => (
                  <View key={a.id}>
                    {i > 0 ? <Divider inset={60} /> : null}
                    <ListRow
                      icon="document-text"
                      iconTone="neutral"
                      title={a.description}
                      subtitle={`${documentTypeLabel(t, a.type)} · ${formatDate(a.date)}`}
                      value={Number(a.amount) ? formatMoneyShort(a.amount) : null}
                    />
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <Txt variant="footnote" tone="muted" style={styles.footer}>
            {t(`Contabil: ${user.accountingCompany.name}`, `Accountant: ${user.accountingCompany.name}`)}
          </Txt>
        </View>
      </Animated.ScrollView>

      <NavBar
        title={user.clientCompany.name}
        scrollY={scrollY}
        showAt={heroHeight - 10}
        right={headerButtons('plain')}
        fadeRight
      />
    </View>
  );
}

/** This month at a glance: revenue against expenses, the result, and VAT if it applies. */
function MonthCard({
  revenue,
  expenses,
  vat,
  onPress,
}: {
  revenue: number;
  expenses: number;
  vat: { net: number; dueDate: string } | null;
  onPress: () => void;
}) {
  const c = useColors();
  const t = useT();
  const max = Math.max(revenue, expenses, 1);
  const profit = revenue - expenses;
  const bar = (value: number, css: string, fallback: string) => (
    <View style={[styles.track, { backgroundColor: c.fill }]}>
      <View
        style={[
          styles.trackFill,
          { width: `${Math.max(3, (Math.max(0, value) / max) * 100)}%`, backgroundColor: fallback },
          gradient(css),
        ]}
      />
    </View>
  );
  return (
    <Card onPress={onPress} style={{ marginTop: space.md }}>
      <View style={styles.monthHead}>
        <Txt variant="title">{t('Luna aceasta', 'This month')}</Txt>
        <Ionicons name="chevron-forward" size={17} color={c.faint} />
      </View>
      <View style={styles.monthRow}>
        <View style={styles.monthLabel}>
          <View style={[styles.legend, { backgroundColor: '#22A45D' }]} />
          <Txt variant="small" tone="soft">
            {t('Venituri', 'Revenue')}
          </Txt>
        </View>
        <Txt weight="700" tabular>
          {formatMoneyShort(revenue)}
        </Txt>
      </View>
      {bar(revenue, 'linear-gradient(90deg, #15803D, #34C76F)', '#22A45D')}
      <View style={[styles.monthRow, { marginTop: space.md }]}>
        <View style={styles.monthLabel}>
          <View style={[styles.legend, { backgroundColor: c.chart }]} />
          <Txt variant="small" tone="soft">
            {t('Cheltuieli', 'Expenses')}
          </Txt>
        </View>
        <Txt weight="700" tabular>
          {formatMoneyShort(expenses)}
        </Txt>
      </View>
      {bar(expenses, 'linear-gradient(90deg, #465FE9, #7C8CFF)', c.chart)}
      <View style={[styles.result, { backgroundColor: profit >= 0 ? c.goodSoft : c.dangerSoft }]}>
        <Txt variant="small" weight="600" tone={profit >= 0 ? 'good' : 'danger'}>
          {profit >= 0 ? t('Profit', 'Profit') : t('Pierdere', 'Loss')}
        </Txt>
        <Txt weight="700" tone={profit >= 0 ? 'good' : 'danger'} tabular>
          {formatMoneyShort(Math.abs(profit))}
        </Txt>
      </View>
      {vat ? (
        <>
          <View style={{ height: space.md }} />
          <Divider />
          <View style={[styles.monthRow, { marginTop: space.md }]}>
            <View style={{ flex: 1 }}>
              <Txt variant="small" weight="600">
                {vat.net >= 0 ? t('TVA de plată', 'VAT to pay') : t('TVA de recuperat', 'VAT to recover')}
              </Txt>
              <Txt variant="caption" tone="muted">
                {t(`scadent ${formatDate(vat.dueDate)}`, `due ${formatDate(vat.dueDate)}`)}
              </Txt>
            </View>
            <Txt weight="700" tone={vat.net >= 0 ? 'warn' : 'good'} tabular>
              {formatMoneyShort(Math.abs(vat.net))}
            </Txt>
          </View>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  ground: { position: 'absolute', top: 0, left: 0, right: 0 },
  hero: { paddingHorizontal: space.lg + 4, paddingBottom: space.xl + space.lg },
  heroTop: { height: NAV_BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatarRing: { borderRadius: 20, padding: 1, borderWidth: 1, borderColor: navy.glassLine },
  greeting: {
    marginTop: space.lg,
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.9,
  },
  balance: { marginTop: space.xl },
  balanceLabel: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  balanceLabelText: {
    color: navy.onNavyMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  balanceValue: { marginTop: 4, fontSize: 40, lineHeight: 46, letterSpacing: -1.4 },
  balancePlaceholder: { color: navy.onNavyMuted, fontWeight: '700' },
  actions: { flexDirection: 'row', marginTop: space.xl + 4, marginHorizontal: -space.xs },
  sheet: {
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    paddingHorizontal: space.lg,
    paddingTop: space.lg + 4,
  },
  kpiRow: { flexDirection: 'row', gap: space.md },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  monthLabel: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legend: { width: 8, height: 8, borderRadius: 4 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 4 },
  result: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  footer: { textAlign: 'center', marginTop: space.xl },
});
