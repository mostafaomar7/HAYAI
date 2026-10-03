import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import {
  StatusFlow, StatusHistoryRow, WebsiteAdmin, WebsitePurchase
} from '../../../../../core/services/website/website.models';
import { fmtDate, fmtMoney, nullIfEmpty } from '../shared/website-utils';
import { adminLabel, attrLabel, attributionRows, enumLabel, humanize, needsReason } from './sales-shared';

/**
 * One website purchase request.
 *
 * The website never takes payment: an approved request is followed by an
 * offline contract and invoice, and only then marked completed. The status
 * buttons are exactly `allowed_statuses` from the API, so the dashboard never
 * offers a move the state machine would refuse.
 */
@Component({
  selector: 'app-purchase-detail',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './purchase-detail.html',
  styleUrls: ['../shared/website.shared.css', './purchase-detail.css']
})
export class PurchaseDetail {
  private api = inject(WebsiteApiService);
  readonly ctx = inject(WebsiteContextService);
  private i18n = inject(I18nService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly lang = this.i18n.lang;
  readonly adminLabel = adminLabel;
  readonly humanize = humanize;

  id = Number(this.route.snapshot.paramMap.get('id'));
  purchase = signal<WebsitePurchase | null>(null);
  flows = signal<StatusFlow[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  busy = signal(false);

  admins = signal<WebsiteAdmin[]>([]);
  /** The admin list needs roles.manage; without it the assignee is typed as an id. */
  adminsDenied = signal(false);
  assignee = signal('');
  notes = signal('');
  metaSaving = signal(false);
  metaError = signal<string | null>(null);

  canUpdate = computed(() => this.ctx.can('orders.update'));

  dirty = computed(() => {
    const p = this.purchase();
    if (!p) return false;
    return this.assignee() !== String(p.assigned_to?.id ?? '') || this.notes() !== (p.internal_notes ?? '');
  });

  attribution = computed(() => attributionRows(this.purchase()?.attribution));

  /** The current assignee may be missing from the picker (e.g. lost their website roles). */
  assigneeMissing = computed(() => {
    const a = this.purchase()?.assigned_to;
    return !!a && !this.admins().some(x => x.id === a.id);
  });

  history = computed<StatusHistoryRow[]>(() => [...(this.purchase()?.history ?? [])].reverse());

  constructor() {
    this.load();
    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => this.flows.set(e.purchase_statuses ?? []),
      error: () => this.flows.set([])
    });
    this.api.admins().pipe(takeUntilDestroyed()).subscribe({
      next: list => this.admins.set(list ?? []),
      error: () => this.adminsDenied.set(true)
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.purchase(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => {
        this.apply(p);
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(errorMessage(err, 'web.purchases.load_failed'));
        this.loading.set(false);
      }
    });
  }

  private apply(p: WebsitePurchase): void {
    this.purchase.set(p);
    this.assignee.set(String(p.assigned_to?.id ?? ''));
    this.notes.set(p.internal_notes ?? '');
  }

  back(): void {
    this.router.navigate(['/dashboard/website/purchases']);
  }

  statusLabel(value: string | null | undefined, apiLabel?: string | null): string {
    return enumLabel(this.i18n, 'purchase_status', value, apiLabel);
  }

  date(value: string | null | undefined, withTime = true): string {
    return fmtDate(value, this.lang(), withTime);
  }

  money(value: string | number | null | undefined, currency?: string): string {
    return fmtMoney(value, currency ?? this.purchase()?.currency ?? 'EGP', this.lang());
  }

  /** Destructive moves get the red button; the rest are ordinary. */
  isDanger(status: string): boolean {
    return status === 'rejected' || status === 'canceled';
  }

  async move(status: string): Promise<void> {
    const p = this.purchase();
    if (!p || this.busy()) return;
    let reason: string | null = null;
    const label = this.statusLabel(status);

    if (needsReason(this.flows(), status)) {
      reason = await this.dialog.prompt({
        title: 'web.purchases.reason_title',
        text: 'web.purchases.reason_text',
        params: { status: label },
        inputType: 'textarea',
        confirmText: 'web.purchases.move_confirm'
      });
      if (reason === null) return;
      if (!reason.trim()) {
        this.dialog.error('common.error', 'web.purchases.reason_required');
        return;
      }
    } else {
      const ok = await this.dialog.confirm({
        title: 'web.purchases.move_title',
        text: 'web.purchases.move_text',
        params: { status: label, reference: p.reference },
        icon: 'question',
        confirmText: 'web.purchases.move_confirm'
      });
      if (!ok) return;
    }

    this.busy.set(true);
    this.api.setPurchaseStatus(p.id, status, reason?.trim() || null).subscribe({
      next: res => {
        this.busy.set(false);
        this.apply(res);
        // The transition response may omit history; reload so the timeline is current.
        if (!res.history) this.load();
        this.dialog.toast('success', 'web.purchases.status_changed');
      },
      error: err => {
        this.busy.set(false);
        this.dialog.error('common.error', errorMessage(err, 'web.purchases.status_failed'));
      }
    });
  }

  saveMeta(): void {
    const p = this.purchase();
    if (!p) return;
    const raw = this.assignee().trim();
    if (raw && !/^\d+$/.test(raw)) {
      this.metaError.set('web.purchases.assignee_invalid');
      return;
    }
    this.metaSaving.set(true);
    this.metaError.set(null);
    this.api.updatePurchase(p.id, {
      assigned_to: raw ? Number(raw) : null,
      internal_notes: nullIfEmpty(this.notes())
    }).subscribe({
      next: res => {
        this.metaSaving.set(false);
        // PATCH answers with the purchase but maybe without history; keep ours.
        this.apply({ ...res, history: res.history ?? p.history });
        this.dialog.toast('success', 'common.saved');
      },
      error: err => {
        this.metaSaving.set(false);
        this.metaError.set(errorMessage(err, 'web.purchases.save_failed'));
      }
    });
  }

  assignToMe(): void {
    const me = this.ctx.me();
    if (me) this.assignee.set(String(me.id));
  }

  attrLabel(key: string): string {
    return attrLabel(this.i18n, key);
  }

  actorLabel(h: StatusHistoryRow): string {
    return h.performed_by?.name ?? humanize(h.actor);
  }
}
