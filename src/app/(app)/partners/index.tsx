import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useGetPartnersQuery, type PartnerKind } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { Screen } from '@/components/Screen';
import { Avatar, Card, Divider, EmptyState, ErrorState, Fab, ListRow, Loading, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { initials } from '@/lib/format';
import { radius, space, useColors } from '@/theme';

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
    <View style={{ flex: 1 }}>
      <Screen refreshing={isFetching && !isLoading} onRefresh={refetch} contentStyle={{ paddingBottom: 96 }}>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'clients', label: t('Clienți', 'Clients') },
            { value: 'suppliers', label: t('Furnizori', 'Suppliers') },
          ]}
        />
        <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Ionicons name="search" size={18} color={c.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('Caută după nume sau CUI', 'Search by name or tax ID')}
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
            icon="people-outline"
            title={kind === 'clients' ? t('Niciun client', 'No clients') : t('Niciun furnizor', 'No suppliers')}
            message={t(
              'Adaugă unul în câteva secunde, completat automat din CUI.',
              'Add one in seconds, autofilled from the tax ID.',
            )}
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
      <Fab
        icon="add"
        label={kind === 'clients' ? t('Client', 'Client') : t('Furnizor', 'Supplier')}
        onPress={() => router.push({ pathname: '/partners/edit', params: { kind } })}
      />
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
    marginVertical: space.md,
  },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15 },
});
