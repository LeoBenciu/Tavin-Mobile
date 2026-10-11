import type {
  EFacturaStatus,
  InvoiceStatus,
  InvoiceType,
  IssuedInvoiceListItem,
  PendingUpload,
  TaskStatus,
} from '@/api/types';
import type { Translate } from '@/i18n';
import type { IconName } from '@/components/ui';
import type { Tone } from '@/theme';

export function invoiceNumber(inv: { series: string; number: number }): string {
  return `${inv.series}${inv.series ? ' ' : ''}${inv.number}`;
}

export function invoiceTypeLabel(t: Translate, type: InvoiceType | string): string {
  switch (type) {
    case 'PROFORMA':
      return t('Proformă', 'Proforma');
    case 'CREDIT_NOTE':
      return t('Storno', 'Credit note');
    case 'AVIZ':
      return t('Aviz', 'Delivery note');
    case 'RECEIPT':
      return t('Chitanță', 'Receipt');
    default:
      return t('Factură', 'Invoice');
  }
}

/** One status a business owner cares about: paid, overdue, waiting… */
export function invoiceStatus(
  t: Translate,
  inv: Pick<IssuedInvoiceListItem, 'status' | 'paymentStatus' | 'dueDate'>,
): {
  label: string;
  tone: Tone;
} {
  const status = inv.status as InvoiceStatus;
  if (status === 'DRAFT') return { label: t('Ciornă', 'Draft'), tone: 'neutral' };
  if (status === 'CANCELLED') return { label: t('Anulată', 'Cancelled'), tone: 'neutral' };
  if (status === 'PAID' || inv.paymentStatus === 'FULLY_PAID' || inv.paymentStatus === 'OVERPAID') {
    return { label: t('Încasată', 'Paid'), tone: 'good' };
  }
  if (status === 'OVERDUE') return { label: t('Restantă', 'Overdue'), tone: 'danger' };
  if (status === 'PARTIALLY_PAID' || inv.paymentStatus === 'PARTIALLY_PAID') {
    return { label: t('Încasată parțial', 'Partly paid'), tone: 'warn' };
  }
  return { label: t('Neîncasată', 'Unpaid'), tone: 'accent' };
}

export function efacturaStatus(
  t: Translate,
  s: EFacturaStatus | string,
): { label: string; tone: Tone; icon: IconName } {
  switch (s) {
    case 'ACCEPTED':
      return { label: t('Acceptată ANAF', 'Accepted by ANAF'), tone: 'good', icon: 'checkmark-circle' };
    case 'PENDING':
      return { label: t('În procesare ANAF', 'Processing at ANAF'), tone: 'warn', icon: 'time' };
    case 'REJECTED':
      return { label: t('Respinsă ANAF', 'Rejected by ANAF'), tone: 'danger', icon: 'close-circle' };
    case 'ERROR':
      return { label: t('Eroare SPV', 'SPV error'), tone: 'danger', icon: 'alert-circle' };
    default:
      return { label: t('Netrimisă în SPV', 'Not sent to SPV'), tone: 'neutral', icon: 'cloud-upload-outline' };
  }
}

/** Fiscal documents that go to ANAF e-Factura. */
export function isEfacturaDocument(type: string): boolean {
  return type === 'REGULAR' || type === 'CREDIT_NOTE';
}

export function uploadStatus(t: Translate, u: PendingUpload): { label: string; tone: Tone } {
  if (u.hasError) return { label: t('Eroare', 'Error'), tone: 'danger' };
  if (u.isReady) return { label: t('Gata pentru contabil', 'Ready for accountant'), tone: 'good' };
  return { label: t('Se procesează', 'Processing'), tone: 'warn' };
}

export function documentTypeLabel(t: Translate, type: string): string {
  // Same labels as the web portal's Documente page (DOC_TYPE_LABELS).
  const map: Record<string, [string, string]> = {
    Invoice: ['Factură', 'Invoice'],
    FACTURA_EMISA: ['Factură', 'Invoice'],
    invoice_issued: ['Factură', 'Invoice'],
    Receipt: ['Chitanță', 'Receipt'],
    CreditNote: ['Factură storno', 'Credit note'],
    'Bank Statement': ['Extras de cont', 'Bank statement'],
    Contract: ['Contract', 'Contract'],
    'Z Report': ['Raport Z', 'Z report'],
    'Payment Disposition': ['Dispoziție de plată', 'Payment disposition'],
    'Collection Disposition': ['Dispoziție de încasare', 'Collection disposition'],
    NIR: ['NIR', 'Goods receipt (NIR)'],
  };
  const pair = map[type];
  return pair ? t(pair[0], pair[1]) : type;
}

export function taskStatusLabel(t: Translate, s: TaskStatus): { label: string; tone: Tone } {
  switch (s) {
    case 'COMPLETED':
      return { label: t('Finalizată', 'Done'), tone: 'good' };
    case 'IN_PROGRESS':
      return { label: t('În lucru', 'In progress'), tone: 'warn' };
    case 'CANCELLED':
      return { label: t('Anulată', 'Cancelled'), tone: 'neutral' };
    default:
      return { label: t('De făcut', 'To do'), tone: 'accent' };
  }
}

// ── VAT, units and article types (Prisma enums on the server) ──

/**
 * Article VAT (enum) → invoice line rate. Mirrors the web: legacy 9% / 19%
 * articles invoice at the current 11% / 21%, and a non-VAT-payer charges 0%.
 */
export function vatRateForArticle(vat: string | null | undefined, isNeplatitorTva: boolean): number {
  if (isNeplatitorTva) return 0;
  const v = String(vat ?? '').toUpperCase();
  if (v === 'NINE' || v === '9') return 11;
  if (v === 'NINETEEN' || v === '19') return 21;
  const map: Record<string, number> = { TWENTYONE: 21, ELEVEN: 11, FIVE: 5, ZERO: 0 };
  if (v in map) return map[v];
  const n = Number(v);
  return Number.isFinite(n) ? n : 21;
}

export const VAT_RATES = [21, 11, 5, 0] as const;

export const ARTICLE_VAT_OPTIONS: { value: string; label: string }[] = [
  { value: 'TWENTYONE', label: '21%' },
  { value: 'ELEVEN', label: '11%' },
  { value: 'FIVE', label: '5%' },
  { value: 'ZERO', label: '0%' },
];

export function articleVatLabel(vat: string): string {
  return (
    ARTICLE_VAT_OPTIONS.find((o) => o.value === vat)?.label ??
    (vat === 'NINE' ? '9%' : vat === 'NINETEEN' ? '19%' : vat)
  );
}

export const UNITS: { value: string; ro: string; en: string }[] = [
  { value: 'BUCATA', ro: 'buc', en: 'pcs' },
  { value: 'ORA', ro: 'oră', en: 'hour' },
  { value: 'ZI_DE_LUCRU', ro: 'zi', en: 'day' },
  { value: 'LUNI_DE_LUCRU', ro: 'lună', en: 'month' },
  { value: 'UNITATE_DE_SERVICE', ro: 'serviciu', en: 'service' },
  { value: 'KILOGRAM', ro: 'kg', en: 'kg' },
  { value: 'GRAM', ro: 'g', en: 'g' },
  { value: 'TONA', ro: 't', en: 't' },
  { value: 'LITRU', ro: 'l', en: 'l' },
  { value: 'MILILITRU', ro: 'ml', en: 'ml' },
  { value: 'METRU', ro: 'm', en: 'm' },
  { value: 'METRU_PATRAT', ro: 'mp', en: 'sq m' },
  { value: 'METRU_CUB', ro: 'mc', en: 'cu m' },
  { value: 'KILOMETRU', ro: 'km', en: 'km' },
  { value: 'SET', ro: 'set', en: 'set' },
  { value: 'PERECHE', ro: 'pereche', en: 'pair' },
  { value: 'CUTIE', ro: 'cutie', en: 'box' },
  { value: 'PACHET', ro: 'pachet', en: 'pack' },
  { value: 'SAC', ro: 'sac', en: 'bag' },
  { value: 'KILOWATT_ORA', ro: 'kWh', en: 'kWh' },
];

export function unitLabel(t: Translate, value: string | null | undefined): string {
  const u = UNITS.find((x) => x.value === value || x.ro === String(value ?? '').toLowerCase());
  if (u) return t(u.ro, u.en);
  if (!value || value === 'BUC') return t('buc', 'pcs');
  return String(value).toLowerCase();
}

/** Article types a small business actually picks from the phone. */
export const ARTICLE_TYPES: { value: string; ro: string; en: string }[] = [
  { value: 'MARFURI', ro: 'Marfă', en: 'Goods' },
  { value: 'SERVICII_VANDUTE', ro: 'Serviciu', en: 'Service' },
  { value: 'PRODUSE_FINITE', ro: 'Produs finit', en: 'Finished product' },
  { value: 'MATERII_PRIME', ro: 'Materie primă', en: 'Raw material' },
  { value: 'MATERIALE_AUXILIARE', ro: 'Materiale auxiliare', en: 'Auxiliary materials' },
  { value: 'OBIECTE_DE_INVENTAR', ro: 'Obiecte de inventar', en: 'Inventory items' },
  { value: 'AMBALAJE', ro: 'Ambalaje', en: 'Packaging' },
  { value: 'COMBUSTIBILI', ro: 'Combustibili', en: 'Fuel' },
];

export function articleTypeLabel(t: Translate, value: string): string {
  const a = ARTICLE_TYPES.find((x) => x.value === value);
  return a ? t(a.ro, a.en) : value;
}

/** Same rule as the server (stock.constants): goods move stock, services don't. */
export function isServiceType(type: string | null | undefined): boolean {
  return String(type ?? '')
    .toUpperCase()
    .startsWith('SERVICII');
}

export function lineTotals(line: { quantity: number; unitPrice: number; vatRate: number; discountPercent?: number }) {
  const gross = line.quantity * line.unitPrice;
  const net = gross * (1 - (line.discountPercent ?? 0) / 100);
  const vat = (net * line.vatRate) / 100;
  return { net: round2(net), vat: round2(vat), total: round2(net + vat) };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Next numeric partner code, as the web portal generates it. */
export function nextNumericCode(items: { code?: string | null }[]): string {
  const numeric = items
    .map((i) => String(i.code ?? '').trim())
    .filter((c) => /^\d+$/.test(c))
    .map(Number);
  return String(numeric.length ? Math.max(...numeric) + 1 : items.length + 1);
}
