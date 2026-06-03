import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
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

  loading = signal(true);
  greetingName = computed(() => this.auth.currentUser()?.name ?? 'Admin');

  range = signal<AnalyticsRange>({});
  stats = signal<StatCard[]>([]);
  usersByCategory = signal<CategoryBar | null>(null);
  revenueByPlan = signal<CategoryBar | null>(null);
  userGrowth = signal<TimeSeries | null>(null);
  revenueOverTime = signal<TimeSeries | null>(null);

  // precomputed bar-height arrays (max-normalized %), referenced by the template
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

  private toStats(o: OverviewKpis): StatCard[] {
    const fmt = (n: number) => n.toLocaleString('en-US');
    return [
      { id: 1, title: 'Total Users', value: fmt(o.totalUsers.value), trend: `${o.totalUsers.trendPercent}%`, trendUp: o.totalUsers.trendPercent >= 0, icon: 'total-users' },
      { id: 2, title: 'New Users', value: fmt(o.newUsers.value), trend: `${o.newUsers.trendPercent}%`, trendUp: o.newUsers.trendPercent >= 0, icon: 'new-users' },
      { id: 3, title: 'Total Revenue', value: fmt(Number(o.totalRevenue.value)), trend: `${o.totalRevenue.trendPercent}%`, trendUp: o.totalRevenue.trendPercent >= 0, icon: 'total-revenue' },
      { id: 4, title: 'Period Revenue', value: fmt(Number(o.periodRevenue.value)), trend: `${o.periodRevenue.trendPercent}%`, trendUp: o.periodRevenue.trendPercent >= 0, icon: 'period-revenue' }
    ];
  }

}
