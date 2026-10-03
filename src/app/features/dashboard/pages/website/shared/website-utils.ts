import { ByLocale, Locale } from '../../../../../core/services/website/website.models';

/**
 * Small helpers shared by the Website CMS screens.
 */

/**
 * The translation row for `locale`, whichever shape the endpoint used:
 * an array of rows carrying `locale` (pages, products list) or an object
 * keyed by locale (create / update bodies, some detail payloads).
 */
export function translationFor<T extends { locale?: Locale | string }>(
  translations: T[] | ByLocale<T> | null | undefined,
  locale: Locale
): T | undefined {
  if (!translations) return undefined;
  if (Array.isArray(translations)) return translations.find(t => t.locale === locale);
  return (translations as ByLocale<T>)[locale];
}

/** First non-empty value of `key` across locales, preferring `prefer`. */
export function pickLocalized<T extends { locale?: Locale | string }>(
  translations: T[] | ByLocale<T> | null | undefined,
  key: keyof T,
  prefer: Locale
): string {
  const order: Locale[] = prefer === 'ar' ? ['ar', 'en'] : ['en', 'ar'];
  for (const l of order) {
    const v = translationFor(translations, l)?.[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  return '';
}

/** Locales a translations collection actually has. */
export function localesOf<T extends { locale?: Locale | string }>(
  translations: T[] | ByLocale<T> | null | undefined
): Locale[] {
  if (!translations) return [];
  if (Array.isArray(translations)) return translations.map(t => t.locale as Locale).filter(Boolean);
  return (Object.keys(translations) as Locale[]).filter(k => (translations as ByLocale<T>)[k]);
}

/** Whitespace-separated word count — the same rule the API uses for the 40–60 word direct answer. */
export function wordCount(text: string | null | undefined): number {
  const t = (text ?? '').replace(/<[^>]*>/g, ' ').trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * Display date in the dashboard language. Accepts ISO timestamps and plain
 * `YYYY-MM-DD`; returns an em dash for empty values.
 */
export function fmtDate(value: string | null | undefined, lang: Locale = 'en', withTime = false): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  return withTime
    ? d.toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** `2026-10-10T08:00` (datetime-local input) ← ISO string, in the browser's zone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO string with offset ← datetime-local input value; null when empty. */
export function fromLocalInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Money as the API sends it (string decimals) → display text. */
export function fmtMoney(value: string | number | null | undefined, currency = 'EGP', lang: Locale = 'en'): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (isNaN(n)) return String(value);
  return `${currency} ${n.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 })}`;
}

/** Splits a textarea into trimmed, non-empty lines (string lists, same_as URLs …). */
export function lines(text: string | null | undefined): string[] {
  return (text ?? '').split('\n').map(s => s.trim()).filter(Boolean);
}

export function joinLines(list: string[] | null | undefined): string {
  return (list ?? []).join('\n');
}

/** Empty strings → null, so optional fields clear instead of saving "". */
export function nullIfEmpty<T>(value: T): T | null {
  return typeof value === 'string' && value.trim() === '' ? null : value;
}

/** Deep copy for editable working state (plain JSON only). */
export function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}
