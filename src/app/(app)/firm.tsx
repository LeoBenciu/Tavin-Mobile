import { View } from 'react-native';

import { useGetFirmBalanceQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { useUser } from '@/auth/session';
import { splitMoney } from '@/components/charts';
import { BalanceCard } from '@/components/Hero';
import { Screen } from '@/components/Screen';
import { Card, Divider, EmptyState, ErrorState, ListRow, Loading, Pill, SectionTitle } from '@/components/ui';
import { useT } from '@/i18n';
import { formatDate, formatMoney } from '@/lib/format';

/** Fees owed to the accounting firm (their invoices to this client). */
export default function FirmBalanceScreen() {
  const t = useT();
  const user = useUser();
  const { data, isLoading, isFetching, error, refetch } = useGetFirmBalanceQuery();

  if (isLoading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (error && !data)
    return (
      <Screen>
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      </Screen>
    );

  const invoices = data?.invoices ?? [];
  const [amount, currency] = splitMoney(formatMoney(data?.balance ?? 0, data?.currency));
  return (
    <Screen refreshing={isFetching} onRefresh={refetch}>
      <BalanceCard
        label={t(`Datorat către ${user.accountingCompany.name}`, `Owed to ${user.accountingCompany.name}`)}
        amount={amount}
        currency={currency}
        tone={data && data.balance > 0.009 ? 'warn' : 'good'}
      />
      {invoices.length === 0 ? (
        <EmptyState
          icon="happy"
          title={t('Ești la zi', 'You’re all paid up')}
          message={t('Nu ai facturi neachitate către contabil.', 'No unpaid invoices from your accountant.')}
        />
      ) : (
        <>
          <SectionTitle title={t('Facturi neachitate', 'Unpaid invoices')} />
          <Card padded={false}>
            {invoices.map((inv, i) => (
              <View key={inv.id}>
                {i > 0 ? <Divider inset={60} /> : null}
                <ListRow
                  icon="receipt"
                  iconTone={inv.overdue ? 'danger' : 'warn'}
                  title={inv.invoiceNumber}
                  subtitle={t(`scadentă ${formatDate(inv.dueDate)}`, `due ${formatDate(inv.dueDate)}`)}
                  value={formatMoney(inv.outstanding, inv.currency)}
                  below={inv.overdue ? <Pill label={t('Restantă', 'Overdue')} tone="danger" /> : null}
                />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
