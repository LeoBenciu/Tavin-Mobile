import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, useGetDocumentsQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { TabScreen } from '@/components/LargeTitle';
import {
  Card,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  Loading,
  Pill,
  SearchField,
  Segmented,
  Txt,
} from '@/components/ui';
import { useT } from '@/i18n';
import { documentTypeLabel, uploadStatus } from '@/lib/domain';
import { formatDate, formatMoney, formatRelative } from '@/lib/format';
import { space } from '@/theme';

type Tab = 'inbox' | 'saved';
export default function DocumentsScreen() {
  const t = useT();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('inbox');
  const [query, setQuery] = useState('');

  // Extraction runs on the server; poll only while something is still processing.
  const { data: cached } = api.endpoints.getDocuments.useQueryState();
  const { data, isLoading, isFetching, error, refetch } = useGetDocumentsQuery(undefined, {
    pollingInterval: cached?.pendingUploads.some((u) => u.isProcessing) ? 8000 : 0,
    skipPollingIfUnfocused: true,
  });
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

  const counts = data?.stats;

  return (
    <TabScreen
      title={t('Documente', 'Documents')}
      refreshing={isFetching && !isLoading}
      onRefresh={refetch}>
      <Segmented
        value={tab}
        onChange={setTab}
        style={{ marginTop: space.xs }}
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
                    below={<Pill label={st.label} tone={st.tone} />}
                    onPress={() =>
                      router.push({ pathname: '/document', params: { kind: 'upload', id: String(u.id) } })
                    }
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
                  iconTone={d.isOutgoingInvoice ? 'good' : d.isIncomingInvoice ? 'accent' : 'neutral'}
                  title={d.name}
                  subtitle={meta}
                  value={d.documentTotal ? formatMoney(d.documentTotal, d.documentCurrency) : null}
                  below={
                    d.nirDocument ? <Pill label={t('NIR generat', 'NIR created')} tone="good" icon="checkmark" /> : null
                  }
                  onPress={() => router.push({ pathname: '/document', params: { kind: 'saved', id: String(d.id) } })}
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
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: space.md, marginBottom: space.lg },
  note: { textAlign: 'center', marginTop: space.md },
});
