import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AiInsightsService,
  AiModule,
  AiUsageRow,
  AiUsageStatus
} from '../../../../../core/services/ai-insights.service';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

/**
 * Every AI request, with what it cost and whether it answered (backend brief
 * of 2026-10-22).
 *
 * The filters live in the URL, because this screen is linked into: a token
 * request opens it for one account, and the overview opens it for one module.
 * Reloading such a link has to show the same rows.
 *
 * Only filters the API actually implements are offered. An unknown query
 * parameter is **ignored silently** there — `charged_to=allocation` returns
 * the whole log unfiltered, and an unknown `status` returns nothing at all —
 * so a control we invented would quietly lie about what is on screen.
 */
@Component({
  selector: 'app-ai-usage',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './ai-usage.html',
  styleUrls: ['../../website/shared/website.shared.css', './ai-usage.css']
})
export class AiUsage {
  private svc = inject(AiInsightsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18n = inject(I18nService);

  readonly statuses: AiUsageStatus[] = [
    'ok', 'quota_exceeded', 'insufficient_data', 'provider_error', 'invalid_output', 'blocked'
  ];

  loading = signal(true);
  failed = signal(false);
  items = signal<AiUsageRow[]>([]);
  total = signal(0);

  modules = signal<AiModule[]>([]);

  from = signal('');
  to = signal('');
  module = signal('');
  status = signal<'' | AiUsageStatus>('');
  userId = signal<number | null>(null);
  /** Display only: the name we already had when the link was built. */
  userName = signal('');

  readonly perPage = 25;
  page = signal(1);

  constructor() {
    this.svc.modules().subscribe({
      // The filter degrades to "all modules" rather than taking the screen
      // down with it.
      next: m => this.modules.set(m ?? []),
      error: () => this.modules.set([])
    });

    this.route.queryParamMap.subscribe(q => {
      this.from.set(q.get('from') || '');
      this.to.set(q.get('to') || '');
      this.module.set(q.get('module') || '');
      const s = q.get('status') as AiUsageStatus | null;
      this.status.set(s && this.statuses.includes(s) ? s : '');
      const u = Number(q.get('user_id'));
      this.userId.set(Number.isFinite(u) && u > 0 ? u : null);
      this.userName.set(q.get('user_name') || '');
      this.page.set(Math.max(1, Number(q.get('page')) || 1));
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.usage({
      ...(this.from() ? { from: this.from() } : {}),
      ...(this.to() ? { to: this.to() } : {}),
      ...(this.module() ? { module: this.module() } : {}),
      ...(this.status() ? { status: this.status() as AiUsageStatus } : {}),
      ...(this.userId() ? { user_id: this.userId()! } : {}),
      page: this.page(),
      per_page: this.perPage
    }).subscribe({
      next: r => {
        this.items.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.total.set(0);
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }

  /** Every change goes through the URL, so the view and the link agree. */
  private navigate(patch: Record<string, string | number | null>): void {
    const current: Record<string, string | number | null> = {
      from: this.from() || null,
      to: this.to() || null,
      module: this.module() || null,
      status: this.status() || null,
      user_id: this.userId(),
      user_name: this.userName() || null,
      page: this.page() > 1 ? this.page() : null
    };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...current, page: null, ...patch },
      queryParamsHandling: ''
    });
  }

  setFrom(v: string): void { this.navigate({ from: v || null }); }
  setTo(v: string): void { this.navigate({ to: v || null }); }
  setModule(v: string): void { this.navigate({ module: v || null }); }
  setStatus(v: string): void { this.navigate({ status: v || null }); }
  clearUser(): void { this.navigate({ user_id: null, user_name: null }); }
  clearAll(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }
  goToPage(page: number): void { this.navigate({ page: page > 1 ? page : null }); }

  hasFilters(): boolean {
    return !!(this.from() || this.to() || this.module() || this.status() || this.userId());
  }

  moduleLabel(key: string | null | undefined): string {
    if (!key) return '—';
    const m = this.modules().find(x => x.key === key);
    if (!m) return key;
    const name = this.i18n.lang() === 'ar' ? m.name_ar : m.name_en;
    return (name || '').trim() || key;
  }

  /**
   * Our own translation, not the API's `status_label` — that field is English
   * only, and this screen has an Arabic half.
   */
  statusKey(row: AiUsageRow): string {
    const s = String(row.status || '');
    return this.statuses.includes(s as AiUsageStatus) ? `ai.usage.status.${s}` : (s || '—');
  }

  statusClass(row: AiUsageRow): string {
    const s = String(row.status || '');
    if (s === 'ok') return 'pill-ok';
    if (s === 'quota_exceeded') return 'pill-warning';
    if (s === 'blocked') return 'pill-blocked';
    return s ? 'pill-failed' : '';
  }

  chargedKey(row: AiUsageRow): string {
    const c = String(row.charged_to || '');
    return ['pool', 'allocation', 'none'].includes(c) ? `ai.usage.charged.${c}` : (c || '—');
  }

  num(v: number | null | undefined): string {
    return typeof v === 'number' ? v.toLocaleString('en') : '—';
  }

  usd(v: number | null | undefined): string {
    if (typeof v !== 'number') return '—';
    return '$' + v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }

  /** Milliseconds are noise at this length; seconds are what one reads. */
  duration(v: number | null | undefined): string {
    if (typeof v !== 'number') return '—';
    return (v / 1000).toFixed(1) + 's';
  }
}
