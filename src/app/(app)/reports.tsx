import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  useGetCashFlowQuery,
  useGetExpensesByCategoryQuery,
  useGetPnlQuery,
  useGetReportsOverviewQuery,
  useGetSalesPerClientQuery,
  useGetVatReportQuery,
  type Period,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { MonthlyBars, RankedBars } from '@/components/charts';
import { Screen } from '@/components/Screen';
import { Card, Chip, Divider, ErrorState, Loading, SectionTitle, Segmented, Txt } from '@/components/ui';
import { useLanguage, useT } from '@/i18n';
import { formatDate, formatMoney, isoDay } from '@/lib/format';
import { space } from '@/theme';

type PeriodKey = 'month' | 'lastMonth' | 'quarter' | 'year';
type Tab = 'pnl' | 'cash' | 'vat' | 'clients' | 'expenses';

const MONTHS_RO = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function periodFor(key: PeriodKey): Period {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'lastMonth':
      return { startDate: isoDay(new Date(y, m - 1, 1)), endDate: isoDay(new Date(y, m, 0)) };
    case 'quarter': {
      const q = Math.floor(m / 3) * 3;
      return { startDate: isoDay(new Date(y, q, 1)), endDate: isoDay(new Date(y, q + 3, 0)) };
    }
    case 'year':
      return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
    default:
      return { startDate: isoDay(new Date(y, m, 1)), endDate: isoDay(new Date(y, m + 1, 0)) };
  }
}

export default function ReportsScreen() {
  const t = useT();
  const { language } = useLanguage();
  const [periodKey, setPeriodKey] = useState<PeriodKey>('month');
  const [tab, setTab] = useState<Tab>('pnl');
  const period = useMemo(() => periodFor(periodKey), [periodKey]);

  const overview = useGetReportsOverviewQuery('year');
  const pnl = useGetPnlQuery(period, { skip: tab !== 'pnl' });
  const cash = useGetCashFlowQuery(period, { skip: tab !== 'cash' });
  const vat = useGetVatReportQuery(period, { skip: tab !== 'vat' });
  const sales = useGetSalesPerClientQuery(period, { skip: tab !== 'clients' });
  const expenses = useGetExpensesByCategoryQuery(period, { skip: tab !== 'expenses' });

  const months = language === 'ro' ? MONTHS_RO : MONTHS_EN;
  // January → this month, zero-filled, so columns keep their place and width.
  const monthly = useMemo(() => {
    const now = new Date();
    const byKey = new Map((overview.data?.monthlyData ?? []).map((d) => [d.month, d.revenue]));
    return Array.from({ length: now.getMonth() + 1 }, (_, m) => {
      const key = `${now.getFullYear()}-${String(m + 1).padStart(2, '0')}`;
      return { label: months[m], value: byKey.get(key) ?? 0 };
    });
  }, [overview.data, months]);

  const active = { pnl, cash, vat, clients: sales, expenses }[tab];
  const refresh = () => {
    overview.refetch();
    if (!active.isUninitialized) active.refetch();
  };

  return (
    <Screen refreshing={active.isFetching && !active.isLoading} onRefresh={refresh}>
      <Card>
        <Txt variant="label" tone="muted">
          {t('Venituri facturate pe lună', 'Invoiced revenue per month')}
        </Txt>
        <View style={{ height: space.sm }} />
        {overview.isLoading ? (
          <Loading />
        ) : (
          <MonthlyBars
            data={monthly}
            emptyLabel={t('Încă nu ai facturi emise anul acesta.', 'No invoices issued this year yet.')}
          />
        )}
      </Card>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chips}>
        {(
          [
            ['month', t('Luna aceasta', 'This month')],
            ['lastMonth', t('Luna trecută', 'Last month')],
            ['quarter', t('Trimestrul', 'This quarter')],
            ['year', t('Anul', 'This year')],
          ] as [PeriodKey, string][]
        ).map(([k, label]) => (
          <Chip key={k} label={label} active={periodKey === k} onPress={() => setPeriodKey(k)} />
        ))}
      </ScrollView>
      <Txt variant="caption" tone="muted" style={{ marginBottom: space.sm }}>
        {formatDate(period.startDate)} – {formatDate(period.endDate)} · {t('din contabilitate', 'from the books')}
      </Txt>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pnl', label: t('Profit', 'Profit') },
          { value: 'cash', label: 'Cash' },
          { value: 'vat', label: t('TVA', 'VAT') },
          { value: 'clients', label: t('Clienți', 'Clients') },
          { value: 'expenses', label: t('Chelt.', 'Costs') },
        ]}
      />
      <View style={{ height: space.md }} />

      {active.isLoading ? (
        <Loading />
      ) : active.error ? (
        <ErrorState message={errorMessage(active.error)} onRetry={active.refetch} />
      ) : tab === 'pnl' && pnl.data ? (
        <>
          <Card>
            <Line label={t('Venituri', 'Revenue')} value={formatMoney(pnl.data.totalRevenue)} />
            <Line label={t('Cheltuieli', 'Expenses')} value={formatMoney(pnl.data.totalExpenses)} />
            <Divider />
            <Line
              label={pnl.data.netIncome >= 0 ? t('Profit', 'Profit') : t('Pierdere', 'Loss')}
              value={formatMoney(pnl.data.netIncome)}
              bold
              tone={pnl.data.netIncome >= 0 ? 'good' : 'danger'}
            />
          </Card>
          {pnl.data.expenses.length > 0 ? (
            <>
              <SectionTitle title={t('Cele mai mari cheltuieli', 'Largest expenses')} />
              <Card>
                <RankedBars
                  items={pnl.data.expenses.map((e) => ({ label: e.name, value: e.amount, sub: e.accountCode }))}
                />
              </Card>
            </>
          ) : null}
          {pnl.data.revenue.length > 0 ? (
            <>
              <SectionTitle title={t('Surse de venit', 'Revenue sources')} />
              <Card>
                <RankedBars
                  items={pnl.data.revenue.map((e) => ({ label: e.name, value: e.amount, sub: e.accountCode }))}
                />
              </Card>
            </>
          ) : null}
        </>
      ) : tab === 'cash' && cash.data ? (
        <Card>
          <Line label={t('Sold inițial', 'Opening cash')} value={formatMoney(cash.data.openingBalance)} />
          <Line label={t('Din activitate', 'Operating')} value={formatMoney(cash.data.operating.total)} />
          <Line label={t('Investiții', 'Investing')} value={formatMoney(cash.data.investing.total)} />
          <Line label={t('Finanțare', 'Financing')} value={formatMoney(cash.data.financing.total)} />
          <Divider />
          <Line
            label={t('Variație', 'Net change')}
            value={formatMoney(cash.data.netChange)}
            tone={cash.data.netChange >= 0 ? 'good' : 'danger'}
          />
          <Line label={t('Sold final', 'Closing cash')} value={formatMoney(cash.data.closingBalance)} bold />
        </Card>
      ) : tab === 'vat' && vat.data ? (
        <Card>
          <Line label={t('TVA colectată', 'Output VAT')} value={formatMoney(vat.data.collected)} />
          <Line label={t('TVA deductibilă', 'Input VAT')} value={formatMoney(vat.data.deductible)} />
          <Divider />
          <Line
            label={
              vat.data.direction === 'payable'
                ? t('TVA de plată', 'VAT to pay')
                : t('TVA de recuperat', 'VAT to recover')
            }
            value={formatMoney(Math.abs(vat.data.netVat))}
            bold
            tone={vat.data.direction === 'payable' ? 'warn' : 'good'}
          />
          <Txt variant="caption" tone="muted" style={{ marginTop: space.sm }}>
            {t(
              'Aceeași sursă ca decontul D300 (conturile 4427 / 4426).',
              'Same source as the D300 return (accounts 4427 / 4426).',
            )}
          </Txt>
        </Card>
      ) : tab === 'clients' && sales.data ? (
        <Card>
          {sales.data.clients.length === 0 ? (
            <Txt tone="muted">{t('Nicio vânzare în perioadă.', 'No sales in this period.')}</Txt>
          ) : (
            <RankedBars
              items={sales.data.clients.map((cl) => ({
                label: cl.name,
                value: cl.amount,
                sub: t(`${cl.invoiceCount} facturi · fără TVA`, `${cl.invoiceCount} invoices · excl. VAT`),
              }))}
              limit={15}
            />
          )}
        </Card>
      ) : tab === 'expenses' && expenses.data ? (
        <Card>
          {expenses.data.categories.length === 0 ? (
            <Txt tone="muted">{t('Nicio cheltuială în perioadă.', 'No expenses in this period.')}</Txt>
          ) : (
            <RankedBars items={expenses.data.categories.map((e) => ({ label: e.name, value: e.amount }))} />
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

function Line({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: 'good' | 'danger' | 'warn';
}) {
  return (
    <View style={styles.line}>
      <Txt tone={bold ? 'default' : 'soft'} weight={bold ? '700' : undefined}>
        {label}
      </Txt>
      <Txt weight={bold ? '700' : '600'} tone={tone}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  // A horizontal ScrollView must not grow vertically inside the page column.
  chipScroll: { flexGrow: 0 },
  chips: { gap: space.sm, paddingVertical: space.md },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
});
