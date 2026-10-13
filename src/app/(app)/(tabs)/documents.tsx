import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  api,
  useCancelUploadMutation,
  useDeleteSavedDocumentMutation,
  useGetDocumentsQuery,
  useLazyGetDocumentUrlQuery,
  useLazyGetPendingUploadUrlQuery,
  useRetryUploadMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { PendingUpload, SavedDocument } from '@/api/types';
import { TabScreen } from '@/components/LargeTitle';
import { ActionSheet, type SheetAction } from '@/components/Sheet';
import {
  Card,
  Divider,
  EmptyState,
  ErrorState,
  HeaderButton,
  ListRow,
  Loading,
  Pill,
  SearchField,
  Segmented,
  Tap,
  Txt,
} from '@/components/ui';
import { useT } from '@/i18n';
import { confirm, notify } from '@/lib/confirm';
import { documentTypeLabel, uploadStatus } from '@/lib/domain';
import { openUrl } from '@/lib/files';
import { formatDate, formatMoney, formatRelative } from '@/lib/format';
import { accentGlowStrong, radius, space, tileGradient } from '@/theme';

type Tab = 'inbox' | 'saved';
type Selected = { kind: 'pending'; item: PendingUpload } | { kind: 'saved'; item: SavedDocument } | null;

export default function DocumentsScreen() {
  const t = useT();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('inbox');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Selected>(null);

  // Extraction runs on the server; poll only while something is still processing.
  const { data: cached } = api.endpoints.getDocuments.useQueryState();
  const { data, isLoading, isFetching, error, refetch } = useGetDocumentsQuery(undefined, {
    pollingInterval: cached?.pendingUploads.some((u) => u.isProcessing) ? 8000 : 0,
    skipPollingIfUnfocused: true,
  });
  const [getPendingUrl] = useLazyGetPendingUploadUrlQuery();
  const [getDocUrl] = useLazyGetDocumentUrlQuery();
  const [retryUpload] = useRetryUploadMutation();
  const [cancelUpload] = useCancelUploadMutation();
  const [deleteSaved] = useDeleteSavedDocumentMutation();

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

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      notify(t('Eroare', 'Error'), errorMessage(e));
    }
  };

  const view = (s: NonNullable<Selected>) =>
    run(async () => {
      const res = s.kind === 'pending' ? await getPendingUrl(s.item.id).unwrap() : await getDocUrl(s.item.id).unwrap();
      await openUrl(res.url);
    });

  const actions: SheetAction[] = !selected
    ? []
    : selected.kind === 'pending'
      ? [
          { label: t('Vezi fișierul', 'View file'), icon: 'eye-outline', onPress: () => view(selected) },
          {
            label: t('Generează NIR', 'Create goods receipt (NIR)'),
            icon: 'clipboard-outline',
            hidden: !(selected.item.isIncomingInvoice && selected.item.isReady),
            onPress: () =>
              router.push({ pathname: '/nir', params: { source: 'upload', id: String(selected.item.id) } }),
          },
          {
            label: t('Reîncearcă procesarea', 'Retry processing'),
            icon: 'refresh',
            hidden: !selected.item.hasError,
            onPress: () => run(() => retryUpload(selected.item.id).unwrap()),
          },
          {
            label: t('Anulează încărcarea', 'Cancel upload'),
            icon: 'trash-outline',
            tone: 'danger',
            onPress: async () => {
              if (
                await confirm(t('Anulezi încărcarea?', 'Cancel this upload?'), selected.item.fileName, {
                  destructive: true,
                })
              ) {
                await run(() => cancelUpload(selected.item.id).unwrap());
              }
            },
          },
        ]
      : [
          { label: t('Vezi documentul', 'View document'), icon: 'eye-outline', onPress: () => view(selected) },
          {
            label: selected.item.nirDocument
              ? t('Deschide NIR', 'Open NIR')
              : t('Generează NIR', 'Create goods receipt (NIR)'),
            icon: 'clipboard-outline',
            hidden: !selected.item.isIncomingInvoice,
            onPress: () =>
              router.push({ pathname: '/nir', params: { source: 'invoice', id: String(selected.item.id) } }),
          },
          {
            label: t('Șterge documentul', 'Delete document'),
            icon: 'trash-outline',
            tone: 'danger',
            hidden: !!selected.item.isOutgoingInvoice,
            onPress: async () => {
              if (
                await confirm(
                  t('Ștergi documentul?', 'Delete this document?'),
                  t(
                    'Documentul dispare și din lista contabilului.',
                    'It will also disappear from your accountant’s list.',
                  ),
                  { destructive: true, confirmLabel: t('Șterge', 'Delete') },
                )
              ) {
                await run(() => deleteSaved(selected.item.id).unwrap());
              }
            },
          },
        ];

  const counts = data?.stats;

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
              `Încărcate${counts ? ` (${data!.pendingUploads.length})` : ''}`,
              `Uploaded${counts ? ` (${data!.pendingUploads.length})` : ''}`,
            ),
          },
          {
            value: 'saved',
            label: t(
              `Înregistrate${counts ? ` (${data!.savedDocuments.length})` : ''}`,
              `Booked${counts ? ` (${data!.savedDocuments.length})` : ''}`,
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
            title={t('Niciun document în lucru', 'Nothing in progress')}
            message={t(
              'Fotografiază facturi, bonuri sau extrase și le trimitem direct contabilului.',
              'Snap invoices, receipts or statements and we send them straight to your accountant.',
            )}
          />
        ) : (
          <Card padded={false}>
            {pending.map((u, i) => {
              const st = uploadStatus(t, u);
              return (
                <View key={u.id}>
                  {i > 0 ? <Divider inset={60} /> : null}
                  <ListRow
                    icon={u.contentType?.startsWith('image/') ? 'image' : 'document'}
                    iconTone={st.tone}
                    title={u.fileName}
                    subtitle={u.hasError && u.errorMessage ? u.errorMessage : formatRelative(u.createdAt)}
                    below={
                      <View style={styles.pills}>
                        <Pill label={st.label} tone={st.tone} />
                        {u.paidPersonally ? <Pill label={t('Plătit personal', 'Paid personally')} icon="wallet" /> : null}
                      </View>
                    }
                    onPress={() => setSelected({ kind: 'pending', item: u })}
                    chevron={false}
                  />
                </View>
              );
            })}
          </Card>
        )
      ) : saved.length === 0 ? (
        <EmptyState
          icon="folder-open"
          title={t('Niciun document înregistrat', 'No booked documents')}
          message={t(
            'Documentele apar aici după ce le procesează contabilul.',
            'Documents show up here once your accountant books them.',
          )}
        />
      ) : (
        <Card padded={false}>
          {saved.map((d, i) => {
            const meta = [
              documentTypeLabel(t, d.type),
              d.documentInvoiceNumber,
              d.documentClientName,
              formatDate(d.documentIssueDate ?? d.createdAt),
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <View key={d.id}>
                {i > 0 ? <Divider inset={60} /> : null}
                <ListRow
                  icon={d.isIncomingInvoice ? 'arrow-down' : d.isOutgoingInvoice ? 'arrow-up' : 'document-text'}
                  iconTone={d.isIncomingInvoice ? 'warn' : d.isOutgoingInvoice ? 'good' : 'neutral'}
                  title={d.name}
                  subtitle={meta}
                  value={d.documentTotal ? formatMoney(d.documentTotal, d.documentCurrency) : null}
                  below={
                    d.nirDocument || d.paidPersonally ? (
                      <View style={styles.pills}>
                        {d.nirDocument ? <Pill label={t('NIR generat', 'NIR created')} tone="good" icon="checkmark" /> : null}
                        {d.paidPersonally ? (
                          <Pill
                            label={d.paidByName ? t(`Decont · ${d.paidByName}`, `Expense report · ${d.paidByName}`) : t('Decont', 'Expense report')}
                            icon="wallet"
                          />
                        ) : null}
                      </View>
                    ) : null
                  }
                  onPress={() => setSelected({ kind: 'saved', item: d })}
                  chevron={false}
                />
              </View>
            );
          })}
        </Card>
      )}
      {data && tab === 'inbox' && pending.some((u) => u.isProcessing) ? (
        <Txt variant="footnote" tone="muted" style={styles.note}>
          {t(
            'Extragem automat datele — durează de obicei sub un minut.',
            'We extract the data automatically — usually under a minute.',
          )}
        </Txt>
      ) : null}
      <ActionSheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? (selected.kind === 'pending' ? selected.item.fileName : selected.item.name) : undefined}
        actions={actions}
      />
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
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
