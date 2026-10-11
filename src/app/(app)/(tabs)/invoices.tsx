import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useGetInvoicesQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { IssuedInvoiceListItem } from '@/api/types';
import { Card, Chip, EmptyState, ErrorState, Fab, Loading, Pill, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { efacturaStatus, invoiceNumber, invoiceStatus, invoiceTypeLabel, isEfacturaDocument } from '@/lib/domain';
import { formatDate, formatMoney, formatMoneyShort } from '@/lib/format';
import { radius, space, useColors } from '@/theme';

const PAGE = 30;

export default function InvoicesScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const [status, setStatus] = useState<string | undefined>();
  const [invoiceType, setInvoiceType] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pages, setPages] = useState(1);

  useEffect(() => {
    const h = setTimeout(() => {
      setDebounced(search.trim());
      setPages(1);
    }, 400);
    return () => clearTimeout(h);
  }, [search]);

  const { data, isLoading, isFetching, error, refetch } = useGetInvoicesQuery({
    status,
    invoiceType,
    search: debounced || undefined,
    limit: PAGE * pages,
  });

  const statusFilters: { value?: string; label: string }[] = [
    { value: undefined, label: t('Toate', 'All') },
    { value: 'ISSUED', label: t('Emise', 'Issued') },
    { value: 'OVERDUE', label: t('Restante', 'Overdue') },
    { value: 'PARTIALLY_PAID', label: t('Parțial', 'Partly paid') },
    { value: 'PAID', label: t('Încasate', 'Paid') },
    { value: 'DRAFT', label: t('Ciorne', 'Drafts') },
  ];
  const typeFilters: { value?: string; label: string }[] = [
    { value: undefined, label: t('Toate tipurile', 'All types') },
    { value: 'REGULAR', label: t('Facturi', 'Invoices') },
    { value: 'PROFORMA', label: t('Proforme', 'Proformas') },
    { value: 'AVIZ', label: t('Avize', 'Delivery notes') },
    { value: 'CREDIT_NOTE', label: t('Storno', 'Credit notes') },
  ];

  const header = (
    <View>
      {data ? (
        <View style={styles.stats}>
          <Card style={styles.stat}>
            <Txt variant="caption" tone="muted">
              {t('De încasat', 'Outstanding')}
            </Txt>
            <Txt weight="700" tone="accent" numberOfLines={1} adjustsFontSizeToFit>
              {formatMoneyShort(data.stats.pendingAmount)}
            </Txt>
          </Card>
          <Card style={styles.stat}>
            <Txt variant="caption" tone="muted">
              {t('Restant', 'Overdue')}
            </Txt>
            <Txt
              weight="700"
              tone={data.stats.overdueAmount > 0 ? 'danger' : 'default'}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {formatMoneyShort(data.stats.overdueAmount)}
            </Txt>
          </Card>
          <Card style={styles.stat}>
            <Txt variant="caption" tone="muted">
              {t('Încasat', 'Collected')}
            </Txt>
            <Txt weight="700" tone="good" numberOfLines={1} adjustsFontSizeToFit>
              {formatMoneyShort(data.stats.paidAmount)}
            </Txt>
          </Card>
        </View>
      ) : null}
      <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('Caută client sau număr', 'Search client or number')}
          placeholderTextColor={c.muted}
          style={[styles.searchInput, { color: c.text }]}
          returnKeyType="search"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {statusFilters.map((f) => (
          <Chip
            key={f.label}
            label={f.label}
            active={status === f.value}
            onPress={() => {
              setStatus(f.value);
              setPages(1);
            }}
          />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {typeFilters.map((f) => (
          <Chip
            key={f.label}
            label={f.label}
            active={invoiceType === f.value}
            onPress={() => {
              setInvoiceType(f.value);
              setPages(1);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );

  const renderItem = ({ item }: { item: IssuedInvoiceListItem }) => {
    const st = invoiceStatus(t, item);
    const ef = efacturaStatus(t, item.efacturaStatus);
    const remaining = Math.max(0, item.total - item.paidAmount);
    return (
      <Card
        onPress={() => router.push({ pathname: '/invoices/[id]', params: { id: String(item.id) } })}
        style={styles.item}>
        <View style={styles.itemTop}>
          <View style={{ flex: 1 }}>
            <Txt weight="600" numberOfLines={1}>
              {item.clientName}
            </Txt>
            <Txt variant="small" tone="muted">
              {invoiceTypeLabel(t, item.invoiceType)} {invoiceNumber(item)} · {formatDate(item.issueDate)}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt weight="700">{formatMoney(item.total, item.currency)}</Txt>
            {remaining > 0.009 && item.paidAmount > 0 ? (
              <Txt variant="caption" tone="muted">
                {t(`rest ${formatMoney(remaining, item.currency)}`, `${formatMoney(remaining, item.currency)} left`)}
              </Txt>
            ) : null}
          </View>
        </View>
        <View style={styles.pills}>
          <Pill label={st.label} tone={st.tone} />
          {isEfacturaDocument(item.invoiceType) && item.status !== 'DRAFT' ? (
            <Pill label={ef.label} tone={ef.tone} icon={ef.icon} />
          ) : null}
          {item.status !== 'PAID' && item.status !== 'DRAFT' && item.status !== 'CANCELLED' ? (
            <Txt variant="caption" tone={item.status === 'OVERDUE' ? 'danger' : 'muted'} style={{ marginLeft: 'auto' }}>
              {t(`scadent ${formatDate(item.dueDate)}`, `due ${formatDate(item.dueDate)}`)}
            </Txt>
          ) : null}
        </View>
      </Card>
    );
  };

  const invoices = data?.invoices ?? [];
  const canLoadMore = !!data && invoices.length < data.total;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <FlatList
        data={invoices}
        keyExtractor={(i) => String(i.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading && pages === 1}
            onRefresh={refetch}
            tintColor={c.accent}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (canLoadMore && !isFetching) setPages((p) => p + 1);
        }}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={errorMessage(error)} onRetry={refetch} />
          ) : (
            <EmptyState
              icon="receipt-outline"
              title={t('Nicio factură aici', 'No invoices here')}
              message={t(
                'Emite o factură în câteva secunde, direct de pe telefon.',
                'Issue an invoice in seconds, right from your phone.',
              )}
              action={{
                label: t('Factură nouă', 'New invoice'),
                icon: 'add',
                onPress: () => router.push('/invoices/new'),
              }}
            />
          )
        }
        ListFooterComponent={canLoadMore ? <Loading /> : null}
      />
      <Fab icon="add" label={t('Factură', 'Invoice')} onPress={() => router.push('/invoices/new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 96 },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, padding: space.md, gap: 2 },
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
  chips: { gap: space.sm, paddingVertical: space.sm },
  item: { marginBottom: space.md, gap: space.sm },
  itemTop: { flexDirection: 'row', gap: space.md },
  pills: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
});
