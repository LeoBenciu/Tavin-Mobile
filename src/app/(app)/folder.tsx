import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { useGetDocumentsQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, FormGroup, Loading, SectionTitle, StatStrip } from '@/components/ui';
import { docKind, monthKey, SavedRow, useDocumentActions, useMonthTitle, type DocKind } from '@/features/documents';
import { useT } from '@/i18n';
import { space } from '@/theme';

/** One month's booked documents, split into received invoices, issued invoices and the rest. */
export default function MonthFolderScreen() {
  const t = useT();
  const monthName = useMonthTitle();
  const { month = '' } = useLocalSearchParams<{ month: string }>();
  const { data, isLoading, isFetching, error, refetch } = useGetDocumentsQuery();
  const { open, sheet } = useDocumentActions();

  const docs = useMemo(
    () =>
      (data?.savedDocuments ?? [])
        .filter((d) => monthKey(d) === month)
        .sort((a, b) =>
          String(b.documentIssueDate ?? b.createdAt).localeCompare(String(a.documentIssueDate ?? a.createdAt)),
        ),
    [data, month],
  );
  const sections: { kind: DocKind; title: string }[] = [
    { kind: 'incoming', title: t('Facturi primite', 'Received invoices') },
    { kind: 'outgoing', title: t('Facturi emise', 'Issued invoices') },
    { kind: 'other', title: t('Alte documente', 'Other documents') },
  ];
  const count = (k: DocKind) => docs.filter((d) => docKind(d) === k).length;

  return (
    <Screen refreshing={isFetching && !isLoading} onRefresh={refetch}>
      <Stack.Screen options={{ title: monthName(month) }} />
      {isLoading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : docs.length === 0 ? (
        <EmptyState
          icon="folder-open"
          title={t('Folder gol', 'Empty folder')}
          message={t('Nu mai sunt documente în luna aceasta.', 'There are no documents left in this month.')}
        />
      ) : (
        <>
          <StatStrip
            items={[
              { label: t('Primite', 'Received'), value: String(count('incoming')), tone: 'warn' },
              { label: t('Emise', 'Issued'), value: String(count('outgoing')), tone: 'good' },
              { label: t('Altele', 'Other'), value: String(count('other')) },
            ]}
          />
          {sections.map((s) => {
            const list = docs.filter((d) => docKind(d) === s.kind);
            if (list.length === 0) return null;
            return (
              <View key={s.kind}>
                <SectionTitle title={s.title} size="small" />
                <FormGroup inset={60}>
                  {list.map((d) => (
                    <SavedRow key={d.id} item={d} onPress={() => open({ kind: 'saved', item: d })} />
                  ))}
                </FormGroup>
              </View>
            );
          })}
          <View style={{ height: space.lg }} />
        </>
      )}
      {sheet}
    </Screen>
  );
}
