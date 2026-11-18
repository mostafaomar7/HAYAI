import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  LoyaltyPartner,
  LoyaltyService,
  LoyaltyVoucher,
  SettlementStatus,
  VOUCHER_STATUSES,
  VoucherStatus,
  VoucherTotals,
  messageOf
} from '../../../../../core/services/loyalty.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { LoyaltyPage } from '../loyalty-shared';

/**
 * Vouchers and what Hayai owes partners for them.
 *
 * The filters live in the URL, so the overview's "unsettled" tile and a
 * partner's owed amount can link straight to the rows they count. The totals
 * in the header cover the whole filtered list, not just this page.
 *
 * Settling is for redeemed + unsettled rows only; anything else in the
 * selection is skipped by the server rather than failing the request.
 */
@Component({
  selector: 'app-loyalty-vouchers',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink, PaginationComponent],
  templateUrl: './loyalty-vouchers.html',
  styleUrls: ['../../website/shared/website.shared.css', '../loyalty.css']
})
export class LoyaltyVouchersPage extends LoyaltyPage {
  private svc = inject(LoyaltyService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly statuses = VOUCHER_STATUSES;
  readonly perPage = 20;

  loading = signal(true);
  failed = signal(false);
  items = signal<LoyaltyVoucher[]>([]);
  total = signal(0);
  totals = signal<VoucherTotals | null>(null);
  partners = signal<LoyaltyPartner[]>([]);

  status = signal<'' | VoucherStatus>('');
  settlement = signal<'' | SettlementStatus>('');
  partnerId = signal<number | null>(null);
  partnerName = signal('');
  userId = signal<number | null>(null);
  userName = signal('');
  code = signal('');
  from = signal('');
  to = signal('');
  page = signal(1);

  selected = signal<Set<number>>(new Set());
  busy = signal(false);

  onCode = debounce((v: string) => this.navigate({ code: v.trim().toUpperCase() || null }));

  constructor() {
    super();
    this.svc.partners({ accepts: 1, per_page: 100 }).subscribe({
      next: r => this.partners.set(r.items),
      error: () => this.partners.set([])
    });
    this.route.queryParamMap.subscribe(q => {
      const s = q.get('status') as VoucherStatus | null;
      this.status.set(s && VOUCHER_STATUSES.includes(s) ? s : '');
      const st = q.get('settlement');
      this.settlement.set(st === 'settled' || st === 'unsettled' ? st : '');
      const pid = Number(q.get('partner_user_id'));
      this.partnerId.set(pid > 0 ? pid : null);
      this.partnerName.set(q.get('partner_name') || '');
      const uid = Number(q.get('user_id'));
      this.userId.set(uid > 0 ? uid : null);
      this.userName.set(q.get('user_name') || '');
      this.code.set(q.get('code') || '');
      this.from.set(q.get('from') || '');
      this.to.set(q.get('to') || '');
      this.page.set(Math.max(1, Number(q.get('page')) || 1));
      this.selected.set(new Set());
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.vouchers({
      status: this.status() || null,
      settlement: this.settlement() || null,
      partner_user_id: this.partnerId(),
      user_id: this.userId(),
      code: this.code() || null,
      from: this.from() || null,
      to: this.to() || null,
      page: this.page(),
      per_page: this.perPage
    }).subscribe({
      next: r => {
        this.items.set(r.items);
        this.total.set(r.pagination.total);
        this.totals.set((r.meta?.['totals'] as VoucherTotals | undefined) ?? null);
        this.loading.set(false);
      },
      error: () => { this.items.set([]); this.total.set(0); this.totals.set(null); this.failed.set(true); this.loading.set(false); }
    });
  }

  private navigate(patch: Record<string, string | number | null>): void {
    const current: Record<string, string | number | null> = {
      status: this.status() || null,
      settlement: this.settlement() || null,
      partner_user_id: this.partnerId(),
      partner_name: this.partnerName() || null,
      user_id: this.userId(),
      user_name: this.userName() || null,
      code: this.code() || null,
      from: this.from() || null,
      to: this.to() || null
    };
    this.router.navigate([], { relativeTo: this.route, queryParams: { ...current, page: null, ...patch } });
  }

  setStatus(v: string): void { this.navigate({ status: v || null }); }
  setSettlement(v: string): void { this.navigate({ settlement: v || null }); }
  setPartner(v: string): void {
    const p = this.partners().find(x => String(x.user_id) === v);
    this.navigate({ partner_user_id: v || null, partner_name: p ? this.partnerLabel(p) : null });
  }
  setDate(which: 'from' | 'to', v: string): void { this.navigate({ [which]: v || null }); }
  clearUser(): void { this.navigate({ user_id: null, user_name: null }); }
  goToPage(p: number): void { this.navigate({ page: p > 1 ? p : null }); }

  /** "Owed to partners": one click from the header. */
  showOwed(): void { this.navigate({ status: 'redeemed', settlement: 'unsettled' }); }

  partnerLabel(p: LoyaltyPartner): string {
    return (p.display_name || p.account_name || '').trim() || `#${p.user_id}`;
  }

  /** The chosen partner is kept in the picker even if it is not in the first 100. */
  partnerMissing = computed(() => !!this.partnerId() && !this.partners().some(p => p.user_id === this.partnerId()));

  statusLabel(v: LoyaltyVoucher): string {
    return this.label(v.status_label, `loyalty.voucher.status.${v.status}`);
  }

  settlementLabel(v: LoyaltyVoucher): string {
    return v.settlement_status ? this.label(v.settlement_status_label, `loyalty.voucher.settlement.${v.settlement_status}`) : '';
  }

  // ---------------------------------------------------------------- selection

  settleable(v: LoyaltyVoucher): boolean {
    return v.status === 'redeemed' && v.settlement_status === 'unsettled';
  }

  settleableRows = computed(() => this.items().filter(v => this.settleable(v)));

  allSelected = computed(() => {
    const rows = this.settleableRows();
    return rows.length > 0 && rows.every(v => this.selected().has(v.id));
  });

  toggleOne(v: LoyaltyVoucher, on: boolean): void {
    const s = new Set(this.selected());
    if (on) s.add(v.id); else s.delete(v.id);
    this.selected.set(s);
  }

  toggleAll(on: boolean): void {
    this.selected.set(on ? new Set(this.settleableRows().map(v => v.id)) : new Set());
  }

  selectedAmount = computed(() =>
    this.items().filter(v => this.selected().has(v.id)).reduce((sum, v) => sum + (v.amount || 0), 0)
  );

  /** One partner per transfer is the normal case; mixing them is worth a word. */
  selectedPartners = computed(() =>
    new Set(this.items().filter(v => this.selected().has(v.id)).map(v => v.partner?.user_id)).size
  );

  async settle(): Promise<void> {
    const ids = [...this.selected()];
    if (!ids.length || this.busy()) return;
    const ref = await this.dialog.prompt({
      title: 'loyalty.vouchers.settle_title',
      text: this.selectedPartners() > 1 ? 'loyalty.vouchers.settle_text_mixed' : 'loyalty.vouchers.settle_text',
      placeholder: 'loyalty.vouchers.settle_ref',
      confirmText: 'loyalty.vouchers.settle',
      params: { n: ids.length, amount: this.money(this.selectedAmount()), partners: this.selectedPartners() }
    });
    if (ref === null) return;
    this.busy.set(true);
    this.svc.settle(ids, ref.trim() || null).subscribe({
      next: r => {
        this.busy.set(false);
        this.selected.set(new Set());
        const skipped = r?.skipped_ids?.length ?? 0;
        this.dialog.toast('success', skipped ? 'loyalty.vouchers.settled_skipped' : 'loyalty.vouchers.settled', {
          n: r?.settled_ids?.length ?? 0, amount: this.money(r?.settled_amount ?? 0), skipped
        });
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.dialog.error('loyalty.save_failed', messageOf(err, 'loyalty.save_failed'));
      }
    });
  }

  async cancel(v: LoyaltyVoucher): Promise<void> {
    const reason = await this.dialog.prompt({
      title: 'loyalty.vouchers.cancel_title',
      text: 'loyalty.vouchers.cancel_text',
      placeholder: 'loyalty.vouchers.cancel_reason',
      inputType: 'textarea',
      confirmText: 'loyalty.vouchers.cancel',
      danger: true,
      required: true,
      params: { code: v.code, points: this.num(v.points) }
    });
    if (!reason) return;
    this.busy.set(true);
    this.svc.cancelVoucher(v.id, reason.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.dialog.toast('success', 'loyalty.vouchers.cancelled');
        this.load();
      },
      error: err => {
        this.busy.set(false);
        const code = (err as { error?: { error_code?: string } })?.error?.error_code;
        if (err?.status === 409 || code === 'VOUCHER_NOT_ACTIVE') {
          this.dialog.error('loyalty.vouchers.not_active_title', 'loyalty.vouchers.not_active');
          this.load();
          return;
        }
        this.dialog.error('loyalty.save_failed', messageOf(err, 'loyalty.save_failed'));
      }
    });
  }
}
