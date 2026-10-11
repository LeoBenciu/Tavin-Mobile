import { getLanguage } from '@/i18n';

const pad = (n: number) => String(n).padStart(2, '0');

function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 1234.5 → "1.234,50" (Romanian grouping, as on invoices). */
export function formatAmount(value: unknown, decimals = 2): string {
  const n = toNumber(value);
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '−' : ''}${grouped}${frac ? `,${frac}` : ''}`;
}

export function formatMoney(value: unknown, currency = 'RON'): string {
  return `${formatAmount(value)} ${currency || 'RON'}`;
}

/** Whole lei for KPI tiles: 12.480 RON */
export function formatMoneyShort(value: unknown, currency = 'RON'): string {
  return `${formatAmount(Math.round(toNumber(value)), 0)} ${currency || 'RON'}`;
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value);
  // Plain dates ("2026-10-10") are calendar days, not UTC instants.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "10.10.2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : '—';
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  return d ? `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
}

/** "acum 5 min", "ieri", or a date. */
export function formatRelative(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '—';
  const ro = getLanguage() === 'ro';
  const diffMin = Math.round((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return ro ? 'acum' : 'now';
  if (diffMin < 60) return ro ? `acum ${diffMin} min` : `${diffMin} min ago`;
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return ro ? 'ieri' : 'yesterday';
  return formatDate(d);
}

/** Local calendar day as the API expects it: "2026-10-10". */
export function isoDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(day: string, days: number): string {
  const d = parseDate(day) ?? new Date();
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

export function isValidIsoDay(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

export function daysUntil(value: string | null | undefined): number | null {
  const d = parseDate(value);
  if (!d) return null;
  const today = parseDate(isoDay())!;
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Parses "1.234,56", "1234.56" or "1 234,56" typed by a user. */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function initials(name: string | null | undefined): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}
