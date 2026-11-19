import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

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

// ------------------------------------------------------------- app usage
// Backend of 2026-11-18: when each account last used an app, which app,
// platform and version. `statistics.view`, like the rest of `/admin/analytics`.

export type AppUsageAudience = 'patients' | 'partners';
export type AppUsageApp = 'patient' | 'partner' | 'unknown';
export type AppUsagePlatform = 'android' | 'ios' | 'windows' | 'unknown';
export type AppUsageBucketKey = 'last_7_days' | '8_to_30_days' | '31_to_90_days' | 'over_90_days' | 'no_activity';
export type AppUsageActivity = 'active' | 'inactive' | 'no_activity';
export type AppUsageSort = 'last_seen_desc' | 'last_seen_asc' | 'newest';

export const APP_USAGE_USER_TYPES = [
  'patient', 'tourist', 'doctor', 'hospital', 'clinic', 'senior_care', 'pharmacies', 'labs_radiology',
  'medical_insurance', 'home_care', 'physical_therapy', 'employment_office', 'medical_devices'
] as const;

export interface AppUsageFilters {
  audience?: AppUsageAudience | '';
  user_type?: string;
  app?: AppUsageApp | '';
  platform?: AppUsagePlatform | '';
}

/** The five numbers every breakdown row carries. */
export interface AppUsageCounts {
  users: number;
  active_7_days: number;
  active_30_days: number;
  inactive_30_days: number;
  no_activity: number;
}

export interface AppUsageOverview {
  as_of: string;
  total_users: number;
  active: { last_24_hours: number; last_7_days: number; last_30_days: number };
  buckets: { key: AppUsageBucketKey; label: string; users: number }[];
  by_platform: (AppUsageCounts & { platform: string | null; platform_label: string; store: string | null; store_label: string })[];
  by_app: (AppUsageCounts & { app: string | null; app_label: string })[];
  by_user_type: (AppUsageCounts & { user_type: string | null; user_type_label: string })[];
  app_versions: (AppUsageCounts & {
    app: string | null; app_label: string; platform: string | null; platform_label: string;
    app_version: string | null; app_build: number | null;
  })[];
}

/** Also what `meta.user.app_usage` carries on the activity page. */
export interface AppUsageInfo {
  last_seen_at: string | null;
  days_since_seen: number | null;
  last_login_at: string | null;
  platform: string | null;
  platform_label?: string | null;
  store: string | null;
  store_label?: string | null;
  app: string | null;
  app_label?: string | null;
  app_version: string | null;
  app_build: number | null;
}

export interface AppUsageUser extends AppUsageInfo {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  user_type: string | null;
  user_type_label?: string | null;
  status: string | null;
  status_label?: string | null;
  registered_at: string | null;
}

export interface AppUsageUsersQuery extends AppUsageFilters {
  activity?: AppUsageActivity | '';
  days?: number | null;
  bucket?: AppUsageBucketKey | '';
  app_version?: string;
  build_below?: number | null;
  search?: string;
  sort?: AppUsageSort | '';
  page?: number;
  per_page?: number;
}

@Injectable({ providedIn: 'root' })
export class AppUsageService {
  private api = inject(ApiService);

  overview(f: AppUsageFilters): Observable<AppUsageOverview> {
    return this.api.get<AppUsageOverview>('/admin/analytics/app-usage', f);
  }

  users(q: AppUsageUsersQuery): Observable<PagedResult<AppUsageUser>> {
    return this.api.getPaged<AppUsageUser>('/admin/analytics/app-usage/users', q);
  }
}
