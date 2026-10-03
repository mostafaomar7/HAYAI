import { I18nService } from '../../../../../core/i18n/i18n.service';
import { Locale, WebsiteCategory } from '../../../../../core/services/website/website.models';
import { fmtMoney } from '../shared/website-utils';

/**
 * Helpers shared by the catalog screens (product list, product editor,
 * categories).
 */

/** Pricing types that put a figure on the site (when `is_price_public`). */
export const PRICED_TYPES = new Set(['fixed', 'starting_from']);

/** Billing periods that are not a recurring unit, so no "/ month" suffix. */
const NO_PERIOD = new Set(['one_time', 'once', 'none']);

/** `under_review` → `Under review`: last-resort text when neither the API nor i18n has a label. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const s = value.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Display text for an enum value: the API's `*_label` (already in the request
 * language), then our `web.enum.<group>.<value>` key, then the humanized raw
 * value so a value the backend adds later still reads sensibly.
 */
export function enumLabel(i18n: I18nService, group: string, value: string | null | undefined, apiLabel?: unknown): string {
  if (typeof apiLabel === 'string' && apiLabel) return apiLabel;
  if (!value) return '—';
  const key = `web.enum.${group}.${value}`;
  const text = i18n.translate(key);
  return text === key ? humanize(value) : text;
}

/** ` / month` for recurring periods, empty for one-time or unknown-empty. */
export function periodSuffix(i18n: I18nService, period: string | null | undefined): string {
  if (!period || NO_PERIOD.has(period)) return '';
  const key = `web.products.per.${period}`;
  const unit = i18n.translate(key);
  return ` / ${unit === key ? enumLabel(i18n, 'billing_period', period).toLowerCase() : unit}`;
}

export interface PriceLike {
  pricing_type: string | null | undefined;
  price: number | string | null | undefined;
  currency?: string | null;
  billing_period?: string | null;
}

/**
 * How a price reads, following §5 of the contract:
 * fixed → "EGP 4,500 / month", starting_from → "From EGP 4,500 / month",
 * contact_for_price / custom_quote → their label and never a figure.
 * Visibility (`is_price_public`) is the caller's concern — the admin list
 * still shows the figure, with a "private" badge next to it.
 */
export function priceDisplay(i18n: I18nService, p: PriceLike, lang: Locale): string {
  const type = p.pricing_type ?? '';
  if (!PRICED_TYPES.has(type)) return enumLabel(i18n, 'pricing_type', type || null);
  if (p.price === null || p.price === undefined || p.price === '') return '—';
  const money = fmtMoney(p.price, p.currency || 'EGP', lang) + periodSuffix(i18n, p.billing_period);
  return type === 'starting_from' ? i18n.translate('web.products.from_price', { price: money }) : money;
}

/** A category's name in the dashboard language, falling back to English. */
export function categoryName(c: Pick<WebsiteCategory, 'name' | 'name_en' | 'name_ar'> | null | undefined, lang: Locale): string {
  if (!c) return '—';
  return (lang === 'ar' ? c.name_ar : null) || c.name_en || c.name || '—';
}
