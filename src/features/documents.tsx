import { useRouter } from 'expo-router';
import { useState } from 'react';

import {
  useCancelUploadMutation,
  useDeleteSavedDocumentMutation,
  useLazyGetDocumentUrlQuery,
  useLazyGetPendingUploadUrlQuery,
  useRetryUploadMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { PendingUpload, SavedDocument } from '@/api/types';
import { ActionSheet, type SheetAction } from '@/components/Sheet';
import { ListRow, Pill } from '@/components/ui';
import { useLanguage, useT, type Translate } from '@/i18n';
import { confirm, notify } from '@/lib/confirm';
import { documentTypeLabel, uploadStatus } from '@/lib/domain';
import { openUrl } from '@/lib/files';
import { formatDate, formatMoney, formatMonth, formatRelative } from '@/lib/format';

export type DocumentSelection = { kind: 'pending'; item: PendingUpload } | { kind: 'saved'; item: SavedDocument };

// ── Months ──

/** The month a booked document belongs to: its issue date (what the books use), else when it arrived. */
export function monthKey(d: SavedDocument): string {
  const day = String(d.documentIssueDate ?? d.createdAt ?? '');
  const m = /^(\d{4})-(\d{2})/.exec(day);
  if (m) return `${m[1]}-${m[2]}`;
  const parsed = new Date(day);
  return Number.isNaN(parsed.getTime())
    ? '0000-00'
    : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

export function monthTitle(key: string, language: 'ro' | 'en'): string {
  const [y, m] = key.split('-').map(Number);
  return y ? formatMonth(y, m - 1, language) : '—';
}

export type MonthFolder = { key: string; year: number; docs: SavedDocument[] };

/** Newest month first. */
export function groupByMonth(docs: SavedDocument[]): MonthFolder[] {
  const map = new Map<string, SavedDocument[]>();
  for (const d of docs) {
    const k = monthKey(d);
    map.set(k, [...(map.get(k) ?? []), d]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, list]) => ({ key, year: Number(key.slice(0, 4)), docs: list }));
}

export type DocKind = 'incoming' | 'outgoing' | 'other';

export function docKind(d: SavedDocument): DocKind {
  return d.isIncomingInvoice ? 'incoming' : d.isOutgoingInvoice ? 'outgoing' : 'other';
}

/** "4 primite · 3 emise · 2 altele" */
export function folderSummary(t: Translate, docs: SavedDocument[]): string {
  const n = { incoming: 0, outgoing: 0, other: 0 };
  docs.forEach((d) => n[docKind(d)]++);
  return [
    n.incoming ? t(`${n.incoming} primite`, `${n.incoming} received`) : null,
    n.outgoing ? t(`${n.outgoing} emise`, `${n.outgoing} issued`) : null,
    n.other ? t(`${n.other} altele`, `${n.other} other`) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// ── Rows ──

export function PendingRow({ item, onPress }: { item: PendingUpload; onPress: () => void }) {
  const t = useT();
  const st = uploadStatus(t, item);
  return (
    <ListRow
      icon={item.contentType?.startsWith('image/') ? 'image' : 'document'}
      iconTone={st.tone}
      title={item.fileName}
      subtitle={item.hasError && item.errorMessage ? item.errorMessage : formatRelative(item.createdAt)}
      below={<Pill label={st.label} tone={st.tone} />}
      onPress={onPress}
      chevron={false}
    />
  );
}

export function SavedRow({
  item,
  onPress,
  showDate = true,
}: {
  item: SavedDocument;
  onPress: () => void;
  showDate?: boolean;
}) {
  const t = useT();
  const kind = docKind(item);
  const meta = [
    documentTypeLabel(t, item.type),
    item.documentInvoiceNumber,
    item.documentClientName,
    showDate ? formatDate(item.documentIssueDate ?? item.createdAt) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListRow
      icon={kind === 'incoming' ? 'arrow-down' : kind === 'outgoing' ? 'arrow-up' : 'document-text'}
      iconTone={kind === 'incoming' ? 'warn' : kind === 'outgoing' ? 'good' : 'neutral'}
      title={item.name}
      subtitle={meta}
      value={item.documentTotal ? formatMoney(item.documentTotal, item.documentCurrency) : null}
      below={item.nirDocument ? <Pill label={t('NIR generat', 'NIR created')} tone="good" icon="checkmark" /> : null}
      onPress={onPress}
      chevron={false}
    />
  );
}

// ── Actions ──

/** The "…" menu for a document (view, NIR, retry, delete). Render `sheet` once per screen. */
export function useDocumentActions() {
  const t = useT();
  const router = useRouter();
  const [selected, setSelected] = useState<DocumentSelection | null>(null);
  const [getPendingUrl] = useLazyGetPendingUploadUrlQuery();
  const [getDocUrl] = useLazyGetDocumentUrlQuery();
  const [retryUpload] = useRetryUploadMutation();
  const [cancelUpload] = useCancelUploadMutation();
  const [deleteSaved] = useDeleteSavedDocumentMutation();

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      notify(t('Eroare', 'Error'), errorMessage(e));
    }
  };

  const view = (s: DocumentSelection) =>
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

  const sheet = (
    <ActionSheet
      visible={!!selected}
      onClose={() => setSelected(null)}
      title={selected ? (selected.kind === 'pending' ? selected.item.fileName : selected.item.name) : undefined}
      actions={actions}
    />
  );

  return { open: setSelected, sheet };
}

export function useMonthTitle() {
  const { language } = useLanguage();
  return (key: string) => monthTitle(key, language);
}
