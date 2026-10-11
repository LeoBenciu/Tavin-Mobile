import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useGetBankQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { Screen } from '@/components/Screen';
import {
  Card,
  Chip,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  Loading,
  Pill,
  SectionTitle,
  Txt,
} from '@/components/ui';
import { useT } from '@/i18n';
import { formatDate, formatMoney, formatRelative } from '@/lib/format';
import { space } from '@/theme';

export default function BankScreen() {
  const t = useT();
  const { data, isLoading, isFetching, error, refetch } = useGetBankQuery();
  const [accountId, setAccountId] = useState<number | null>(null);

  const transactions = useMemo(
    () => (data?.transactions ?? []).filter((x) => accountId == null || x.bankAccountId === accountId),
    [data, accountId],
  );

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
  if (!data || data.accounts.length === 0) {
    return (
      <Screen refreshing={isFetching} onRefresh={refetch}>
        <EmptyState
          icon="card-outline"
          title={t('Niciun cont bancar', 'No bank accounts')}
          message={t(
            'Conturile apar aici după ce încarci extrase sau le conectezi prin Open Banking pe tavin.eu.',
            'Accounts show up once you upload statements or connect them through Open Banking on tavin.eu.',
          )}
        />
      </Screen>
    );
  }

  return (
    <Screen refreshing={isFetching} onRefresh={refetch}>
      <Card>
        <Txt variant="caption" tone="muted">
          {t('Sold total', 'Total balance')}
        </Txt>
        <Txt variant="display">{formatMoney(data.totalBalance)}</Txt>
      </Card>

      <SectionTitle title={t('Conturi', 'Accounts')} />
      <Card padded={false}>
        {data.accounts.map((a, i) => (
          <View key={a.id}>
            {i > 0 ? <Divider inset={space.lg} /> : null}
            <ListRow
              icon="card-outline"
              title={a.name || a.bank}
              subtitle={`${a.iban}${a.connected && a.lastSync ? ` · ${t('sincronizat', 'synced')} ${formatRelative(a.lastSync)}` : ''}`}
              value={formatMoney(a.balance, a.currency)}
              right={a.connected ? <Pill label="Open Banking" tone="good" /> : null}
            />
          </View>
        ))}
      </Card>

      <SectionTitle title={t('Tranzacții', 'Transactions')} />
      {data.accounts.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label={t('Toate', 'All')} active={accountId == null} onPress={() => setAccountId(null)} />
          {data.accounts.map((a) => (
            <Chip key={a.id} label={a.name || a.bank} active={accountId === a.id} onPress={() => setAccountId(a.id)} />
          ))}
        </ScrollView>
      ) : null}
      {transactions.length === 0 ? (
        <Txt tone="muted" style={{ textAlign: 'center', padding: space.xl }}>
          {t('Nicio tranzacție.', 'No transactions.')}
        </Txt>
      ) : (
        <Card padded={false}>
          {transactions.slice(0, 100).map((x, i) => (
            <View key={x.id}>
              {i > 0 ? <Divider inset={space.lg} /> : null}
              <ListRow
                icon={x.type === 'credit' ? 'arrow-down' : 'arrow-up'}
                iconTone={x.type === 'credit' ? 'good' : 'neutral'}
                title={x.description || t('Tranzacție', 'Transaction')}
                subtitle={formatDate(x.date)}
                value={`${x.type === 'credit' ? '+' : '−'}${formatMoney(Math.abs(x.amount))}`}
                valueTone={x.type === 'credit' ? 'good' : 'default'}
                numberOfLines={2}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm, paddingBottom: space.md },
});
