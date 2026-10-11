import type { NirData, NirLine } from '@/api/types';
import { round2 } from './domain';

const pad = (n: number) => String(n).padStart(2, '0');

function todayDDMMYYYY(): string {
  const d = new Date();
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Any stored date ("2026-10-10", "10.10.2026") → "10-10-2026", as the NIR PDF prints it. */
export function toDDMMYYYY(value: unknown): string {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (/^nan[-./]nan[-./]nan$/i.test(s) || /^invalid date$/i.test(s)) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const dot = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
  if (dot) return `${dot[1].padStart(2, '0')}-${dot[2].padStart(2, '0')}-${dot[3]}`;
  return s;
}

export function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '')
    .trim()
    .replace(/\s/g, '');
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Brings a stored NIR to the "Notă de recepție" shape the web portal edits
 * (port of normalizeNirToNewFormat in ClientDocuments.tsx).
 */
export function normalizeNir(
  raw: NirData,
  opts: { nirDocumentId: number; companyName?: string; companyAddress?: string },
): NirData {
  const d = raw as Record<string, any>;
  let out: NirData;
  if (d?.title === 'Nota de receptie' || d?.nr_nir !== undefined) {
    out = JSON.parse(JSON.stringify(raw)) as NirData;
    out.data = toDDMMYYYY(out.data) || todayDDMMYYYY();
    out.data_receptie = toDDMMYYYY(out.data_receptie) || out.data;
  } else {
    const oldLines: any[] = Array.isArray(d?.line_items) ? d.line_items : [];
    const line_items: NirLine[] = oldLines.map((item, idx) => {
      const cant = num(item.cantitate ?? item.quantity);
      const pu = num(item.pret_unitar ?? item.unit_price ?? item.unitPrice);
      return {
        ...item,
        nr_crt: idx + 1,
        denumire_produs: item.denumire_produs ?? item.description ?? item.name ?? '',
        um: item.um ?? item.unit ?? 'buc',
        cantitate: cant,
        cant_document: cant,
        pret_unitar: pu,
        valoare: num(item.valoare ?? item.total_net ?? cant * pu),
        tva: num(item.tva ?? item.tva_total_4426 ?? item.vat_amount),
      };
    });
    out = {
      document_type: 'NIR',
      title: 'Nota de receptie',
      nr_nir: d?.nr_nir ?? d?.nr_document ?? d?.nir_number ?? '',
      unitatea: d?.unitatea ?? d?.buyer ?? '',
      fiscal_id: d?.fiscal_id ?? d?.buyer_ein ?? '',
      adresa: d?.adresa ?? d?.buyer_address ?? '',
      furnizor: d?.furnizor ?? d?.vendor ?? '',
      data: toDDMMYYYY(d?.data ?? d?.preparation_date) || todayDDMMYYYY(),
      gestiunea: d?.gestiunea ?? '',
      nr_doc: d?.nr_doc ?? d?.nr_document ?? d?.invoice_number ?? '',
      line_items,
      data_receptie: toDDMMYYYY(d?.data_receptie ?? d?.data) || todayDDMMYYYY(),
      comisie_nume_1: d?.comisie_nume_1 ?? d?.membru_comisie_1 ?? '',
      comisie_nume_2: d?.comisie_nume_2 ?? d?.membru_comisie_2 ?? '',
      comisie_nume_3: d?.comisie_nume_3 ?? d?.membru_comisie_3 ?? '',
      primit_in_gestiune_nume: d?.primit_in_gestiune_nume ?? '',
    };
  }
  if (!out.adresa && opts.companyAddress) out.adresa = opts.companyAddress;
  if (!String(out.unitatea ?? '').trim() && opts.companyName) out.unitatea = opts.companyName;
  if (!out.nr_nir || out.nr_nir === 'NIR 0000') out.nr_nir = `NIR ${String(opts.nirDocumentId).padStart(4, '0')}`;
  return withTotals(out);
}

export function withTotals(nir: NirData): NirData {
  const lines = nir.line_items ?? [];
  return {
    ...nir,
    total_valoare: round2(lines.reduce((s, l) => s + num(l.valoare), 0)),
    total_tva: round2(lines.reduce((s, l) => s + num(l.tva), 0)),
  };
}

export function lineManagementId(line: NirLine): number | null {
  const v = line.management_id ?? line.managementId;
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) ? n : null;
}

export function lineArticleType(line: NirLine): string {
  return String(line.article_type ?? line.articleType ?? 'MARFURI');
}

/** Numbers as numbers (inputs hold text while the user types). */
export function finalizeNir(nir: NirData): NirData {
  return withTotals({
    ...nir,
    line_items: (nir.line_items ?? []).map((l, i) => ({
      ...l,
      nr_crt: i + 1,
      cantitate: num(l.cantitate),
      cant_document: num(l.cant_document ?? l.cantitate),
      pret_unitar: num(l.pret_unitar),
      valoare: num(l.valoare),
      tva: num(l.tva),
    })),
  });
}
