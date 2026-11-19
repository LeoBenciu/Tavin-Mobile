import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useGetApprovalsQuery,
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
import { NavyBackdrop } from '@/components/Hero';
import { useTabBarSpace } from '@/components/TabBar';
import {
  Amount,
  Button,
  Card,
  Divider,
  ErrorState,
  HeaderButton,
  IconTile,
  ListRow,
  Loading,
  Pill,
  SectionTitle,
  Tap,
  Txt,
  type IconName,
} from '@/components/ui';
import { useT, type Translate } from '@/i18n';
import { documentTypeLabel } from '@/lib/domain';
import { daysUntil, formatDate, formatMoney, formatMoneyShort, initials } from '@/lib/format';
import { column, gradient, navy, radius, space, useColors } from '@/theme';

function greeting(t: Translate): string {
  const h = new Date().getHours();
  if (h < 12) return t('Bună dimineața', 'Good morning');
  if (h < 18) return t('Bună ziua', 'Good afternoon');
  return t('Bună seara', 'Good evening');
}

/** What the accountant is waiting on, as one card with its one action. */
type Todo = {
  key: string;
  icon: IconName;
  kind: string;
  title: string;
  note: string | null;
  pill: { label: string; urgent: boolean } | null;
  action: string;
  onPress: () => void;
};

/**
 * Acasă: what needs the client first (one card, one coral button), then the money on
 * the navy card, then the month. The company avatar opens the rest of the firm.
 */
export default function HomeScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const user = useUser();

  const dashboard = useGetDashboardQuery();
  const vatDue = useGetVatDueQuery();
  const health = useGetHealthQuery();
  const firmBalance = useGetFirmBalanceQuery();
  const approvals = useGetApprovalsQuery();
  const tasks = useGetTasksQuery();
  const notifications = useGetNotificationsQuery();

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
  const unreadNotifications = notifications.data?.unreadCount ?? 0;
  const stats = dashboard.data?.stats;
  const vat = vatDue.data && vatDue.data.applies ? vatDue.data : null;
  const owedToFirm = firmBalance.data && firmBalance.data.balance > 0.009 ? firmBalance.data : null;
  const deadline = health.data?.nextDeadline;
  const deadlineDays = deadline ? daysUntil(deadline.dueDate) : null;
  const [balance, balanceCurrency] = splitMoney(formatMoneyShort(stats?.bankBalance ?? 0));
  const today = new Date().toLocaleDateString(t('ro-RO', 'en-GB'), { weekday: 'long', day: 'numeric', month: 'long' });

  // Invoices to confirm come first (the accountant can't book them without an answer), then tasks by due date.
  const todos: Todo[] = [
    ...(approvals.data?.data ?? []).map((a): Todo => {
      const risky = a.riskLevel === 'HIGH' || a.ibanIsNew;
      return {
        key: `a${a.id}`,
        icon: 'shield-checkmark',
        kind: t('Factură de confirmat', 'Invoice to confirm'),
        title: a.vendorName,
        note: formatMoney(a.totalAmount, a.currency),
        pill: risky ? { label: t('De verificat', 'Check this'), urgent: true } : null,
        action: t('Verifică', 'Review'),
        onPress: () => router.push('/approvals'),
      };
    }),
    ...(tasks.data?.tasks ?? [])
      .filter((x) => x.status === 'PENDING' || x.status === 'IN_PROGRESS')
      .sort((x, y) => String(x.dueDate ?? '9999').localeCompare(String(y.dueDate ?? '9999')))
      .map((task): Todo => {
        const days = daysUntil(task.dueDate);
        return {
          key: `t${task.id}`,
          icon: 'checkmark-done',
          kind: t('Cerut de contabil', 'Asked by your accountant'),
          title: task.title,
          note: task.description,
          pill: task.dueDate
            ? {
                label:
                  days != null && days < 0
                    ? t('Întârziată', 'Late')
                    : t(`până pe ${formatDate(task.dueDate)}`, `by ${formatDate(task.dueDate)}`),
                urgent: days != null && days <= 1,
              }
            : null,
          action: t('Deschide', 'Open'),
          onPress: () => router.push('/accountant'),
        };
      }),
  ];
  const first = todos[0];
  const more = todos.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.md, paddingBottom: tabSpace + space.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.muted} colors={[c.accent]} />
        }>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push('/menu')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t(`${user.clientCompany.name}: firma mea`, `${user.clientCompany.name}: my company`)}
            style={({ pressed }) => [styles.company, { backgroundColor: c.text }, pressed && { opacity: 0.8 }]}>
            <Text style={[styles.companyText, { color: c.background }]}>{initials(user.clientCompany.name)}</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Txt variant="footnote" tone="muted" weight="600" numberOfLines={1}>
              {today}
            </Txt>
            <Txt variant="heading" numberOfLines={1} adjustsFontSizeToFit>
              {`${greeting(t)}, ${firstName}`}
            </Txt>
          </View>
          <HeaderButton
            icon="notifications-outline"
            dot={unreadNotifications > 0}
            label={t('Notificări', 'Notifications')}
            onPress={() => router.push('/notifications')}
          />
        </View>

        {first ? (
          <>
            <SectionTitle
              title={t(`De rezolvat · ${todos.length}`, `To do · ${todos.length}`)}
              size="small"
              action={{ label: t('Vezi tot', 'See all'), onPress: () => router.push('/accountant') }}
            />
            <Card>
              <View style={styles.todoHead}>
                <IconTile icon={first.icon} tone="accent" size={36} />
                <Txt variant="label" tone="muted" style={styles.todoKind} numberOfLines={1}>
                  {first.kind}
                </Txt>
                {first.pill ? (
                  <Pill label={first.pill.label} tone={first.pill.urgent ? 'urgent' : 'neutral'} />
                ) : null}
              </View>
              <Txt variant="heading" style={styles.todoTitle} numberOfLines={2}>
                {first.title}
              </Txt>
              {first.note ? (
                <Txt variant="small" tone="muted" numberOfLines={2}>
                  {first.note}
                </Txt>
              ) : null}
              <Button title={first.action} onPress={first.onPress} style={styles.todoAction} />
            </Card>
            {more > 0 ? (
              <Tap
                onPress={() => router.push('/accountant')}
                scaleTo={0.98}
                accessibilityRole="button"
                style={styles.moreRow}>
                <Pill label={`+${more}`} tone="accent" />
                <Txt variant="small" weight="600" style={{ flex: 1 }} numberOfLines={1}>
                  {more === 1
                    ? t('Încă un lucru de rezolvat', 'One more thing to do')
                    : t(`Încă ${more} lucruri de rezolvat`, `${more} more things to do`)}
                </Txt>
                <Ionicons name="chevron-forward" size={17} color={c.faint} />
              </Tap>
            ) : null}
          </>
        ) : approvals.data && tasks.data ? (
          <View style={[styles.clear, { backgroundColor: c.goodSoft }]}>
            <Ionicons name="checkmark-circle" size={20} color={c.good} />
            <Txt variant="small" weight="600" tone="good" style={{ flex: 1 }}>
              {t('Ești la zi cu contabilul.', 'You’re all caught up with your accountant.')}
            </Txt>
          </View>
        ) : null}

        <NavyBackdrop style={styles.money}>
          <Pressable onPress={() => router.push('/bank')} accessibilityRole="button" style={styles.moneyTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.moneyLabel}>{t('Sold în bancă', 'Bank balance')}</Text>
              {stats ? (
                <Amount value={balance} currency={balanceCurrency} size="display" color="#FFFFFF" />
              ) : (
                <Text style={styles.moneyPlaceholder}>—</Text>
              )}
            </View>
            <View style={styles.moneyChevron}>
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </View>
          </Pressable>
          <View style={styles.glassRow}>
            <GlassStat
              label={t('De încasat', 'To collect')}
              value={stats ? splitMoney(formatMoneyShort(stats.unpaidInvoices.total))[0] : '—'}
              onPress={() => router.push('/invoices')}
            />
            <GlassStat
              label={t('De plătit', 'To pay')}
              value={stats ? splitMoney(formatMoneyShort(stats.pendingBills.total))[0] : '—'}
              onPress={() => router.push('/bills')}
            />
            {vat ? (
              <GlassStat
                label={vat.netVat >= 0 ? t('TVA de plată', 'VAT to pay') : t('TVA de recuperat', 'VAT to recover')}
                value={splitMoney(formatMoneyShort(Math.abs(vat.netVat)))[0]}
                onPress={() => router.push('/reports')}
              />
            ) : null}
          </View>
        </NavyBackdrop>

        {dashboard.isLoading ? (
          <Loading />
        ) : dashboard.error && !stats ? (
          <ErrorState message={errorMessage(dashboard.error)} onRetry={dashboard.refetch} />
        ) : stats ? (
          <MonthCard
            revenue={stats.revenue}
            expenses={stats.expenses}
            vat={vat ? { net: vat.netVat, dueDate: vat.dueDate } : null}
            onPress={() => router.push('/reports')}
          />
        ) : null}

        {deadline || owedToFirm ? (
          <>
            <SectionTitle title={t('De urmărit', 'Coming up')} size="small" />
            <Card padded={false}>
              {deadline ? (
                <ListRow
                  icon="calendar"
                  iconTone={deadlineDays != null && deadlineDays <= 3 ? 'urgent' : 'accent'}
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
              {owedToFirm ? (
                <>
                  {deadline ? <Divider inset={60} /> : null}
                  <ListRow
                    icon="briefcase"
                    iconTone={owedToFirm.invoices.some((i) => i.overdue) ? 'urgent' : 'accent'}
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
              size="small"
              action={{ label: t('Vezi tot', 'See all'), onPress: () => router.push('/documents') }}
            />
            <Card padded={false}>
              {dashboard.data.recentActivity.slice(0, 5).map((a, i) => (
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
      </ScrollView>
    </View>
  );
}

/** One figure under the balance (in the balance's currency), as plain text that opens the screen behind it. */
function GlassStat({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.glass, pressed && { opacity: 0.6 }]}>
      <Text style={styles.glassLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.glassValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </Pressable>
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
      <View style={styles.result}>
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
  content: { ...column, paddingHorizontal: space.lg, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  company: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  companyText: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  todoHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  todoKind: { flex: 1, fontSize: 11.5, letterSpacing: 0.6 },
  todoTitle: { marginTop: space.md, marginBottom: 2 },
  todoAction: { marginTop: space.lg },
  moreRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    paddingHorizontal: space.lg,
  },
  clear: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md + 2,
    borderRadius: radius.md,
  },
  money: {
    marginTop: space.lg + 2,
    borderRadius: radius.lg + 2,
    padding: space.lg + 2,
    gap: space.lg - 2,
    boxShadow: navy.shadow,
  },
  moneyTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  moneyLabel: {
    color: navy.indigoLight,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  moneyPlaceholder: { color: navy.onNavyMuted, fontSize: 30, lineHeight: 36, fontWeight: '700' },
  moneyChevron: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: navy.glass,
  },
  glassRow: { flexDirection: 'row', gap: space.lg },
  glass: { flex: 1, minHeight: 44, gap: 2, justifyContent: 'center' },
  glassLabel: { color: navy.onNavySoft, fontSize: 12 },
  glassValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
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
  },
  footer: { textAlign: 'center', marginTop: space.xl },
});
