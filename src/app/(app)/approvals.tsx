import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  useGetApprovalsQuery,
  useGetCostCentersQuery,
  useLazyGetDocumentUrlQuery,
  useLazyGetPendingUploadUrlQuery,
  useRespondApprovalMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { ConfirmationAction, InvoiceConfirmation } from '@/api/types';
import { Screen } from '@/components/Screen';
import { ActionSheet, PickerSheet, Sheet } from '@/components/Sheet';
import { splitMoney } from '@/components/charts';
import { Amount, Button, Card, EmptyState, ErrorState, Field, Loading, Pill, SelectField, Txt } from '@/components/ui';
import { useT, type Translate } from '@/i18n';
import { notify } from '@/lib/confirm';
import { openUrl } from '@/lib/files';
import { formatDate, formatMoney } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { radius, space, useColors } from '@/theme';

function riskText(t: Translate, code: string): string {
  switch (code) {
    case 'NEW_VENDOR':
      return t('Furnizor nou — prima factură de la această firmă', 'New supplier — first invoice from this company');
    case 'NEW_IBAN':
      return t('Cont bancar diferit de cel folosit până acum', 'Bank account differs from the one used before');
    case 'DUPLICATE':
      return t(
        'Posibil duplicat — există deja o factură cu acest număr',
        'Possible duplicate — an invoice with this number exists',
      );
    case 'AMOUNT_ANOMALY':
      return t('Sumă neobișnuit de mare față de istoric', 'Unusually large amount compared to history');
    default:
      return code;
  }
}

const NEEDS_NOTE: ConfirmationAction[] = ['REJECT', 'WRONGLY_ISSUED', 'CLARIFY'];

export default function ApprovalsScreen() {
  const c = useColors();
  const t = useT();
  const { data, isLoading, isFetching, error, refetch } = useGetApprovalsQuery();
  const { data: costCenters = [] } = useGetCostCentersQuery();
  const [respond, { isLoading: responding }] = useRespondApprovalMutation();
  const [getPendingUrl] = useLazyGetPendingUploadUrlQuery();
  const [getDocUrl] = useLazyGetDocumentUrlQuery();

  const [moreFor, setMoreFor] = useState<InvoiceConfirmation | null>(null);
  const [noteFor, setNoteFor] = useState<{ item: InvoiceConfirmation; action: ConfirmationAction } | null>(null);
  const [note, setNote] = useState('');
  const [costCenterFor, setCostCenterFor] = useState<number | null>(null);
  const [costCenterByItem, setCostCenterByItem] = useState<Record<number, number>>({});

  const send = async (item: InvoiceConfirmation, action: ConfirmationAction, withNote?: string) => {
    try {
      const res = await respond({
        id: item.id,
        action,
        note: withNote?.trim() || undefined,
        costCenterId: costCenterByItem[item.id] ?? null,
      }).unwrap();
      if (res.alreadyResolved) notify(t('Factura era deja rezolvată.', 'This invoice was already handled.'));
      else haptic.success();
      setNoteFor(null);
      setNote('');
    } catch (e) {
      notify(t('Nu a mers', 'That didn’t work'), errorMessage(e));
    }
  };

  const choose = (item: InvoiceConfirmation, action: ConfirmationAction) => {
    if (NEEDS_NOTE.includes(action)) {
      setNote('');
      setNoteFor({ item, action });
    } else {
      void send(item, action);
    }
  };

  const viewInvoice = async (item: InvoiceConfirmation) => {
    try {
      const r = item.documentId
        ? await getDocUrl(item.documentId).unwrap()
        : await getPendingUrl(item.pendingUploadId!).unwrap();
      await openUrl(r.url);
    } catch (e) {
      notify(t('Nu am putut deschide factura', 'Couldn’t open the invoice'), errorMessage(e));
    }
  };

  const items = data?.data ?? [];
  const actionTitle: Record<ConfirmationAction, string> = {
    CONFIRM: t('Aprob', 'Approve'),
    REJECT: t('Resping factura', 'Reject invoice'),
    UNKNOWN_VENDOR: t('Nu cunosc furnizorul', 'I don’t know this supplier'),
    WRONGLY_ISSUED: t('Emisă greșit', 'Issued by mistake'),
    CLARIFY: t('Cer clarificări', 'Ask for clarification'),
  };

  return (
    <Screen refreshing={isFetching && !isLoading} onRefresh={refetch}>
      {isLoading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="shield-checkmark"
          title={t('Nimic de confirmat', 'Nothing to confirm')}
          message={t(
            'Când primești în SPV o factură neobișnuită (furnizor nou, IBAN schimbat), te întrebăm aici înainte să fie plătită sau înregistrată.',
            'When an unusual e-invoice arrives in SPV (new supplier, changed IBAN), we ask you here before it’s paid or booked.',
          )}
        />
      ) : (
        <>
          <Txt variant="small" tone="muted" style={styles.intro}>
            {t(
              'Confirmă că recunoști aceste facturi. Până răspunzi, contabilul nu le înregistrează.',
              'Confirm you recognise these invoices. Your accountant won’t book them until you answer.',
            )}
          </Txt>
          {items.map((item) => {
            const reasons = Array.isArray(item.riskReasons) ? item.riskReasons : [];
            const cc = costCenters.find((x) => x.id === costCenterByItem[item.id]);
            const [amount, currency] = splitMoney(formatMoney(item.totalAmount, item.currency));
            return (
              <Card key={item.id} style={styles.card}>
                <View style={styles.top}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="title" numberOfLines={2}>
                      {item.vendorName}
                    </Txt>
                    <Txt variant="small" tone="muted">
                      CUI {item.vendorEin}
                      {item.documentNumber ? ` · ${item.documentNumber}` : ''}
                      {item.documentDate ? ` · ${formatDate(item.documentDate)}` : ''}
                    </Txt>
                  </View>
                  <Pill
                    label={
                      item.riskLevel === 'HIGH'
                        ? t('Risc ridicat', 'High risk')
                        : item.riskLevel === 'MEDIUM'
                          ? t('De verificat', 'Check')
                          : t('Risc mic', 'Low risk')
                    }
                    tone={item.riskLevel === 'HIGH' ? 'danger' : item.riskLevel === 'MEDIUM' ? 'warn' : 'neutral'}
                  />
                </View>
                <Amount value={amount} currency={currency} size="display" style={{ marginTop: space.md }} />
                {item.paymentIban ? (
                  <View style={[styles.iban, { backgroundColor: c.fill }]}>
                    <Ionicons name="card-outline" size={16} color={c.muted} />
                    <Txt variant="small" tone="soft" style={{ flexShrink: 1 }} tabular>
                      {item.paymentIban}
                    </Txt>
                    {item.ibanIsNew ? <Pill label={t('IBAN NOU', 'NEW IBAN')} tone="danger" /> : null}
                  </View>
                ) : null}
                {reasons.length > 0 ? (
                  <View style={[styles.reasons, { backgroundColor: c.warnSoft }]}>
                    {reasons.map((r) => (
                      <View key={r} style={styles.reason}>
                        <Ionicons name="warning" size={15} color={c.warn} style={{ marginTop: 1 }} />
                        <Txt variant="small" tone="warn" style={{ flex: 1 }}>
                          {riskText(t, r)}
                        </Txt>
                      </View>
                    ))}
                  </View>
                ) : null}
                {costCenters.length > 0 ? (
                  <View style={{ marginTop: space.md }}>
                    <SelectField
                      label={t('Centru de cost (opțional)', 'Cost centre (optional)')}
                      value={cc ? `${cc.code} · ${cc.name}` : null}
                      placeholder={t('Alege', 'Choose')}
                      onPress={() => setCostCenterFor(item.id)}
                    />
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <Button
                    title={t('Resping', 'Reject')}
                    variant="danger"
                    onPress={() => choose(item, 'REJECT')}
                    disabled={responding}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title={t('Aprob', 'Approve')}
                    icon="checkmark"
                    onPress={() => choose(item, 'CONFIRM')}
                    loading={responding}
                    style={{ flex: 1.4 }}
                  />
                </View>
                <View style={styles.secondary}>
                  {item.pendingUploadId || item.documentId ? (
                    <Button
                      title={t('Vezi factura', 'View invoice')}
                      icon="eye-outline"
                      variant="ghost"
                      size="sm"
                      onPress={() => viewInvoice(item)}
                    />
                  ) : null}
                  <Button
                    title={t('Alte răspunsuri', 'Other answers')}
                    icon="ellipsis-horizontal"
                    variant="ghost"
                    size="sm"
                    onPress={() => setMoreFor(item)}
                  />
                </View>
              </Card>
            );
          })}
        </>
      )}

      <ActionSheet
        visible={!!moreFor}
        onClose={() => setMoreFor(null)}
        title={moreFor?.vendorName}
        actions={
          moreFor
            ? (['UNKNOWN_VENDOR', 'WRONGLY_ISSUED', 'CLARIFY'] as ConfirmationAction[]).map((a) => ({
                label: actionTitle[a],
                icon:
                  a === 'UNKNOWN_VENDOR'
                    ? 'help-circle-outline'
                    : a === 'WRONGLY_ISSUED'
                      ? 'warning-outline'
                      : 'chatbubble-ellipses-outline',
                onPress: () => choose(moreFor, a),
              }))
            : []
        }
      />

      <Sheet
        visible={!!noteFor}
        onClose={() => setNoteFor(null)}
        title={noteFor ? actionTitle[noteFor.action] : undefined}>
        <View style={{ paddingHorizontal: space.lg }}>
          <Field
            label={t('Explicație pentru contabil', 'Note for your accountant')}
            value={note}
            onChangeText={setNote}
            multiline
            autoFocus
            placeholder={
              noteFor?.action === 'CLARIFY'
                ? t('Ce vrei să afli despre factură?', 'What do you want to know about it?')
                : t('De ce nu e corectă factura?', 'Why isn’t this invoice right?')
            }
          />
          <Button
            title={t('Trimite răspunsul', 'Send answer')}
            loading={responding}
            disabled={!note.trim()}
            onPress={() => noteFor && send(noteFor.item, noteFor.action, note)}
          />
        </View>
      </Sheet>

      <PickerSheet
        visible={costCenterFor != null}
        onClose={() => setCostCenterFor(null)}
        title={t('Centru de cost', 'Cost centre')}
        items={costCenters}
        keyOf={(x) => x.id}
        labelOf={(x) => x.name}
        sublabelOf={(x) => x.code}
        selectedKey={costCenterFor != null ? costCenterByItem[costCenterFor] : null}
        onSelect={(x) => costCenterFor != null && setCostCenterByItem((m) => ({ ...m, [costCenterFor]: x.id }))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: space.lg, paddingHorizontal: 2 },
  card: { marginBottom: space.lg },
  top: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  iban: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    flexWrap: 'wrap',
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.sm + 2,
  },
  reasons: { marginTop: space.sm, gap: 6, padding: space.md, borderRadius: radius.sm + 2 },
  reason: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  secondary: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: space.xs },
});
