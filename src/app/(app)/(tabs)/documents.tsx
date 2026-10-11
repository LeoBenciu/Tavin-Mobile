import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, useGetDocumentsQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { TabScreen } from '@/components/LargeTitle';
import {
  EmptyState,
  ErrorState,
  FormGroup,
  HeaderButton,
  ListRow,
  Loading,
  SearchField,
  SectionTitle,
  Segmented,
  Tap,
  Txt,
} from '@/components/ui';
import {
  folderSummary,
  groupByMonth,
  PendingRow,
  SavedRow,
  useDocumentActions,
  useMonthTitle,
} from '@/features/documents';
import { useT } from '@/i18n';
import { isoDay } from '@/lib/format';
import { accentGlowStrong, radius, space, tileGradient } from '@/theme';

type Tab = 'inbox' | 'saved';

export default function DocumentsScreen() {
  const t = useT();
  const router = useRouter();
  const monthName = useMonthTitle();
  const [tabChoice, setTab] = useState<Tab | null>(null);
  const [query, setQuery] = useState('');
  const { open, sheet } = useDocumentActions();

  // Extraction runs on the server; poll only while something is still processing.
  const { data: cached } = api.endpoints.getDocuments.useQueryState();
  const { data, isLoading, isFetching, error, refetch } = useGetDocumentsQuery(undefined, {
    pollingInterval: cached?.pendingUploads.some((u) => u.isProcessing) ? 8000 : 0,
    skipPollingIfUnfocused: true,
  });

  // With nothing in progress, open on the month folders.
  const tab: Tab =
    tabChoice ?? (data && data.pendingUploads.length === 0 && data.savedDocuments.length > 0 ? 'saved' : 'inbox');

  const needle = query.trim().toLowerCase();
  const pending = useMemo(
    () => (data?.pendingUploads ?? []).filter((u) => !needle || u.fileName.toLowerCase().includes(needle)),
    [data, needle],
  );
  const saved = useMemo(
    () =>
      (data?.savedDocuments ?? []).filter(
        (d) =>
          !needle ||
          `${d.name} ${d.documentInvoiceNumber ?? ''} ${d.documentClientName ?? ''}`.toLowerCase().includes(needle),
      ),
    [data, needle],
  );
  const folders = useMemo(() => groupByMonth(saved), [saved]);
  const years = useMemo(() => [...new Set(folders.map((f) => f.year))], [folders]);
  const currentMonth = isoDay().slice(0, 7);

  return (
    <TabScreen
      title={t('Documente', 'Documents')}
      refreshing={isFetching && !isLoading}
      onRefresh={refetch}
      actions={
        <HeaderButton icon="camera" tone="accent" label={t('Scanează', 'Scan')} onPress={() => router.push('/scan')} />
      }>
      <SnapTile onPress={() => router.push('/scan')} />
      <Segmented
        value={tab}
        onChange={setTab}
        style={{ marginTop: space.lg }}
        options={[
          {
            value: 'inbox',
            label: t(
              `În lucru${data ? ` (${data.pendingUploads.length})` : ''}`,
              `In progress${data ? ` (${data.pendingUploads.length})` : ''}`,
            ),
          },
          {
            value: 'saved',
            label: t(
              `Înregistrate${data ? ` (${data.savedDocuments.length})` : ''}`,
              `Booked${data ? ` (${data.savedDocuments.length})` : ''}`,
            ),
          },
        ]}
      />
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t('Caută nume, număr, partener', 'Search name, number, partner')}
        style={styles.search}
      />

      {isLoading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : tab === 'inbox' ? (
        pending.length === 0 ? (
          <EmptyState
            icon="cloud-upload"
            title={needle ? t('Niciun rezultat', 'No results') : t('Niciun document în lucru', 'Nothing in progress')}
            message={
              needle
                ? undefined
                : t(
                    'Fotografiază facturi, bonuri sau extrase și le trimitem direct contabilului. După ce le înregistrează, le găsești pe luni, la „Înregistrate”.',
                    'Snap invoices, receipts or statements and we send them straight to your accountant. Once booked, you find them by month under “Booked”.',
                  )
            }
          />
        ) : (
          <FormGroup inset={60}>
            {pending.map((u) => (
              <PendingRow key={u.id} item={u} onPress={() => open({ kind: 'pending', item: u })} />
            ))}
          </FormGroup>
        )
      ) : saved.length === 0 ? (
        <EmptyState
          icon="folder-open"
          title={needle ? t('Niciun rezultat', 'No results') : t('Niciun document înregistrat', 'No booked documents')}
          message={
            needle
              ? undefined
              : t(
                  'Documentele apar aici, pe luni, după ce le înregistrează contabilul.',
                  'Documents show up here, by month, once your accountant books them.',
                )
          }
        />
      ) : needle ? (
        // Searching looks across every month at once.
        <FormGroup inset={60}>
          {saved.map((d) => (
            <SavedRow key={d.id} item={d} onPress={() => open({ kind: 'saved', item: d })} />
          ))}
        </FormGroup>
      ) : (
        years.map((year) => (
          <View key={year}>
            <SectionTitle title={String(year)} size="small" />
            <FormGroup inset={60}>
              {folders
                .filter((f) => f.year === year)
                .map((f) => (
                  <ListRow
                    key={f.key}
                    icon={f.key === currentMonth ? 'folder-open' : 'folder'}
                    iconTone="accent"
                    solid
                    title={monthName(f.key)}
                    subtitle={folderSummary(t, f.docs)}
                    right={
                      <Txt tone="muted" tabular>
                        {f.docs.length}
                      </Txt>
                    }
                    onPress={() => router.push({ pathname: '/folder', params: { month: f.key } })}
                  />
                ))}
            </FormGroup>
          </View>
        ))
      )}
      {data && tab === 'inbox' && pending.some((u) => u.isProcessing) ? (
        <Txt variant="footnote" tone="muted" style={styles.note}>
          {t(
            'Extragem automat datele — durează de obicei sub un minut.',
            'We extract the data automatically — usually under a minute.',
          )}
        </Txt>
      ) : null}
      {sheet}
    </TabScreen>
  );
}

/** "Snap a receipt" — the indigo tile from the landing page's phone (.lp-portal-snap). */
function SnapTile({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <Tap onPress={onPress} scaleTo={0.98} style={[styles.snap, tileGradient('accent', 135)]} accessibilityRole="button">
      <View style={styles.snapIcon}>
        <Ionicons name="camera" size={22} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.snapTitle}>{t('Fă o poză la un bon', 'Snap a receipt')}</Text>
        <Text style={styles.snapText}>
          {t(
            'Ajunge direct la contabil, iar datele se extrag singure',
            'It goes straight to your accountant, data read for you',
          )}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.8)" />
    </Tap>
  );
}

const styles = StyleSheet.create({
  snap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    boxShadow: accentGlowStrong,
  },
  snapIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  snapTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  snapText: { color: '#DFE4FF', fontSize: 13, lineHeight: 18, marginTop: 1 },
  search: { marginTop: space.md, marginBottom: space.lg },
  note: { textAlign: 'center', marginTop: space.md },
});
