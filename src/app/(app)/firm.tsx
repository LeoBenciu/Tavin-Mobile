import { View } from 'react-native';

import { useGetFirmBalanceQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { useUser } from '@/auth/session';
import { Screen } from '@/components/Screen';
import { Card, Divider, EmptyState, ErrorState, ListRow, Loading, Pill, SectionTitle, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { formatDate, formatMoney } from '@/lib/format';
import { space } from '@/theme';

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
  return (
    <Screen refreshing={isFetching} onRefresh={refetch}>
      <Card>
        <Txt variant="caption" tone="muted">
          {t(`Datorat către ${user.accountingCompany.name}`, `Owed to ${user.accountingCompany.name}`)}
        </Txt>
        <Txt variant="display" tone={data && data.balance > 0.009 ? 'warn' : 'good'}>
          {formatMoney(data?.balance ?? 0, data?.currency)}
        </Txt>
      </Card>
      {invoices.length === 0 ? (
        <EmptyState
          icon="happy-outline"
          title={t('Ești la zi', 'You’re all paid up')}
          message={t('Nu ai facturi neachitate către contabil.', 'No unpaid invoices from your accountant.')}
        />
      ) : (
        <>
          <SectionTitle title={t('Facturi neachitate', 'Unpaid invoices')} />
          <Card padded={false}>
            {invoices.map((inv, i) => (
              <View key={inv.id}>
                {i > 0 ? <Divider inset={space.lg} /> : null}
                <ListRow
                  title={inv.invoiceNumber}
                  subtitle={t(`scadentă ${formatDate(inv.dueDate)}`, `due ${formatDate(inv.dueDate)}`)}
                  value={formatMoney(inv.outstanding, inv.currency)}
                  right={inv.overdue ? <Pill label={t('Restantă', 'Overdue')} tone="danger" /> : null}
                />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
