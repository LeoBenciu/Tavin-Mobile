import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGetInvoicesQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { IssuedInvoiceListItem } from '@/api/types';
import { LARGE_TITLE_HEIGHT, LargeTitle, NAV_BAR_HEIGHT, NavBar, useCollapsingTitle } from '@/components/LargeTitle';
import { useTabBarSpace } from '@/components/TabBar';
import {
  Chip,
  EmptyState,
  ErrorState,
  HeaderButton,
  Loading,
  Pill,
  SearchField,
  StatStrip,
  Txt,
} from '@/components/ui';
import { useT } from '@/i18n';
import { efacturaStatus, invoiceNumber, invoiceStatus, invoiceTypeLabel, isEfacturaDocument } from '@/lib/domain';
import { formatDate, formatMoney, formatMoneyShort } from '@/lib/format';
import { radius, space, useColors } from '@/theme';

const PAGE = 30;

export default function InvoicesScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { scrollY, onScroll } = useCollapsingTitle();
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

  const invoices = data?.invoices ?? [];
  const canLoadMore = !!data && invoices.length < data.total;

  const header = (
    <View>
      <LargeTitle title={t('Facturi', 'Invoices')} />
      {data ? (
        <StatStrip
          items={[
            {
              label: t('De încasat', 'Outstanding'),
              value: formatMoneyShort(data.stats.pendingAmount),
              tone: 'accent',
            },
            {
              label: t('Restant', 'Overdue'),
              value: formatMoneyShort(data.stats.overdueAmount),
              tone: data.stats.overdueAmount > 0 ? 'danger' : 'default',
            },
            { label: t('Încasat', 'Collected'), value: formatMoneyShort(data.stats.paidAmount), tone: 'good' },
          ]}
        />
      ) : null}
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder={t('Caută client sau număr', 'Search client or number')}
        style={{ marginTop: space.md }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chips}>
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={[styles.chips, { paddingTop: 0, paddingBottom: space.md }]}>
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

  const renderItem = ({ item, index }: { item: IssuedInvoiceListItem; index: number }) => {
    const st = invoiceStatus(t, item);
    const ef = efacturaStatus(t, item.efacturaStatus);
    const remaining = Math.max(0, item.total - item.paidAmount);
    const first = index === 0;
    const last = index === invoices.length - 1;
    const showDue = item.status !== 'PAID' && item.status !== 'DRAFT' && item.status !== 'CANCELLED';
    const showSpv = isEfacturaDocument(item.invoiceType) && item.status !== 'DRAFT';
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/invoices/[id]', params: { id: String(item.id) } })}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? c.surfaceAlt : c.surface },
          first && styles.rowFirst,
          last && styles.rowLast,
        ]}>
        {!first ? <View style={[styles.separator, { backgroundColor: c.separator }]} /> : null}
        <View style={styles.rowLine}>
          <Txt weight="600" numberOfLines={1} style={{ flex: 1 }}>
            {item.clientName}
          </Txt>
          <Txt weight="700" tabular>
            {formatMoney(item.total, item.currency)}
          </Txt>
        </View>
        <View style={styles.rowLine}>
          <Txt variant="small" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
            {invoiceTypeLabel(t, item.invoiceType)} {invoiceNumber(item)} · {formatDate(item.issueDate)}
          </Txt>
          <Pill label={st.label} tone={st.tone} />
        </View>
        {showSpv || showDue || (remaining > 0.009 && item.paidAmount > 0) ? (
          <View style={styles.rowLine}>
            {showSpv ? <Pill label={ef.label} tone={ef.tone} icon={ef.icon} /> : <View />}
            <Txt
              variant="caption"
              tone={item.status === 'OVERDUE' ? 'danger' : 'muted'}
              weight={item.status === 'OVERDUE' ? '600' : '400'}>
              {remaining > 0.009 && item.paidAmount > 0
                ? t(`rest ${formatMoney(remaining, item.currency)}`, `${formatMoney(remaining, item.currency)} left`)
                : showDue
                  ? t(`scadent ${formatDate(item.dueDate)}`, `due ${formatDate(item.dueDate)}`)
                  : ''}
            </Txt>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Animated.FlatList
        style={{ marginTop: insets.top }}
        data={invoices}
        keyExtractor={(i) => String(i.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.list, { paddingBottom: tabSpace + space.xl }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading && pages === 1}
            onRefresh={refetch}
            tintColor={c.muted}
            colors={[c.accent]}
            progressViewOffset={NAV_BAR_HEIGHT}
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
              icon="receipt"
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
      <NavBar
        title={t('Facturi', 'Invoices')}
        scrollY={scrollY}
        showAt={LARGE_TITLE_HEIGHT}
        right={
          <HeaderButton
            icon="add"
            tone="accent"
            label={t('Factură nouă', 'New invoice')}
            onPress={() => router.push('/invoices/new')}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, paddingTop: NAV_BAR_HEIGHT },
  // A horizontal ScrollView must not grow vertically inside the page column.
  chipScroll: { flexGrow: 0, marginHorizontal: -space.lg },
  chips: { gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.lg },
  row: { paddingHorizontal: space.lg, paddingVertical: 12, gap: 5 },
  rowFirst: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  rowLast: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  separator: { position: 'absolute', top: 0, left: space.lg, right: 0, height: StyleSheet.hairlineWidth },
  rowLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
});
