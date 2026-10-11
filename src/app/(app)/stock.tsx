import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useGetStockBalancesQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { Screen } from '@/components/Screen';
import { Card, Chip, Divider, EmptyState, ErrorState, ListRow, Loading, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { unitLabel } from '@/lib/domain';
import { formatAmount, formatMoney } from '@/lib/format';
import { radius, space, useColors } from '@/theme';

export default function StockScreen() {
  const c = useColors();
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
          icon="cube-outline"
          title={t('Niciun stoc', 'No stock')}
          message={t(
            'Stocul apare după primele NIR-uri sau importul inițial.',
            'Stock shows up after your first goods receipts (NIR) or the initial import.',
          )}
        />
      ) : (
        <>
          <Card>
            <Txt variant="caption" tone="muted">
              {t('Valoare stoc (cost mediu)', 'Stock value (average cost)')}
            </Txt>
            <Txt variant="heading">{formatMoney(totalValue)}</Txt>
          </Card>
          <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Ionicons name="search" size={18} color={c.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('Caută produs', 'Search product')}
              placeholderTextColor={c.muted}
              style={[styles.searchInput, { color: c.text }]}
            />
          </View>
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
          <Card padded={false}>
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    marginTop: space.md,
  },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15 },
  // A horizontal ScrollView must not grow vertically inside the page column.
  chipScroll: { flexGrow: 0 },
  chips: { gap: space.sm, paddingTop: space.md },
});
