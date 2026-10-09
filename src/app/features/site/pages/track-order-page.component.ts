import { ChangeDetectionStrategy, Component, PLATFORM_ID, ViewEncapsulation, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Dict } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteStringKey } from '../i18n/site-strings';
import { SiteApiService } from '../services/site-api.service';
import { SeoHeadService } from '../services/seo-head.service';
import { arr, money, str } from '../site-utils';
import { trackOrderPath } from '../site-paths';

/**
 * Guest purchase tracking: `/{locale}/requests/track?ref=…&token=…` — the link
 * shown once after a purchase request. Always noindex (and `/requests/` is
 * disallowed in robots.txt). The look-up runs in the browser only, so the
 * order's contact details never land in server HTML or the hydration state;
 * server.ts also serves this path with `Cache-Control: no-store` because the
 * token is a private credential carried in the URL.
 */
@Component({
  selector: 'site-track-order',
  host: { 'data-page-type': 'order_tracking' },
  styleUrl: './site-view.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap blk">
      <h1>{{ state.t('trackTitle') }}</h1>
      <p class="lead">{{ state.t('trackIntro') }}</p>

      <form class="filters" method="get" [attr.action]="action" (submit)="lookup($event)">
        <label>
          {{ state.t('reference') }}
          <input name="ref" required dir="ltr" autocomplete="off" [attr.value]="ref()" />
        </label>
        <label>
          {{ state.t('trackingToken') }}
          <input name="token" required dir="ltr" autocomplete="off" [attr.value]="token()" />
        </label>
        <button type="submit" class="btn btn-primary btn-sm">{{ state.t('trackButton') }}</button>
      </form>

      @if (error()) {
        <p class="form-alert" role="alert">{{ error() }}</p>
      }

      @if (order(); as o) {
        <section class="form-card" aria-live="polite">
          <p>{{ state.t('reference') }}: <strong dir="ltr">{{ o['reference'] }}</strong></p>
          <p>{{ state.t('status') }}: <span class="status-pill">{{ statusLabel(o['status']) }}</span></p>
          @if (str(o['decision_reason'])) {
            <p class="muted">{{ o['decision_reason'] }}</p>
          }
          <div class="table-scroll">
            <table class="data-tbl">
              <caption>{{ state.t('items') }}</caption>
              <thead>
                <tr>
                  <th scope="col">{{ state.t('plan') }}</th>
                  <th scope="col">{{ state.t('quantity') }}</th>
                  <th scope="col">{{ state.t('unitPrice') }}</th>
                  <th scope="col">{{ state.t('lineTotal') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (it of arr(o['items']); track $index) {
                  <tr>
                    <th scope="row">{{ it['product_name'] }}{{ it['tier_name'] ? ' — ' + it['tier_name'] : '' }}</th>
                    <td>{{ it['quantity'] }}</td>
                    <td dir="ltr">{{ it['unit_price'] ? money(it['unit_price'], it['currency'], state.locale()) : state.t('toBeQuotedShort') }}</td>
                    <td dir="ltr">{{ it['line_total'] ? money(it['line_total'], it['currency'], state.locale()) : state.t('toBeQuotedShort') }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (o['has_unpriced_items']) {
            <p class="note">{{ state.t('toBeQuoted') }}</p>
          } @else if (o['estimated_total']) {
            <p>{{ state.t('estimatedTotal') }}: <strong dir="ltr">{{ money(o['estimated_total'], o['currency'], state.locale()) }}</strong></p>
          }
          @if (arr(o['history']).length) {
            <h2 class="h-sm">{{ state.t('history') }}</h2>
            <ol>
              @for (h of arr(o['history']); track $index) {
                <li>{{ statusLabel(h['to_status']) }} — <time [attr.datetime]="h['created_at']">{{ str(h['created_at']).slice(0, 10) }}</time>
                  @if (str(h['reason'])) { <span class="muted"> ({{ h['reason'] }})</span> }
                </li>
              }
            </ol>
          }

          @if (o['can_cancel']) {
            <form class="site-form" (submit)="cancel($event)">
              <div class="field field-wide">
                <label for="cancel-reason">{{ state.t('cancelReason') }}</label>
                <textarea id="cancel-reason" name="reason" rows="3" required maxlength="1000"></textarea>
              </div>
              <div class="form-actions-row">
                <button type="submit" class="btn btn-outline" [disabled]="busy()">{{ state.t('confirmCancel') }}</button>
              </div>
            </form>
          }
          @if (canceled()) {
            <p class="form-done" role="status">{{ state.t('canceled') }}</p>
          }
        </section>
      }
    </div>
  `
})
export class TrackOrderPageComponent {
  protected state = inject(SiteStateService);
  private api = inject(SiteApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected str = str;
  protected arr = arr;
  protected money = money;

  /** The public tracking payload has the status value only, no label. */
  protected statusLabel(status: string | null | undefined): string {
    const key = `st_${status}` as SiteStringKey;
    const label = status ? this.state.t(key) : '';
    return label && label !== key ? label : str(status);
  }

  protected ref = signal(this.route.snapshot.queryParamMap.get('ref') ?? '');
  protected token = signal(this.route.snapshot.queryParamMap.get('token') ?? '');
  protected order = signal<Dict | null>(null);
  protected error = signal<string | null>(null);
  protected busy = signal(false);
  protected canceled = signal(false);
  protected action = trackOrderPath(this.state.locale());

  constructor() {
    const locale = this.state.locale();
    this.state.page.set(null);
    // No API classification here: the server and the tag layer both fall back
    // to sensitive, which is right for a page showing a private order.
    this.state.tagPage.set({ pageType: 'order_tracking', measurement: null });
    this.state.alternates.set([]);
    inject(SeoHeadService).apply({
      locale,
      title: `${this.state.t('trackTitle')} | ${str(this.state.site()?.organization?.name) || 'HAYAI'}`,
      robots: 'noindex, nofollow'
    });
    if (this.isBrowser && this.ref() && this.token()) this.load();
  }

  protected lookup(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    this.ref.set(String(data.get('ref') ?? '').trim());
    this.token.set(String(data.get('token') ?? '').trim());
    // Keep the URL shareable/bookmarkable without reloading the page.
    this.router.navigate([], { queryParams: { ref: this.ref(), token: this.token() }, replaceUrl: true });
    this.load();
  }

  protected cancel(event: Event): void {
    event.preventDefault();
    const reason = String(new FormData(event.target as HTMLFormElement).get('reason') ?? '').trim();
    if (!reason) return;
    this.busy.set(true);
    this.api.cancelPurchase(this.ref(), this.token(), reason).subscribe({
      next: res => {
        this.busy.set(false);
        this.canceled.set(true);
        const d = (res as Dict)?.['data'];
        if (d) this.order.set(d);
        else this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(err.error?.message || this.state.t('genericError'));
      }
    });
  }

  private load(): void {
    if (!this.ref() || !this.token()) return;
    this.error.set(null);
    this.api.trackPurchase(this.ref(), this.token()).subscribe({
      next: res => this.order.set((res as Dict)?.['data'] ?? null),
      error: (err: HttpErrorResponse) => {
        this.order.set(null);
        this.error.set(err.status === 404 ? this.state.t('notFoundOrder') : err.status === 429 ? this.state.t('rateLimited') : this.state.t('genericError'));
      }
    });
  }
}
