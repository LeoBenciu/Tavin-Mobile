import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  useCreateInvoiceMutation,
  useCreatePartnerMutation,
  useGetArticlesQuery,
  useGetInvoiceSettingsQuery,
  useGetManagementsQuery,
  useGetPartnersQuery,
  useGetSequencesQuery,
  useLookupCompanyMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { Article, NewInvoice, Partner } from '@/api/types';
import { Screen } from '@/components/Screen';
import { PickerSheet, Sheet } from '@/components/Sheet';
import {
  Banner,
  Button,
  Card,
  Chip,
  Divider,
  Field,
  ListRow,
  Segmented,
  SectionTitle,
  SelectField,
  ToggleRow,
  Txt,
} from '@/components/ui';
import { useT } from '@/i18n';
import { notify } from '@/lib/confirm';
import {
  isServiceType,
  lineTotals,
  nextNumericCode,
  round2,
  UNITS,
  unitLabel,
  VAT_RATES,
  vatRateForArticle,
} from '@/lib/domain';
import { addDays, formatMoney, isoDay, isValidIsoDay, parseAmount } from '@/lib/format';
import { space, useColors } from '@/theme';

type DocType = 'REGULAR' | 'PROFORMA' | 'AVIZ';
const DEFAULT_SERIES: Record<DocType, string> = { REGULAR: 'FV', PROFORMA: 'PRO', AVIZ: 'AV' };

type ClientInfo = {
  id?: number;
  name: string;
  ein: string;
  regCom: string;
  address: string;
  city: string;
  county: string;
  email: string;
  phone: string;
  vatPayer?: boolean;
};

const EMPTY_CLIENT: ClientInfo = {
  name: '',
  ein: '',
  regCom: '',
  address: '',
  city: '',
  county: '',
  email: '',
  phone: '',
};

type Line = {
  key: string;
  articleId?: number;
  articleCode?: string;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  unitPrice: string;
  vatRate: number;
  discountPercent: string;
  articleType: string;
  managementId?: number;
};

let lineSeq = 0;
const newKey = () => `l${Date.now()}-${lineSeq++}`;

export default function NewInvoiceScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();

  const { data: settings } = useGetInvoiceSettingsQuery();
  const { data: sequences = [] } = useGetSequencesQuery();
  const { data: clients = [] } = useGetPartnersQuery('clients');
  const { data: articles = [] } = useGetArticlesQuery();
  const { data: managements = [] } = useGetManagementsQuery();
  const [createInvoice, { isLoading: creating }] = useCreateInvoiceMutation();
  const [createPartner] = useCreatePartnerMutation();

  const isNeplatitorTva = !!settings?.isNeplatitorTva;
  const defaultVat = isNeplatitorTva ? 0 : 21;

  const [docType, setDocTypeState] = useState<DocType>('REGULAR');
  // Typed values override the defaults derived from sequences / invoice settings.
  const [seriesInput, setSeries] = useState<string | null>(null);
  const [numberInput, setNumber] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState(isoDay());
  const [dueInput, setDueDate] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'RON' | 'EUR' | 'USD'>('RON');
  const [client, setClient] = useState<ClientInfo>(EMPTY_CLIENT);
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState('');
  const [efacturaAutoSubmit, setEfacturaAutoSubmit] = useState(true);
  const [autoEmailInput, setAutoEmail] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [clientPicker, setClientPicker] = useState(false);
  const [clientEditor, setClientEditor] = useState(false);
  const [articlePicker, setArticlePicker] = useState(false);
  const [editingLine, setEditingLine] = useState<string | null>(null);

  // Series and next number follow the document type, like the web portal.
  const defaults = useMemo(() => {
    const year = new Date().getFullYear();
    const def = sequences.find((x) => x.invoiceType === docType && x.isDefault);
    const ser = def?.series ?? DEFAULT_SERIES[docType];
    const seq = sequences.find((x) => x.series === ser && x.year === year && x.invoiceType === docType);
    return { series: ser, number: String(Math.max(1, (seq?.currentNumber ?? 0) + 1)) };
  }, [docType, sequences]);
  const series = seriesInput ?? defaults.series;
  const number = numberInput ?? defaults.number;
  const dueDate = dueInput ?? addDays(issueDate, settings?.defaultPaymentTermDays ?? 15);
  const autoEmail = autoEmailInput ?? !!settings?.autoSendInvoiceEmail;

  const setDocType = (next: DocType) => {
    setDocTypeState(next);
    // A new document type has its own series and counter.
    setSeries(null);
    setNumber(null);
  };

  const computed = useMemo(() => {
    let net = 0;
    let vat = 0;
    for (const l of lines) {
      const tt = lineTotals({
        quantity: parseAmount(l.quantity) ?? 0,
        unitPrice: parseAmount(l.unitPrice) ?? 0,
        vatRate: isNeplatitorTva ? 0 : l.vatRate,
        discountPercent: parseAmount(l.discountPercent) ?? 0,
      });
      net += tt.net;
      vat += tt.vat;
    }
    return { net: round2(net), vat: round2(vat), total: round2(net + vat) };
  }, [lines, isNeplatitorTva]);

  const pickClient = (p: Partner) =>
    setClient({
      id: p.id,
      name: p.name,
      ein: p.ein ?? '',
      regCom: '',
      address: p.address ?? '',
      city: p.localitate ?? '',
      county: p.judet ?? '',
      email: p.email ?? '',
      phone: p.phone ?? '',
    });

  const addArticle = (a: Article): string => {
    const key = newKey();
    setLines((ls) => [
      ...ls,
      {
        key,
        articleId: a.id,
        articleCode: a.code,
        description: a.name,
        quantity: '1',
        unitOfMeasure: a.unitOfMeasure || 'BUCATA',
        unitPrice: '',
        vatRate: vatRateForArticle(a.vat, isNeplatitorTva),
        discountPercent: '',
        articleType: a.type || 'MARFURI',
        managementId: !isServiceType(a.type) ? managements[0]?.id : undefined,
      },
    ]);
    return key;
  };

  const addFreeLine = (service: boolean) => {
    const key = newKey();
    setLines((ls) => [
      ...ls,
      {
        key,
        description: '',
        quantity: '1',
        unitOfMeasure: service ? 'UNITATE_DE_SERVICE' : 'BUCATA',
        unitPrice: '',
        vatRate: defaultVat,
        discountPercent: '',
        articleType: service ? 'SERVICII_VANDUTE' : 'MARFURI',
      },
    ]);
    setEditingLine(key);
  };

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  const validate = (): string | null => {
    if (!client.name.trim()) return t('Alege sau completează clientul.', 'Choose or enter the client.');
    if (!client.ein.trim()) return t('Completează CUI-ul clientului.', 'Enter the client’s tax ID (CUI).');
    if (!client.address.trim()) return t('Completează adresa clientului.', 'Enter the client’s address.');
    if (docType === 'REGULAR' && (!client.city.trim() || !client.county.trim())) {
      return t(
        'Localitatea și județul clientului sunt obligatorii pentru e-Factura.',
        'Client city and county are required for e-Factura.',
      );
    }
    if (!isValidIsoDay(issueDate) || !isValidIsoDay(dueDate))
      return t('Datele trebuie să fie de forma AAAA-LL-ZZ.', 'Dates must look like YYYY-MM-DD.');
    if (dueDate < issueDate)
      return t('Scadența nu poate fi înainte de data emiterii.', 'The due date can’t be before the issue date.');
    if (lines.length === 0) return t('Adaugă cel puțin un produs sau serviciu.', 'Add at least one item or service.');
    for (const [i, l] of lines.entries()) {
      if (!l.description.trim()) return t(`Linia ${i + 1} nu are denumire.`, `Line ${i + 1} has no description.`);
      const q = parseAmount(l.quantity);
      const p = parseAmount(l.unitPrice);
      if (q == null || q <= 0)
        return t(`Cantitatea de pe linia ${i + 1} nu e validă.`, `Line ${i + 1} has an invalid quantity.`);
      if (p == null) return t(`Completează prețul pe linia ${i + 1}.`, `Enter the price on line ${i + 1}.`);
    }
    if (autoEmail && !client.email.trim()) {
      return t(
        'Pentru trimitere automată completează emailul clientului.',
        'Automatic sending needs the client’s email.',
      );
    }
    return null;
  };

  const submit = async (saveAsDraft: boolean) => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    const body: NewInvoice = {
      invoiceType: docType,
      series: series.trim() || undefined,
      ...(number.trim() && Number.isFinite(Number(number)) ? { number: parseInt(number, 10) } : {}),
      issueDate,
      dueDate,
      currency,
      ...(client.id ? { clientId: client.id } : {}),
      clientName: client.name.trim(),
      clientEin: client.ein.trim(),
      clientRegCom: client.regCom.trim() || undefined,
      clientAddress: client.address.trim(),
      clientCity: client.city.trim() || undefined,
      clientCounty: client.county.trim() || undefined,
      ...(client.vatPayer != null ? { clientVatPayer: client.vatPayer } : {}),
      clientEmail: client.email.trim() || undefined,
      clientPhone: client.phone.trim() || undefined,
      autoSendAfterIssue: autoEmail,
      efacturaAutoSubmit: docType === 'REGULAR' ? efacturaAutoSubmit : false,
      notes: notes.trim() || undefined,
      saveAsDraft,
      lineItems: lines.map((l, i) => ({
        lineNumber: i + 1,
        ...(l.articleId != null ? { articleId: l.articleId } : {}),
        ...(l.articleCode ? { articleCode: l.articleCode } : {}),
        description: l.description.trim(),
        quantity: parseAmount(l.quantity) ?? 1,
        unitOfMeasure: l.unitOfMeasure,
        unitPrice: parseAmount(l.unitPrice) ?? 0,
        vatRate: isNeplatitorTva ? 0 : l.vatRate,
        ...(parseAmount(l.discountPercent) ? { discountPercent: parseAmount(l.discountPercent)! } : {}),
        articleType: l.articleType,
        ...(l.managementId != null ? { managementId: l.managementId } : {}),
      })),
    };
    try {
      const created = await createInvoice(body).unwrap();
      router.replace({ pathname: '/invoices/[id]', params: { id: String(created.id) } });
    } catch (e) {
      setError(errorMessage(e, t('Nu am putut crea documentul.', 'Couldn’t create the document.')));
    }
  };

  const lineBeingEdited = lines.find((l) => l.key === editingLine) ?? null;

  return (
    <Screen
      keyboard
      footer={
        <View style={styles.footerRow}>
          <Button
            title={t('Ciornă', 'Draft')}
            variant="secondary"
            onPress={() => submit(true)}
            disabled={creating}
            style={{ flex: 1 }}
          />
          <Button
            title={docType === 'REGULAR' ? t('Emite factura', 'Issue invoice') : t('Emite', 'Issue')}
            icon="send"
            onPress={() => submit(false)}
            loading={creating}
            style={{ flex: 2 }}
          />
        </View>
      }>
      <Segmented
        value={docType}
        onChange={setDocType}
        options={[
          { value: 'REGULAR', label: t('Factură', 'Invoice') },
          { value: 'PROFORMA', label: t('Proformă', 'Proforma') },
          { value: 'AVIZ', label: t('Aviz', 'Delivery note') },
        ]}
      />

      {error ? (
        <View style={{ marginTop: space.md }}>
          <Banner tone="danger" icon="alert-circle" title={error} />
        </View>
      ) : null}
      {isNeplatitorTva ? (
        <View style={{ marginTop: space.md }}>
          <Banner
            tone="neutral"
            icon="information-circle-outline"
            title={t('Firmă neplătitoare de TVA', 'Not registered for VAT')}
            message={t('Liniile se emit cu TVA 0%.', 'Lines are issued with 0% VAT.')}
          />
        </View>
      ) : null}

      <SectionTitle title={t('Client', 'Client')} />
      {client.name ? (
        <Card onPress={() => setClientEditor(true)}>
          <View style={styles.clientRow}>
            <View style={{ flex: 1 }}>
              <Txt weight="600">{client.name}</Txt>
              <Txt variant="small" tone="muted">
                {[client.ein, client.city, client.county].filter(Boolean).join(' · ')}
              </Txt>
              {client.email ? (
                <Txt variant="small" tone="muted">
                  {client.email}
                </Txt>
              ) : null}
            </View>
            <Pressable onPress={() => setClientPicker(true)} hitSlop={8}>
              <Txt variant="small" tone="accent" weight="600">
                {t('Schimbă', 'Change')}
              </Txt>
            </Pressable>
          </View>
        </Card>
      ) : (
        <View style={styles.footerRow}>
          <Button
            title={t('Alege client', 'Choose client')}
            icon="people-outline"
            variant="secondary"
            onPress={() => setClientPicker(true)}
            style={{ flex: 1 }}
          />
          <Button
            title={t('Client nou', 'New client')}
            icon="add"
            variant="secondary"
            onPress={() => {
              setClient(EMPTY_CLIENT);
              setClientEditor(true);
            }}
            style={{ flex: 1 }}
          />
        </View>
      )}

      <SectionTitle title={t('Produse și servicii', 'Items and services')} />
      {lines.length > 0 ? (
        <Card padded={false}>
          {lines.map((l, i) => {
            const qty = parseAmount(l.quantity) ?? 0;
            const price = parseAmount(l.unitPrice) ?? 0;
            const tt = lineTotals({
              quantity: qty,
              unitPrice: price,
              vatRate: isNeplatitorTva ? 0 : l.vatRate,
              discountPercent: parseAmount(l.discountPercent) ?? 0,
            });
            return (
              <View key={l.key}>
                {i > 0 ? <Divider inset={space.lg} /> : null}
                <ListRow
                  title={l.description || t('Linie fără denumire', 'Untitled line')}
                  subtitle={`${l.quantity || 0} ${unitLabel(t, l.unitOfMeasure)} × ${formatMoney(price, currency)} · TVA ${isNeplatitorTva ? 0 : l.vatRate}%`}
                  value={formatMoney(tt.total, currency)}
                  onPress={() => setEditingLine(l.key)}
                  numberOfLines={2}
                />
              </View>
            );
          })}
        </Card>
      ) : null}
      <View style={[styles.footerRow, { marginTop: space.md }]}>
        <Button
          title={t('Din articole', 'From items')}
          icon="pricetags-outline"
          variant="secondary"
          size="sm"
          onPress={() => setArticlePicker(true)}
          style={{ flex: 1 }}
        />
        <Button
          title={t('Linie liberă', 'Custom line')}
          icon="create-outline"
          variant="secondary"
          size="sm"
          onPress={() => addFreeLine(false)}
          style={{ flex: 1 }}
        />
      </View>

      {lines.length > 0 ? (
        <Card style={{ marginTop: space.md }}>
          <View style={styles.totalRow}>
            <Txt tone="soft">{t('Fără TVA', 'Net')}</Txt>
            <Txt>{formatMoney(computed.net, currency)}</Txt>
          </View>
          <View style={styles.totalRow}>
            <Txt tone="soft">TVA</Txt>
            <Txt>{formatMoney(computed.vat, currency)}</Txt>
          </View>
          <View style={styles.totalRow}>
            <Txt variant="title" weight="700">
              {t('Total', 'Total')}
            </Txt>
            <Txt variant="title" weight="700">
              {formatMoney(computed.total, currency)}
            </Txt>
          </View>
        </Card>
      ) : null}

      <SectionTitle title={t('Detalii', 'Details')} />
      <Card>
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label={t('Serie', 'Series')} value={series} onChangeText={setSeries} autoCapitalize="characters" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('Număr', 'Number')} value={number} onChangeText={setNumber} keyboardType="number-pad" />
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('Data emiterii', 'Issue date')}
              value={issueDate}
              onChangeText={setIssueDate}
              placeholder="AAAA-LL-ZZ"
              error={issueDate && !isValidIsoDay(issueDate) ? t('AAAA-LL-ZZ', 'YYYY-MM-DD') : null}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t('Scadența', 'Due date')}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="AAAA-LL-ZZ"
              error={dueDate && !isValidIsoDay(dueDate) ? t('AAAA-LL-ZZ', 'YYYY-MM-DD') : null}
            />
          </View>
        </View>
        <View style={styles.chipRow}>
          {[0, 15, 30, 60].map((d) => (
            <Chip
              key={d}
              label={d === 0 ? t('La emitere', 'On issue') : t(`${d} zile`, `${d} days`)}
              active={dueDate === addDays(issueDate, d)}
              onPress={() => setDueDate(addDays(issueDate, d))}
            />
          ))}
        </View>
        <Txt variant="small" tone="soft" weight="500" style={{ marginTop: space.md, marginBottom: 6 }}>
          {t('Monedă', 'Currency')}
        </Txt>
        <Segmented
          value={currency}
          onChange={setCurrency}
          options={[
            { value: 'RON', label: 'RON' },
            { value: 'EUR', label: 'EUR' },
            { value: 'USD', label: 'USD' },
          ]}
        />
        <View style={{ height: space.md }} />
        <Field label={t('Mențiuni (opțional)', 'Notes (optional)')} value={notes} onChangeText={setNotes} multiline />
      </Card>

      <SectionTitle title={t('Trimitere', 'Sending')} />
      <Card padded={false}>
        {docType === 'REGULAR' ? (
          <ToggleRow
            icon="cloud-upload-outline"
            title={t('Trimite automat în SPV (e-Factura)', 'Send to SPV automatically (e-Factura)')}
            subtitle={t('Tavin o încarcă la ANAF după emitere.', 'Tavin uploads it to ANAF after issuing.')}
            value={efacturaAutoSubmit}
            onValueChange={setEfacturaAutoSubmit}
          />
        ) : null}
        {docType === 'REGULAR' ? <Divider inset={space.lg} /> : null}
        <ToggleRow
          icon="mail-outline"
          title={t('Trimite clientului pe email', 'Email it to the client')}
          subtitle={client.email || t('Necesită emailul clientului', 'Needs the client’s email')}
          value={autoEmail}
          onValueChange={setAutoEmail}
        />
      </Card>

      {/* ── Pickers & editors ── */}
      <PickerSheet
        visible={clientPicker}
        onClose={() => setClientPicker(false)}
        title={t('Alege clientul', 'Choose client')}
        items={clients}
        keyOf={(p) => p.id}
        labelOf={(p) => p.name}
        sublabelOf={(p) => [p.ein, p.localitate].filter(Boolean).join(' · ')}
        selectedKey={client.id}
        onSelect={pickClient}
        emptyText={t('Niciun client salvat încă.', 'No saved clients yet.')}
        footer={
          <ListRow
            icon="add"
            title={t('Client nou', 'New client')}
            subtitle={t('Completezi automat din CUI', 'Autofill from the tax ID')}
            onPress={() => {
              setClientPicker(false);
              setClient(EMPTY_CLIENT);
              setTimeout(() => setClientEditor(true), 300);
            }}
          />
        }
      />
      {/* Mounted only while open, so it always starts from the current client. */}
      {clientEditor ? (
        <ClientEditor
          visible
          initial={client}
          existingClients={clients}
          onClose={() => setClientEditor(false)}
          onSave={async (info, saveToList) => {
            let id = info.id;
            if (!id && saveToList) {
              try {
                const created = await createPartner({
                  kind: 'clients',
                  data: {
                    code: nextNumericCode(clients),
                    name: info.name,
                    ein: info.ein || undefined,
                    address: info.address || undefined,
                    localitate: info.city || undefined,
                    judet: info.county || undefined,
                    email: info.email || undefined,
                    phone: info.phone || undefined,
                  },
                }).unwrap();
                id = created.id;
              } catch (e) {
                notify(t('Clientul nu a fost salvat în listă', 'Client not saved to your list'), errorMessage(e));
              }
            }
            setClient({ ...info, id });
            setClientEditor(false);
          }}
        />
      ) : null}
      <PickerSheet
        visible={articlePicker}
        onClose={() => setArticlePicker(false)}
        title={t('Alege articolul', 'Choose an item')}
        items={articles}
        keyOf={(a) => a.id}
        labelOf={(a) => a.name}
        sublabelOf={(a) => [a.code, unitLabel(t, a.unitOfMeasure)].filter(Boolean).join(' · ')}
        onSelect={(a) => {
          const key = addArticle(a);
          // Open the price editor once the picker has finished closing.
          setTimeout(() => setEditingLine(key), 350);
        }}
        emptyText={t('Nu ai articole salvate. Folosește o linie liberă.', 'No saved items. Use a custom line.')}
        footer={
          <View style={styles.pickerFooter}>
            <Button
              title={t('Serviciu (linie liberă)', 'Service (custom line)')}
              icon="construct-outline"
              variant="secondary"
              size="sm"
              onPress={() => {
                setArticlePicker(false);
                setTimeout(() => addFreeLine(true), 300);
              }}
              style={{ flex: 1 }}
            />
          </View>
        }
      />
      {lineBeingEdited ? (
        <LineEditor
          line={lineBeingEdited}
          currency={currency}
          isNeplatitorTva={isNeplatitorTva}
          managements={managements}
          onChange={(patch) => updateLine(lineBeingEdited.key, patch)}
          onRemove={() => {
            removeLine(lineBeingEdited.key);
            setEditingLine(null);
          }}
          onClose={() => setEditingLine(null)}
        />
      ) : null}
      <View style={{ height: space.lg }} />
      <Txt variant="caption" tone="muted" style={{ textAlign: 'center' }}>
        <Ionicons name="lock-closed-outline" size={11} color={c.muted} />{' '}
        {t(
          'Documentul se emite pe firma ta, cu datele din Setări → Facturare.',
          'Issued on your company with the details from Settings → Invoicing.',
        )}
      </Txt>
    </Screen>
  );
}

function LineEditor({
  line,
  currency,
  isNeplatitorTva,
  managements,
  onChange,
  onRemove,
  onClose,
}: {
  line: Line;
  currency: string;
  isNeplatitorTva: boolean;
  managements: { id: number; name: string; code: string }[];
  onChange: (patch: Partial<Line>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [unitPicker, setUnitPicker] = useState(false);
  const [mgmtPicker, setMgmtPicker] = useState(false);
  const service = isServiceType(line.articleType);
  const tt = lineTotals({
    quantity: parseAmount(line.quantity) ?? 0,
    unitPrice: parseAmount(line.unitPrice) ?? 0,
    vatRate: isNeplatitorTva ? 0 : line.vatRate,
    discountPercent: parseAmount(line.discountPercent) ?? 0,
  });

  return (
    <Sheet visible onClose={onClose} title={line.articleId ? t('Articol', 'Item') : t('Linie', 'Line')}>
      <View style={{ paddingHorizontal: space.lg }}>
        <Field
          label={t('Denumire', 'Description')}
          value={line.description}
          onChangeText={(v) => onChange({ description: v })}
          placeholder={t('ex. Consultanță octombrie', 'e.g. October consulting')}
          autoFocus={!line.description}
        />
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('Cantitate', 'Quantity')}
              value={line.quantity}
              onChangeText={(v) => onChange({ quantity: v })}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <SelectField
              label={t('UM', 'Unit')}
              value={unitLabel(t, line.unitOfMeasure)}
              placeholder="buc"
              onPress={() => setUnitPicker(true)}
            />
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={{ flex: 1.4 }}>
            <Field
              label={t(`Preț unitar fără TVA (${currency})`, `Unit price excl. VAT (${currency})`)}
              value={line.unitPrice}
              onChangeText={(v) => onChange({ unitPrice: v })}
              keyboardType="decimal-pad"
              placeholder="0,00"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t('Discount %', 'Discount %')}
              value={line.discountPercent}
              onChangeText={(v) => onChange({ discountPercent: v })}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>
        </View>
        {!isNeplatitorTva ? (
          <>
            <Txt variant="small" tone="soft" weight="500" style={{ marginBottom: 6 }}>
              {t('Cotă TVA', 'VAT rate')}
            </Txt>
            <View style={styles.chipRow}>
              {VAT_RATES.map((r) => (
                <Chip key={r} label={`${r}%`} active={line.vatRate === r} onPress={() => onChange({ vatRate: r })} />
              ))}
            </View>
          </>
        ) : null}
        {!line.articleId ? (
          <View style={[styles.chipRow, { marginTop: space.md }]}>
            <Chip
              label={t('Marfă / produs', 'Goods / product')}
              active={!service}
              onPress={() => onChange({ articleType: 'MARFURI' })}
            />
            <Chip
              label={t('Serviciu', 'Service')}
              active={service}
              onPress={() => onChange({ articleType: 'SERVICII_VANDUTE', managementId: undefined })}
            />
          </View>
        ) : null}
        {!service && managements.length > 0 ? (
          <View style={{ marginTop: space.md }}>
            <SelectField
              label={t('Gestiune (scade din stoc)', 'Warehouse (stock goes out)')}
              value={managements.find((m) => m.id === line.managementId)?.name ?? null}
              placeholder={t('Prima gestiune', 'First warehouse')}
              onPress={() => setMgmtPicker(true)}
            />
          </View>
        ) : null}
        <View style={[styles.totalRow, { marginTop: space.md }]}>
          <Txt tone="soft">{t('Total linie', 'Line total')}</Txt>
          <Txt weight="700">{formatMoney(tt.total, currency)}</Txt>
        </View>
        <View style={[styles.footerRow, { marginTop: space.md }]}>
          <Button
            title={t('Șterge', 'Remove')}
            variant="danger"
            icon="trash-outline"
            onPress={onRemove}
            style={{ flex: 1 }}
          />
          <Button title={t('Gata', 'Done')} onPress={onClose} style={{ flex: 2 }} />
        </View>
      </View>
      <PickerSheet
        visible={unitPicker}
        onClose={() => setUnitPicker(false)}
        title={t('Unitate de măsură', 'Unit of measure')}
        items={UNITS}
        keyOf={(u) => u.value}
        labelOf={(u) => t(u.ro, u.en)}
        selectedKey={line.unitOfMeasure}
        onSelect={(u) => onChange({ unitOfMeasure: u.value })}
      />
      <PickerSheet
        visible={mgmtPicker}
        onClose={() => setMgmtPicker(false)}
        title={t('Gestiune', 'Warehouse')}
        items={managements}
        keyOf={(m) => m.id}
        labelOf={(m) => m.name}
        sublabelOf={(m) => m.code}
        selectedKey={line.managementId}
        onSelect={(m) => onChange({ managementId: m.id })}
      />
    </Sheet>
  );
}

function ClientEditor({
  visible,
  initial,
  existingClients,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: ClientInfo;
  existingClients: Partner[];
  onClose: () => void;
  onSave: (info: ClientInfo, saveToList: boolean) => void | Promise<void>;
}) {
  const t = useT();
  const [info, setInfo] = useState<ClientInfo>(initial);
  const [saveToList, setSaveToList] = useState(true);
  const [lookup, { isLoading: looking }] = useLookupCompanyMutation();
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof ClientInfo, v: string) => setInfo((p) => ({ ...p, [k]: v }));

  const fromAnaf = async () => {
    const cui = info.ein.replace(/\s/g, '').replace(/^RO/i, '');
    if (!/^\d{2,10}$/.test(cui)) {
      setLookupMsg(t('CUI-ul are doar cifre (2–10).', 'The tax ID has only digits (2–10).'));
      return;
    }
    const existing = existingClients.find((p) => String(p.ein ?? '').replace(/^RO/i, '') === cui);
    try {
      const r = await lookup(cui).unwrap();
      setInfo((p) => ({
        ...p,
        id: existing?.id ?? p.id,
        name: r.name || p.name,
        ein: r.isVatPayer ? `RO${cui}` : cui,
        regCom: r.registrationNumber ?? p.regCom,
        address: r.legalAddress ?? p.address,
        city: r.city ?? p.city,
        county: r.county ?? p.county,
        email: p.email || r.email || '',
        phone: p.phone || r.phoneNumber || '',
        vatPayer: r.isVatPayer ?? p.vatPayer,
      }));
      setLookupMsg(t('Date completate de la ANAF.', 'Filled in from ANAF.'));
    } catch (e) {
      setLookupMsg(errorMessage(e, t('Firma nu a fost găsită la ANAF.', 'Company not found at ANAF.')));
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={info.id ? t('Date client', 'Client details') : t('Client nou', 'New client')}
      fullHeight>
      <Screen scroll keyboard contentStyle={{ paddingTop: 0 }}>
        <Field
          label={t('CUI', 'Tax ID (CUI)')}
          value={info.ein}
          onChangeText={(v) => set('ein', v)}
          autoCapitalize="characters"
          placeholder="RO12345678"
          hint={lookupMsg ?? undefined}
          right={
            <Pressable onPress={fromAnaf} style={{ paddingHorizontal: space.md }} hitSlop={6}>
              <Txt variant="small" tone="accent" weight="600">
                {looking ? t('Caut…', 'Searching…') : t('Caută ANAF', 'Look up')}
              </Txt>
            </Pressable>
          }
        />
        <Field label={t('Denumire', 'Name')} value={info.name} onChangeText={(v) => set('name', v)} />
        <Field
          label={t('Nr. Reg. Com.', 'Trade register no.')}
          value={info.regCom}
          onChangeText={(v) => set('regCom', v)}
        />
        <Field label={t('Adresă', 'Address')} value={info.address} onChangeText={(v) => set('address', v)} />
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label={t('Localitate', 'City')} value={info.city} onChangeText={(v) => set('city', v)} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('Județ', 'County')} value={info.county} onChangeText={(v) => set('county', v)} />
          </View>
        </View>
        <Field
          label={t('Email', 'Email')}
          value={info.email}
          onChangeText={(v) => set('email', v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label={t('Telefon', 'Phone')}
          value={info.phone}
          onChangeText={(v) => set('phone', v)}
          keyboardType="phone-pad"
        />
        {!info.id ? (
          <Card padded={false} style={{ marginBottom: space.md }}>
            <ToggleRow
              title={t('Salvează în lista de clienți', 'Save to my clients')}
              value={saveToList}
              onValueChange={setSaveToList}
            />
          </Card>
        ) : null}
        <Button
          title={t('Folosește clientul', 'Use this client')}
          loading={saving}
          onPress={async () => {
            if (!info.name.trim()) {
              setLookupMsg(t('Completează denumirea.', 'Enter the name.'));
              return;
            }
            setSaving(true);
            try {
              await onSave(info, saveToList);
            } finally {
              setSaving(false);
            }
          }}
        />
      </Screen>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', gap: space.md },
  twoCol: { flexDirection: 'row', gap: space.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  clientRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  pickerFooter: { flexDirection: 'row', paddingHorizontal: space.lg, paddingBottom: space.sm },
});
