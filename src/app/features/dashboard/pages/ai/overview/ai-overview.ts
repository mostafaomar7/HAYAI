import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AiInsightsService,
  AiModule,
  AiModuleSummaryRow,
  AiOverview as AiOverviewData
} from '../../../../../core/services/ai-insights.service';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';

/**
 * What the AI did and what it cost (backend brief of 2026-10-22).
 *
 * Two things on this screen are deliberately labelled rather than just
 * printed:
 *
 * - the shared free pool does not follow the date window, so it is in its own
 *   block that says "right now" instead of sitting among windowed numbers;
 * - in the doctors block, `tokens_used` is windowed while `allocated_tokens`
 *   and `remaining_tokens` are the lifetime of their grants. Unlabelled, the
 *   three read as a contradiction: on production today the last 30 days show
 *   0 used beside 56,320 tokens missing from allocated − remaining.
 */
@Component({
  selector: 'app-ai-overview',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink],
  templateUrl: './ai-overview.html',
  // The dashboard's shared card/tile/table styles. They live under the
  // website feature for historical reasons; they are not website-specific,
  // and copying them a third time is what left the token-request screens
  // unstyled.
  styleUrls: ['../../website/shared/website.shared.css', './ai-overview.css']
})
export class AiOverview {
  private svc = inject(AiInsightsService);
  private i18n = inject(I18nService);

  loading = signal(true);
  failed = signal(false);
  data = signal<AiOverviewData | null>(null);

  /** The catalog, so the table says "Dialysis" rather than `dialysis`. */
  catalog = signal<AiModule[]>([]);

  modulesLoading = signal(true);
  modulesFailed = signal(false);
  modules = signal<AiModuleSummaryRow[]>([]);

  from = signal(AiOverview.iso(new Date(Date.now() - 30 * 86400000)));
  to = signal(AiOverview.iso(new Date()));

  /** `YYYY-MM-DD` in local time — `toISOString` would shift a Cairo evening. */
  private static iso(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  constructor() {
    // Names only. If it fails the table falls back to the module keys, which
    // are readable enough to not be worth failing the screen over.
    this.svc.modules().subscribe({
      next: m => this.catalog.set(m ?? []),
      error: () => this.catalog.set([])
    });
    this.load();
  }

  moduleLabel(key: string | null | undefined): string {
    if (!key) return '—';
    const m = this.catalog().find(x => x.key === key);
    if (!m) return key;
    const name = this.i18n.lang() === 'ar' ? m.name_ar : m.name_en;
    return (name || '').trim() || key;
  }

  load(): void {
    const range = { from: this.from(), to: this.to() };

    this.loading.set(true);
    this.failed.set(false);
    this.svc.overview(range).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: () => { this.data.set(null); this.failed.set(true); this.loading.set(false); }
    });

    // Its own call, its own failure: the per-module table going missing must
    // not take the totals down with it.
    this.modulesLoading.set(true);
    this.modulesFailed.set(false);
    this.svc.usageSummary(range).subscribe({
      next: rows => { this.modules.set(rows ?? []); this.modulesLoading.set(false); },
      error: () => { this.modules.set([]); this.modulesFailed.set(true); this.modulesLoading.set(false); }
    });
  }

  setRange(which: 'from' | 'to', value: string): void {
    if (!value) return;
    (which === 'from' ? this.from : this.to).set(value);
    if (this.from() > this.to()) {
      // Keep the pair valid rather than asking the server for a window that
      // runs backwards.
      (which === 'from' ? this.to : this.from).set(value);
    }
    this.load();
  }

  preset(days: number): void {
    this.to.set(AiOverview.iso(new Date()));
    this.from.set(AiOverview.iso(new Date(Date.now() - days * 86400000)));
    this.load();
  }

  /** How much of the shared pool is gone, 0–100. */
  poolPercent = computed(() => {
    const p = this.data()?.patients;
    const total = p?.free_pool_total ?? 0;
    const used = p?.free_pool_used ?? 0;
    if (!total) return 0;
    return Math.min(100, Math.round((used / total) * 100));
  });

  /** Share of requests that did not answer normally, 0–100. */
  failureRate = computed(() => {
    const d = this.data();
    const total = d?.requests ?? 0;
    if (!total) return null;
    return Math.round(((d?.failed_requests ?? 0) / total) * 100);
  });

  num(v: number | null | undefined): string {
    return typeof v === 'number' ? v.toLocaleString('en') : '—';
  }

  /** Costs here are fractions of a dollar; two decimals would read as zero. */
  usd(v: number | null | undefined): string {
    if (typeof v !== 'number') return '—';
    return '$' + v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }

  /** `error_rate` arrives as 0–1, not as a percentage. */
  rate(v: number | null | undefined): string {
    return typeof v === 'number' ? Math.round(v * 100) + '%' : '—';
  }

  moduleLink(row: AiModuleSummaryRow): unknown[] {
    return ['/dashboard/ai/usage'];
  }

  moduleParams(row: AiModuleSummaryRow): Record<string, string> {
    return { module: row.module || '', from: this.from(), to: this.to() };
  }

  rangeParams(): Record<string, string> {
    return { from: this.from(), to: this.to() };
  }
}
