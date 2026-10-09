import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  WebsiteApiService, errorMessage, saveDownload
} from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import {
  ListParams, LocaleInfo, StatusFlow, WebsiteForm, WebsiteLead, WhatsappRef
} from '../../../../../core/services/website/website.models';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { fmtDate } from '../shared/website-utils';
import { attrLabel, attributionRows, enumLabel } from '../purchases/sales-shared';

const SPAM = 'spam';

/**
 * Website leads (form submissions).
 *
 * Spam is held back by default: the API excludes it unless asked
 * (`exclude_spam=0`), so it lives behind its own tab at the end instead of
 * inflating "all". The forms list deep-links here with `?form_id=` and
 * campaign reports with `?type=`, so both are read on load.
 */
@Component({
  selector: 'app-lead-list',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './lead-list.html',
  styleUrls: ['../shared/website.shared.css', './lead-list.css']
})
export class LeadList {
  private api = inject(WebsiteApiService);
  readonly ctx = inject(WebsiteContextService);
  private i18n = inject(I18nService);
  private dialog = inject(DialogService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  readonly lang = this.i18n.lang;

  rows = signal<WebsiteLead[]>([]);
  counts = signal<Record<string, number>>({});
  flows = signal<StatusFlow[]>([]);
  types = signal<string[]>([]);
  locales = signal<LocaleInfo[]>([]);
  forms = signal<WebsiteForm[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  exporting = signal(false);
  adsExporting = signal(false);

  // A WhatsApp chat's reference code → the visit it came from → a lead.
  waOpen = signal(false);
  waRef = signal('');
  waResult = signal<WhatsappRef | null>(null);
  waLoading = signal(false);
  waError = signal<string | null>(null);
  waSaving = signal(false);
  waFieldErrors = signal<Record<string, string>>({});
  waAttribution = computed(() => attributionRows(this.waResult()?.attribution as Record<string, unknown> | null));
  /** The Google Ads file covers leads and purchases, so it needs both permissions. */
  readonly canAdsExport = computed(() => this.ctx.can('leads.view') && this.ctx.can('orders.view'));
  total = signal(0);
  readonly perPage = 20;
  page = signal(1);

  status = signal('');
  search = signal('');
  type = signal('');
  formId = signal('');
  utmCampaign = signal('');
  utmSource = signal('');
  locale = signal('');
  from = signal('');
  to = signal('');
  filtersOpen = signal(false);

  private sub?: Subscription;

  tabs = computed(() => {
    const values = this.flows().map(f => f.value);
    for (const k of Object.keys(this.counts())) {
      if (k !== 'all' && !values.includes(k)) values.push(k);
    }
    return ['', ...values.filter(v => v !== SPAM), SPAM];
  });

  activeFilters = computed(() =>
    [this.type(), this.formId(), this.utmCampaign(), this.utmSource(), this.locale(), this.from(), this.to()]
      .filter(Boolean).length
  );

  onSearch = debounce((value: string) => {
    this.search.set(value.trim());
    this.reload();
  });

  onUtm = debounce((which: 'utmCampaign' | 'utmSource', value: string) => {
    this[which].set(value.trim());
    this.reload();
  });

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    this.formId.set(q.get('form_id') ?? '');
    this.type.set(q.get('type') ?? '');
    this.status.set(q.get('status') ?? '');
    if (this.formId() || this.type()) this.filtersOpen.set(true);
    this.load();

    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => {
        this.flows.set(e.lead_statuses ?? []);
        // A lead's type is its form's type; the enum may also list lead types separately.
        const leadTypes = e['lead_types'];
        this.types.set(Array.isArray(leadTypes) ? (leadTypes as string[]) : e.form_types ?? []);
        this.locales.set(e.locales ?? []);
      },
      error: () => this.flows.set([])
    });
    this.api.forms({ per_page: 100 }).pipe(takeUntilDestroyed()).subscribe({
      next: res => this.forms.set(res.items),
      error: () => this.forms.set([])
    });
  }

  /** The list filters, without paging — shared with the CSV export. */
  private filters(): ListParams {
    const spam = this.status() === SPAM;
    return {
      status: this.status() || undefined,
      exclude_spam: spam ? 0 : undefined,
      q: this.search() || undefined,
      type: this.type() || undefined,
      form_id: this.formId() || undefined,
      utm_campaign: this.utmCampaign() || undefined,
      utm_source: this.utmSource() || undefined,
      locale: this.locale() || undefined,
      from: this.from() || undefined,
      to: this.to() || undefined
    };
  }

  load(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.sub = this.api
      .leads({ ...this.filters(), page: this.page(), per_page: this.perPage })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.rows.set(res.items);
          this.counts.set(res.counts);
          this.total.set(res.pagination.total);
          this.loading.set(false);
        },
        error: err => {
          this.rows.set([]);
          this.loadError.set(errorMessage(err, 'web.leads.load_failed'));
          this.loading.set(false);
        }
      });
  }

  private reload(): void {
    this.page.set(1);
    this.load();
  }

  setStatus(value: string): void {
    this.status.set(value);
    this.reload();
  }

  setFilter(which: 'type' | 'formId' | 'locale' | 'from' | 'to', value: string): void {
    this[which].set(value);
    this.reload();
  }

  clearFilters(): void {
    for (const s of [this.type, this.formId, this.utmCampaign, this.utmSource, this.locale, this.from, this.to]) s.set('');
    // Drop the deep-link params too, so a refresh does not bring them back.
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    this.reload();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  open(row: WebsiteLead): void {
    this.router.navigate(['/dashboard/website/leads', row.id]);
  }

  count(status: string): number | null {
    const c = this.counts();
    if (status === '') {
      if (typeof c['all'] === 'number') return c['all'];
      const keys = Object.keys(c).filter(k => k !== SPAM);
      return keys.length ? keys.reduce((s, k) => s + (c[k] ?? 0), 0) : null;
    }
    return typeof c[status] === 'number' ? c[status] : null;
  }

  tabLabel(status: string): string {
    return status === '' ? this.i18n.translate('common.all') : enumLabel(this.i18n, 'lead_status', status);
  }

  statusLabel(row: WebsiteLead): string {
    return enumLabel(this.i18n, 'lead_status', row.status, row.status_label);
  }

  typeLabel(value: string, apiLabel?: string | null): string {
    return enumLabel(this.i18n, 'lead_type', value, apiLabel);
  }

  formName(f: WebsiteForm): string {
    return f.name || (this.lang() === 'ar' && f.name_ar) || f.name_en || f.key;
  }

  date(value: string | null | undefined): string {
    return fmtDate(value, this.lang(), true);
  }

  exportCsv(): void {
    this.exporting.set(true);
    this.api.exportLeads(this.filters()).subscribe({
      next: res => {
        this.exporting.set(false);
        saveDownload(res, 'leads.csv');
      },
      // The error body is a Blob here, so the backend message is not readable; say it generically.
      error: () => {
        this.exporting.set(false);
        this.dialog.error('common.error', 'web.leads.export_failed');
      }
    });
  }

  /**
   * The weekly Google Ads offline upload. Uses the list's date filter when
   * one is set; without it the API sends the last 7 days.
   */
  exportGoogleAds(): void {
    this.adsExporting.set(true);
    this.api.googleAdsConversions({ from: this.from() || undefined, to: this.to() || undefined }).subscribe({
      next: res => {
        this.adsExporting.set(false);
        saveDownload(res, 'google-ads-conversions.csv');
      },
      error: () => {
        this.adsExporting.set(false);
        this.dialog.error('common.error', 'web.leads.wa.ads_failed');
      }
    });
  }

  toggleWhatsapp(): void {
    this.waOpen.set(!this.waOpen());
  }

  findWhatsappRef(event?: Event): void {
    event?.preventDefault();
    const ref = this.waRef().trim();
    if (!ref) return;
    this.waLoading.set(true);
    this.waError.set(null);
    this.waResult.set(null);
    this.waFieldErrors.set({});
    this.api.whatsappRef(ref).subscribe({
      next: res => {
        this.waLoading.set(false);
        this.waResult.set(res);
      },
      error: err => {
        this.waLoading.set(false);
        this.waError.set(err?.status === 404 ? 'web.leads.wa.not_found' : errorMessage(err, 'web.leads.wa.lookup_failed'));
      }
    });
  }

  createWhatsappLead(event: Event): void {
    event.preventDefault();
    const found = this.waResult();
    if (!found) return;
    const data = new FormData(event.target as HTMLFormElement);
    const value = (k: string) => String(data.get(k) ?? '').trim() || undefined;
    const phone = value('phone');
    if (!phone) {
      this.waFieldErrors.set({ phone: this.i18n.translate('web.leads.wa.phone_required') });
      return;
    }
    this.waSaving.set(true);
    this.waFieldErrors.set({});
    this.api
      .leadFromWhatsappRef(found.ref, { phone, name: value('name'), email: value('email'), organization: value('organization'), notes: value('notes') })
      .subscribe({
        next: lead => {
          this.waSaving.set(false);
          this.dialog.toast('success', 'web.leads.wa.created');
          this.router.navigate(['/dashboard/website/leads', lead.id]);
        },
        error: err => {
          this.waSaving.set(false);
          // Converted already (by someone else, a moment ago): show the lead it became.
          const existing = err?.status === 409 ? err.error?.errors : null;
          if (existing?.lead_id) {
            this.waResult.set({ ...found, lead_id: existing.lead_id, lead_reference: existing.lead_reference ?? null });
            return;
          }
          if (err?.status === 422 && err.error?.errors) {
            const mapped: Record<string, string> = {};
            for (const [k, msgs] of Object.entries(err.error.errors as Record<string, string[]>)) mapped[k] = Array.isArray(msgs) ? msgs[0] : String(msgs);
            this.waFieldErrors.set(mapped);
            return;
          }
          this.dialog.error('common.error', errorMessage(err, 'web.leads.wa.create_failed'));
        }
      });
  }

  openLead(id: number): void {
    this.router.navigate(['/dashboard/website/leads', id]);
  }

  attrLabel(key: string): string {
    return attrLabel(this.i18n, key);
  }

  async remove(row: WebsiteLead, event: Event): Promise<void> {
    event.stopPropagation();
    const ok = await this.dialog.confirm({
      title: 'web.leads.delete_title',
      text: 'web.leads.delete_text',
      params: { reference: row.reference },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteLead(row.id).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.leads.deleted');
        if (this.rows().length === 1 && this.page() > 1) this.page.set(this.page() - 1);
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.leads.delete_failed'))
    });
  }
}
