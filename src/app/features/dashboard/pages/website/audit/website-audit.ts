import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebsiteApiService, errorMessage } from '../../../../../core/services/website/website-api.service';
import { AuditLogRow } from '../../../../../core/services/website/website.models';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { fmtDate } from '../shared/website-utils';

/** The entity types the website audit log records (§15). Not served by `/enums`, so listed here. */
export const AUDIT_ENTITY_TYPES = [
  'website_page', 'website_product', 'website_lead', 'website_purchase_request', 'website_cta',
  'website_form', 'website_faq', 'website_author', 'website_category', 'website_media', 'website_redirect',
  'website_menu', 'website_crawler_rule', 'website_llms_entry', 'website_settings', 'website_role', 'user'
];

/** Where an audited entity can be opened, for the ones that have their own screen. */
const ENTITY_ROUTES: Record<string, string> = {
  website_page: '/dashboard/website/pages',
  website_product: '/dashboard/website/products',
  website_lead: '/dashboard/website/leads',
  website_purchase_request: '/dashboard/website/purchases',
  website_form: '/dashboard/website/forms'
};

interface AuditFilters {
  entity_type: string;
  entity_id: string;
  action: string;
  admin_id: string;
  method: string;
  from: string;
  to: string;
}

const EMPTY: AuditFilters = { entity_type: '', entity_id: '', action: '', admin_id: '', method: '', from: '', to: '' };

/**
 * Website audit log (§15, audit.view): who changed what, with the old and new
 * values. Filters live in the query string, so other screens deep-link with
 * `?entity_type=website_page&entity_id=3` ("history of this page") and the
 * filtered view survives a reload or a shared link.
 */
@Component({
  selector: 'app-website-audit',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink, PaginationComponent],
  templateUrl: './website-audit.html',
  styleUrls: ['../shared/website.shared.css', './website-audit.css']
})
export class WebsiteAudit {
  private api = inject(WebsiteApiService);
  private i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly entityTypes = AUDIT_ENTITY_TYPES;
  readonly methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  readonly perPageOptions = [25, 50, 100];

  rows = signal<AuditLogRow[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  total = signal(0);
  page = signal(1);
  perPage = signal(25);
  filters = signal<AuditFilters>({ ...EMPTY });
  expanded = signal<Set<number>>(new Set());

  /** Free-text filters write to the URL after typing stops, not per keystroke. */
  onText = debounce((key: keyof AuditFilters, value: string) => this.setFilter(key, value.trim()));

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const f: AuditFilters = { ...EMPTY };
      for (const k of Object.keys(EMPTY) as (keyof AuditFilters)[]) f[k] = q.get(k) ?? '';
      this.filters.set(f);
      this.page.set(Math.max(1, Number(q.get('page')) || 1));
      const pp = Number(q.get('per_page'));
      this.perPage.set(this.perPageOptions.includes(pp) ? pp : 25);
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const f = this.filters();
    this.api
      .auditLogs({
        page: this.page(),
        per_page: this.perPage(),
        entity_type: f.entity_type || undefined,
        entity_id: f.entity_id || undefined,
        action: f.action || undefined,
        admin_id: f.admin_id || undefined,
        method: f.method || undefined,
        from: f.from || undefined,
        to: f.to || undefined
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.rows.set(res.items);
          this.total.set(res.pagination.total);
          this.expanded.set(new Set());
          this.loading.set(false);
        },
        error: err => {
          this.rows.set([]);
          this.loadError.set(errorMessage(err, 'web.audit.load_failed'));
          this.loading.set(false);
        }
      });
  }

  private navigate(params: Record<string, string | number | null>): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge' });
  }

  setFilter(key: keyof AuditFilters, value: string): void {
    if (this.filters()[key] === value) return;
    this.navigate({ [key]: value || null, page: null });
  }

  setPerPage(value: string): void {
    this.navigate({ per_page: Number(value) === 25 ? null : Number(value), page: null });
  }

  goToPage(page: number): void {
    this.navigate({ page: page > 1 ? page : null });
  }

  clearFilters(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  hasFilters(): boolean {
    return Object.values(this.filters()).some(Boolean);
  }

  /** Clicking an entity narrows the log to that one record's history. */
  filterEntity(row: AuditLogRow): void {
    if (!row.entity_type) return;
    this.navigate({ entity_type: row.entity_type, entity_id: row.entity_id ?? null, page: null });
  }

  filterAdmin(row: AuditLogRow): void {
    if (row.admin?.id) this.navigate({ admin_id: row.admin.id, page: null });
  }

  toggle(id: number): void {
    this.expanded.update(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isOpen(id: number): boolean {
    return this.expanded().has(id);
  }

  hasDiff(row: AuditLogRow): boolean {
    return !!(row.old_values && Object.keys(row.old_values).length) || !!(row.new_values && Object.keys(row.new_values).length);
  }

  /** Union of old and new keys, each with both sides rendered as text. */
  diff(row: AuditLogRow): { key: string; old: string; new: string; changed: boolean; added: boolean; removed: boolean }[] {
    const o = row.old_values ?? {};
    const n = row.new_values ?? {};
    const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])];
    return keys.map(key => {
      const inOld = Object.prototype.hasOwnProperty.call(o, key);
      const inNew = Object.prototype.hasOwnProperty.call(n, key);
      const a = this.show(o[key]);
      const b = this.show(n[key]);
      return { key, old: inOld ? a : '', new: inNew ? b : '', changed: a !== b, added: !inOld && inNew, removed: inOld && !inNew };
    });
  }

  private show(v: unknown): string {
    if (v === undefined) return '';
    if (v === null) return 'null';
    if (typeof v === 'object') return JSON.stringify(v, null, 2);
    return String(v);
  }

  entityLabel(type: string | null): string {
    if (!type) return '—';
    const k = `web.audit.entity.${type}`;
    const t = this.i18n.translate(k);
    return t === k ? type : t;
  }

  entityRoute(row: AuditLogRow): (string | number)[] | null {
    const base = row.entity_type ? ENTITY_ROUTES[row.entity_type] : undefined;
    return base && row.entity_id ? [base, row.entity_id] : null;
  }

  statusClass(status: number | null | undefined): string {
    const s = Number(status) || 0;
    if (s >= 200 && s < 300) return 'pill-ok';
    if (s >= 400 && s < 500) return 'pill-warning';
    if (s >= 500) return 'pill-error';
    return 'pill-draft';
  }

  date(value: string | null | undefined): string {
    return fmtDate(value, this.i18n.lang(), true);
  }
}
