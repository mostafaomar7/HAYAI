import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  LoyaltyService,
  LoyaltySettings,
  LoyaltySettingsPatch,
  fieldErrorsOf,
  messageOf
} from '../../../../../core/services/loyalty.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { LoyaltyPage, numOrNull } from '../loyalty-shared';

/**
 * The program's own numbers. Only the fields that changed are sent: every
 * field is optional on PATCH, and sending the untouched ones back would
 * overwrite a change another admin made in the meantime.
 *
 * Switching the program on is its own action with a confirm, not part of
 * Save: it starts paying points to every member immediately.
 */
@Component({
  selector: 'app-loyalty-settings',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './loyalty-settings.html',
  styleUrls: ['../../website/shared/website.shared.css', '../loyalty.css']
})
export class LoyaltySettingsPage extends LoyaltyPage {
  private svc = inject(LoyaltyService);
  private dialog = inject(DialogService);

  readonly termsMax = 5000;

  loading = signal(true);
  failed = signal(false);
  saved = signal<LoyaltySettings | null>(null);
  saving = signal(false);
  switching = signal(false);
  fieldErrors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);

  // the form, as typed
  convPoints = signal('');
  convAmount = signal('');
  validityDays = signal('');
  neverExpire = signal(false);
  minRedeem = signal('');
  maxRedeem = signal('');
  voucherDays = signal('');
  referralDays = signal('');
  termsEn = signal('');
  termsAr = signal('');

  constructor() {
    super();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.settings().subscribe({
      next: s => { this.fill(s); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); }
    });
  }

  private fill(s: LoyaltySettings): void {
    this.saved.set(s);
    this.convPoints.set(String(s.conversion_points ?? ''));
    this.convAmount.set(String(s.conversion_amount ?? ''));
    this.neverExpire.set(s.points_validity_days === null);
    this.validityDays.set(s.points_validity_days === null ? '' : String(s.points_validity_days));
    this.minRedeem.set(String(s.min_redeem_points ?? ''));
    this.maxRedeem.set(s.max_redeem_points === null ? '' : String(s.max_redeem_points));
    this.voucherDays.set(String(s.voucher_validity_days ?? ''));
    this.referralDays.set(String(s.referral_window_days ?? ''));
    this.termsEn.set(s.terms_en ?? '');
    this.termsAr.set(s.terms_ar ?? '');
    this.fieldErrors.set({});
    this.formError.set(null);
  }

  /** What the form says, as the API wants it. NaN marks a field that is not a number. */
  private values = computed(() => ({
    conversion_points: numOrNull(this.convPoints()),
    conversion_amount: numOrNull(this.convAmount()),
    points_validity_days: this.neverExpire() ? null : numOrNull(this.validityDays()),
    min_redeem_points: numOrNull(this.minRedeem()),
    max_redeem_points: numOrNull(this.maxRedeem()),
    voucher_validity_days: numOrNull(this.voucherDays()),
    referral_window_days: numOrNull(this.referralDays()),
    terms_en: this.termsEn().trim() || null,
    terms_ar: this.termsAr().trim() || null
  }));

  /** Checked here so the obvious mistakes never reach the server. */
  clientErrors = computed(() => {
    const v = this.values();
    const e: Record<string, string> = {};
    const int = (n: number | null) => n !== null && Number.isInteger(n);
    if (!int(v.conversion_points) || v.conversion_points! < 1) e['conversion_points'] = 'loyalty.settings.err.points_min';
    if (v.conversion_amount === null || isNaN(v.conversion_amount) || v.conversion_amount < 0.01) e['conversion_amount'] = 'loyalty.settings.err.amount_min';
    if (!this.neverExpire() && (!int(v.points_validity_days) || v.points_validity_days! < 1 || v.points_validity_days! > 3650)) e['points_validity_days'] = 'loyalty.settings.err.validity';
    if (!int(v.min_redeem_points) || v.min_redeem_points! < 1) e['min_redeem_points'] = 'loyalty.settings.err.min_redeem';
    if (v.max_redeem_points !== null && (!int(v.max_redeem_points) || (int(v.min_redeem_points) && v.max_redeem_points < v.min_redeem_points!))) e['max_redeem_points'] = 'loyalty.settings.err.max_redeem';
    if (!int(v.voucher_validity_days) || v.voucher_validity_days! < 1 || v.voucher_validity_days! > 365) e['voucher_validity_days'] = 'loyalty.settings.err.voucher_days';
    if (!int(v.referral_window_days) || v.referral_window_days! < 0 || v.referral_window_days! > 365) e['referral_window_days'] = 'loyalty.settings.err.referral_days';
    if ((v.terms_en ?? '').length > this.termsMax) e['terms_en'] = 'loyalty.settings.err.terms';
    if ((v.terms_ar ?? '').length > this.termsMax) e['terms_ar'] = 'loyalty.settings.err.terms';
    return e;
  });

  /** The server's message wins over ours for the same field. */
  errorFor(field: string): string | null {
    return this.fieldErrors()[field] ?? this.clientErrors()[field] ?? null;
  }

  /** Only what differs from what was loaded. */
  changes = computed<LoyaltySettingsPatch>(() => {
    const s = this.saved();
    if (!s) return {};
    const v = this.values();
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      const before = (s as unknown as Record<string, unknown>)[k] ?? null;
      const norm = typeof before === 'string' ? (before.trim() || null) : before;
      if (val !== norm) out[k] = val;
    }
    return out as LoyaltySettingsPatch;
  });

  dirty = computed(() => Object.keys(this.changes()).length > 0);
  canSave = computed(() => this.canManage() && this.dirty() && !this.saving() && !Object.keys(this.clientErrors()).length);

  /** Live from the form, so the admin sees the value before saving it. */
  pointValue = computed(() => {
    const p = numOrNull(this.convPoints());
    const a = numOrNull(this.convAmount());
    if (!p || !a || isNaN(p) || isNaN(a)) return null;
    return a / p;
  });

  pointValueText = computed(() => {
    const v = this.pointValue();
    if (v === null) return '—';
    return v.toLocaleString('en', { maximumFractionDigits: 6 }) + ' ' + this.currencyWord(this.saved()?.currency);
  });

  preview = computed(() => {
    const v = this.values();
    const cur = this.currencyWord(this.saved()?.currency);
    return {
      points: this.num(v.conversion_points ?? NaN),
      amount: (v.conversion_amount ?? 0).toLocaleString('en', { maximumFractionDigits: 2 }) + ' ' + cur,
      days: this.num(v.points_validity_days ?? NaN),
      min: this.num(v.min_redeem_points ?? NaN),
      voucherDays: this.num(v.voucher_validity_days ?? NaN)
    };
  });

  async toggleEnabled(box: HTMLInputElement): Promise<void> {
    const s = this.saved();
    if (!s || !this.canManage()) { box.checked = !!s?.enabled; return; }
    const turningOn = box.checked;
    const ok = await this.dialog.confirm({
      title: turningOn ? 'loyalty.settings.on_title' : 'loyalty.settings.off_title',
      text: turningOn ? 'loyalty.settings.on_text' : 'loyalty.settings.off_text',
      confirmText: turningOn ? 'loyalty.settings.turn_on' : 'loyalty.settings.turn_off',
      danger: !turningOn
    });
    if (!ok) { box.checked = s.enabled; return; }
    this.switching.set(true);
    this.svc.updateSettings({ enabled: turningOn }).subscribe({
      next: r => {
        this.switching.set(false);
        // Keep anything typed but not saved: only `enabled` came back changed.
        this.saved.set({ ...s, ...r, enabled: r?.enabled ?? turningOn });
        this.dialog.toast('success', turningOn ? 'loyalty.settings.turned_on' : 'loyalty.settings.turned_off');
      },
      error: err => {
        this.switching.set(false);
        box.checked = s.enabled;
        this.dialog.error('loyalty.save_failed', messageOf(err, 'loyalty.save_failed'));
      }
    });
  }

  save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.fieldErrors.set({});
    this.formError.set(null);
    this.svc.updateSettings(this.changes()).subscribe({
      next: r => {
        this.saving.set(false);
        this.fill(r);
        this.dialog.toast('success', 'loyalty.saved');
      },
      error: err => {
        this.saving.set(false);
        const fe = fieldErrorsOf(err);
        if (fe) { this.fieldErrors.set(fe); return; }
        this.formError.set(messageOf(err, 'loyalty.save_failed'));
      }
    });
  }

  reset(): void {
    const s = this.saved();
    if (s) this.fill(s);
  }

  /** Typing in a field clears the server's complaint about it. */
  edit(field: string, sig: { set(v: string): void }, value: string): void {
    sig.set(value);
    if (this.fieldErrors()[field]) {
      const { [field]: _, ...rest } = this.fieldErrors();
      this.fieldErrors.set(rest);
    }
  }
}
