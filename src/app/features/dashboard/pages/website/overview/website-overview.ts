import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebsiteApiService, errorMessage } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { WebsiteOverview as OverviewData } from '../../../../../core/services/website/website.models';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { fmtDate } from '../shared/website-utils';

interface QuickLink {
  label: string;
  hint: string;
  route: string;
  permission: string;
}

/**
 * Landing screen of the Website section (`GET /overview`, cms.view).
 *
 * It answers "what needs me today": unpublished drafts, scheduled releases,
 * new leads and open purchases. The quick links are filtered by the admin's
 * own permissions so nobody is offered a screen the guard would bounce.
 */
@Component({
  selector: 'app-website-overview',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink],
  templateUrl: './website-overview.html',
  styleUrls: ['../shared/website.shared.css', './website-overview.css']
})
export class WebsiteOverview {
  private api = inject(WebsiteApiService);
  private i18n = inject(I18nService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  readonly ctx = inject(WebsiteContextService);

  data = signal<OverviewData | null>(null);
  loading = signal(true);
  loadError = signal<string | null>(null);

  private readonly allLinks: QuickLink[] = [
    { label: 'menu.website.pages', hint: 'web.overview.link_pages', route: '/dashboard/website/pages', permission: 'cms.view' },
    { label: 'menu.website.articles', hint: 'web.overview.link_articles', route: '/dashboard/website/articles', permission: 'cms.view' },
    { label: 'menu.website.products', hint: 'web.overview.link_products', route: '/dashboard/website/products', permission: 'products.view' },
    { label: 'menu.website.leads', hint: 'web.overview.link_leads', route: '/dashboard/website/leads', permission: 'leads.view' },
    { label: 'menu.website.purchases', hint: 'web.overview.link_purchases', route: '/dashboard/website/purchases', permission: 'orders.view' },
    { label: 'menu.website.media', hint: 'web.overview.link_media', route: '/dashboard/website/media', permission: 'media.view' },
    { label: 'menu.website.crawlers', hint: 'web.overview.link_crawlers', route: '/dashboard/website/crawlers', permission: 'seo.view' },
    { label: 'menu.website.redirects', hint: 'web.overview.link_redirects', route: '/dashboard/website/redirects', permission: 'redirects.view' },
    { label: 'menu.website.analytics', hint: 'web.overview.link_analytics', route: '/dashboard/website/analytics', permission: 'analytics.view' },
    { label: 'menu.website.settings', hint: 'web.overview.link_settings', route: '/dashboard/website/settings', permission: 'settings.view' },
    { label: 'menu.website.audit', hint: 'web.overview.link_audit', route: '/dashboard/website/audit', permission: 'audit.view' },
    { label: 'menu.website.roles', hint: 'web.overview.link_roles', route: '/dashboard/website/roles', permission: 'roles.manage' }
  ];

  readonly links = computed(() => this.allLinks.filter(l => this.ctx.can(l.permission)));
  readonly roles = computed(() => this.ctx.me()?.roles ?? []);

  constructor() {
    // `/me` is normally already cached by the route guard; this only makes
    // the role chips appear when the screen is reached some other way.
    this.ctx.load().pipe(takeUntilDestroyed()).subscribe();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.overview().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: d => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(errorMessage(err, 'web.overview.load_failed'));
        this.loading.set(false);
      }
    });
  }

  /** Counters are open-ended maps keyed by status; a missing status is zero. */
  count(map: Record<string, number> | null | undefined, key: string): number {
    return map?.[key] ?? 0;
  }

  openPage(id: number): void {
    this.router.navigate(['/dashboard/website/pages', id]);
  }

  date(value: string | null | undefined): string {
    return fmtDate(value, this.i18n.lang(), true);
  }

  roleLabel(role: string): string {
    const key = `web.role.${role}`;
    const t = this.i18n.translate(key);
    return t === key ? role : t;
  }
}
