import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  useCancelInvoiceMutation,
  useCheckEfacturaStatusMutation,
  useCreateCreditNoteMutation,
  useDeleteInvoiceMutation,
  useDuplicateInvoiceMutation,
  useGetInvoicePdfUrlMutation,
  useGetInvoiceQuery,
  useGetReceiptPdfUrlMutation,
  useIssueInvoiceMutation,
  useRecordPaymentMutation,
  useRetryEfacturaMutation,
  useSendInvoiceEmailMutation,
  useSubmitEfacturaMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { Screen } from '@/components/Screen';
import { ActionSheet, Sheet, type SheetAction } from '@/components/Sheet';
import { Banner, Button, Card, Divider, ErrorState, Field, Loading, Pill, SectionTitle, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { confirm, notify } from '@/lib/confirm';
import {
  efacturaStatus,
  invoiceNumber,
  invoiceStatus,
  invoiceTypeLabel,
  isEfacturaDocument,
  unitLabel,
} from '@/lib/domain';
import { openUrl, shareRemoteFile } from '@/lib/files';
import { formatDate, formatMoney, isoDay, isValidIsoDay, parseAmount } from '@/lib/format';
import { space, useColors } from '@/theme';

export default function InvoiceDetailScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data: inv, isLoading, error, refetch, isFetching } = useGetInvoiceQuery(id);

  const [getPdfUrl] = useGetInvoicePdfUrlMutation();
  const [getReceiptUrl] = useGetReceiptPdfUrlMutation();
  const [sendEmail] = useSendInvoiceEmailMutation();
  const [submitSpv] = useSubmitEfacturaMutation();
  const [retrySpv] = useRetryEfacturaMutation();
  const [checkSpv] = useCheckEfacturaStatusMutation();
  const [issue] = useIssueInvoiceMutation();
  const [cancel] = useCancelInvoiceMutation();
  const [remove] = useDeleteInvoiceMutation();
  const [duplicate] = useDuplicateInvoiceMutation();
  const [creditNote] = useCreateCreditNoteMutation();
  const [recordPayment, { isLoading: paying }] = useRecordPaymentMutation();

  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(isoDay());
  const [stornoOpen, setStornoOpen] = useState(false);
  const [stornoReason, setStornoReason] = useState('');

  const act = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await fn();
      if (success) notify(success);
    } catch (e) {
      notify(t('Nu a mers', 'That didn’t work'), errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (!inv) {
    return (
      <Screen>
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      </Screen>
    );
  }

  const st = invoiceStatus(t, inv);
  const ef = efacturaStatus(t, inv.efacturaStatus);
  const isDraft = inv.status === 'DRAFT';
  const isCancelled = inv.status === 'CANCELLED';
  const fiscal = isEfacturaDocument(inv.invoiceType);
  const remaining = Math.max(0, Math.round((inv.total - inv.paidAmount) * 100) / 100);
  const canCollect = !isDraft && !isCancelled && inv.invoiceType === 'REGULAR' && remaining > 0.009;
  const title = `${invoiceTypeLabel(t, inv.invoiceType)} ${invoiceNumber(inv)}`;
  const fileName = `${inv.series}${inv.number}.pdf`;

  const openPdf = () => act('pdf', async () => openUrl((await getPdfUrl(inv.id).unwrap()).url));
  const sharePdf = () =>
    act('share', async () => {
      const r = await getPdfUrl(inv.id).unwrap();
      await shareRemoteFile(r.url, r.fileName || fileName);
    });

  const spvAction =
    !fiscal || isDraft || isCancelled
      ? null
      : inv.efacturaStatus === 'NOT_SENT'
        ? {
            label: t('Trimite în SPV', 'Send to SPV'),
            icon: 'cloud-upload-outline' as const,
            run: () => submitSpv(inv.id).unwrap(),
          }
        : inv.efacturaStatus === 'REJECTED' || inv.efacturaStatus === 'ERROR'
          ? {
              label: t('Retrimite în SPV', 'Resend to SPV'),
              icon: 'refresh' as const,
              run: () => retrySpv(inv.id).unwrap(),
            }
          : inv.efacturaStatus === 'PENDING'
            ? {
                label: t('Verifică la ANAF', 'Check at ANAF'),
                icon: 'sync' as const,
                run: () => checkSpv(inv.id).unwrap(),
              }
            : null;

  const menuActions: SheetAction[] = [
    {
      label: t('Trimite clientului pe email', 'Email to client'),
      icon: 'mail-outline',
      hidden: isDraft || isCancelled,
      onPress: () => act('email', () => sendEmail(inv.id).unwrap(), t('Factura a fost trimisă.', 'Invoice sent.')),
    },
    {
      label: t('Chitanță', 'Receipt'),
      icon: 'document-attach-outline',
      hidden: isDraft || isCancelled || inv.invoiceType !== 'REGULAR' || inv.paidAmount <= 0,
      onPress: () =>
        act('receipt', async () => {
          const r = await getReceiptUrl({ id: inv.id, amount: inv.paidAmount }).unwrap();
          await shareRemoteFile(r.url, r.fileName || `chitanta-${inv.series}${inv.number}.pdf`);
        }),
    },
    {
      label: t('Duplică', 'Duplicate'),
      icon: 'copy-outline',
      onPress: () =>
        act('dup', async () => {
          const copy = await duplicate(inv.id).unwrap();
          router.push({ pathname: '/invoices/[id]', params: { id: String(copy.id) } });
        }),
    },
    {
      label: t('Stornează', 'Credit note'),
      icon: 'return-down-back-outline',
      hidden: isDraft || isCancelled || inv.invoiceType !== 'REGULAR',
      onPress: () => setStornoOpen(true),
    },
    {
      label: t('Anulează', 'Cancel invoice'),
      icon: 'close-circle-outline',
      tone: 'danger',
      hidden: !inv.canCancel || isCancelled,
      onPress: async () => {
        if (
          await confirm(t('Anulezi documentul?', 'Cancel this document?'), title, {
            destructive: true,
            confirmLabel: t('Anulează', 'Cancel it'),
          })
        ) {
          await act('cancel', () => cancel(inv.id).unwrap());
        }
      },
    },
    {
      label: t('Șterge', 'Delete'),
      icon: 'trash-outline',
      tone: 'danger',
      hidden: !inv.canDelete,
      onPress: async () => {
        if (
          await confirm(t('Ștergi documentul?', 'Delete this document?'), title, {
            destructive: true,
            confirmLabel: t('Șterge', 'Delete'),
          })
        ) {
          await act('delete', async () => {
            await remove(inv.id).unwrap();
            router.back();
          });
        }
      },
    },
  ];

  return (
    <Screen
      refreshing={isFetching}
      onRefresh={refetch}
      footer={
        isDraft ? (
          <Button
            title={t('Emite documentul', 'Issue document')}
            icon="send"
            loading={busy === 'issue'}
            onPress={() => act('issue', () => issue(inv.id).unwrap(), t('Documentul a fost emis.', 'Document issued.'))}
          />
        ) : canCollect ? (
          <Button
            title={t('Înregistrează încasare', 'Record payment')}
            icon="cash-outline"
            onPress={() => {
              setPayAmount(String(remaining).replace('.', ','));
              setPayDate(isoDay());
              setPayOpen(true);
            }}
          />
        ) : undefined
      }>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <Pressable
              onPress={() => setMenu(true)}
              hitSlop={10}
              accessibilityLabel={t('Mai multe acțiuni', 'More actions')}>
              <Ionicons name="ellipsis-horizontal-circle" size={26} color={c.accentText} />
            </Pressable>
          ),
        }}
      />

      <Card>
        <View style={styles.pills}>
          <Pill label={st.label} tone={st.tone} />
          {fiscal && !isDraft ? <Pill label={ef.label} tone={ef.tone} icon={ef.icon} /> : null}
        </View>
        <Txt variant="display" style={{ marginTop: space.md }}>
          {formatMoney(inv.total, inv.currency)}
        </Txt>
        {inv.paidAmount > 0 && remaining > 0.009 ? (
          <Txt tone="muted">
            {t(
              `Încasat ${formatMoney(inv.paidAmount, inv.currency)} · rest ${formatMoney(remaining, inv.currency)}`,
              `Paid ${formatMoney(inv.paidAmount, inv.currency)} · ${formatMoney(remaining, inv.currency)} left`,
            )}
          </Txt>
        ) : null}
        <View style={{ height: space.md }} />
        <Divider />
        <View style={styles.meta}>
          <Meta label={t('Client', 'Client')} value={inv.clientName} sub={inv.clientEin} />
          <View style={styles.metaRow}>
            <Meta label={t('Emisă', 'Issued')} value={formatDate(inv.issueDate)} />
            <Meta
              label={t('Scadentă', 'Due')}
              value={formatDate(inv.dueDate)}
              tone={inv.status === 'OVERDUE' ? 'danger' : undefined}
            />
          </View>
        </View>
      </Card>

      {inv.efacturaErrorMessage && (inv.efacturaStatus === 'REJECTED' || inv.efacturaStatus === 'ERROR') ? (
        <View style={{ marginTop: space.md }}>
          <Banner
            tone="danger"
            icon="alert-circle"
            title={t('Mesaj ANAF', 'ANAF message')}
            message={inv.efacturaErrorMessage}
          />
        </View>
      ) : null}

      <View style={styles.quick}>
        <Button
          title={t('Vezi PDF', 'View PDF')}
          icon="eye-outline"
          variant="secondary"
          size="sm"
          onPress={openPdf}
          loading={busy === 'pdf'}
          style={{ flex: 1 }}
        />
        <Button
          title={t('Trimite', 'Share')}
          icon="share-outline"
          variant="secondary"
          size="sm"
          onPress={sharePdf}
          loading={busy === 'share'}
          style={{ flex: 1 }}
        />
      </View>
      {spvAction ? (
        <Button
          title={spvAction.label}
          icon={spvAction.icon}
          variant="secondary"
          loading={busy === 'spv'}
          onPress={() => act('spv', spvAction.run)}
          style={{ marginTop: space.sm }}
        />
      ) : null}

      <SectionTitle title={t('Produse', 'Items')} />
      <Card padded={false}>
        {inv.lineItems.map((l, i) => (
          <View key={l.id}>
            {i > 0 ? <Divider inset={space.lg} /> : null}
            <View style={styles.line}>
              <View style={{ flex: 1 }}>
                <Txt weight="500">{l.description}</Txt>
                <Txt variant="small" tone="muted">
                  {l.quantity} {unitLabel(t, l.unitOfMeasure)} × {formatMoney(l.unitPrice, inv.currency)} · TVA{' '}
                  {l.vatRate}%{l.discountPercent ? ` · −${l.discountPercent}%` : ''}
                </Txt>
              </View>
              <Txt weight="600">{formatMoney(l.totalWithVat, inv.currency)}</Txt>
            </View>
          </View>
        ))}
        <Divider />
        <View style={styles.totals}>
          <Row label={t('Fără TVA', 'Net')} value={formatMoney(inv.subtotal, inv.currency)} />
          <Row label="TVA" value={formatMoney(inv.vatAmount, inv.currency)} />
          <Row label={t('Total', 'Total')} value={formatMoney(inv.total, inv.currency)} bold />
        </View>
      </Card>

      {inv.notes ? (
        <>
          <SectionTitle title={t('Mențiuni', 'Notes')} />
          <Card>
            <Txt tone="soft">{inv.notes}</Txt>
          </Card>
        </>
      ) : null}

      {!isDraft && inv.canEdit && inv.editWindowRemainingHours > 0 ? (
        <Txt variant="caption" tone="muted" style={styles.hint}>
          {t(
            `Poți corecta factura de pe tavin.eu încă ${Math.ceil(inv.editWindowRemainingHours)} ore, cât nu e trimisă la ANAF.`,
            `You can still correct it on tavin.eu for ${Math.ceil(inv.editWindowRemainingHours)} hours, until it reaches ANAF.`,
          )}
        </Txt>
      ) : null}

      <ActionSheet visible={menu} onClose={() => setMenu(false)} title={title} actions={menuActions} />

      <Sheet visible={payOpen} onClose={() => setPayOpen(false)} title={t('Încasare', 'Payment received')}>
        <View style={{ paddingHorizontal: space.lg }}>
          <Field
            label={t(`Sumă (${inv.currency})`, `Amount (${inv.currency})`)}
            value={payAmount}
            onChangeText={setPayAmount}
            keyboardType="decimal-pad"
            autoFocus
          />
          <Field
            label={t('Data încasării', 'Payment date')}
            value={payDate}
            onChangeText={setPayDate}
            placeholder="AAAA-LL-ZZ"
            error={payDate && !isValidIsoDay(payDate) ? 'AAAA-LL-ZZ' : null}
          />
          <Button
            title={t('Salvează încasarea', 'Save payment')}
            loading={paying}
            onPress={async () => {
              const amount = parseAmount(payAmount);
              if (amount == null || amount <= 0) {
                notify(t('Sumă invalidă', 'Invalid amount'));
                return;
              }
              if (!isValidIsoDay(payDate)) return;
              try {
                await recordPayment({ id: inv.id, amount, paymentDate: payDate }).unwrap();
                setPayOpen(false);
              } catch (e) {
                notify(t('Nu a mers', 'That didn’t work'), errorMessage(e));
              }
            }}
          />
        </View>
      </Sheet>

      <Sheet visible={stornoOpen} onClose={() => setStornoOpen(false)} title={t('Stornare', 'Credit note')}>
        <View style={{ paddingHorizontal: space.lg }}>
          <Txt tone="soft" style={{ marginBottom: space.md }}>
            {t(
              'Se emite o factură storno pentru întreaga valoare și, dacă e cazul, se trimite în SPV.',
              'A credit note for the full amount is issued and, if applicable, sent to SPV.',
            )}
          </Txt>
          <Field
            label={t('Motiv (opțional)', 'Reason (optional)')}
            value={stornoReason}
            onChangeText={setStornoReason}
          />
          <Button
            title={t('Emite storno', 'Issue credit note')}
            variant="danger"
            loading={busy === 'storno'}
            onPress={() =>
              act('storno', async () => {
                const cn = await creditNote({ id: inv.id, reason: stornoReason.trim() || undefined }).unwrap();
                setStornoOpen(false);
                router.push({ pathname: '/invoices/[id]', params: { id: String(cn.id) } });
              })
            }
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function Meta({ label, value, sub, tone }: { label: string; value: string; sub?: string | null; tone?: 'danger' }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
      <Txt weight="600" tone={tone}>
        {value}
      </Txt>
      {sub ? (
        <Txt variant="small" tone="muted">
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Txt tone={bold ? 'default' : 'soft'} weight={bold ? '700' : undefined}>
        {label}
      </Txt>
      <Txt weight={bold ? '700' : '500'}>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  meta: { gap: space.md, marginTop: space.md },
  metaRow: { flexDirection: 'row', gap: space.md },
  quick: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  line: { flexDirection: 'row', gap: space.md, padding: space.lg, alignItems: 'center' },
  totals: { padding: space.lg, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  hint: { textAlign: 'center', marginTop: space.lg },
});
