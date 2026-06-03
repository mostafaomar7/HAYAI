import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface AnalyticsRange {
  from?: string;
  to?: string;
  provider_type?: string;
}

export interface KpiValue {
  value: number;
  trendPercent: number;
  currency?: string;
}

export interface OverviewKpis {
  totalUsers: KpiValue;
  newUsers: KpiValue;
  totalRevenue: KpiValue;
  periodRevenue: KpiValue;
}

export interface CategoryBar {
  currency: string | null;
  items: { label: string; value: number }[];
}

export interface TimeSeries {
  groupBy: string;
  currency?: string;
  series: { label: string; value: number }[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private api = inject(ApiService);

  overview(range: AnalyticsRange = {}): Observable<OverviewKpis> {
    return this.api.get<OverviewKpis>('/admin/analytics/overview', range);
  }

  usersByCategory(range: AnalyticsRange = {}): Observable<CategoryBar> {
    return this.api.get<CategoryBar>('/admin/analytics/users-by-category', range);
  }

  revenueByPlanType(range: AnalyticsRange = {}): Observable<CategoryBar> {
    return this.api.get<CategoryBar>('/admin/analytics/revenue-by-plan-type', range);
  }

  userGrowth(range: AnalyticsRange = {}): Observable<TimeSeries> {
    return this.api.get<TimeSeries>('/admin/analytics/user-growth', range);
  }

  revenueOverTime(range: AnalyticsRange = {}): Observable<TimeSeries> {
    return this.api.get<TimeSeries>('/admin/analytics/revenue-over-time', range);
  }
}
