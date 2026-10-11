import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState, type SetStateAction } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

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
import { splitMoney } from '@/components/charts';
import { DateSheet, formatDay } from '@/components/DateSheet';
import { Screen } from '@/components/Screen';
import { PickerSheet, Sheet } from '@/components/Sheet';
import {
  Amount,
  Avatar,
  Banner,
  Button,
  Card,
  Divider,
  FormGroup,
  FormInput,
  FormRow,
  ListRow,
  Segmented,
  SectionTitle,
  ToggleRow,
  Txt,
  type IconName,
} from '@/components/ui';
import { useLanguage, useT } from '@/i18n';
import { notify } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
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
import { addDays, formatMoney, initials, isoDay, isValidIsoDay, parseAmount } from '@/lib/format';
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
  const { language } = useLanguage();
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
  const [client, setClientState] = useState<ClientInfo>(EMPTY_CLIENT);
  const [lines, setLinesState] = useState<Line[]>([]);
  const [notes, setNotes] = useState('');
  const [efacturaAutoSubmit, setEfacturaAutoSubmit] = useState(true);
  const [autoEmailInput, setAutoEmail] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Fixing the client or the lines clears a validation error about them.
  const setClient = (next: SetStateAction<ClientInfo>) => {
    setError(null);
    setClientState(next);
  };
  const setLines = (next: SetStateAction<Line[]>) => {
    setError(null);
    setLinesState(next);
  };

  const [clientPicker, setClientPicker] = useState(false);
  const [clientEditor, setClientEditor] = useState(false);
  const [articlePicker, setArticlePicker] = useState(false);
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [datePicker, setDatePicker] = useState<'issue' | 'due' | null>(null);

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
      haptic.warning();
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
  const [totalAmount, totalCurrency] = splitMoney(formatMoney(computed.total, currency));
  const termDays = daysBetween(issueDate, dueDate);
  const termLabel =
    termDays == null || termDays < 0
      ? ''
      : termDays === 0
        ? t(' · la emitere', ' · on issue')
        : t(` · ${termDays} zile`, ` · ${termDays} days`);

  return (
    <Screen
      keyboard
      footer={
        <>
          {/* Errors show by the button that caused them, not at the top of a long form. */}
          {error ? <Banner tone="danger" icon="alert" title={error} /> : null}
          <View style={styles.checkout}>
            <View style={{ flex: 1 }}>
              <Txt variant="caption" tone="muted" weight="600">
                {t('Total de plată', 'Total due')}
              </Txt>
              <Amount value={totalAmount} currency={totalCurrency} size="heading" />
            </View>
            <Button title={t('Ciornă', 'Draft')} variant="secondary" onPress={() => submit(true)} disabled={creating} />
            <Button title={t('Emite', 'Issue')} icon="send" onPress={() => submit(false)} loading={creating} />
          </View>
        </>
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

      {isNeplatitorTva ? (
        <View style={{ marginTop: space.md }}>
          <Banner
            tone="neutral"
            icon="information"
            title={t('Firmă neplătitoare de TVA', 'Not registered for VAT')}
            message={t('Liniile se emit cu TVA 0%.', 'Lines are issued with 0% VAT.')}
          />
        </View>
      ) : null}

      <SectionTitle size="small" title={t('Client', 'Client')} />
      {client.name ? (
        <Card onPress={() => setClientEditor(true)} style={styles.clientCard}>
          <Avatar text={initials(client.name)} size={44} />
          <View style={{ flex: 1, gap: 1 }}>
            <Txt weight="600" numberOfLines={2}>
              {client.name}
            </Txt>
            <Txt variant="small" tone="muted" numberOfLines={1}>
              {[client.ein, client.city, client.county].filter(Boolean).join(' · ') ||
                t('Completează datele clientului', 'Complete the client details')}
            </Txt>
            {client.email ? (
              <Txt variant="small" tone="muted" numberOfLines={1}>
                {client.email}
              </Txt>
            ) : null}
          </View>
          <Button title={t('Schimbă', 'Change')} variant="secondary" size="sm" onPress={() => setClientPicker(true)} />
        </Card>
      ) : (
        <FormGroup inset={60}>
          <ListRow
            icon="people"
            iconTone="accent"
            solid
            title={t('Alege din clienți', 'Choose a saved client')}
            subtitle={
              clients.length
                ? t(`${clients.length} clienți salvați`, `${clients.length} saved clients`)
                : t('Nu ai încă clienți salvați', 'No saved clients yet')
            }
            onPress={() => setClientPicker(true)}
          />
          <ListRow
            icon="person-add"
            iconTone="sky"
            solid
            title={t('Client nou', 'New client')}
            subtitle={t('Completat automat din CUI, de la ANAF', 'Filled in from the tax ID, via ANAF')}
            onPress={() => {
              setClient(EMPTY_CLIENT);
              setClientEditor(true);
            }}
          />
        </FormGroup>
      )}

      <SectionTitle size="small" title={t('Produse și servicii', 'Items and services')} />
      <FormGroup inset={60}>
        {lines.map((l) => {
          const price = parseAmount(l.unitPrice) ?? 0;
          const tt = lineTotals({
            quantity: parseAmount(l.quantity) ?? 0,
            unitPrice: price,
            vatRate: isNeplatitorTva ? 0 : l.vatRate,
            discountPercent: parseAmount(l.discountPercent) ?? 0,
          });
          const service = isServiceType(l.articleType);
          return (
            <ListRow
              key={l.key}
              icon={service ? 'construct' : 'cube'}
              iconTone={service ? 'neutral' : 'accent'}
              title={l.description || t('Linie fără denumire', 'Untitled line')}
              titleTone={l.description ? 'default' : 'faint'}
              subtitle={`${l.quantity || 0} ${unitLabel(t, l.unitOfMeasure)} × ${formatMoney(price, currency)} · TVA ${isNeplatitorTva ? 0 : l.vatRate}%`}
              value={formatMoney(tt.total, currency)}
              onPress={() => setEditingLine(l.key)}
              chevron={false}
              numberOfLines={2}
            />
          );
        })}
        <AddRow
          icon="pricetags"
          label={t('Adaugă din articole', 'Add from your items')}
          onPress={() => setArticlePicker(true)}
        />
        <AddRow
          icon="create"
          label={t('Adaugă linie liberă', 'Add a custom line')}
          onPress={() => addFreeLine(false)}
        />
      </FormGroup>

      {lines.length > 0 ? (
        <Card style={{ marginTop: space.md }}>
          <View style={styles.totalRow}>
            <Txt tone="soft">{t('Fără TVA', 'Net')}</Txt>
            <Txt tabular>{formatMoney(computed.net, currency)}</Txt>
          </View>
          <View style={styles.totalRow}>
            <Txt tone="soft">TVA</Txt>
            <Txt tabular>{formatMoney(computed.vat, currency)}</Txt>
          </View>
          <View style={styles.totalDivider}>
            <Divider />
          </View>
          <View style={styles.totalRow}>
            <Txt variant="title">{t('Total', 'Total')}</Txt>
            <Amount value={totalAmount} currency={totalCurrency} size="heading" />
          </View>
        </Card>
      ) : null}

      <SectionTitle size="small" title={t('Detalii', 'Details')} />
      <FormGroup>
        <FormRow label={t('Serie', 'Series')}>
          <FormInput value={series} onChangeText={setSeries} autoCapitalize="characters" autoCorrect={false} />
        </FormRow>
        <FormRow label={t('Număr', 'Number')}>
          <FormInput value={number} onChangeText={setNumber} keyboardType="number-pad" />
        </FormRow>
        <FormRow
          label={t('Data emiterii', 'Issue date')}
          value={formatDay(issueDate, language)}
          onPress={() => setDatePicker('issue')}
        />
        <FormRow
          label={t('Scadența', 'Due date')}
          value={`${formatDay(dueDate, language)}${termLabel}`}
          onPress={() => setDatePicker('due')}
        />
        <FormRow label={t('Monedă', 'Currency')}>
          <View style={styles.currency}>
            <Segmented
              value={currency}
              onChange={setCurrency}
              options={[
                { value: 'RON', label: 'RON' },
                { value: 'EUR', label: 'EUR' },
                { value: 'USD', label: 'USD' },
              ]}
            />
          </View>
        </FormRow>
        <FormRow label={t('Mențiuni', 'Notes')} stacked>
          <FormInput
            align="left"
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder={t('Opțional — apar pe factură', 'Optional — printed on the invoice')}
          />
        </FormRow>
      </FormGroup>

      <SectionTitle size="small" title={t('Trimitere', 'Sending')} />
      <FormGroup inset={60}>
        {docType === 'REGULAR' ? (
          <ToggleRow
            icon="cloud-upload"
            iconTone="sky"
            solid
            title={t('Trimite automat în SPV', 'Send to SPV automatically')}
            subtitle={t(
              'e-Factura: Tavin o încarcă la ANAF după emitere',
              'e-Factura: Tavin uploads it to ANAF after issuing',
            )}
            value={efacturaAutoSubmit}
            onValueChange={setEfacturaAutoSubmit}
          />
        ) : null}
        <ToggleRow
          icon="mail"
          iconTone="accent"
          solid
          title={t('Trimite clientului pe email', 'Email it to the client')}
          subtitle={client.email || t('Necesită emailul clientului', 'Needs the client’s email')}
          value={autoEmail}
          onValueChange={setAutoEmail}
        />
      </FormGroup>

      <Txt variant="footnote" tone="muted" style={styles.note}>
        <Ionicons name="lock-closed" size={11} color={c.muted} />{' '}
        {t(
          'Documentul se emite pe firma ta, cu datele din Setări → Facturare.',
          'Issued on your company with the details from Settings → Invoicing.',
        )}
      </Txt>

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
            icon="person-add"
            iconTone="sky"
            solid
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
          <ListRow
            icon="construct"
            iconTone="neutral"
            solid
            title={t('Serviciu (linie liberă)', 'Service (custom line)')}
            subtitle={t('Fără articol salvat', 'Without a saved item')}
            onPress={() => {
              setArticlePicker(false);
              setTimeout(() => addFreeLine(true), 300);
            }}
          />
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
      {datePicker ? (
        <DateSheet
          title={datePicker === 'issue' ? t('Data emiterii', 'Issue date') : t('Scadența', 'Due date')}
          value={datePicker === 'issue' ? issueDate : dueDate}
          onChange={datePicker === 'issue' ? setIssueDate : setDueDate}
          onClose={() => setDatePicker(null)}
          shortcuts={
            datePicker === 'issue'
              ? [{ label: t('Azi', 'Today'), value: isoDay() }]
              : DUE_TERMS.map((d) => ({
                  label: d === 0 ? t('La emitere', 'On issue') : t(`${d} zile`, `${d} days`),
                  value: addDays(issueDate, d),
                }))
          }
        />
      ) : null}
    </Screen>
  );
}

const DUE_TERMS = [0, 15, 30, 60];

/** Whole days from one calendar day to another, or null if either is invalid. */
function daysBetween(from: string, to: string): number | null {
  if (!isValidIsoDay(from) || !isValidIsoDay(to)) return null;
  const [a, b] = [from, to].map((s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

/** iOS "add" row inside a group: accent plus and label. */
function AddRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.addRow, pressed && { backgroundColor: c.surfaceAlt }]}>
      <View style={styles.addIcon}>
        <Ionicons name="add-circle" size={26} color={c.accentText} />
      </View>
      <Txt weight="600" tone="accent" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Ionicons name={icon} size={18} color={c.faint} />
    </Pressable>
  );
}

const formatQty = (n: number) =>
  Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000).replace('.', ',');

/** − [ quantity ] + */
function Stepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const c = useColors();
  const t = useT();
  const n = parseAmount(value) ?? 0;
  const step = (delta: number) => {
    haptic.selection();
    onChange(formatQty(Math.max(0, n + delta)));
  };
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => step(-1)}
        disabled={n <= 1}
        hitSlop={4}
        accessibilityLabel={t('Mai puțin', 'Less')}
        style={({ pressed }) => [
          styles.stepButton,
          { backgroundColor: c.fill },
          (n <= 1 || pressed) && { opacity: n <= 1 ? 0.35 : 0.6 },
        ]}>
        <Ionicons name="remove" size={18} color={c.text} />
      </Pressable>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        selectTextOnFocus
        selectionColor={c.accent}
        style={[styles.stepInput, { color: c.text }]}
      />
      <Pressable
        onPress={() => step(1)}
        hitSlop={4}
        accessibilityLabel={t('Mai mult', 'More')}
        style={({ pressed }) => [styles.stepButton, { backgroundColor: c.fill }, pressed && { opacity: 0.6 }]}>
        <Ionicons name="add" size={18} color={c.text} />
      </Pressable>
    </View>
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
  const c = useColors();
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
  const [lineAmount, lineCurrency] = splitMoney(formatMoney(tt.total, currency));
  // Keep a rate the item already carries selectable even if it is not a current rate.
  const rates = [...new Set<number>([...VAT_RATES, line.vatRate])];

  return (
    <Sheet visible onClose={onClose} title={line.articleId ? t('Articol', 'Item') : t('Linie', 'Line')}>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
        <FormGroup>
          <FormRow label={t('Denumire', 'Description')} stacked>
            <FormInput
              align="left"
              value={line.description}
              onChangeText={(v) => onChange({ description: v })}
              placeholder={t('ex. Consultanță octombrie', 'e.g. October consulting')}
              autoFocus={!line.description}
            />
          </FormRow>
        </FormGroup>

        <FormGroup style={{ marginTop: space.md }}>
          <FormRow label={t('Cantitate', 'Quantity')}>
            <View style={styles.fill}>
              <Stepper value={line.quantity} onChange={(v) => onChange({ quantity: v })} />
            </View>
          </FormRow>
          <FormRow
            label={t('Unitate de măsură', 'Unit')}
            value={unitLabel(t, line.unitOfMeasure)}
            onPress={() => setUnitPicker(true)}
          />
          <FormRow label={t('Preț fără TVA', 'Price excl. VAT')}>
            <FormInput
              value={line.unitPrice}
              onChangeText={(v) => onChange({ unitPrice: v })}
              keyboardType="decimal-pad"
              placeholder="0,00"
            />
            <Txt tone="muted">{currency}</Txt>
          </FormRow>
          <FormRow label={t('Discount', 'Discount')}>
            <FormInput
              value={line.discountPercent}
              onChangeText={(v) => onChange({ discountPercent: v })}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <Txt tone="muted">%</Txt>
          </FormRow>
          {!service && managements.length > 0 ? (
            <FormRow
              label={t('Gestiune', 'Warehouse')}
              value={managements.find((m) => m.id === line.managementId)?.name ?? null}
              placeholder={t('Prima gestiune', 'First warehouse')}
              onPress={() => setMgmtPicker(true)}
            />
          ) : null}
        </FormGroup>

        {!isNeplatitorTva ? (
          <>
            <Txt variant="label" tone="muted" style={styles.groupLabel}>
              {t('Cotă TVA', 'VAT rate')}
            </Txt>
            <Segmented
              value={String(line.vatRate)}
              onChange={(v) => onChange({ vatRate: Number(v) })}
              options={rates.map((r) => ({ value: String(r), label: `${r}%` }))}
            />
          </>
        ) : null}
        {!line.articleId ? (
          <>
            <Txt variant="label" tone="muted" style={styles.groupLabel}>
              {t('Tip', 'Type')}
            </Txt>
            <Segmented
              value={service ? 'service' : 'goods'}
              onChange={(v) =>
                onChange(
                  v === 'service'
                    ? { articleType: 'SERVICII_VANDUTE', managementId: undefined }
                    : { articleType: 'MARFURI' },
                )
              }
              options={[
                { value: 'goods', label: t('Marfă / produs', 'Goods / product') },
                { value: 'service', label: t('Serviciu', 'Service') },
              ]}
            />
          </>
        ) : null}

        <View style={[styles.lineTotal, { backgroundColor: c.accentSoft }]}>
          <Txt weight="600" tone="accent">
            {t('Total linie, cu TVA', 'Line total incl. VAT')}
          </Txt>
          <Amount value={lineAmount} currency={lineCurrency} size="heading" tone="accent" />
        </View>
        <View style={styles.footerRow}>
          <Button
            title={t('Șterge', 'Remove')}
            variant="danger"
            icon="trash-outline"
            onPress={onRemove}
            style={{ flex: 1 }}
          />
          <Button title={t('Gata', 'Done')} icon="checkmark" onPress={onClose} style={{ flex: 1.6 }} />
        </View>
      </ScrollView>
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
  const [lookupMsg, setLookupMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof ClientInfo, v: string) => setInfo((p) => ({ ...p, [k]: v }));

  const fromAnaf = async () => {
    const cui = info.ein.replace(/\s/g, '').replace(/^RO/i, '');
    if (!/^\d{2,10}$/.test(cui)) {
      setLookupMsg({ text: t('CUI-ul are doar cifre (2–10).', 'The tax ID has only digits (2–10).'), ok: false });
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
      haptic.success();
      setLookupMsg({ text: t('Date completate de la ANAF.', 'Filled in from ANAF.'), ok: true });
    } catch (e) {
      setLookupMsg({
        text: errorMessage(e, t('Firma nu a fost găsită la ANAF.', 'Company not found at ANAF.')),
        ok: false,
      });
    }
  };

  const LABEL = 118;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={info.id ? t('Date client', 'Client details') : t('Client nou', 'New client')}
      fullHeight>
      <Screen scroll keyboard insetAdjust={false} contentStyle={{ paddingTop: 0 }}>
        <FormGroup>
          <FormRow label="CUI" labelWidth={LABEL}>
            <FormInput
              align="left"
              value={info.ein}
              onChangeText={(v) => set('ein', v)}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="RO12345678"
              returnKeyType="search"
              onSubmitEditing={fromAnaf}
            />
            <Button
              title={t('Caută ANAF', 'Look up')}
              icon="search"
              variant="secondary"
              size="sm"
              loading={looking}
              onPress={fromAnaf}
            />
          </FormRow>
        </FormGroup>
        <Txt
          variant="footnote"
          tone={lookupMsg ? (lookupMsg.ok ? 'good' : 'danger') : 'muted'}
          style={styles.lookupNote}>
          {lookupMsg?.text ??
            t(
              'Scrie CUI-ul și caută la ANAF — completăm noi restul.',
              'Type the tax ID and look it up — we fill in the rest.',
            )}
        </Txt>

        <FormGroup style={{ marginTop: space.lg }}>
          <FormRow label={t('Denumire', 'Name')} labelWidth={LABEL}>
            <FormInput align="left" value={info.name} onChangeText={(v) => set('name', v)} />
          </FormRow>
          <FormRow label={t('Nr. Reg. Com.', 'Trade reg. no.')} labelWidth={LABEL}>
            <FormInput
              align="left"
              value={info.regCom}
              onChangeText={(v) => set('regCom', v)}
              placeholder="J12/345/2020"
            />
          </FormRow>
          <FormRow label={t('Adresă', 'Address')} labelWidth={LABEL}>
            <FormInput align="left" value={info.address} onChangeText={(v) => set('address', v)} />
          </FormRow>
          <FormRow label={t('Localitate', 'City')} labelWidth={LABEL}>
            <FormInput align="left" value={info.city} onChangeText={(v) => set('city', v)} />
          </FormRow>
          <FormRow label={t('Județ', 'County')} labelWidth={LABEL}>
            <FormInput align="left" value={info.county} onChangeText={(v) => set('county', v)} />
          </FormRow>
        </FormGroup>

        <FormGroup style={{ marginTop: space.lg }}>
          <FormRow label={t('Email', 'Email')} labelWidth={LABEL}>
            <FormInput
              align="left"
              value={info.email}
              onChangeText={(v) => set('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t('pentru trimiterea facturii', 'to send the invoice')}
            />
          </FormRow>
          <FormRow label={t('Telefon', 'Phone')} labelWidth={LABEL}>
            <FormInput align="left" value={info.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
          </FormRow>
        </FormGroup>

        {!info.id ? (
          <FormGroup style={{ marginTop: space.lg }}>
            <ToggleRow
              title={t('Salvează în lista de clienți', 'Save to my clients')}
              value={saveToList}
              onValueChange={setSaveToList}
            />
          </FormGroup>
        ) : null}
        <Button
          title={t('Folosește clientul', 'Use this client')}
          icon="checkmark"
          loading={saving}
          style={{ marginTop: space.xl }}
          onPress={async () => {
            if (!info.name.trim()) {
              setLookupMsg({ text: t('Completează denumirea.', 'Enter the name.'), ok: false });
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
  checkout: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  clientCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  totalDivider: { marginVertical: space.sm },
  currency: { width: 190, marginLeft: 'auto' },
  note: { textAlign: 'center', marginTop: space.xl, paddingHorizontal: space.lg },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52 },
  addIcon: { width: 32, alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepInput: { width: 64, minHeight: 40, fontSize: 17, fontWeight: '600', textAlign: 'center', paddingVertical: 0 },
  fill: { flex: 1, alignItems: 'flex-end' },
  sheetBody: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  groupLabel: { marginTop: space.lg, marginBottom: 7, paddingHorizontal: space.lg },
  lineTotal: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: 16,
  },
  footerRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  lookupNote: { marginTop: 7, paddingHorizontal: space.lg },
});
