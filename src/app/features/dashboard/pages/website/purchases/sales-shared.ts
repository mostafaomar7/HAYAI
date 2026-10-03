import { I18nService } from '../../../../../core/i18n/i18n.service';
import { StatusFlow, WebsiteAdmin } from '../../../../../core/services/website/website.models';

/**
 * Helpers shared by the sales screens (purchases, leads, forms).
 */

/** `under_review` → `Under review`: last-resort text when neither the API nor i18n has a label. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const s = value.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Display text for an enum value. The API's own `*_label` wins (it is already
 * in the request language); then our `web.enum.<group>.<value>` key; then the
 * humanized raw value, so a value the backend adds later still reads sensibly.
 */
export function enumLabel(
  i18n: I18nService,
  group: string,
  value: string | null | undefined,
  apiLabel?: string | null
): string {
  if (apiLabel) return apiLabel;
  if (!value) return '—';
  const key = `web.enum.${group}.${value}`;
  const text = i18n.translate(key);
  return text === key ? humanize(value) : text;
}

/**
 * Statuses that always need a reason, whatever the enum says: a rejection or
 * cancellation is shown to the customer and kept on the record.
 */
const ALWAYS_REASON = new Set(['rejected', 'canceled']);

export function needsReason(flows: StatusFlow[] | null | undefined, target: string): boolean {
  if (ALWAYS_REASON.has(target)) return true;
  return !!flows?.find(f => f.value === target)?.requires_reason;
}

/** A submitted value from a lead's free-form `data` as one readable line. */
export function formatValue(value: unknown, i18n: I18nService): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return i18n.translate(value ? 'common.yes' : 'common.no');
  if (Array.isArray(value)) return value.map(v => formatValue(v, i18n)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Option text in the assignee picker. */
export function adminLabel(a: WebsiteAdmin): string {
  return a.email ? `${a.name} (${a.email})` : a.name;
}

/** Bytes → `1.2 MB` for attachment sizes. */
export function fmtSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Label for an attribution key (`utm_source` …); unknown keys are humanized. */
export function attrLabel(i18n: I18nService, key: string): string {
  const k = `web.purchases.attr.${key}`;
  const text = i18n.translate(k);
  return text === k ? humanize(key) : text;
}

/** Non-empty attribution entries as display rows. */
export function attributionRows(a: Record<string, unknown> | null | undefined): { key: string; value: string }[] {
  if (!a) return [];
  return Object.entries(a)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([key, v]) => ({ key, value: typeof v === 'object' ? JSON.stringify(v) : String(v) }));
}
