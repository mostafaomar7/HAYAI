import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivityEntry,
  ApprovalTally,
  CostPayload,
  DELIVERY_WINDOWS,
  DeliveryWindow,
  DeviceGroupOrdersService,
  ExternalDeviceEntry,
  GroupOrderPatch,
  GroupOrderDetail,
  GroupOrderParticipant,
  ShippingCompany,
  deliveryLabel
} from '../../../../core/services/device-group-orders.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

type Tab = 'joined' | 'pending' | 'activity';

interface CostDraft {
  total_cost: string;
  /** Index into DELIVERY_WINDOWS — the API stores a week range, not a label. */
  delivery: number;
  /**
   * A partner id, or the sentinel `NEW_COMPANY` when the importer is being
   * typed onto this round instead of picked from the partners list.
   */
  shipping_company_id: string;
  ship_company_name: string;
  ship_company_contact_person: string;
  ship_company_phone: string;
  ship_company_email: string;
  notes: string;
}

/** Not an id the API could ever issue, so it cannot collide with a real one. */
const NEW_COMPANY = '__new';

/** The round's own terms, as the edit form holds them: strings from inputs. */
interface RoundDraft {
  target_size: string;
  join_deadline: string;
  /** Index into DELIVERY_WINDOWS, or -1 for "not set yet". */
  delivery: number;
  notes_for_users: string;
}

/**
 * Screens 7 through 16 — one round, from filling up to the handover.
 *
 * They are a single component because they are a single record at different
 * points of its lifecycle: the header, the summary and the participant tabs are
 * identical throughout, and only the action panel changes. Splitting them per
 * screen would mean eight routes onto one id, and eight places to keep the same
 * participant table in sync.
 */
@Component({
  selector: 'app-group-order-details',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './group-order-details.html',
  styleUrls: ['./group-orders.shared.css', './group-order-details.css']
})
export class GroupOrderDetails {
  private svc = inject(DeviceGroupOrdersService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly deliveryWindows = DELIVERY_WINDOWS;
  readonly deliveryLabel = deliveryLabel;

  id = signal<number>(0);
  order = signal<GroupOrderDetail | null>(null);
  /**
   * The round embeds only a thin device reference (id, name, cover image), but
   * screen 7 shows the category and the description too, so the catalogue entry
   * is fetched alongside it rather than dropping two fields from the design.
   */
  device = signal<ExternalDeviceEntry | null>(null);
  approvals = signal<ApprovalTally | null>(null);
  shippingCompanies = signal<ShippingCompany[]>([]);

  loading = signal(true);
  loadError = signal<string | null>(null);
  busy = signal(false);
  tab = signal<Tab>('joined');

  // ---- cost form (screens 9 and 10) ----
  costFormOpen = signal(false);

  editOpen = signal(false);
  editDraft = signal<RoundDraft>({ target_size: '', join_deadline: '', delivery: -1, notes_for_users: '' });
  editErrors = signal<Record<string, string>>({});
  editError = signal<string | null>(null);
  costDraft = signal<CostDraft>({
    total_cost: '', delivery: 2, shipping_company_id: '',
    ship_company_name: '', ship_company_contact_person: '',
    ship_company_phone: '', ship_company_email: '', notes: ''
  });
  costErrors = signal<Record<string, string>>({});
  costError = signal<string | null>(null);

  constructor() {
    this.id.set(Number(this.route.snapshot.paramMap.get('id')));
    this.load();

    this.svc.shippingCompanies({ per_page: 200 }).pipe(takeUntilDestroyed()).subscribe({
      next: res => this.shippingCompanies.set(res.items),
      error: () => this.shippingCompanies.set([])
    });
  }

  // ------------------------------------------------------------------ load

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.groupOrder(this.id()).pipe(takeUntilDestroyed()).subscribe({
      next: o => {
        this.order.set(o);
        this.loading.set(false);
        this.seedCostDraft(o);
        // Embedded on the detail payload; the separate call is only a fallback
        // for the two fields the thin reference does not carry.
        if (o.approvals) this.approvals.set(o.approvals);
        else if (this.needsApprovalTracking(o)) this.loadApprovals();
        if (o.device_id) this.loadDevice(o.device_id);
      },
      error: () => { this.loadError.set('gorders.load_failed'); this.loading.set(false); }
    });
  }

  private loadDevice(id: number): void {
    this.svc.device(id).subscribe({
      next: d => this.device.set(d),
      // The summary degrades to the round's own fields; it is not worth failing
      // the whole screen over a category label.
      error: () => this.device.set(null)
    });
  }

  private loadApprovals(): void {
    this.svc.approvals(this.id()).subscribe({
      next: a => this.approvals.set(a.summary),
      error: () => this.approvals.set(null)
    });
  }

  private needsApprovalTracking(o: GroupOrderDetail): boolean {
    return ['approval_pending', 'all_approved', 'ready', 'closed'].includes(o.status);
  }

  private seedCostDraft(o: GroupOrderDetail): void {
    const c = o.cost;
    const company = o.shipping_company;
    const idx = DELIVERY_WINDOWS.findIndex(
      w => w.min === o.delivery_weeks_min && w.max === o.delivery_weeks_max
    );
    this.costDraft.set({
      total_cost: c?.total_cost != null ? String(c.total_cost) : '',
      delivery: idx >= 0 ? idx : 2,
      shipping_company_id: company?.id ? String(company.id) : '',
      ship_company_name: '', ship_company_contact_person: '',
      ship_company_phone: '', ship_company_email: '',
      notes: c?.notes ?? ''
    });
  }

  // ------------------------------------------------------------ derived view

  status = computed(() => this.order()?.status ?? 'draft');
  statusLabel = computed(() => this.order()?.status_label || this.order()?.status || '');
  deviceName = computed(() => this.order()?.device?.name ?? this.device()?.name ?? '');
  categoryName = computed(() => this.device()?.category?.name ?? null);
  description = computed(() => this.device()?.short_description ?? null);
  coverImage = computed(() => this.order()?.device?.cover_image_url ?? this.device()?.cover_image_url ?? null);

  participants = computed(() => this.order()?.participants ?? []);
  joined = computed(() => this.participants().filter(p => p.membership_status === 'joined'));
  pending = computed(() => this.participants().filter(p => p.membership_status === 'pending'));
  activity = computed<ActivityEntry[]>(() => this.order()?.activity_log ?? []);

  percent = computed(() => {
    const o = this.order();
    if (!o) return 0;
    if (typeof o.progress === 'number') return Math.min(100, Math.max(0, o.progress));
    if (!o.group_size) return 0;
    return Math.min(100, Math.round((o.joined / o.group_size) * 100));
  });

  remaining = computed(() => {
    const o = this.order();
    if (!o) return 0;
    return typeof o.remaining === 'number' ? o.remaining : Math.max(0, o.group_size - o.joined);
  });

  /** Screen 9 — the round is full but no quote has been recorded yet. */
  canAddCost = computed(() => ['completed', 'cost_pending'].includes(this.status()));
  /** Screens 11 and 14 — a quote is out and the tally is worth showing. */
  showApprovalPanel = computed(() =>
    ['approval_pending', 'all_approved', 'ready', 'closed'].includes(this.status()));
  canRemind = computed(() => this.status() === 'approval_pending');
  /** Screen 15 — every participant has approved, so contacts can be handed over. */
  canShareContacts = computed(() => this.status() === 'all_approved');
  /** Screen 16 — the handover happened; HAYAI's involvement is over. */
  isReady = computed(() => ['ready', 'closed'].includes(this.status()));
  canClose = computed(() => this.status() === 'ready');
  canCancel = computed(() => !['closed', 'cancelled', 'expired'].includes(this.status()));
  /**
   * Terms can be corrected until a quote exists. After that the participants
   * agreed to a price, so changing what they agreed to is not the admin's call
   * — the API answers 405, and the only way out stays cancelling.
   */
  canEditRound = computed(() => this.canCancel() && this.order()?.cost?.total_cost == null);
  /** The file is buyers' phone numbers, so it only exists once consent is recorded. */
  canExport = computed(() => ['all_approved', 'ready', 'closed'].includes(this.status()));
  /** A quote exists and is no longer editable — screen 11. */
  hasSentCost = computed(() => {
    const c = this.order()?.cost;
    return !!c && c.total_cost != null && !this.canAddCost();
  });

  approvalPercent = computed(() => {
    const a = this.approvals();
    if (!a) return 0;
    if (typeof a.percent === 'number') return Math.min(100, Math.max(0, a.percent));
    return a.total ? Math.round((a.approved / a.total) * 100) : 0;
  });

  // -------------------------------------------------------- participant acts

  approve(p: GroupOrderParticipant): void {
    this.run(this.svc.approveParticipant(this.id(), p.id), 'gorders.participant_approved');
  }

  async reject(p: GroupOrderParticipant): Promise<void> {
    const reason = await this.dialog.prompt({
      title: 'gorders.reject_title',
      text: 'gorders.reject_text',
      params: { name: p.user_name },
      confirmText: 'gorders.reject'
    });
    // The backend rejects an empty reason, so it is checked before the call
    // rather than surfacing a 422 the admin cannot act on.
    if (!reason || !reason.trim()) return;
    this.run(this.svc.rejectParticipant(this.id(), p.id, reason.trim()), 'gorders.participant_rejected');
  }

  async removeParticipant(p: GroupOrderParticipant): Promise<void> {
    const reason = await this.dialog.prompt({
      title: 'gorders.remove_title',
      text: 'gorders.remove_text',
      params: { name: p.user_name },
      confirmText: 'gorders.remove'
    });
    if (!reason || !reason.trim()) return;
    this.run(this.svc.removeParticipant(this.id(), p.id, reason.trim()), 'gorders.participant_removed');
  }

  // ------------------------------------------------------ round terms (edit)

  openEditForm(): void {
    const o = this.order();
    if (!o) return;
    const idx = DELIVERY_WINDOWS.findIndex(
      w => w.min === o.delivery_weeks_min && w.max === o.delivery_weeks_max
    );
    this.editErrors.set({});
    this.editError.set(null);
    this.editDraft.set({
      target_size: String(o.group_size ?? ''),
      // The input wants YYYY-MM-DD; the field may arrive with a time on it.
      join_deadline: (o.join_deadline ?? '').slice(0, 10),
      delivery: idx,
      notes_for_users: o.notes_for_users ?? ''
    });
    this.editOpen.set(true);
  }

  setRound<K extends keyof RoundDraft>(key: K, value: RoundDraft[K]): void {
    this.editDraft.update(d => ({ ...d, [key]: value }));
  }

  /** The seats already spoken for — the floor `target_size` cannot go under. */
  heldSeats = computed(() => {
    const o = this.order();
    return Math.max(o?.joined ?? 0, 0);
  });

  saveRound(): void {
    const o = this.order();
    const d = this.editDraft();
    if (!o) return;

    const errors: Record<string, string> = {};
    const size = Number(d.target_size);
    if (!d.target_size || !Number.isInteger(size) || size < 2) {
      errors['target_size'] = 'gorders.group_size_invalid';
    } else if (size < this.heldSeats()) {
      // Caught here so the admin sees which number is the floor, rather than a
      // 422 that only says the request was refused.
      errors['target_size'] = 'gorders.group_size_below_joined';
    }
    if (!d.join_deadline) errors['join_deadline'] = 'gorders.required';
    if (Object.keys(errors).length) { this.editErrors.set(errors); return; }

    // Only what actually changed: a PATCH naming a field rewrites it, and
    // resending an unchanged deadline that has since passed would 422.
    const body: GroupOrderPatch = {};
    if (size !== o.group_size) body.target_size = size;
    if (d.join_deadline !== (o.join_deadline ?? '').slice(0, 10)) body.join_deadline = d.join_deadline;
    const w = DELIVERY_WINDOWS[d.delivery];
    if (w && (w.min !== o.delivery_weeks_min || w.max !== o.delivery_weeks_max)) {
      body.delivery_weeks_min = w.min;
      body.delivery_weeks_max = w.max;
    }
    const notes = d.notes_for_users.trim();
    if (notes !== (o.notes_for_users ?? '')) body.notes_for_users = notes || null;

    if (!Object.keys(body).length) { this.editOpen.set(false); return; }

    this.busy.set(true);
    this.editError.set(null);
    this.svc.updateRound(this.id(), body).subscribe({
      next: () => {
        this.busy.set(false);
        this.editOpen.set(false);
        this.dialog.toast('success', 'gorders.round_updated');
        // Shrinking the size onto the headcount fills the round, so the status
        // may have moved; the whole record is refetched rather than patched.
        this.load();
      },
      error: err => {
        this.busy.set(false);
        const r = err as HttpErrorResponse;
        // 405 and 409 are not validation: the round moved past the point where
        // its terms are the admin's to change, so the form says so and closes.
        if (r.status === 405) { this.editError.set('gorders.edit_locked_priced'); return; }
        if (r.status === 409) { this.editError.set('gorders.edit_locked_closed'); return; }
        const bag = r?.error?.errors as Record<string, string[]> | undefined;
        if (bag) {
          this.editErrors.set(Object.fromEntries(
            Object.entries(bag).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])));
        } else {
          this.editError.set(r?.error?.message ?? 'gorders.save_failed');
        }
      }
    });
  }

  // ------------------------------------------------------- cost (screen 10)

  openCostForm(): void {
    this.costErrors.set({});
    this.costError.set(null);
    this.costFormOpen.set(true);
  }

  setCost<K extends keyof CostDraft>(key: K, value: CostDraft[K]): void {
    this.costDraft.update(d => ({ ...d, [key]: value }));
  }

  /** Drives the read-only contact fields under the picker. */
  selectedCompany = computed(() =>
    this.shippingCompanies().find(c => String(c.id) === this.costDraft().shipping_company_id) ?? null);

  /** True while the importer is being typed rather than picked. */
  isNewCompany = computed(() => this.costDraft().shipping_company_id === NEW_COMPANY);

  goToCompanies(): void {
    this.router.navigate(['/dashboard/group-orders/shipping-companies']);
  }

  /** Screen 10's read-only "Cost Per Person" figure, recomputed as they type. */
  costPerPerson = computed(() => {
    const total = Number(this.costDraft().total_cost);
    const count = this.order()?.joined ?? 0;
    if (!total || !count) return null;
    return total / count;
  });

  submitCost(): void {
    const d = this.costDraft();
    const errors: Record<string, string> = {};
    const total = Number(d.total_cost);
    const window: DeliveryWindow | undefined = DELIVERY_WINDOWS[d.delivery];

    if (!d.total_cost || !isFinite(total) || total <= 0) errors['total_cost'] = 'gorders.total_cost_invalid';
    if (!window) errors['delivery'] = 'gorders.required';
    // Either branch satisfies the API, but one of them has to be filled in.
    const typing = d.shipping_company_id === NEW_COMPANY;
    if (!d.shipping_company_id) errors['shipping_company_id'] = 'gorders.required';
    else if (typing && !d.ship_company_name.trim()) errors['ship_company_name'] = 'gorders.required';
    if (Object.keys(errors).length) { this.costErrors.set(errors); return; }

    const company: Partial<CostPayload> = typing
      ? {
          ship_company_name: d.ship_company_name.trim(),
          ship_company_contact_person: d.ship_company_contact_person.trim() || null,
          ship_company_phone: d.ship_company_phone.trim() || null,
          ship_company_email: d.ship_company_email.trim() || null
        }
      : { shipping_company_id: Number(d.shipping_company_id) };

    this.busy.set(true);
    this.costError.set(null);
    this.svc
      .submitCost(this.id(), {
        total_cost: total,
        delivery_weeks_min: window!.min,
        delivery_weeks_max: window!.max,
        ...company,
        notes: d.notes.trim() || null
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.costFormOpen.set(false);
          this.dialog.toast('success', 'gorders.cost_sent');
          this.load();
        },
        error: err => {
          this.busy.set(false);
          const bag = (err as HttpErrorResponse)?.error?.errors as Record<string, string[]> | undefined;
          if (bag) {
            this.costErrors.set(
              Object.fromEntries(Object.entries(bag).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]))
            );
          }
          this.costError.set(err?.error?.message ?? 'gorders.save_failed');
        }
      });
  }

  // ------------------------------------------------ round-level transitions

  sendReminder(): void {
    this.busy.set(true);
    this.svc.sendReminder(this.id()).subscribe({
      next: a => {
        this.approvals.set(a.summary ?? this.approvals());
        this.busy.set(false);
        this.dialog.toast('success', 'gorders.reminder_sent');
      },
      error: err => this.fail(err)
    });
  }

  async shareContacts(): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'gorders.share_contacts_title',
      text: 'gorders.share_contacts_text',
      confirmText: 'gorders.share_contacts'
    });
    if (!ok) return;
    this.run(this.svc.shareContacts(this.id()), 'gorders.contacts_shared');
  }

  async close(): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'gorders.close_title',
      text: 'gorders.close_text',
      confirmText: 'gorders.close_round'
    });
    if (!ok) return;
    this.run(this.svc.close(this.id()), 'gorders.round_closed');
  }

  async cancel(): Promise<void> {
    const reason = await this.dialog.prompt({
      title: 'gorders.cancel_title',
      text: 'gorders.cancel_text',
      confirmText: 'gorders.cancel_round'
    });
    if (!reason || !reason.trim()) return;
    this.run(this.svc.cancel(this.id(), reason.trim()), 'gorders.round_cancelled');
  }

  /**
   * The CSV carries a UTF-8 BOM from the backend so Excel reads the Arabic
   * names; it is written to the file untouched rather than re-encoded here.
   */
  exportCsv(): void {
    this.busy.set(true);
    this.svc.exportParticipants(this.id()).subscribe({
      next: blob => {
        this.busy.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `group-order-${this.id()}-participants.csv`;
        a.click();
        // Revoking immediately can cancel the download in some browsers.
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      error: err => this.fail(err)
    });
  }

  // ---------------------------------------------------------------- helpers

  /** Shared tail for the one-shot actions: they all refetch and toast the same way. */
  private run(obs: Observable<unknown>, successKey: string): void {
    this.busy.set(true);
    obs.subscribe({
      next: () => {
        this.busy.set(false);
        this.dialog.toast('success', successKey);
        this.load();
      },
      error: (err: HttpErrorResponse) => this.fail(err)
    });
  }

  private fail(err: HttpErrorResponse): void {
    this.busy.set(false);
    this.dialog.error('common.error', err?.error?.message ?? 'gorders.action_failed');
  }

  back(): void {
    this.router.navigate(['/dashboard/group-orders']);
  }

  /**
   * Not every activity row is a status change; a plain event still needs a
   * label. A status is returned as a translation key rather than the API's
   * label so the log reads Arabic in Arabic — the pipe falls through unchanged
   * for anything that is not a key.
   */
  activityLabel(h: ActivityEntry): string {
    if (h.to_status) return 'gorders.status.' + h.to_status;
    return h.to_status_label || h.event.replace(/_/g, ' ');
  }

  money(value: number | string | null | undefined, currency = 'USD'): string {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (!isFinite(n)) return String(value);
    return `${currency} ${n.toLocaleString(this.i18n.isRtl() ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;
  }
}
