import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useGetArticlesQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { Screen } from '@/components/Screen';
import { Card, Divider, EmptyState, ErrorState, ListRow, Loading, Pill, SearchField } from '@/components/ui';
import { useT } from '@/i18n';
import { articleTypeLabel, articleVatLabel, isServiceType, unitLabel } from '@/lib/domain';
import { space, useColors } from '@/theme';

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
    <Screen refreshing={isFetching && !isLoading} onRefresh={refetch}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/articles/edit')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('Articol nou', 'New item')}>
              <Ionicons name="add" size={28} color={c.accentText} />
            </Pressable>
          ),
        }}
      />
      <SearchField
        value={q}
        onChangeText={setQ}
        placeholder={t('Caută articol sau cod', 'Search item or code')}
        style={styles.search}
      />
      {isLoading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="pricetags"
          title={t('Niciun articol', 'No items')}
          message={t(
            'Salvează produsele și serviciile pe care le facturezi des.',
            'Save the products and services you invoice often.',
          )}
          action={{ label: t('Articol nou', 'New item'), icon: 'add', onPress: () => router.push('/articles/edit') }}
        />
      ) : (
        <Card padded={false}>
          {list.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Divider inset={60} /> : null}
              <ListRow
                icon={isServiceType(a.type) ? 'construct' : 'cube'}
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
  );
}

const styles = StyleSheet.create({
  search: { marginBottom: space.lg },
});
