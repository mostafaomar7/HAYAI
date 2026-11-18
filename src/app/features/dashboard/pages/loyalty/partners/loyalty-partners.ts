import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  LoyaltyPartner,
  LoyaltyService,
  PARTNER_TYPES,
  fieldErrorsOf,
  messageOf
} from '../../../../../core/services/loyalty.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { LoyaltyPage, numOrNull } from '../loyalty-shared';

/**
 * Which provider accounts accept points. Every provider account is listed,
 * accepting ones first; the switch on a row is the agreement being on or off,
 * and the dialog holds the cap on one voucher and an internal note.
 */
@Component({
  selector: 'app-loyalty-partners',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink, PaginationComponent],
  templateUrl: './loyalty-partners.html',
  styleUrls: ['../../website/shared/website.shared.css', '../loyalty.css']
})
export class LoyaltyPartnersPage extends LoyaltyPage {
  private svc = inject(LoyaltyService);
  private dialog = inject(DialogService);

  readonly types = PARTNER_TYPES;
  readonly perPage = 20;

  loading = signal(true);
  failed = signal(false);
  items = signal<LoyaltyPartner[]>([]);
  total = signal(0);
  page = signal(1);
  busy = signal<Set<number>>(new Set());

  tab = signal<'all' | 'accepting'>('all');
  type = signal('');
  search = signal('');

  // ---- the dialog ----
  editing = signal<LoyaltyPartner | null>(null);
  fAccepts = signal(false);
  fCap = signal('');
  fNote = signal('');
  saving = signal(false);
  fieldErrors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);

  onSearch = debounce((v: string) => { this.search.set(v.trim()); this.page.set(1); this.load(); });

  constructor() {
    super();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.partners({
      accepts: this.tab() === 'accepting' ? 1 : null,
      user_type: this.type() || null,
      search: this.search() || null,
      page: this.page(),
      per_page: this.perPage
    }).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.pagination.total); this.loading.set(false); },
      error: () => { this.items.set([]); this.total.set(0); this.failed.set(true); this.loading.set(false); }
    });
  }

  setTab(t: 'all' | 'accepting'): void { this.tab.set(t); this.page.set(1); this.load(); }
  setType(v: string): void { this.type.set(v); this.page.set(1); this.load(); }
  goToPage(p: number): void { this.page.set(p); this.load(); }

  name(p: LoyaltyPartner): string {
    return (p.display_name || p.account_name || '').trim() || `#${p.user_id}`;
  }

  private setBusy(id: number, on: boolean): void {
    const s = new Set(this.busy());
    if (on) s.add(id); else s.delete(id);
    this.busy.set(s);
  }

  private replace(row: LoyaltyPartner): void {
    this.items.update(list => list.map(x => x.user_id === row.user_id ? { ...x, ...row } : x));
  }

  async toggle(p: LoyaltyPartner, box: HTMLInputElement): Promise<void> {
    if (!this.canManage()) { box.checked = p.accepts_points; return; }
    const next = box.checked;
    const ok = await this.dialog.confirm({
      title: next ? 'loyalty.partners.on_title' : 'loyalty.partners.off_title',
      text: next ? 'loyalty.partners.on_text' : 'loyalty.partners.off_text',
      confirmText: 'common.confirm',
      danger: !next,
      params: { name: this.name(p) }
    });
    if (!ok) { box.checked = p.accepts_points; return; }
    this.setBusy(p.user_id, true);
    this.svc.updatePartner(p.user_id, { accepts_points: next, max_voucher_amount: p.max_voucher_amount, note: p.note }).subscribe({
      next: row => {
        this.setBusy(p.user_id, false);
        this.replace({ ...p, ...row, accepts_points: row?.accepts_points ?? next });
        this.dialog.toast('success', 'loyalty.saved');
      },
      error: err => {
        this.setBusy(p.user_id, false);
        box.checked = p.accepts_points;
        this.dialog.error('loyalty.save_failed', messageOf(err, 'loyalty.save_failed'));
      }
    });
  }

  openEdit(p: LoyaltyPartner): void {
    this.editing.set(p);
    this.fAccepts.set(p.accepts_points);
    this.fCap.set(p.max_voucher_amount === null ? '' : String(p.max_voucher_amount));
    this.fNote.set(p.note ?? '');
    this.fieldErrors.set({});
    this.formError.set(null);
  }

  close(): void { this.editing.set(null); }

  save(): void {
    const p = this.editing();
    if (!p || this.saving()) return;
    const cap = numOrNull(this.fCap());
    if (cap !== null && (isNaN(cap) || cap <= 0)) {
      this.fieldErrors.set({ max_voucher_amount: 'loyalty.partners.err.cap' });
      return;
    }
    this.saving.set(true);
    this.fieldErrors.set({});
    this.formError.set(null);
    this.svc.updatePartner(p.user_id, { accepts_points: this.fAccepts(), max_voucher_amount: cap, note: this.fNote().trim() || null }).subscribe({
      next: row => {
        this.saving.set(false);
        this.replace({ ...p, ...row });
        this.editing.set(null);
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

  vouchersParams(p: LoyaltyPartner): Record<string, string | number> {
    return { partner_user_id: p.user_id, partner_name: this.name(p), status: 'redeemed', settlement: 'unsettled' };
  }
}
