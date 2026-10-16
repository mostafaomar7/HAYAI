import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { DialogService } from '../../../../core/services/dialog.service';
import {
  AnalyticsService,
  AnalyticsRange,
  CategoryBar,
  OverviewKpis,
  TimeSeries
} from '../../../../core/services/analytics.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton';

interface StatCard {
  id: number;
  titleKey: string;
  value: string;
  trend: string;
  /** The exact figure, for the badge's tooltip when the badge rounds it. */
  trendExact: string;
  trendUp: boolean;
  icon: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, TPipe, SkeletonComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  private auth = inject(AuthService);
  private analytics = inject(AnalyticsService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);

  loading = signal(true);
  /** Four stat cards and six bars: the shape the page settles into. */
  readonly placeholders = [0, 1, 2, 3];
  readonly chartPlaceholders = ['45%', '72%', '30%', '88%', '58%', '40%'];
  greetingName = computed(() => this.auth.currentUser()?.name ?? 'Admin');

  // form-bound date inputs
  fromDate = signal<string>('');
  toDate = signal<string>('');

  // applied range (used by API calls)
  range = signal<AnalyticsRange>({});

  stats = signal<StatCard[]>([]);
  usersByCategory = signal<CategoryBar | null>(null);
  revenueByPlan = signal<CategoryBar | null>(null);
  userGrowth = signal<TimeSeries | null>(null);
  revenueOverTime = signal<TimeSeries | null>(null);

  usersByCategoryHeights = computed(() =>
    this.normalize((this.usersByCategory()?.items ?? []).map(i => i.value))
  );
  revenueByPlanHeights = computed(() =>
    this.normalize((this.revenueByPlan()?.items ?? []).map(i => i.value))
  );
  userGrowthHeights = computed(() =>
    this.normalize((this.userGrowth()?.series ?? []).map(s => s.value))
  );
  revenueOverTimeHeights = computed(() =>
    this.normalize((this.revenueOverTime()?.series ?? []).map(s => s.value))
  );

  private normalize(values: number[]): number[] {
    const max = Math.max(...values, 1);
    return values.map(v => Math.max(2, Math.round((v / max) * 100)));
  }

  /**
   * The charts read `/admin/analytics/*`, which needs `statistics.view`.
   * Home is every admin's landing page, so it stays open to all; without the
   * permission it shows the greeting and nothing it would only fail to load.
   */
  readonly showStats = inject(AdminAccessService).can('statistics');

  constructor() {
    if (this.showStats) this.refresh();
    else this.loading.set(false);
  }

  refresh() {
    this.loading.set(true);
    const r = this.range();
    forkJoin({
      overview: this.analytics.overview(r),
      usersByCategory: this.analytics.usersByCategory(r),
      revenueByPlan: this.analytics.revenueByPlanType(r),
      userGrowth: this.analytics.userGrowth(r),
      revenueOverTime: this.analytics.revenueOverTime(r)
    }).subscribe({
      next: ({ overview, usersByCategory, revenueByPlan, userGrowth, revenueOverTime }) => {
        this.stats.set(this.toStats(overview));
        this.usersByCategory.set(usersByCategory);
        this.revenueByPlan.set(revenueByPlan);
        this.userGrowth.set(userGrowth);
        this.revenueOverTime.set(revenueOverTime);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  applyDateRange() {
    const from = this.fromDate();
    const to = this.toDate();
    if (from && to && from > to) {
      this.dialog.error(this.i18n.translate('home.invalid_date_range'), this.i18n.translate('home.invalid_date_range_text'));
      return;
    }
    this.range.set({ from: from || undefined, to: to || undefined });
    this.refresh();
  }

  resetDateRange() {
    this.fromDate.set('');
    this.toDate.set('');
    this.range.set({});
    this.refresh();
  }

  applyPreset(days: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.fromDate.set(fmt(from));
    this.toDate.set(fmt(to));
    this.range.set({ from: fmt(from), to: fmt(to) });
    this.refresh();
  }

  private toStats(o: OverviewKpis): StatCard[] {
    const fmt = (n: number) => n.toLocaleString('en-US');
    return [
      { id: 1, titleKey: 'home.total_users', value: fmt(o.totalUsers.value), trend: this.fmtTrend(o.totalUsers.trendPercent), trendExact: this.exactTrend(o.totalUsers.trendPercent), trendUp: o.totalUsers.trendPercent >= 0, icon: 'total-users' },
      { id: 2, titleKey: 'home.new_users', value: fmt(o.newUsers.value), trend: this.fmtTrend(o.newUsers.trendPercent), trendExact: this.exactTrend(o.newUsers.trendPercent), trendUp: o.newUsers.trendPercent >= 0, icon: 'new-users' },
      { id: 3, titleKey: 'home.total_revenue', value: fmt(Number(o.totalRevenue.value)), trend: this.fmtTrend(o.totalRevenue.trendPercent), trendExact: this.exactTrend(o.totalRevenue.trendPercent), trendUp: o.totalRevenue.trendPercent >= 0, icon: 'total-revenue' },
      { id: 4, titleKey: 'home.period_revenue', value: fmt(Number(o.periodRevenue.value)), trend: this.fmtTrend(o.periodRevenue.trendPercent), trendExact: this.exactTrend(o.periodRevenue.trendPercent), trendUp: o.periodRevenue.trendPercent >= 0, icon: 'period-revenue' }
    ];
  }

  /**
   * A percentage an admin can read at a glance.
   *
   * The API's figure is right — `periodRevenue` of 1,246,094 against a
   * previous period of 19,375 really is +6331.5%, and it reconciles to the
   * decimal. It is just not a number anyone can use: past a certain size a
   * percentage stops being a comparison and starts being noise, and "+155256.7%"
   * on a seven-day range is noise.
   *
   * So from ten times over, it is shown as a multiple — `×64` — which is
   * what the percentage was trying to say. The exact figure stays in the
   * badge's tooltip, so nothing is hidden, only moved.
   */
  private fmtTrend(pct: number): string {
    if (!Number.isFinite(pct)) return '—';
    // Round first, then choose the form. Deciding before rounding puts 999.9
    // and 1000 on opposite sides of the same line: "+1000%" and "×11".
    const rounded = Math.abs(pct) >= 100 ? Math.round(pct) : Math.round(pct * 10) / 10;
    if (rounded >= 1000) {
      const times = 1 + rounded / 100;
      return `×${times >= 100 ? Math.round(times) : times.toFixed(1).replace(/\.0$/, '')}`;
    }
    return `${rounded > 0 ? '+' : ''}${rounded}%`;
  }

  /** The untouched percentage, for the tooltip. */
  private exactTrend(pct: number): string {
    return Number.isFinite(pct) ? `${pct > 0 ? '+' : ''}${pct}%` : '';
  }

  formatValue(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
}
