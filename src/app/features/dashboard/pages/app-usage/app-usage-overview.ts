import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  APP_USAGE_USER_TYPES,
  AppUsageCounts,
  AppUsageFilters,
  AppUsageOverview,
  AppUsageService
} from '../../../../core/services/analytics.service';
import { USER_TYPE_LABEL } from '../../../../core/services/notifications.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { pct, platformClass, versionText } from './app-usage-shared';

type Version = AppUsageOverview['app_versions'][number];

const PLATFORM_COLOR: Record<string, string> = { android: '#16A34A', ios: '#111827', windows: '#2563EB' };

/**
 * Who uses the apps, on which platform and version, and who stopped
 * (backend of 2026-11-18). Every count, bar and row opens the users list
 * with the same filters plus the slice that was clicked.
 *
 * The filters live in the URL so a filtered view can be shared as a link.
 */
@Component({
  selector: 'app-app-usage-overview',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './app-usage-overview.html',
  styleUrls: ['../website/shared/website.shared.css', './app-usage.css']
})
export class AppUsageOverviewPage {
  private svc = inject(AppUsageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18n = inject(I18nService);

  readonly userTypes = APP_USAGE_USER_TYPES;
  readonly platformClass = platformClass;
  readonly versionText = versionText;
  readonly pct = pct;

  loading = signal(true);
  failed = signal<string | null>(null);
  data = signal<AppUsageOverview | null>(null);
  filters = signal<AppUsageFilters>({});
  infoOpen = signal(false);

  constructor() {
    this.route.queryParamMap.subscribe(q => {
      this.filters.set({
        audience: (q.get('audience') as AppUsageFilters['audience']) || '',
        user_type: q.get('user_type') || '',
        app: (q.get('app') as AppUsageFilters['app']) || '',
        platform: (q.get('platform') as AppUsageFilters['platform']) || ''
      });
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(null);
    this.svc.overview(this.filters()).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: err => {
        this.data.set(null);
        this.loading.set(false);
        // An unknown filter value in a hand-edited link answers 422.
        const errors = err?.error?.errors as Record<string, string[]> | undefined;
        this.failed.set(err?.status === 422 && errors ? Object.values(errors).map(v => v[0]).join(' · ') : 'appusage.load_failed');
      }
    });
  }

  setFilter(key: keyof AppUsageFilters, value: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.filterParams(), [key]: value || null } });
  }

  clearFilters(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  hasFilters = computed(() => Object.values(this.filters()).some(Boolean));

  private filterParams(): Record<string, string | null> {
    const f = this.filters();
    return { audience: f.audience || null, user_type: f.user_type || null, app: f.app || null, platform: f.platform || null };
  }

  /** Screen 2 with this screen's filters plus `extra`. */
  openUsers(extra: Record<string, string | number | null>): void {
    this.router.navigate(['/dashboard/analytics/app-usage/users'], { queryParams: { ...this.filterParams(), ...extra } });
  }

  typeKey(type: string | null | undefined): string {
    return type ? (USER_TYPE_LABEL[type] ?? type) : '';
  }

  num(v: number | null | undefined): string {
    return typeof v === 'number' ? v.toLocaleString('en') : '—';
  }

  activePct(row: AppUsageCounts): string {
    const p = pct(row.active_30_days, row.users);
    return p === null ? '—' : p + '%';
  }

  maxBucket = computed(() => Math.max(1, ...(this.data()?.buckets ?? []).map(b => b.users)));

  // ---------------------------------------------------------------- donut

  readonly R = 54;
  readonly C = 2 * Math.PI * 54;

  donut = computed(() => {
    const rows = this.data()?.by_platform ?? [];
    const total = rows.reduce((s, r) => s + r.users, 0) || 1;
    let offset = 0;
    return rows.map(r => {
      const len = (r.users / total) * this.C;
      const seg = { label: r.store_label || r.platform_label, sub: r.platform_label, users: r.users, color: PLATFORM_COLOR[r.platform ?? ''] ?? '#CBD5E1', dash: `${len} ${this.C - len}`, offset: -offset };
      offset += len;
      return seg;
    });
  });

  // ---------------------------------------------------------------- versions

  /** Highest build per app + platform: anything below it is outdated. */
  private newest = computed(() => {
    const m = new Map<string, number>();
    for (const v of this.data()?.app_versions ?? []) {
      if (v.app_build === null) continue;
      const k = `${v.app}|${v.platform}`;
      m.set(k, Math.max(m.get(k) ?? -Infinity, v.app_build));
    }
    return m;
  });

  newestBuild(v: Version): number | null {
    return this.newest().get(`${v.app}|${v.platform}`) ?? null;
  }

  isOutdated(v: Version): boolean {
    const n = this.newestBuild(v);
    return v.app_build !== null && n !== null && v.app_build < n;
  }

  openVersion(v: Version): void {
    if (this.isOutdated(v)) {
      this.openUsers({ app: v.app, platform: v.platform, build_below: this.newestBuild(v) });
    } else if (v.app_version) {
      this.openUsers({ app: v.app, platform: v.platform, app_version: v.app_version });
    }
  }

  asOf = computed(() => {
    const d = this.data()?.as_of;
    return d ? new Date(d).toLocaleString(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  });
}
