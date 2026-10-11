import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useGetPartnersQuery, type PartnerKind } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { Screen } from '@/components/Screen';
import {
  Avatar,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  Loading,
  SearchField,
  Segmented,
} from '@/components/ui';
import { useT } from '@/i18n';
import { initials } from '@/lib/format';
import { space, useColors } from '@/theme';

export default function PartnersScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const [kind, setKind] = useState<PartnerKind>('clients');
  const [q, setQ] = useState('');
  const { data, isLoading, isFetching, error, refetch } = useGetPartnersQuery(kind);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...(data ?? [])]
      .filter((p) => !needle || `${p.name} ${p.ein ?? ''} ${p.localitate ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }, [data, q]);

  return (
    <Screen refreshing={isFetching && !isLoading} onRefresh={refetch}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/partners/edit', params: { kind } })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={
                kind === 'clients' ? t('Client nou', 'New client') : t('Furnizor nou', 'New supplier')
              }>
              <Ionicons name="add" size={28} color={c.accentText} />
            </Pressable>
          ),
        }}
      />
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'clients', label: t('Clienți', 'Clients') },
          { value: 'suppliers', label: t('Furnizori', 'Suppliers') },
        ]}
      />
      <SearchField
        value={q}
        onChangeText={setQ}
        placeholder={t('Caută după nume sau CUI', 'Search by name or tax ID')}
        style={styles.search}
      />
      {isLoading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="people"
          title={kind === 'clients' ? t('Niciun client', 'No clients') : t('Niciun furnizor', 'No suppliers')}
          message={t(
            'Adaugă unul în câteva secunde, completat automat din CUI.',
            'Add one in seconds, autofilled from the tax ID.',
          )}
          action={{
            label: kind === 'clients' ? t('Client nou', 'New client') : t('Furnizor nou', 'New supplier'),
            icon: 'add',
            onPress: () => router.push({ pathname: '/partners/edit', params: { kind } }),
          }}
        />
      ) : (
        <Card padded={false}>
          {list.map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <Divider inset={64} /> : null}
              <ListRow
                title={p.name}
                subtitle={[p.ein, p.localitate, p.email].filter(Boolean).join(' · ')}
                leading={<Avatar text={initials(p.name)} size={36} />}
                onPress={() => router.push({ pathname: '/partners/edit', params: { kind, id: String(p.id) } })}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: space.md, marginBottom: space.lg },
});
