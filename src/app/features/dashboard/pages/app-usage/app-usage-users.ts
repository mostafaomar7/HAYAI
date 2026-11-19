import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  APP_USAGE_USER_TYPES,
  AppUsageBucketKey,
  AppUsageService,
  AppUsageUser,
  AppUsageUsersQuery
} from '../../../../core/services/analytics.service';
import { USER_TYPE_LABEL } from '../../../../core/services/notifications.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';
import { platformClass, timeAgo, versionText } from './app-usage-shared';

const BUCKETS: AppUsageBucketKey[] = ['last_7_days', '8_to_30_days', '31_to_90_days', 'over_90_days', 'no_activity'];

/**
 * The accounts behind any number on the overview, mostly used to find who
 * stopped using the app. Every filter is in the URL; the server picks the
 * default sort (longest unused first for the inactive views) when none is set.
 */
@Component({
  selector: 'app-app-usage-users',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './app-usage-users.html',
  styleUrls: ['../website/shared/website.shared.css', './app-usage.css']
})
export class AppUsageUsersPage {
  private svc = inject(AppUsageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18n = inject(I18nService);

  readonly userTypes = APP_USAGE_USER_TYPES;
  readonly platformClass = platformClass;
  readonly versionText = versionText;
  readonly dayChoices = [7, 30, 90];
  readonly perPage = 20;

  loading = signal(true);
  failed = signal(false);
  fieldErrors = signal<Record<string, string>>({});
  hasFieldErrors = computed(() => Object.keys(this.fieldErrors()).length > 0);
  items = signal<AppUsageUser[]>([]);
  total = signal(0);
  q = signal<AppUsageUsersQuery>({});
  /** The bucket's own label, from the overview the admin came from. */
  bucketLabel = signal('');
  buildDraft = signal('');

  onSearch = debounce((v: string) => this.navigate({ search: v.trim() || null }));

  constructor() {
    this.route.queryParamMap.subscribe(p => {
      const num = (k: string) => { const n = Number(p.get(k)); return p.get(k) !== null && p.get(k) !== '' && Number.isFinite(n) ? n : null; };
      const bucket = p.get('bucket') as AppUsageBucketKey | null;
      this.q.set({
        audience: (p.get('audience') as AppUsageUsersQuery['audience']) || '',
        user_type: p.get('user_type') || '',
        app: (p.get('app') as AppUsageUsersQuery['app']) || '',
        platform: (p.get('platform') as AppUsageUsersQuery['platform']) || '',
        activity: (p.get('activity') as AppUsageUsersQuery['activity']) || '',
        days: num('days'),
        bucket: bucket || '',
        app_version: p.get('app_version') || '',
        build_below: num('build_below'),
        search: p.get('search') || '',
        sort: (p.get('sort') as AppUsageUsersQuery['sort']) || '',
        page: Math.max(1, num('page') ?? 1),
        per_page: this.perPage
      });
      this.buildDraft.set(this.q().build_below ? String(this.q().build_below) : '');
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.fieldErrors.set({});
    const q = this.q();
    // `days` only means something next to active / inactive.
    const days = q.activity === 'active' || q.activity === 'inactive' ? (q.days ?? 30) : null;
    this.svc.users({ ...q, days }).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.pagination.total); this.loading.set(false); },
      error: err => {
        this.items.set([]);
        this.total.set(0);
        this.loading.set(false);
        const errors = err?.error?.errors as Record<string, string[] | string> | undefined;
        if (err?.status === 422 && errors) {
          const flat: Record<string, string> = {};
          for (const [k, v] of Object.entries(errors)) flat[k] = Array.isArray(v) ? v[0] : String(v);
          this.fieldErrors.set(flat);
        } else {
          this.failed.set(true);
        }
      }
    });
    if (q.bucket && !this.bucketLabel()) this.loadBucketLabel();
  }

  /** The chip shows the API's own wording for the bucket. */
  private loadBucketLabel(): void {
    const { audience, user_type, app, platform } = this.q();
    this.svc.overview({ audience, user_type, app, platform }).subscribe({
      next: d => this.bucketLabel.set(d.buckets.find(b => b.key === this.q().bucket)?.label ?? ''),
      error: () => {}
    });
  }

  private params(): Record<string, string | number | null> {
    const q = this.q();
    return {
      audience: q.audience || null, user_type: q.user_type || null, app: q.app || null, platform: q.platform || null,
      activity: q.activity || null, days: q.days ?? null, bucket: q.bucket || null, app_version: q.app_version || null,
      build_below: q.build_below ?? null, search: q.search || null, sort: q.sort || null
    };
  }

  navigate(patch: Record<string, string | number | null>): void {
    if ('bucket' in patch) this.bucketLabel.set('');
    this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.params(), page: null, ...patch } });
  }

  goToPage(p: number): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.params(), page: p > 1 ? p : null } });
  }

  /** The preset: not used in the last 30 days, no activity included. */
  inactivePreset(): void {
    this.navigate({ activity: 'inactive', days: 30, bucket: null, sort: null });
  }

  setActivity(v: string): void {
    this.navigate({ activity: v || null, bucket: null, days: v === 'active' || v === 'inactive' ? (this.q().days ?? 30) : null });
  }

  setDays(d: number): void {
    this.navigate({ days: d, activity: this.q().activity === 'active' ? 'active' : 'inactive', bucket: null });
  }

  daysEnabled = computed(() => this.q().activity === 'active' || this.q().activity === 'inactive');
  currentDays = computed(() => this.q().days ?? 30);

  applyBuild(): void {
    const n = Number(this.buildDraft());
    this.navigate({ build_below: this.buildDraft().trim() && Number.isInteger(n) && n > 0 ? n : null });
  }

  clearAll(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  backToOverview(): void {
    const { audience, user_type, app, platform } = this.params();
    this.router.navigate(['/dashboard/analytics/app-usage'], { queryParams: { audience, user_type, app, platform } });
  }

  open(u: AppUsageUser): void {
    this.router.navigate(['/dashboard/users', u.id, 'activity']);
  }

  isBucket(v: string): boolean {
    return BUCKETS.includes(v as AppUsageBucketKey);
  }

  typeKey(type: string | null | undefined): string {
    return type ? (USER_TYPE_LABEL[type] ?? type) : '—';
  }

  ago(iso: string | null): string {
    return timeAgo(iso, this.i18n.lang());
  }

  exact(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }

  /** The row's tooltip: what does not earn a column of its own. */
  rowTitle(u: AppUsageUser): string {
    const t = (k: string) => this.i18n.translate(k);
    const parts = [
      `${t('appusage.last_seen')}: ${u.last_seen_at ? this.exact(u.last_seen_at) : t('appusage.no_activity')}`,
      `${t('appusage.last_login')}: ${u.last_login_at ? this.exact(u.last_login_at) : '—'}`
    ];
    if (u.email) parts.push(u.email);
    return parts.join('\n');
  }
}
