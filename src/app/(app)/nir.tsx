import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  useGetManagementsQuery,
  useGetNirForInvoiceQuery,
  useSaveUploadAndCreateNirMutation,
  useUpdateNirMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { Management, NirData, NirLine, NirResponse } from '@/api/types';
import { clientUserId } from '@/auth/current';
import { Screen } from '@/components/Screen';
import { PickerSheet } from '@/components/Sheet';
import {
  Banner,
  Button,
  Card,
  ErrorState,
  Field,
  Loading,
  Pill,
  SectionTitle,
  SelectField,
  Txt,
} from '@/components/ui';
import { useT } from '@/i18n';
import { notify } from '@/lib/confirm';
import { closeTo } from '@/lib/navigation';
import { ARTICLE_TYPES, articleTypeLabel, isServiceType } from '@/lib/domain';
import { postForPdf } from '@/lib/files';
import { formatMoney } from '@/lib/format';
import { finalizeNir, lineArticleType, lineManagementId, normalizeNir, num, withTotals } from '@/lib/nir';
import { space } from '@/theme';

type PickerState = { kind: 'gestiune'; line: number | 'all' } | { kind: 'type'; line: number } | null;

export default function NirScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ source: 'invoice' | 'upload'; id: string }>();
  const id = Number(params.id);
  const fromInvoice = params.source !== 'upload';

  // Saved incoming invoice: get-or-create. Pending upload: save it, then create.
  const invoiceNir = useGetNirForInvoiceQuery(id, { skip: !fromInvoice || !id });
  const [saveUploadAndCreate, uploadNir] = useSaveUploadAndCreateNirMutation();
  const started = useRef(false);
  useEffect(() => {
    if (!fromInvoice && id && !started.current) {
      started.current = true;
      void saveUploadAndCreate(id);
    }
  }, [fromInvoice, id, saveUploadAndCreate]);

  const response: NirResponse | undefined = fromInvoice ? invoiceNir.data : uploadNir.data;
  const loadError = fromInvoice ? invoiceNir.error : uploadNir.error;

  if (loadError && !response) {
    return (
      <Screen>
        <ErrorState
          message={errorMessage(loadError)}
          onRetry={() => (fromInvoice ? invoiceNir.refetch() : saveUploadAndCreate(id))}
        />
      </Screen>
    );
  }
  if (!response) {
    return (
      <Screen>
        <Loading label={t('Pregătim nota de recepție…', 'Preparing the goods receipt…')} />
      </Screen>
    );
  }
  // Keyed so the editor starts from the NIR the server returned.
  return <NirEditor key={response.nirDocumentId} response={response} onBack={() => closeTo(router, '/documents')} />;
}

function NirEditor({ response, onBack }: { response: NirResponse; onBack: () => void }) {
  const t = useT();
  const { data: managements = [] } = useGetManagementsQuery();
  const [updateNir, { isLoading: saving }] = useUpdateNirMutation();

  const [nir, setNir] = useState<NirData>(() =>
    normalizeNir(response.nirData, {
      nirDocumentId: response.nirDocumentId,
      companyName: response.clientCompanyName,
      companyAddress: response.clientCompanyAddress,
    }),
  );
  const [dirty, setDirty] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [picker, setPicker] = useState<PickerState>(null);

  const managementName = (mid: number | null) => {
    const m = managements.find((x) => x.id === mid);
    return m ? m.name || m.code : null;
  };

  const setField = (key: keyof NirData, value: string) => {
    setNir((prev) => ({ ...prev, [key]: value, ...(key === 'data' ? { data_receptie: value } : {}) }));
    setDirty(true);
  };

  const setLine = (idx: number, patch: Partial<NirLine>) => {
    setNir((prev) => {
      const lines = [...(prev.line_items ?? [])];
      lines[idx] = { ...lines[idx], ...patch };
      return withTotals({ ...prev, line_items: lines });
    });
    setDirty(true);
  };

  const applyManagement = (target: number | 'all', m: Management) => {
    const name = m.name || m.code;
    const patch = { management_id: m.id, managementId: m.id, management_name: name, managementName: name };
    setNir((prev) => {
      const lines = (prev.line_items ?? []).map((l, i) => (target === 'all' || i === target ? { ...l, ...patch } : l));
      return { ...prev, line_items: lines, ...(target === 'all' ? { gestiunea: name } : {}) };
    });
    setDirty(true);
  };

  const missingGestiune = useMemo(
    () =>
      managements.length > 0 &&
      (nir.line_items ?? []).some((l) => !isServiceType(lineArticleType(l)) && lineManagementId(l) == null),
    [nir, managements.length],
  );

  const save = async () => {
    try {
      const clean = finalizeNir(nir);
      await updateNir({ nirDocumentId: response.nirDocumentId, nirData: clean }).unwrap();
      setNir(clean);
      setDirty(false);
      notify(
        t('NIR salvat', 'NIR saved'),
        t('Contabilul vede noua versiune.', 'Your accountant sees the new version.'),
      );
    } catch (e) {
      notify(t('Nu am putut salva', 'Couldn’t save'), errorMessage(e));
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      await postForPdf(
        `/client-portal/documents/nir/${response.nirDocumentId}/generate-pdf?clientUserId=${clientUserId()}`,
        { nirData: finalizeNir(nir) },
        `${response.nirDocumentName || nir.nr_nir || 'NIR'}.pdf`,
      );
    } catch (e) {
      notify(t('Nu am putut genera PDF-ul', 'Couldn’t create the PDF'), errorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  const lines = nir.line_items ?? [];

  return (
    <Screen
      keyboard
      footer={
        <View style={styles.footerRow}>
          <Button
            title={t('PDF', 'PDF')}
            icon="download-outline"
            variant="secondary"
            onPress={download}
            loading={downloading}
            style={{ flex: 1 }}
          />
          <Button
            title={t('Salvează', 'Save')}
            icon="checkmark"
            onPress={save}
            loading={saving}
            disabled={!dirty}
            style={{ flex: 2 }}
          />
        </View>
      }>
      <Stack.Screen options={{ title: nir.nr_nir || t('Notă de recepție', 'Goods receipt') }} />

      {response.created ? (
        <Banner
          tone="good"
          icon="checkmark-circle"
          title={t('NIR creat din factură', 'NIR created from the invoice')}
          message={t(
            'Verifică cantitățile primite și gestiunea, apoi salvează.',
            'Check the received quantities and warehouse, then save.',
          )}
        />
      ) : null}
      {missingGestiune ? (
        <View style={{ marginTop: space.md }}>
          <Banner
            tone="warn"
            icon="cube-outline"
            title={t('Alege gestiunea', 'Pick a warehouse')}
            message={t('Mărfurile intră în stoc doar pe o gestiune.', 'Goods only enter stock in a warehouse.')}
            onPress={() => setPicker({ kind: 'gestiune', line: 'all' })}
          />
        </View>
      ) : null}

      <SectionTitle size="small" title={t('Document', 'Document')} />
      <Card>
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('Data (zz-ll-aaaa)', 'Date (dd-mm-yyyy)')}
              value={String(nir.data ?? '')}
              onChangeText={(v) => setField('data', v)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t('Nr. factură', 'Invoice no.')}
              value={String(nir.nr_doc ?? '')}
              onChangeText={(v) => setField('nr_doc', v)}
            />
          </View>
        </View>
        <Field
          label={t('Furnizor', 'Supplier')}
          value={String(nir.furnizor ?? '')}
          onChangeText={(v) => setField('furnizor', v)}
        />
        {managements.length > 0 ? (
          <SelectField
            label={t('Gestiune (toate liniile)', 'Warehouse (all lines)')}
            value={nir.gestiunea ? String(nir.gestiunea) : null}
            placeholder={t('Alege gestiunea', 'Choose warehouse')}
            onPress={() => setPicker({ kind: 'gestiune', line: 'all' })}
          />
        ) : null}
      </Card>

      <SectionTitle size="small" title={t(`Produse (${lines.length})`, `Items (${lines.length})`)} />
      {lines.map((line, idx) => {
        const type = lineArticleType(line);
        const service = isServiceType(type);
        return (
          <Card key={idx} style={styles.lineCard}>
            <View style={styles.lineHeader}>
              <Txt weight="600" style={{ flex: 1 }}>
                {idx + 1}. {line.denumire_produs || t('Produs', 'Item')}
              </Txt>
              <Pill label={articleTypeLabel(t, type)} tone={service ? 'neutral' : 'accent'} />
            </View>
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Field
                  label={t(`Cantitate primită (${line.um || 'buc'})`, `Qty received (${line.um || 'pcs'})`)}
                  keyboardType="decimal-pad"
                  value={String(line.cantitate ?? '')}
                  onChangeText={(v) =>
                    setLine(idx, { cantitate: v as unknown as number, cant_document: v as unknown as number })
                  }
                  onEndEditing={() =>
                    setLine(idx, { cantitate: num(line.cantitate), cant_document: num(line.cantitate) })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label={t('Preț unitar', 'Unit price')}
                  keyboardType="decimal-pad"
                  value={String(line.pret_unitar ?? '')}
                  onChangeText={(v) => setLine(idx, { pret_unitar: v as unknown as number })}
                  onEndEditing={() => setLine(idx, { pret_unitar: num(line.pret_unitar) })}
                />
              </View>
            </View>
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Field
                  label={t('Valoare', 'Value')}
                  keyboardType="decimal-pad"
                  value={String(line.valoare ?? '')}
                  onChangeText={(v) => setLine(idx, { valoare: v as unknown as number })}
                  onEndEditing={() => setLine(idx, { valoare: num(line.valoare) })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label={t('TVA', 'VAT')}
                  keyboardType="decimal-pad"
                  value={String(line.tva ?? '')}
                  onChangeText={(v) => setLine(idx, { tva: v as unknown as number })}
                  onEndEditing={() => setLine(idx, { tva: num(line.tva) })}
                />
              </View>
            </View>
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <SelectField
                  label={t('Tip', 'Type')}
                  value={articleTypeLabel(t, type)}
                  placeholder={t('Tip articol', 'Item type')}
                  onPress={() => setPicker({ kind: 'type', line: idx })}
                />
              </View>
              {!service && managements.length > 0 ? (
                <View style={{ flex: 1 }}>
                  <SelectField
                    label={t('Gestiune', 'Warehouse')}
                    value={
                      managementName(lineManagementId(line)) ?? (line.management_name as string | undefined) ?? null
                    }
                    placeholder={t('Alege', 'Choose')}
                    onPress={() => setPicker({ kind: 'gestiune', line: idx })}
                  />
                </View>
              ) : null}
            </View>
          </Card>
        );
      })}

      <Card>
        <View style={styles.totalRow}>
          <Txt tone="soft">{t('Total valoare', 'Total value')}</Txt>
          <Txt weight="600">{formatMoney(nir.total_valoare)}</Txt>
        </View>
        <View style={styles.totalRow}>
          <Txt tone="soft">{t('Total TVA', 'Total VAT')}</Txt>
          <Txt weight="600">{formatMoney(nir.total_tva)}</Txt>
        </View>
        <View style={styles.totalRow}>
          <Txt weight="700">{t('Total', 'Total')}</Txt>
          <Txt weight="700">{formatMoney(num(nir.total_valoare) + num(nir.total_tva))}</Txt>
        </View>
      </Card>

      <SectionTitle size="small" title={t('Comisia de recepție', 'Receiving committee')} />
      <Card>
        <Field
          label={t('Membru 1', 'Member 1')}
          value={String(nir.comisie_nume_1 ?? '')}
          onChangeText={(v) => setField('comisie_nume_1', v)}
        />
        <Field
          label={t('Membru 2', 'Member 2')}
          value={String(nir.comisie_nume_2 ?? '')}
          onChangeText={(v) => setField('comisie_nume_2', v)}
        />
        <Field
          label={t('Membru 3', 'Member 3')}
          value={String(nir.comisie_nume_3 ?? '')}
          onChangeText={(v) => setField('comisie_nume_3', v)}
        />
        <Field
          label={t('Primit în gestiune de', 'Received into stock by')}
          value={String(nir.primit_in_gestiune_nume ?? '')}
          onChangeText={(v) => setField('primit_in_gestiune_nume', v)}
        />
      </Card>

      {picker?.kind === 'gestiune' ? (
        <PickerSheet
          visible
          onClose={() => setPicker(null)}
          title={t('Gestiune', 'Warehouse')}
          items={managements}
          keyOf={(m) => m.id}
          labelOf={(m) => m.name || m.code}
          sublabelOf={(m) => m.code}
          onSelect={(m) => applyManagement(picker.line, m)}
        />
      ) : null}
      {picker?.kind === 'type' ? (
        <PickerSheet
          visible
          onClose={() => setPicker(null)}
          title={t('Tip articol', 'Item type')}
          items={ARTICLE_TYPES}
          keyOf={(a) => a.value}
          labelOf={(a) => t(a.ro, a.en)}
          selectedKey={lineArticleType(lines[picker.line])}
          onSelect={(a) => setLine(picker.line, { article_type: a.value, articleType: a.value })}
        />
      ) : null}
      <Button title={t('Înapoi la documente', 'Back to documents')} variant="ghost" onPress={onBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', gap: space.md },
  twoCol: { flexDirection: 'row', gap: space.md },
  lineCard: { marginBottom: space.md },
  lineHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
