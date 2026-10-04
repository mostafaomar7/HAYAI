import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  WebsiteApiService, errorMessage, saveDownload
} from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import {
  LeadAttachment, StatusFlow, StatusHistoryRow, WebsiteAdmin, WebsiteLead
} from '../../../../../core/services/website/website.models';
import { fmtDate, nullIfEmpty } from '../shared/website-utils';
import {
  adminLabel, attrLabel, attributionRows, enumLabel, fmtSize, formatValue, humanize
} from '../purchases/sales-shared';

/**
 * One lead. `data` holds every submitted field by its form key, including the
 * ones that also map onto the lead's own columns, so it is shown in full: it
 * is the only place a custom question's answer lives.
 *
 * Status moves are `allowed_statuses`; a reason is asked for every move
 * (optional unless the enum marks the target as needing one) because it is
 * what the next person reading the history wants to know. Rescuing a lead
 * from spam is simply one of those moves.
 */
@Component({
  selector: 'app-lead-detail',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink],
  templateUrl: './lead-detail.html',
  styleUrls: ['../shared/website.shared.css', '../purchases/purchase-detail.css', './lead-detail.css']
})
export class LeadDetail {
  private api = inject(WebsiteApiService);
  readonly ctx = inject(WebsiteContextService);
  private i18n = inject(I18nService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly lang = this.i18n.lang;
  readonly adminLabel = adminLabel;
  readonly fmtSize = fmtSize;

  id = Number(this.route.snapshot.paramMap.get('id'));
  lead = signal<WebsiteLead | null>(null);
  flows = signal<StatusFlow[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  busy = signal(false);
  downloading = signal<number | null>(null);

  admins = signal<WebsiteAdmin[]>([]);
  adminsDenied = signal(false);
  assignee = signal('');
  notes = signal('');
  metaSaving = signal(false);
  metaError = signal<string | null>(null);

  canUpdate = computed(() => this.ctx.can('leads.update'));

  dirty = computed(() => {
    const l = this.lead();
    if (!l) return false;
    return this.assignee() !== String(l.assigned_to?.id ?? '') || this.notes() !== (l.internal_notes ?? '');
  });

  assigneeMissing = computed(() => {
    const a = this.lead()?.assigned_to;
    return !!a && !this.admins().some(x => x.id === a.id);
  });

  dataRows = computed(() =>
    Object.entries(this.lead()?.data ?? {}).map(([key, value]) => ({ key, value: formatValue(value, this.i18n) }))
  );

  attribution = computed(() => attributionRows(this.lead()?.attribution));

  history = computed<StatusHistoryRow[]>(() => [...(this.lead()?.history ?? [])].reverse());

  constructor() {
    this.load();
    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => this.flows.set(e.lead_statuses ?? []),
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
    this.api.lead(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: l => {
        this.apply(l);
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(errorMessage(err, 'web.leads.load_failed'));
        this.loading.set(false);
      }
    });
  }

  private apply(l: WebsiteLead): void {
    this.lead.set(l);
    this.assignee.set(String(l.assigned_to?.id ?? ''));
    this.notes.set(l.internal_notes ?? '');
  }

  back(): void {
    this.router.navigate(['/dashboard/website/leads']);
  }

  statusLabel(value: string | null | undefined, apiLabel?: string | null): string {
    return enumLabel(this.i18n, 'lead_status', value, apiLabel);
  }

  typeLabel(l: WebsiteLead): string {
    return enumLabel(this.i18n, 'lead_type', l.type, l.type_label);
  }

  date(value: string | null | undefined): string {
    return fmtDate(value, this.lang(), true);
  }

  attrLabel(key: string): string {
    return attrLabel(this.i18n, key);
  }

  actorLabel(h: StatusHistoryRow): string {
    return h.performed_by?.name ?? humanize(h.actor);
  }

  /** Spam and closed are the "away" moves; leaving spam is a rescue, so it stays primary. */
  isDanger(status: string): boolean {
    return status === 'spam' || status === 'closed';
  }

  async move(status: string): Promise<void> {
    const l = this.lead();
    if (!l || this.busy()) return;
    const required = !!this.flows().find(f => f.value === status)?.requires_reason;

    const reason = await this.dialog.prompt({
      title: 'web.leads.move_title',
      text: required ? 'web.leads.reason_required_text' : 'web.leads.reason_optional_text',
      params: { status: this.statusLabel(status), reference: l.reference },
      inputType: 'textarea',
      confirmText: 'web.leads.move_confirm'
    });
    if (reason === null) return;
    if (required && !reason.trim()) {
      this.dialog.error('common.error', 'web.leads.reason_required');
      return;
    }

    this.busy.set(true);
    this.api.updateLead(l.id, { status, reason: reason.trim() || null }).subscribe({
      next: res => {
        this.busy.set(false);
        this.apply(res);
        if (!res.history) this.load();
        this.dialog.toast('success', 'web.leads.status_changed');
      },
      error: err => {
        this.busy.set(false);
        this.dialog.error('common.error', errorMessage(err, 'web.leads.status_failed'));
      }
    });
  }

  saveMeta(): void {
    const l = this.lead();
    if (!l) return;
    const raw = this.assignee().trim();
    if (raw && !/^\d+$/.test(raw)) {
      this.metaError.set('web.purchases.assignee_invalid');
      return;
    }
    this.metaSaving.set(true);
    this.metaError.set(null);
    this.api.updateLead(l.id, {
      assigned_to: raw ? Number(raw) : null,
      internal_notes: nullIfEmpty(this.notes())
    }).subscribe({
      next: res => {
        this.metaSaving.set(false);
        this.apply({ ...res, history: res.history ?? l.history, data: res.data ?? l.data, attachments: res.attachments ?? l.attachments });
        this.dialog.toast('success', 'common.saved');
      },
      error: err => {
        this.metaSaving.set(false);
        this.metaError.set(errorMessage(err, 'web.leads.save_failed'));
      }
    });
  }

  assignToMe(): void {
    const me = this.ctx.me();
    if (me) this.assignee.set(String(me.id));
  }

  download(a: LeadAttachment): void {
    const l = this.lead();
    if (!l) return;
    this.downloading.set(a.index);
    this.api.leadAttachment(l.id, a.index).subscribe({
      next: res => {
        this.downloading.set(null);
        saveDownload(res, a.original_name);
      },
      error: () => {
        this.downloading.set(null);
        this.dialog.error('common.error', 'web.leads.download_failed');
      }
    });
  }

  async remove(): Promise<void> {
    const l = this.lead();
    if (!l) return;
    const ok = await this.dialog.confirm({
      title: 'web.leads.delete_title',
      text: 'web.leads.delete_text',
      params: { reference: l.reference },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteLead(l.id).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.leads.deleted');
        this.back();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.leads.delete_failed'))
    });
  }
}
