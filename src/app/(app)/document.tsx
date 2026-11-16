import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  useCancelUploadMutation,
  useDeleteSavedDocumentMutation,
  useGetDocumentsQuery,
  useLazyGetDocumentUrlQuery,
  useLazyGetPendingUploadUrlQuery,
  useRetryUploadMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { Screen } from '@/components/Screen';
import {
  Banner,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  IconTile,
  ListRow,
  Loading,
  Pill,
  SectionTitle,
  Steps,
  Txt,
} from '@/components/ui';
import { useT } from '@/i18n';
import { confirm, notify } from '@/lib/confirm';
import { documentTypeLabel, uploadStatus } from '@/lib/domain';
import { openUrl } from '@/lib/files';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { closeTo } from '@/lib/navigation';
import { space } from '@/theme';

/**
 * One document: where it is on its way to the books, what was read from it, and what can
 * be done with it. `kind` is "upload" (still with Tavin / the accountant) or "saved" (booked).
 */
export default function DocumentScreen() {
  const t = useT();
  const router = useRouter();
  const { kind, id } = useLocalSearchParams<{ kind: 'upload' | 'saved'; id: string }>();
  const { data, isLoading, error, refetch, isFetching } = useGetDocumentsQuery(undefined, {
    pollingInterval: 8000,
    skipPollingIfUnfocused: true,
  });
  const [getPendingUrl] = useLazyGetPendingUploadUrlQuery();
  const [getDocUrl] = useLazyGetDocumentUrlQuery();
  const [retryUpload] = useRetryUploadMutation();
  const [cancelUpload] = useCancelUploadMutation();
  const [deleteSaved] = useDeleteSavedDocumentMutation();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      notify(t('Nu a mers', 'That didn’t work'), errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <Loading />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  const upload = kind === 'upload' ? data?.pendingUploads.find((u) => String(u.id) === id) : undefined;
  const saved = kind === 'saved' ? data?.savedDocuments.find((d) => String(d.id) === id) : undefined;

  if (!upload && !saved) {
    return (
      <EmptyState
        icon="document-text"
        title={t('Documentul nu mai e aici', 'This document is gone')}
        message={t(
          'Poate a fost înregistrat de contabil sau șters. Îl găsești în lista de documente.',
          'Your accountant may have booked or removed it. Look for it in your documents.',
        )}
        action={{ label: t('Înapoi la documente', 'Back to documents'), onPress: () => closeTo(router, '/documents') }}
      />
    );
  }

  const view = () =>
    run('view', async () => {
      const res = upload ? await getPendingUrl(upload.id).unwrap() : await getDocUrl(saved!.id).unwrap();
      await openUrl(res.url);
    });

  if (upload) {
    const st = uploadStatus(t, upload);
    return (
      <Screen
        refreshing={isFetching}
        onRefresh={refetch}
        footer={
          <Button
            title={t('Vezi fișierul', 'View file')}
            icon="eye-outline"
            variant="secondary"
            loading={busy === 'view'}
            onPress={view}
          />
        }>
        <Stack.Screen options={{ title: t('Document trimis', 'Sent document') }} />
        <Card>
          <View style={styles.head}>
            <IconTile icon={upload.contentType?.startsWith('image/') ? 'image' : 'document'} tone="accent" size={48} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt variant="title" weight="700" numberOfLines={2}>
                {upload.fileName}
              </Txt>
              <Pill label={st.label} tone={st.tone} />
            </View>
          </View>
          <View style={{ height: space.lg }} />
          <Steps
            items={[
              { label: t('Trimis', 'Sent'), note: formatDateTime(upload.createdAt), done: true },
              { label: t('Citit automat', 'Read automatically'), done: upload.isReady },
              { label: t('Înregistrat', 'Booked'), note: t('de contabil', 'by your accountant'), done: false },
            ]}
          />
        </Card>

        {upload.hasError ? (
          <View style={{ marginTop: space.md }}>
            <Banner
              tone="danger"
              icon="alert-circle"
              title={t('Nu am putut citi documentul', 'We couldn’t read this document')}
              message={
                upload.errorMessage ??
                t(
                  'Încearcă din nou sau refă poza, cu tot documentul în cadru.',
                  'Try again, or retake the photo with the whole page in frame.',
                )
              }
            />
          </View>
        ) : (
          <Txt variant="footnote" tone="muted" style={styles.hint}>
            {upload.isReady
              ? t(
                  'Datele sunt citite. Contabilul le verifică înainte de înregistrare; nu trebuie să corectezi nimic.',
                  'The data has been read. Your accountant checks it before booking; you don’t need to correct anything.',
                )
              : t(
                  'Extragem automat datele — durează de obicei sub un minut.',
                  'We extract the data automatically — usually under a minute.',
                )}
          </Txt>
        )}

        <SectionTitle title={t('Acțiuni', 'Actions')} size="small" />
        <Card padded={false}>
          {upload.hasError ? (
            <>
              <ListRow
                icon="refresh"
                title={t('Reîncearcă procesarea', 'Retry processing')}
                onPress={() => run('retry', () => retryUpload(upload.id).unwrap())}
              />
              <Divider inset={60} />
              <ListRow icon="camera" title={t('Refă poza', 'Retake the photo')} onPress={() => router.push('/scan')} />
              <Divider inset={60} />
            </>
          ) : null}
          {upload.isIncomingInvoice && upload.isReady ? (
            <>
              <ListRow
                icon="clipboard"
                title={t('Generează NIR', 'Create goods receipt (NIR)')}
                onPress={() => router.push({ pathname: '/nir', params: { source: 'upload', id: String(upload.id) } })}
              />
              <Divider inset={60} />
            </>
          ) : null}
          <ListRow
            icon="chatbubble-ellipses"
            title={t('Întreabă contabilul', 'Ask your accountant')}
            onPress={() => router.push('/messages')}
          />
          <Divider inset={60} />
          <ListRow
            icon="trash-outline"
            iconTone="danger"
            title={t('Anulează încărcarea', 'Cancel upload')}
            titleTone="danger"
            chevron={false}
            onPress={async () => {
              if (
                await confirm(t('Anulezi încărcarea?', 'Cancel this upload?'), upload.fileName, { destructive: true })
              ) {
                await run('cancel', async () => {
                  await cancelUpload(upload.id).unwrap();
                  closeTo(router, '/documents');
                });
              }
            }}
          />
        </Card>
      </Screen>
    );
  }

  const doc = saved!;
  const facts: [string, string][] = [
    [t('Tip', 'Type'), documentTypeLabel(t, doc.type)],
    ...(doc.documentInvoiceNumber ? [[t('Număr', 'Number'), doc.documentInvoiceNumber] as [string, string]] : []),
    ...(doc.documentClientName ? [[t('Partener', 'Partner'), doc.documentClientName] as [string, string]] : []),
    ...(doc.documentIssueDate ? [[t('Data', 'Date'), formatDate(doc.documentIssueDate)] as [string, string]] : []),
    ...(doc.documentDueDate ? [[t('Scadență', 'Due'), formatDate(doc.documentDueDate)] as [string, string]] : []),
  ];

  return (
    <Screen
      refreshing={isFetching}
      onRefresh={refetch}
      footer={
        <Button
          title={t('Vezi documentul', 'View document')}
          icon="eye-outline"
          variant="secondary"
          loading={busy === 'view'}
          onPress={view}
        />
      }>
      <Stack.Screen options={{ title: documentTypeLabel(t, doc.type) }} />
      <Card>
        <View style={styles.head}>
          <IconTile icon="document-text" tone="good" size={48} />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="title" weight="700" numberOfLines={2}>
              {doc.documentClientName || doc.name}
            </Txt>
            <Pill label={t('Înregistrat', 'Booked')} tone="good" />
          </View>
        </View>
        {doc.documentTotal ? (
          <Txt variant="display" tabular style={{ marginTop: space.md }}>
            {formatMoney(doc.documentTotal, doc.documentCurrency)}
          </Txt>
        ) : null}
      </Card>

      <SectionTitle title={t('Ce am citit din document', 'What we read from it')} size="small" />
      <Card padded={false}>
        {facts.map(([label, value], i) => (
          <View key={label}>
            {i > 0 ? <Divider inset={16} /> : null}
            <View style={styles.fact}>
              <Txt variant="small" tone="muted">
                {label}
              </Txt>
              <Txt weight="600" numberOfLines={1} style={styles.factValue}>
                {value}
              </Txt>
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle title={t('Acțiuni', 'Actions')} size="small" />
      <Card padded={false}>
        {doc.isIncomingInvoice ? (
          <>
            <ListRow
              icon="clipboard"
              title={doc.nirDocument ? t('Deschide NIR', 'Open NIR') : t('Generează NIR', 'Create goods receipt (NIR)')}
              right={doc.nirDocument ? <Ionicons name="checkmark-circle" size={18} color="#15803D" /> : undefined}
              onPress={() => router.push({ pathname: '/nir', params: { source: 'invoice', id: String(doc.id) } })}
            />
            <Divider inset={60} />
          </>
        ) : null}
        <ListRow
          icon="chatbubble-ellipses"
          title={t('Întreabă contabilul', 'Ask your accountant')}
          onPress={() => router.push('/messages')}
        />
        {!doc.isOutgoingInvoice ? (
          <>
            <Divider inset={60} />
            <ListRow
              icon="trash-outline"
              iconTone="danger"
              title={t('Șterge documentul', 'Delete document')}
              titleTone="danger"
              chevron={false}
              onPress={async () => {
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
                  await run('delete', async () => {
                    await deleteSaved(doc.id).unwrap();
                    closeTo(router, '/documents');
                  });
                }
              }}
            />
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  hint: { marginTop: space.md, paddingHorizontal: space.xs },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: 48,
    paddingHorizontal: space.lg,
  },
  factValue: { flexShrink: 1, textAlign: 'right' },
});
