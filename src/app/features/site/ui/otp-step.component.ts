import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Dict } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteStringKey } from '../i18n/site-strings';
import { SiteApiService } from '../services/site-api.service';
import { SiteAnalyticsService } from '../services/site-analytics.service';
import { PolicyVersions, WebsiteAccountService } from '../services/website-account.service';

type Problem = '' | 'daily' | 'blocked' | 'partner';

/** Arabic-Indic and Persian digits typed on an Arabic keyboard → 0-9. */
export function latinDigits(v: string): string {
  return v.replace(/[٠-٩۰-۹]/g, d => String((d.charCodeAt(0) & 0xf) % 10));
}

function errorCode(err: HttpErrorResponse): string {
  const body = err.error as Dict | null;
  return String(body?.['error_code'] ?? body?.['data']?.['error_code'] ?? '');
}

function fieldError(err: HttpErrorResponse, key: string): string | null {
  const v = (err.error as Dict | null)?.['errors']?.[key];
  return Array.isArray(v) ? String(v[0]) : v ? String(v) : null;
}

/**
 * The one SMS code that turns a website request into a HAYAI patient
 * (backend brief 2026-11-26, A3–A5).
 *
 * It sends the code itself on arrival, so every way of reaching it behaves
 * the same: a bad number goes back to the form as `phoneError`, a switched
 * off SMS service becomes `unavailable` (the caller sends a plain lead: a
 * request is never lost to a code), and a good code is `verified` with the
 * session already stored.
 */
@Component({
  selector: 'site-otp-step',
  styleUrl: './account-flow.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="otp-step" [attr.aria-labelledby]="idPrefix() + '-otp-t'">
      <h3 class="otp-title" [attr.id]="idPrefix() + '-otp-t'">{{ title() || state.t('otpTitle') }}</h3>
      @if (intro()) {
        <p class="otp-intro">{{ intro() }}</p>
      }

      <p class="otp-sent" aria-live="polite">
        @if (masked()) {
          {{ sentParts()[0] }}<bdi dir="ltr" class="otp-phone">{{ masked() }}</bdi>{{ sentParts()[1] }}
          @if (expires()) { <span class="muted">{{ state.t('otpExpires', expires()!) }}</span> }
        } @else if (sending()) {
          {{ state.t('otpSendingCode') }}
        }
        @if (canChangeNumber()) {
          <button type="button" class="link-btn" (click)="changeNumber.emit()">{{ state.t('otpChangeNumber') }}</button>
        }
      </p>

      <form class="otp-form" novalidate (submit)="verify($event)">
        <div class="field" [class.has-error]="codeError()">
          <label [attr.for]="idPrefix() + '-otp-code'">{{ state.t('otpCodeLabel') }}</label>
          <input
            #codeEl
            class="otp-code"
            [attr.id]="idPrefix() + '-otp-code'"
            name="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]*"
            maxlength="4"
            dir="ltr"
            required
            [value]="code()"
            (input)="onCode($event)"
            [attr.aria-invalid]="codeError() ? 'true' : null"
            [attr.aria-describedby]="codeError() ? idPrefix() + '-otp-err' : null"
          />
          @if (codeError()) {
            <p class="error" [attr.id]="idPrefix() + '-otp-err'">{{ codeError() }}</p>
          }
        </div>

        <div class="field" [class.has-error]="consentError()">
          <label class="choice consent">
            <input type="checkbox" name="terms" [checked]="consent()" (change)="setConsent($event)" required />
            <span>
              {{ state.t('otpConsentA') }}
              <a [attr.href]="policies()?.termsUrl || null" target="_blank" rel="noopener">{{ state.t('otpTerms') }}</a>
              {{ state.t('otpAnd') }}<a [attr.href]="policies()?.privacyUrl || state.privacyUrl() || null" target="_blank" rel="noopener">{{ state.t('privacyPolicy') }}</a>.
              {{ state.t('otpConsentB') }}
            </span>
          </label>
          @if (consentError()) {
            <p class="error">{{ consentError() }}</p>
          }
        </div>

        @if (message()) {
          <p class="form-alert" role="alert">
            {{ message() }}
            @if (problem() === 'daily' || problem() === 'blocked') {
              @if (callHref()) {
                <a class="otp-call" [attr.href]="callHref()">{{ state.t(problem() === 'daily' ? 'otpCallInstead' : 'callUs') }}</a>
              }
            }
            @if (problem() === 'partner' && canChangeNumber()) {
              <button type="button" class="link-btn" (click)="changeNumber.emit()">{{ state.t('otpChangeNumber') }}</button>
            }
          </p>
        }

        <button type="submit" class="btn btn-primary otp-submit" [disabled]="busy() || sending()">
          {{ busy() ? state.t('otpVerifying') : state.t(submitKey()) }}
        </button>
      </form>

      <p class="otp-resend">
        @if (wait() > 0) {
          <span aria-live="off">{{ state.t('otpResendIn', wait()) }}</span>
        } @else if (problem() !== 'daily' && problem() !== 'blocked') {
          <button type="button" class="link-btn" [disabled]="sending()" (click)="send()">{{ state.t('otpResend') }}</button>
        }
      </p>
    </section>
  `
})
export class OtpStepComponent {
  readonly phone = input.required<string>();
  readonly otpEndpoint = input.required<string>();
  readonly verifyEndpoint = input.required<string>();
  /** The form's own name field, when it has one. */
  readonly name = input<string | null>(null);
  /** `after_submit`: the request this verification links. */
  readonly request = input<{ reference: string; token: string } | null>(null);
  readonly formKey = input<string | null>(null);
  readonly idPrefix = input('f');
  readonly title = input<string | null>(null);
  readonly intro = input<string | null>(null);
  readonly submitKey = input<SiteStringKey>('otpVerifySend');
  readonly canChangeNumber = input(true);

  readonly verified = output<Dict>();
  readonly phoneError = output<string>();
  readonly unavailable = output<void>();
  readonly changeNumber = output<void>();

  protected state = inject(SiteStateService);
  private api = inject(SiteApiService);
  private analytics = inject(SiteAnalyticsService);
  private account = inject(WebsiteAccountService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private codeEl = viewChild<ElementRef<HTMLInputElement>>('codeEl');

  protected masked = signal<string | null>(null);
  protected expires = signal<number | null>(null);
  protected wait = signal(0);
  protected code = signal('');
  protected consent = signal(false);
  protected sending = signal(false);
  protected busy = signal(false);
  protected codeError = signal<string | null>(null);
  protected consentError = signal<string | null>(null);
  protected message = signal<string | null>(null);
  protected problem = signal<Problem>('');
  protected policies = signal<PolicyVersions | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  protected sentParts = computed(() => this.state.t('otpSentTo', '\u0000').split('\u0000'));
  protected callHref = computed(() => {
    const raw = this.state.site()?.organization?.phone || '';
    const digits = raw.replace(/[^\d+]/g, '');
    return digits ? `tel:${digits}` : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
    afterNextRender(() => {
      this.account.policyVersions().subscribe(p => this.policies.set(p));
      this.send();
    });
  }

  private base(): Dict {
    return { session_id: this.analytics.sessionId(), path: location.pathname };
  }

  protected send(): void {
    if (!this.isBrowser || this.sending()) return;
    this.sending.set(true);
    this.message.set(null);
    this.problem.set('');
    this.api.sendCode(this.otpEndpoint(), { phone: latinDigits(this.phone()), ...this.base() }).subscribe({
      next: d => {
        this.sending.set(false);
        this.masked.set((d['phone_masked'] as string) || this.phone());
        this.expires.set(Number(d['expires_in_minutes']) || null);
        this.countdown(Number(d['resend_available_in']) || 60);
        this.codeError.set(null);
        setTimeout(() => this.codeEl()?.nativeElement.focus());
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        const code = errorCode(err);
        if (err.status === 422) {
          this.phoneError.emit(fieldError(err, 'phone') || this.state.t('invalidPhone'));
        } else if (err.status === 503) {
          this.unavailable.emit();
        } else if (err.status === 429 && code === 'OTP_RESEND_COOLDOWN') {
          // A code went out a moment ago: it still works, only resending waits.
          const body = (err.error ?? {}) as Dict;
          this.masked.update(m => m || this.phone());
          this.countdown(Number(body['resend_available_in'] ?? body['data']?.['resend_available_in']) || 60);
        } else if (err.status === 429 && code === 'OTP_DAILY_LIMIT') {
          this.masked.update(m => m || this.phone());
          this.problem.set('daily');
          this.message.set(this.state.t('otpDailyLimit'));
        } else if (err.status === 429) {
          this.masked.update(m => m || this.phone());
          this.message.set(this.state.t('otpWait'));
          this.countdown(Number(err.headers?.get('Retry-After')) || 30);
        } else {
          this.masked.update(m => m || this.phone());
          this.message.set((err.error as Dict | null)?.['message'] || this.state.t('genericError'));
        }
      }
    });
  }

  protected onCode(event: Event): void {
    const el = event.target as HTMLInputElement;
    const clean = latinDigits(el.value).replace(/\D/g, '').slice(0, 4);
    if (el.value !== clean) el.value = clean;
    this.code.set(clean);
    this.codeError.set(null);
  }

  protected setConsent(event: Event): void {
    this.consent.set((event.target as HTMLInputElement).checked);
    if (this.consent()) this.consentError.set(null);
  }

  protected verify(event: Event): void {
    event.preventDefault();
    if (this.busy()) return;
    let bad = false;
    if (!/^\d{4}$/.test(this.code())) {
      this.codeError.set(this.state.t('otpCodeDigits'));
      bad = true;
    }
    if (!this.consent()) {
      this.consentError.set(this.state.t('otpConsentRequired'));
      bad = true;
    }
    if (bad) {
      if (this.codeError()) this.codeEl()?.nativeElement.focus();
      return;
    }
    const p = this.policies();
    const body: Dict = {
      phone: latinDigits(this.phone()),
      code: this.code(),
      terms_accepted: true,
      ...(p ? { terms_version: p.terms, privacy_policy_version: p.privacy } : {}),
      ...this.base()
    };
    if (this.name()) body['name'] = this.name();
    if (this.request()) body['request'] = this.request();

    this.busy.set(true);
    this.message.set(null);
    this.problem.set('');
    this.api.verifyCode(this.verifyEndpoint(), body).subscribe({
      next: d => {
        this.busy.set(false);
        this.account.remember(d);
        this.stopTimer();
        this.verified.emit(d);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        const code = errorCode(err);
        const errors = ((err.error as Dict | null)?.['errors'] ?? {}) as Dict;
        if (err.status === 422 && (errors['terms_version'] || errors['privacy_policy_version'])) {
          // The texts changed while the page was open: fetch them and ask again.
          this.consent.set(false);
          this.consentError.set(this.state.t('otpTermsChanged'));
          this.account.policyVersions(true).subscribe(v => this.policies.set(v));
        } else if (err.status === 422 && errors['terms_accepted']) {
          this.consent.set(false);
          this.consentError.set(this.state.t('otpConsentRequired'));
        } else if (err.status === 422 && errors['phone']) {
          this.phoneError.emit(fieldError(err, 'phone')!);
        } else if (err.status === 422) {
          this.codeError.set(code === 'OTP_INVALID' ? this.state.t('otpInvalid') : fieldError(err, 'code') || this.state.t('otpInvalid'));
          this.code.set('');
          this.codeEl()?.nativeElement.focus();
        } else if (err.status === 429) {
          this.message.set(this.state.t(code === 'OTP_LOCKED' ? 'otpLocked' : 'otpWait'));
          this.code.set('');
        } else if (err.status === 409) {
          this.problem.set('partner');
          this.message.set(this.state.t('otpPartner'));
        } else if (err.status === 403) {
          this.problem.set('blocked');
          this.message.set(this.state.t('otpBlocked'));
        } else if (err.status === 503) {
          this.unavailable.emit();
        } else {
          this.message.set((err.error as Dict | null)?.['message'] || this.state.t('genericError'));
        }
      }
    });
  }

  private countdown(seconds: number): void {
    this.stopTimer();
    this.wait.set(Math.max(0, Math.round(seconds)));
    if (!this.wait()) return;
    this.timer = setInterval(() => {
      this.wait.update(n => n - 1);
      if (this.wait() <= 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
