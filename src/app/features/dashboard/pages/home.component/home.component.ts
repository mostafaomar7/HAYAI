import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { DialogService } from '../../../../core/services/dialog.service';
import {
  AnalyticsService,
  AnalyticsRange,
  CategoryBar,
  OverviewKpis,
  TimeSeries
} from '../../../../core/services/analytics.service';

interface StatCard {
  id: number;
  title: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  private auth = inject(AuthService);
  private analytics = inject(AnalyticsService);
  private dialog = inject(DialogService);

  loading = signal(true);
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

  constructor() {
    this.refresh();
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
      this.dialog.error('Invalid date range', '"From" date must be before "To" date.');
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
      { id: 1, title: 'Total Users', value: fmt(o.totalUsers.value), trend: this.fmtTrend(o.totalUsers.trendPercent), trendUp: o.totalUsers.trendPercent >= 0, icon: 'total-users' },
      { id: 2, title: 'New Users', value: fmt(o.newUsers.value), trend: this.fmtTrend(o.newUsers.trendPercent), trendUp: o.newUsers.trendPercent >= 0, icon: 'new-users' },
      { id: 3, title: 'Total Revenue', value: fmt(Number(o.totalRevenue.value)), trend: this.fmtTrend(o.totalRevenue.trendPercent), trendUp: o.totalRevenue.trendPercent >= 0, icon: 'total-revenue' },
      { id: 4, title: 'Period Revenue', value: fmt(Number(o.periodRevenue.value)), trend: this.fmtTrend(o.periodRevenue.trendPercent), trendUp: o.periodRevenue.trendPercent >= 0, icon: 'period-revenue' }
    ];
  }

  private fmtTrend(pct: number): string {
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct}%`;
  }

  formatValue(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
}
