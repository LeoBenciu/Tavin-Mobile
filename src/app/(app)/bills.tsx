import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useGetBillsQuery, useLazyGetDocumentUrlQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { Bill } from '@/api/types';
import { Screen } from '@/components/Screen';
import { Card, Divider, EmptyState, ErrorState, Kpi, ListRow, Loading, Pill, Segmented } from '@/components/ui';
import { useT, type Translate } from '@/i18n';
import { notify } from '@/lib/confirm';
import { openUrl } from '@/lib/files';
import { daysUntil, formatDate, formatMoney, formatMoneyShort } from '@/lib/format';
import { space, type Tone } from '@/theme';

function billStatus(t: Translate, b: Bill): { label: string; tone: Tone } {
  switch (b.status) {
    case 'paid':
      return { label: t('Plătită', 'Paid'), tone: 'good' };
    case 'partial':
      return { label: t('Parțial', 'Partly paid'), tone: 'warn' };
    case 'overdue':
      return { label: t('Restantă', 'Overdue'), tone: 'danger' };
    default:
      return { label: t('De plătit', 'To pay'), tone: 'accent' };
  }
}

export default function BillsScreen() {
  const t = useT();
  const [filter, setFilter] = useState<'open' | 'paid'>('open');
  const { data, isLoading, isFetching, error, refetch } = useGetBillsQuery();
  const [getUrl] = useLazyGetDocumentUrlQuery();

  const bills = useMemo(() => {
    const list = (data?.bills ?? []).filter((b) => (filter === 'paid' ? b.status === 'paid' : b.status !== 'paid'));
    // Soonest due first for open bills; newest first for paid ones.
    return list.sort((a, b) =>
      filter === 'open'
        ? String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999'))
        : String(b.issueDate ?? '').localeCompare(String(a.issueDate ?? '')),
    );
  }, [data, filter]);

  const open = async (b: Bill) => {
    try {
      await openUrl((await getUrl(b.id).unwrap()).url);
    } catch (e) {
      notify(t('Nu am putut deschide factura', 'Couldn’t open the bill'), errorMessage(e));
    }
  };

  return (
    <Screen refreshing={isFetching && !isLoading} onRefresh={refetch}>
      {data ? (
        <View style={styles.kpis}>
          <Kpi label={t('Total de plătit', 'Total to pay')} value={formatMoneyShort(data.stats.total)} />
          <Kpi
            label={t('Restante', 'Overdue')}
            value={formatMoneyShort(data.stats.overdue)}
            hint={t(`${data.stats.overdueCount} facturi`, `${data.stats.overdueCount} bills`)}
            tone={data.stats.overdue > 0 ? 'danger' : undefined}
          />
          <Kpi
            label={t('Săptămâna asta', 'This week')}
            value={formatMoneyShort(data.stats.dueThisWeek)}
            hint={t(`${data.stats.dueThisWeekCount} facturi`, `${data.stats.dueThisWeekCount} bills`)}
          />
        </View>
      ) : null}
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'open', label: t('De plătit', 'To pay') },
          { value: 'paid', label: t('Plătite', 'Paid') },
        ]}
      />
      <View style={{ height: space.md }} />
      {isLoading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : bills.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title={
            filter === 'open'
              ? t('Nicio factură de plătit', 'No bills to pay')
              : t('Nicio factură plătită', 'No paid bills')
          }
          message={t(
            'Facturile de la furnizori apar aici după ce sunt procesate.',
            'Supplier invoices show up here once processed.',
          )}
        />
      ) : (
        <Card padded={false}>
          {bills.map((b, i) => {
            const st = billStatus(t, b);
            const days = daysUntil(b.dueDate);
            const due =
              b.status === 'paid' || days == null
                ? formatDate(b.issueDate)
                : days < 0
                  ? t(`scadentă de ${-days} zile`, `${-days} days overdue`)
                  : days === 0
                    ? t('scadentă azi', 'due today')
                    : t(`scadentă în ${days} zile`, `due in ${days} days`);
            return (
              <View key={b.id}>
                {i > 0 ? <Divider inset={space.lg} /> : null}
                <ListRow
                  title={b.vendor || b.description}
                  subtitle={`${b.invoiceNumber} · ${due}`}
                  value={formatMoney(b.status === 'paid' ? b.amount : b.remainingAmount, b.currency)}
                  valueTone={b.status === 'overdue' ? 'danger' : undefined}
                  right={<Pill label={st.label} tone={st.tone} />}
                  onPress={() => open(b)}
                  chevron={false}
                />
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
});
