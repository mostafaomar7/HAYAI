import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RequestTrackingLink } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteAnalyticsService } from '../services/site-analytics.service';
import { StoreBadgesComponent } from './store-badges.component';
import { requestTrackingPath } from '../site-paths';

/**
 * What a visitor sees once a request is sent (brief 2026-11-26, A8): the
 * reference, the link that follows it on the web, and — only once an account
 * exists — a soft word about the app. Nothing here blocks: the app is offered,
 * never required.
 */
@Component({
  selector: 'site-request-confirmation',
  imports: [StoreBadgesComponent],
  styleUrl: './account-flow.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-done" role="status" aria-live="polite">
      <p class="form-done-title">{{ reference() ? state.t('requestSent') : state.t('thankYou') }}</p>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      @if (reference()) {
        <p>{{ state.t('yourReference') }}: <strong dir="ltr">{{ reference() }}</strong></p>
      }
    </div>

    @if (trackPath()) {
      <div class="req-link">
        <a class="btn btn-secondary" [attr.href]="trackPath()">{{ state.t('trackYourRequest') }}</a>
        <button type="button" class="btn btn-outline btn-sm" (click)="copy()">{{ copied() ? state.t('copied') : state.t('copyLink') }}</button>
        @if (canShare) {
          <button type="button" class="btn btn-outline btn-sm" (click)="share()">{{ state.t('shareLink') }}</button>
        }
        <p class="muted">{{ state.t('trackHint') }}</p>
      </div>
    }

    @if (accountReady()) {
      <div class="app-soft" (click)="storeClick($event)">
        <p>
          <strong>{{ state.t('appReady') }}</strong>
          {{ state.t('appSignIn') }}
          @if (hasPassword() === false) {
            {{ state.t('appFirstTime') }}
          }
        </p>
        <site-store-badges />
      </div>
    }
  `
})
export class RequestConfirmationComponent {
  readonly reference = input<string | null>(null);
  readonly message = input<string | null>(null);
  readonly tracking = input<RequestTrackingLink | null>(null);
  readonly accountReady = input(false);
  readonly hasPassword = input<boolean | null>(null);
  readonly formKey = input<string | null>(null);

  protected state = inject(SiteStateService);
  private analytics = inject(SiteAnalyticsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected copied = signal(false);
  protected readonly canShare = this.isBrowser && typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  /** On this site, routed in place; the absolute `tracking.url` is what gets shared. */
  protected trackPath = computed(() => {
    const ref = this.reference();
    const token = this.tracking()?.token;
    return ref && token ? requestTrackingPath(this.state.locale(), ref, token) : null;
  });

  private shareUrl(): string {
    const url = this.tracking()?.url;
    return url || (this.isBrowser ? location.origin + this.trackPath() : '');
  }

  constructor() {
    afterNextRender(() =>
      this.analytics.track('confirmation_viewed', { form_key: this.formKey(), reference: this.reference() })
    );
  }

  protected copy(): void {
    const url = this.shareUrl();
    const done = () => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    };
    navigator.clipboard?.writeText(url).then(done, () => window.prompt('', url));
  }

  protected share(): void {
    navigator.share?.({ title: this.state.t('trackYourRequest'), url: this.shareUrl() }).catch(() => {});
  }

  protected storeClick(event: Event): void {
    const a = (event.target as HTMLElement | null)?.closest('a');
    if (!a) return;
    const store = /play\.google\./i.test(a.href) ? 'google_play' : /apps\.apple\./i.test(a.href) ? 'app_store' : 'other';
    this.analytics.track('app_handoff_clicked', { store, form_key: this.formKey(), reference: this.reference() });
  }
}
