import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
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
import { Screen } from '@/components/Screen';
import {
  ActionTile,
  Banner,
  Card,
  Divider,
  ErrorState,
  Kpi,
  ListRow,
  Loading,
  SectionTitle,
  Txt,
} from '@/components/ui';
import { useT } from '@/i18n';
import { documentTypeLabel } from '@/lib/domain';
import { daysUntil, formatDate, formatMoneyShort } from '@/lib/format';
import { radius, space, useColors } from '@/theme';

export default function HomeScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useUser();

  const dashboard = useGetDashboardQuery();
  const vatDue = useGetVatDueQuery();
  const health = useGetHealthQuery();
  const firmBalance = useGetFirmBalanceQuery();
  const approvals = useGetApprovalsQuery();
  const tasks = useGetTasksQuery();
  const notifications = useGetNotificationsQuery();
  const conversations = useGetConversationsQuery();

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

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + space.md, backgroundColor: c.surface, borderBottomColor: c.line },
        ]}>
        <View style={{ flex: 1 }}>
          <Txt variant="heading" numberOfLines={1}>
            {t(`Bună, ${firstName}`, `Hi, ${firstName}`)}
          </Txt>
          <Txt variant="small" tone="muted" numberOfLines={1}>
            {user.clientCompany.name}
          </Txt>
        </View>
        <Pressable
          onPress={() => router.push('/notifications')}
          hitSlop={8}
          style={[styles.headerButton, { backgroundColor: c.chip }]}
          accessibilityLabel={t('Notificări', 'Notifications')}>
          <Ionicons name="notifications-outline" size={22} color={c.text} />
          {unreadNotifications > 0 ? (
            <View style={[styles.dot, { backgroundColor: c.danger, borderColor: c.surface }]} />
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={8}
          style={[styles.headerButton, { backgroundColor: c.chip }]}
          accessibilityLabel={t('Setări', 'Settings')}>
          <Ionicons name="person-circle-outline" size={24} color={c.text} />
        </Pressable>
      </View>

      <Screen refreshing={refreshing} onRefresh={refresh}>
        {pendingApprovals > 0 ? (
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
            message={t(
              'Confirmă că le recunoști, ca să poată fi înregistrate.',
              'Confirm you recognise them so they can be booked.',
            )}
            onPress={() => router.push('/approvals')}
          />
        ) : null}

        <Card style={styles.actions} padded={false}>
          <View style={styles.actionRow}>
            <ActionTile
              icon="camera"
              label={t('Scanează document', 'Scan document')}
              onPress={() => router.push('/scan')}
            />
            <ActionTile
              icon="add-circle"
              label={t('Factură nouă', 'New invoice')}
              onPress={() => router.push('/invoices/new')}
            />
            <ActionTile
              icon="shield-checkmark-outline"
              label={t('Confirmări', 'Approvals')}
              badge={pendingApprovals}
              onPress={() => router.push('/approvals')}
            />
            <ActionTile
              icon="chatbubble-ellipses-outline"
              label={t('Scrie contabilului', 'Message accountant')}
              badge={unreadMessages}
              onPress={() => router.push('/messages')}
            />
          </View>
        </Card>

        {dashboard.isLoading ? (
          <Loading />
        ) : dashboard.error && !stats ? (
          <ErrorState message={errorMessage(dashboard.error)} onRetry={dashboard.refetch} />
        ) : stats ? (
          <>
            <SectionTitle title={t('Pe scurt', 'At a glance')} />
            <View style={styles.kpiRow}>
              <Kpi
                label={t('Sold în bancă', 'Bank balance')}
                value={formatMoneyShort(stats.bankBalance)}
                onPress={() => router.push('/bank')}
              />
              <Kpi
                label={t('De încasat', 'To collect')}
                value={formatMoneyShort(stats.unpaidInvoices.total)}
                hint={t(`${stats.unpaidInvoices.count} facturi`, `${stats.unpaidInvoices.count} invoices`)}
                tone="accent"
                onPress={() => router.push('/invoices')}
              />
            </View>
            <View style={styles.kpiRow}>
              <Kpi
                label={t('De plătit', 'To pay')}
                value={formatMoneyShort(stats.pendingBills.total)}
                hint={t(`${stats.pendingBills.count} facturi`, `${stats.pendingBills.count} bills`)}
                tone={stats.pendingBills.total > 0 ? 'warn' : undefined}
                onPress={() => router.push('/bills')}
              />
              {vat ? (
                <Kpi
                  label={vat.netVat >= 0 ? t('TVA de plată', 'VAT to pay') : t('TVA de recuperat', 'VAT to recover')}
                  value={formatMoneyShort(Math.abs(vat.netVat))}
                  hint={t(`scadent ${formatDate(vat.dueDate)}`, `due ${formatDate(vat.dueDate)}`)}
                  onPress={() => router.push('/reports')}
                />
              ) : (
                <Kpi
                  label={t('Profit luna trecută', 'Last month profit')}
                  value={formatMoneyShort(stats.revenue - stats.expenses)}
                />
              )}
            </View>

            <Card style={{ marginTop: space.md }} onPress={() => router.push('/reports')}>
              <Txt variant="caption" tone="muted">
                {t('Luna trecută', 'Last month')}
              </Txt>
              <View style={styles.split}>
                <View style={{ flex: 1 }}>
                  <Txt variant="small" tone="soft">
                    {t('Venituri', 'Revenue')}
                  </Txt>
                  <Txt variant="title" weight="700" tone="good">
                    {formatMoneyShort(stats.revenue)}
                  </Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="small" tone="soft">
                    {t('Cheltuieli', 'Expenses')}
                  </Txt>
                  <Txt variant="title" weight="700">
                    {formatMoneyShort(stats.expenses)}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} style={{ alignSelf: 'center' }} />
              </View>
            </Card>
          </>
        ) : null}

        {deadline || owedToFirm || openTasks.length > 0 ? (
          <>
            <SectionTitle title={t('De urmărit', 'Coming up')} />
            <Card padded={false}>
              {deadline ? (
                <ListRow
                  icon="calendar-outline"
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
                  {deadline ? <Divider inset={space.lg} /> : null}
                  <ListRow
                    icon="checkbox-outline"
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
                  {deadline || openTasks.length > 0 ? <Divider inset={space.lg} /> : null}
                  <ListRow
                    icon="briefcase-outline"
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
              action={{ label: t('Documente', 'Documents'), onPress: () => router.push('/documents') }}
            />
            <Card padded={false}>
              {dashboard.data.recentActivity.slice(0, 6).map((a, i) => (
                <View key={a.id}>
                  {i > 0 ? <Divider inset={space.lg} /> : null}
                  <ListRow
                    icon="document-text-outline"
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

        <Txt variant="caption" tone="muted" style={styles.footer}>
          {t(`Contabil: ${user.accountingCompany.name}`, `Accountant: ${user.accountingCompany.name}`)}
        </Txt>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 8, right: 9, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  actions: { marginTop: space.md },
  actionRow: { flexDirection: 'row', paddingVertical: space.sm },
  kpiRow: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
  split: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  footer: { textAlign: 'center', marginTop: space.xl },
});
