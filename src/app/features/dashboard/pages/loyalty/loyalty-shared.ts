import { Directive, computed, inject } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { USER_TYPE_LABEL } from '../../../../core/services/notifications.service';

/**
 * What every Hayai-points screen formats the same way: numbers, money, the
 * bilingual titles the API sends, and the account-type words the rest of the
 * dashboard already uses.
 */
@Directive()
export abstract class LoyaltyPage {
  protected i18n = inject(I18nService);
  protected access = inject(AdminAccessService);

  readonly canManage = computed(() => this.access.can('loyalty', 'manage'));

  num(v: number | null | undefined): string {
    return typeof v === 'number' ? v.toLocaleString('en') : '—';
  }

  /** Signed, for ledger lines: `+100`, `−300`. */
  signed(v: number | null | undefined): string {
    if (typeof v !== 'number') return '—';
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en');
  }

  money(v: number | null | undefined, currency = 'EGP'): string {
    if (typeof v !== 'number') return '—';
    return v.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ' + this.currencyWord(currency);
  }

  currencyWord(currency: string | null | undefined): string {
    const c = currency || 'EGP';
    return c === 'EGP' && this.i18n.lang() === 'ar' ? 'ج.م' : c;
  }

  /** `title_ar` on the Arabic screen, `title_en` otherwise, either as a fallback. */
  pick(row: object | null | undefined, field = 'title'): string {
    if (!row) return '';
    const r = row as Record<string, unknown>;
    const ar = String(r[`${field}_ar`] ?? '').trim();
    const en = String(r[`${field}_en`] ?? '').trim();
    return this.i18n.lang() === 'ar' ? (ar || en) : (en || ar);
  }

  /** The dashboard's own word for an account type, or the raw value. */
  typeKey(type: string | null | undefined): string {
    if (!type) return '—';
    return USER_TYPE_LABEL[type] ?? type;
  }

  /** The API's `*_label` when it sent one, otherwise our own key. */
  label(apiLabel: string | null | undefined, key: string): string {
    return this.i18n.lang() === 'en' && apiLabel ? apiLabel : key;
  }
}

/** `datetime-local` value (local time) → ISO with offset, or null. */
export function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO → `datetime-local` value in local time. */
export function isoToLocal(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** A number input's value: null when empty, NaN when not a number. */
export function numOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
}
