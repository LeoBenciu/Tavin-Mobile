import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useGetStockBalancesQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { splitMoney } from '@/components/charts';
import { Screen } from '@/components/Screen';
import {
  Amount,
  Card,
  Chip,
  Divider,
  EmptyState,
  ErrorState,
  IconTile,
  ListRow,
  Loading,
  SearchField,
  Txt,
} from '@/components/ui';
import { useT } from '@/i18n';
import { unitLabel } from '@/lib/domain';
import { formatAmount, formatMoney } from '@/lib/format';
import { space } from '@/theme';

export default function StockScreen() {
  const t = useT();
  const [q, setQ] = useState('');
  const [managementId, setManagementId] = useState<number | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useGetStockBalancesQuery();

  const managements = useMemo(() => {
    const map = new Map<number, string>();
    (data ?? []).forEach((b) => map.set(b.management.id, b.management.name || b.management.code));
    return [...map.entries()];
  }, [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? [])
      .filter((b) => managementId == null || b.managementId === managementId)
      .filter((b) => !needle || `${b.article.name} ${b.article.code}`.toLowerCase().includes(needle))
      .sort((a, b) => a.article.name.localeCompare(b.article.name, 'ro'));
  }, [data, q, managementId]);

  const totalValue = rows.reduce((s, b) => s + Number(b.totalValue || 0), 0);

  return (
    <Screen refreshing={isFetching && !isLoading} onRefresh={refetch}>
      {isLoading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="cube"
          title={t('Niciun stoc', 'No stock')}
          message={t(
            'Stocul apare după primele NIR-uri sau importul inițial.',
            'Stock shows up after your first goods receipts (NIR) or the initial import.',
          )}
        />
      ) : (
        <>
          <Card style={styles.summary}>
            <IconTile icon="cube" tone="warn" solid size={44} />
            <View style={{ flex: 1 }}>
              <Txt variant="footnote" tone="muted" weight="500">
                {t('Valoare stoc (cost mediu)', 'Stock value (average cost)')}
              </Txt>
              <Amount value={splitMoney(formatMoney(totalValue))[0]} currency="RON" size="heading" />
            </View>
          </Card>
          <SearchField
            value={q}
            onChangeText={setQ}
            placeholder={t('Caută produs', 'Search product')}
            style={styles.search}
          />
          {managements.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chips}>
              <Chip
                label={t('Toate gestiunile', 'All warehouses')}
                active={managementId == null}
                onPress={() => setManagementId(null)}
              />
              {managements.map(([mid, name]) => (
                <Chip key={mid} label={name} active={managementId === mid} onPress={() => setManagementId(mid)} />
              ))}
            </ScrollView>
          ) : null}
          <Card padded={false} style={{ marginTop: space.md }}>
            {rows.map((b, i) => {
              const qty = Number(b.quantity);
              return (
                <View key={b.id}>
                  {i > 0 ? <Divider inset={space.lg} /> : null}
                  <ListRow
                    title={b.article.name}
                    subtitle={`${b.article.code} · ${b.management.name || b.management.code} · ${formatMoney(b.totalValue)}`}
                    value={`${formatAmount(qty, qty % 1 === 0 ? 0 : 2)} ${unitLabel(t, b.article.unitOfMeasure)}`}
                    valueTone={qty <= 0 ? 'danger' : undefined}
                  />
                </View>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  search: { marginTop: space.lg },
  // A horizontal ScrollView must not grow vertically inside the page column.
  chipScroll: { flexGrow: 0, marginHorizontal: -space.lg },
  chips: { gap: space.sm, paddingTop: space.md, paddingHorizontal: space.lg },
});
