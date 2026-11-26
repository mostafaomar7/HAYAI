import { ChangeDetectionStrategy, Component, PLATFORM_ID, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { RequestTracking } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteStringKey } from '../i18n/site-strings';
import { SiteApiService } from '../services/site-api.service';
import { SeoHeadService } from '../services/seo-head.service';
import { WebsiteAccountService } from '../services/website-account.service';
import { str } from '../site-utils';

/**
 * A website request, followed without the app:
 * `/{locale}/requests/{reference}?token=…` (brief 2026-11-26, A9). The backend
 * builds this exact path into `tracking.url` and the tracking SMS.
 *
 * The API returns no personal or health details, on purpose, and the look-up
 * still runs in the browser only: the token is a credential in the URL, so it
 * never goes into server HTML, and server.ts serves `/requests/` no-store.
 * Without `?token=` the token remembered on this device is used, so a bare
 * reference link still works where the request was sent.
 */
@Component({
  selector: 'site-request-tracking',
  host: { 'data-page-type': 'request_tracking' },
  styleUrls: ['./site-view.component.css', '../ui/account-flow.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap blk">
      <h1>{{ state.t('requestTitle') }}</h1>

      @if (loading()) {
        <p class="muted" role="status">{{ state.t('loading') }}</p>
      }
      @if (error()) {
        <p class="form-alert" role="alert">{{ error() }}</p>
        @if (callHref()) {
          <p><a class="btn btn-secondary" [attr.href]="callHref()">{{ state.t('callUs') }}</a></p>
        }
      }

      @if (data(); as r) {
        <section class="req-card form-card" aria-live="polite">
          @if (r.title) {
            <h2 class="h-sm">{{ r.title }}</h2>
          }
          <p class="req-meta">
            <span>{{ state.t('reference') }}: <strong dir="ltr">{{ r.reference }}</strong></span>
            @if (r.updated_at) {
              <span>{{ state.t('reqLastUpdate') }}: <time [attr.datetime]="r.updated_at">{{ when(r.updated_at) }}</time></span>
            }
          </p>
          @if (r.account_linked) {
            <p><span class="req-linked">{{ state.t('reqLinked') }}</span></p>
          }

          @if (r.stage === 'closed') {
            <p class="req-closed" role="status">
              {{ state.t('reqClosed') }}
              @if (callHref()) {
                <a [attr.href]="callHref()">{{ state.t('callUs') }}</a>
              }
            </p>
          } @else {
            <ol class="req-steps" [attr.aria-label]="state.t('reqSteps')">
              @for (s of r.steps; track s.key) {
                <li [class.done]="s.done" [class.current]="s.key === r.stage && !s.done" [attr.aria-current]="s.key === r.stage ? 'step' : null">
                  <strong>{{ stageLabel(s.key) }}</strong>
                  @if (s.at) {
                    <time [attr.datetime]="s.at">{{ when(s.at) }}</time>
                  }
                </li>
              }
            </ol>
          }
        </section>
      }
    </div>
  `
})
export class RequestTrackingPageComponent {
  protected state = inject(SiteStateService);
  private api = inject(SiteApiService);
  private account = inject(WebsiteAccountService);
  private route = inject(ActivatedRoute);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected data = signal<RequestTracking | null>(null);
  protected error = signal<string | null>(null);
  protected loading = signal(false);
  /** The look-up in flight: a late answer for an earlier link is dropped. */
  private current = '';

  protected callHref = computed(() => {
    const digits = (this.state.site()?.organization?.phone || '').replace(/[^\d+]/g, '');
    return digits ? `tel:${digits}` : null;
  });

  constructor() {
    const locale = this.state.locale();
    this.state.page.set(null);
    this.state.tagPage.set({ pageType: 'request_tracking', measurement: null });
    this.state.alternates.set([]);
    inject(SeoHeadService).apply({
      locale,
      title: `${this.state.t('requestTitle')} | ${str(this.state.site()?.organization?.name) || 'HAYAI'}`,
      robots: 'noindex, nofollow'
    });
    // The component is reused from one request link to the next: follow the URL.
    if (this.isBrowser) {
      combineLatest([this.route.paramMap, this.route.queryParamMap])
        .pipe(takeUntilDestroyed())
        .subscribe(([params, query]) => this.load(params.get('reference') ?? '', query.get('token') ?? ''));
    }
  }

  protected stageLabel(key: string): string {
    const k = `reqStage_${key}` as SiteStringKey;
    const label = this.state.t(k);
    return label && label !== k ? label : key;
  }

  protected when(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleString(this.state.locale() === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }

  private load(reference: string, fromUrl: string): void {
    const token = fromUrl || this.account.requestToken(reference) || '';
    this.data.set(null);
    this.error.set(null);
    if (!reference || !token) {
      this.error.set(this.state.t('reqNotFound'));
      return;
    }
    const ask = (this.current = reference + '|' + token);
    this.loading.set(true);
    this.api.trackRequest(this.state.locale(), reference, token).subscribe({
      next: d => {
        if (ask !== this.current) return;
        this.loading.set(false);
        const r = d as unknown as RequestTracking;
        this.data.set({ ...r, steps: Array.isArray(r?.steps) ? r.steps : [] });
        if (fromUrl) this.account.rememberRequest(reference, fromUrl);
      },
      error: (err: HttpErrorResponse) => {
        if (ask !== this.current) return;
        this.loading.set(false);
        this.error.set(
          err.status === 404 ? this.state.t('reqNotFound') : err.status === 429 ? this.state.t('rateLimited') : this.state.t('genericError')
        );
      }
    });
  }
}
