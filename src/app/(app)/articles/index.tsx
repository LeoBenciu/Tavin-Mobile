import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useGetArticlesQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { Screen } from '@/components/Screen';
import { Card, Divider, EmptyState, ErrorState, Fab, ListRow, Loading, Pill } from '@/components/ui';
import { useT } from '@/i18n';
import { articleTypeLabel, articleVatLabel, isServiceType, unitLabel } from '@/lib/domain';
import { radius, space, useColors } from '@/theme';

export default function ArticlesScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState('');
  const { data, isLoading, isFetching, error, refetch } = useGetArticlesQuery();

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...(data ?? [])]
      .filter((a) => !needle || `${a.name} ${a.code}`.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }, [data, q]);

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={isFetching && !isLoading} onRefresh={refetch} contentStyle={{ paddingBottom: 96 }}>
        <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Ionicons name="search" size={18} color={c.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('Caută articol sau cod', 'Search item or code')}
            placeholderTextColor={c.muted}
            style={[styles.searchInput, { color: c.text }]}
          />
        </View>
        {isLoading ? (
          <Loading />
        ) : error && !data ? (
          <ErrorState message={errorMessage(error)} onRetry={refetch} />
        ) : list.length === 0 ? (
          <EmptyState
            icon="pricetags-outline"
            title={t('Niciun articol', 'No items')}
            message={t(
              'Salvează produsele și serviciile pe care le facturezi des.',
              'Save the products and services you invoice often.',
            )}
          />
        ) : (
          <Card padded={false}>
            {list.map((a, i) => (
              <View key={a.id}>
                {i > 0 ? <Divider inset={64} /> : null}
                <ListRow
                  icon={isServiceType(a.type) ? 'construct-outline' : 'cube-outline'}
                  iconTone={isServiceType(a.type) ? 'neutral' : 'accent'}
                  title={a.name}
                  subtitle={[a.code, articleTypeLabel(t, a.type), unitLabel(t, a.unitOfMeasure)]
                    .filter(Boolean)
                    .join(' · ')}
                  right={<Pill label={`TVA ${articleVatLabel(a.vat)}`} />}
                  onPress={() => router.push({ pathname: '/articles/edit', params: { id: String(a.id) } })}
                />
              </View>
            ))}
          </Card>
        )}
      </Screen>
      <Fab icon="add" label={t('Articol', 'Item')} onPress={() => router.push('/articles/edit')} />
    </View>
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
    marginBottom: space.md,
  },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15 },
});
