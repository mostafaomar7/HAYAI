import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AccountMode, Dict, FormDefinition, FormField, RequestTrackingLink } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteApiService } from '../services/site-api.service';
import { SiteAnalyticsService } from '../services/site-analytics.service';
import { TagLayerService } from '../services/tag-layer.service';
import { WebsiteAccountService } from '../services/website-account.service';
import { OtpStepComponent, latinDigits } from './otp-step.component';
import { RequestConfirmationComponent } from './request-confirmation.component';
import { str, uuid } from '../site-utils';

type Values = Record<string, string | string[] | boolean>;

/** GA4 events the brief names per form type (also in `site.analytics.events`). */
const FORM_EVENTS: Record<string, string> = {
  icu_bed_request: 'icu_request_submitted',
  treatment_plan: 'treatment_plan_requested'
};

/**
 * A CMS form (contract §8 / §18.3), rendered from its definition.
 *
 * The form is a plain native `<form>`: the server sends real labelled inputs,
 * and on submit the values are read straight from the DOM (FormData). That way
 * nothing typed before hydration finished is lost, and there is no forms
 * library in the public bundle.
 */
@Component({
  selector: 'site-form',
  imports: [OtpStepComponent, RequestConfirmationComponent],
  styleUrl: './account-flow.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (form(); as f) {
      @if (done()) {
        <site-request-confirmation
          [reference]="reference()"
          [message]="doneMessage()"
          [tracking]="tracking()"
          [accountReady]="accountReady()"
          [hasPassword]="hasPassword()"
          [formKey]="f.key"
        />
        <!-- after_submit: the request is in; the code only adds tracking and
             the account, so it comes after and never blocks. -->
        @if (verifyAfter(); as va) {
          <div class="after-verify">
            <site-otp-step
              [phone]="va.phone"
              [otpEndpoint]="otpEndpoint()"
              [verifyEndpoint]="verifyEndpoint()"
              [name]="va.name"
              [request]="va.request"
              [formKey]="f.key"
              [idPrefix]="idPrefix() + '-' + f.key"
              [title]="state.t('verifyAfterTitle')"
              [intro]="state.t('verifyAfterText')"
              submitKey="otpVerify"
              [canChangeNumber]="false"
              (verified)="afterVerified($event)"
              (phoneError)="verifyAfter.set(null)"
              (unavailable)="verifyAfter.set(null)"
            />
          </div>
        }
      } @else {
        <!-- Hidden, not removed, during the code step: what was typed stays
             exactly where it was for "Change number" and for the send. -->
        <form
          #formEl
          class="site-form"
          [attr.id]="anchorId() || null"
          [style.display]="stage() === 'otp' ? 'none' : null"
          novalidate
          (submit)="submit($event)"
          (input)="edited()"
          (change)="edited()"
          (focusin)="started()"
        >
          @if (showTitle() && f.name) {
            <h3 class="form-title">{{ f.name }}</h3>
          }
          <!-- The ICU form's description is the "call 123 first" warning: it
               goes above the submit button, in Coral, instead. -->
          @if (f.description && !urgent()) {
            <p class="muted">{{ f.description }}</p>
          }

          @for (field of f.fields; track field.key) {
            @if (visible(field)) {
              <div class="field" [class.has-error]="errors()[field.key]" [class.field-wide]="isWide(field)">
                @if (isContinuing(field)) {
                  <span class="label-like">{{ field.label }}</span>
                  <p class="continuing">
                    {{ continuingParts()[0] }}<bdi dir="ltr">{{ account.session()?.phone_masked }}</bdi>{{ continuingParts()[1] }} ·
                    <button type="button" class="link-btn" (click)="notYou()">{{ state.t('notYou') }}</button>
                  </p>
                } @else {
                @switch (field.type) {
                  @case ('textarea') {
                    <label [attr.for]="fid(field)">{{ field.label }}@if (field.required) {<span class="req" aria-hidden="true"> *</span>}</label>
                    <textarea
                      [attr.id]="fid(field)"
                      [attr.name]="field.key"
                      rows="4"
                      [attr.required]="field.required ? '' : null"
                      [attr.maxlength]="v(field, 'max_length')"
                      [attr.minlength]="v(field, 'min_length')"
                      [attr.placeholder]="field.placeholder || null"
                      [attr.aria-invalid]="errors()[field.key] ? 'true' : null"
                      [attr.aria-describedby]="describedBy(field)"
                    ></textarea>
                  }
                  @case ('select') {
                    <label [attr.for]="fid(field)">{{ field.label }}@if (field.required) {<span class="req" aria-hidden="true"> *</span>}</label>
                    <select
                      [attr.id]="fid(field)"
                      [attr.name]="field.key"
                      [attr.required]="field.required ? '' : null"
                      [attr.aria-invalid]="errors()[field.key] ? 'true' : null"
                      [attr.aria-describedby]="describedBy(field)"
                    >
                      <option value="">{{ field.placeholder || state.t('selectPlaceholder') }}</option>
                      @for (o of field.options; track o.value) {
                        <option [attr.value]="o.value">{{ o.label }}</option>
                      }
                    </select>
                  }
                  @case ('radio') {
                    <fieldset [attr.aria-describedby]="describedBy(field)">
                      <legend>{{ field.label }}@if (field.required) {<span class="req" aria-hidden="true"> *</span>}</legend>
                      @for (o of field.options; track o.value) {
                        <label class="choice">
                          <input type="radio" [attr.name]="field.key" [attr.value]="o.value" />
                          <span>{{ o.label }}</span>
                        </label>
                      }
                    </fieldset>
                  }
                  @case ('multi_select') {
                    <fieldset [attr.aria-describedby]="describedBy(field)">
                      <legend>{{ field.label }}@if (field.required) {<span class="req" aria-hidden="true"> *</span>}</legend>
                      @for (o of field.options; track o.value) {
                        <label class="choice">
                          <input type="checkbox" [attr.name]="field.key" [attr.value]="o.value" />
                          <span>{{ o.label }}</span>
                        </label>
                      }
                    </fieldset>
                  }
                  @case ('checkbox') {
                    @if (field.options.length) {
                      <fieldset [attr.aria-describedby]="describedBy(field)">
                        <legend>{{ field.label }}@if (field.required) {<span class="req" aria-hidden="true"> *</span>}</legend>
                        @for (o of field.options; track o.value) {
                          <label class="choice">
                            <input type="checkbox" [attr.name]="field.key" [attr.value]="o.value" />
                            <span>{{ o.label }}</span>
                          </label>
                        }
                      </fieldset>
                    } @else {
                      <label class="choice">
                        <input
                          type="checkbox"
                          [attr.id]="fid(field)"
                          [attr.name]="field.key"
                          value="1"
                          [attr.required]="field.required ? '' : null"
                          [attr.aria-describedby]="describedBy(field)"
                        />
                        <span>{{ field.label }}@if (field.required) {<span class="req" aria-hidden="true"> *</span>}</span>
                      </label>
                    }
                  }
                  @case ('file') {
                    <label [attr.for]="fid(field)">{{ field.label }}@if (field.required) {<span class="req" aria-hidden="true"> *</span>}</label>
                    <input
                      type="file"
                      [attr.id]="fid(field)"
                      [attr.name]="field.key"
                      [attr.accept]="accept(field)"
                      [attr.multiple]="maxFiles(field) > 1 ? '' : null"
                      [attr.required]="field.required ? '' : null"
                      [attr.aria-invalid]="errors()[field.key] ? 'true' : null"
                      [attr.aria-describedby]="describedBy(field)"
                    />
                  }
                  @default {
                    <label [attr.for]="fid(field)">{{ field.label }}@if (field.required) {<span class="req" aria-hidden="true"> *</span>}</label>
                    <input
                      [attr.type]="inputType(field)"
                      [attr.id]="fid(field)"
                      [attr.name]="field.key"
                      [attr.autocomplete]="autocomplete(field)"
                      [attr.inputmode]="field.type === 'phone' ? 'tel' : null"
                      [attr.dir]="field.type === 'email' || field.type === 'phone' ? 'ltr' : null"
                      [attr.required]="field.required ? '' : null"
                      [attr.maxlength]="v(field, 'max_length')"
                      [attr.minlength]="v(field, 'min_length')"
                      [attr.min]="v(field, 'min')"
                      [attr.max]="v(field, 'max')"
                      [attr.placeholder]="field.placeholder || null"
                      [attr.aria-invalid]="errors()[field.key] ? 'true' : null"
                      [attr.aria-describedby]="describedBy(field)"
                    />
                  }
                }
                }
                @if (field.help) {
                  <p class="help" [attr.id]="fid(field) + '-help'">{{ field.help }}</p>
                }
                @if (errors()[field.key]) {
                  <p class="error" [attr.id]="fid(field) + '-err'">{{ errors()[field.key] }}</p>
                }
              </div>
            }
          }

          <!-- Honeypot: invisible to people, irresistible to bots. A filled
               value makes the API file the lead as spam silently. -->
          @if (f.honeypot_field) {
            <div class="hp" aria-hidden="true">
              <label [attr.for]="idPrefix() + '-' + f.key + '-hp'">Leave this field empty</label>
              <input
                type="text"
                [attr.id]="idPrefix() + '-' + f.key + '-hp'"
                [attr.name]="f.honeypot_field"
                tabindex="-1"
                autocomplete="off"
              />
            </div>
          }

          @if (f.requires_consent) {
            <div class="field field-wide" [class.has-error]="errors()['consent']">
              <label class="choice consent">
                <input type="checkbox" name="__consent" value="1" required [attr.aria-describedby]="errors()['consent'] ? idPrefix() + '-' + f.key + '-consent-err' : null" />
                <span>
                  {{ f.consent_text || state.t('purchaseConsent') }}
                  @if (privacy()) {
                    <a [attr.href]="privacy()" target="_blank" rel="noopener">{{ state.t('privacyPolicy') }}</a>
                  }
                </span>
              </label>
              @if (errors()['consent']) {
                <p class="error" [attr.id]="idPrefix() + '-' + f.key + '-consent-err'">{{ errors()['consent'] }}</p>
              }
            </div>
          }

          @if (generalError()) {
            <p class="form-alert" role="alert">{{ generalError() }}</p>
          }

          @if (f.description && urgent()) {
            <p class="form-urgent" role="note">{{ f.description }}</p>
          }

          <div class="form-actions-row">
            <button type="submit" class="btn btn-primary" [disabled]="sending()">
              {{ sending() ? state.t('sending') : codeFirst() ? state.t('otpSendCode') : f.submit_label || state.t('submit') }}
            </button>
          </div>
        </form>

        @if (stage() === 'otp') {
          <site-otp-step
            [phone]="otpPhone()"
            [otpEndpoint]="otpEndpoint()"
            [verifyEndpoint]="verifyEndpoint()"
            [name]="otpName()"
            [formKey]="f.key"
            [idPrefix]="idPrefix() + '-' + f.key"
            (verified)="beforeVerified()"
            (phoneError)="backToForm($event)"
            (unavailable)="otpOff()"
            (changeNumber)="backToForm(null)"
          />
          @if (sending()) {
            <p class="muted" role="status">{{ state.t('sending') }}</p>
          }
          @if (generalError()) {
            <p class="form-alert" role="alert">{{ generalError() }}</p>
          }
        }
      }
    }
  `
})
export class SiteFormComponent {
  readonly form = input<FormDefinition | null>(null);
  readonly ctaTrackingKey = input<string | null>(null);
  readonly idPrefix = input('f');
  /** Set on inline forms so `#form-{key}` CTA links land here. */
  readonly anchorId = input<string | null>(null);
  readonly showTitle = input(false);
  readonly submitted = output<Dict>();

  protected state = inject(SiteStateService);
  private api = inject(SiteApiService);
  private analytics = inject(SiteAnalyticsService);
  private tags = inject(TagLayerService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private formEl = viewChild<ElementRef<HTMLFormElement>>('formEl');

  protected values = signal<Values>({});
  protected errors = signal<Record<string, string>>({});
  protected sending = signal(false);
  protected done = signal(false);
  protected reference = signal<string | null>(null);
  protected doneMessage = signal('');
  protected generalError = signal<string | null>(null);
  private startedOnce = false;

  // ---- website-to-patient (brief 2026-11-26)
  protected account = inject(WebsiteAccountService);
  /** Set when the SMS service answered 503: this visit sends plain leads. */
  private otpDown = signal(false);
  protected stage = signal<'form' | 'otp'>('form');
  protected otpPhone = signal('');
  protected otpName = signal<string | null>(null);
  protected tracking = signal<RequestTrackingLink | null>(null);
  protected accountReady = signal(false);
  protected hasPassword = signal<boolean | null>(null);
  protected verifyAfter = signal<{ phone: string; name: string | null; request: { reference: string; token: string } } | null>(null);
  /** The body waiting for the code (before_submit). */
  private pending: Dict | FormData | null = null;
  /** One per submit attempt, reused on retries of it, kept in the draft. */
  private attemptKey: string | null = null;
  /** The exact body of that attempt: a retry under the same key must not differ. */
  private attemptBody: Dict | FormData | null = null;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;

  protected mode = computed<AccountMode>(() => (this.otpDown() ? 'none' : this.form()?.account?.mode ?? 'none'));
  /** The mobile the code goes to: the form's first phone field. */
  protected phoneField = computed(() => this.form()?.fields.find(x => x.type === 'phone') ?? null);
  protected continuing = computed(() => this.mode() !== 'none' && !!this.phoneField() && !!this.account.session());
  protected codeFirst = computed(() => this.mode() === 'before_submit' && !!this.phoneField() && !this.continuing());
  protected continuingParts = computed(() => this.state.t('continuingAs', '\u0000').split('\u0000'));
  protected otpEndpoint = computed(() => this.form()?.account?.otp_endpoint || `/api/v1/public/${this.state.locale()}/account/otp`);
  protected verifyEndpoint = computed(() => this.form()?.account?.verify_endpoint || `/api/v1/public/${this.state.locale()}/account/verify`);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.draftTimer && clearTimeout(this.draftTimer));
    afterNextRender(() => {
      const f = this.form();
      if (!f) return;
      if (this.mode() !== 'none') this.account.check(this.state.locale()).subscribe();
      this.restoreDraft(f);
    });
  }

  protected privacy = computed(() => this.form()?.privacy_url || this.state.privacyUrl());

  protected isContinuing(field: FormField): boolean {
    return this.continuing() && field.key === this.phoneField()?.key;
  }

  protected notYou(): void {
    this.account.forget(this.state.locale());
    this.errors.update(e => {
      const { [this.phoneField()?.key ?? '']: _drop, ...rest } = e;
      return rest;
    });
    setTimeout(() => this.formEl()?.nativeElement.querySelector<HTMLElement>(`[name="${CSS.escape(this.phoneField()?.key ?? '')}"]`)?.focus());
  }

  // ---- draft: survives refresh, the code step and a lost connection

  /** Typed by the visitor: a different request from any earlier attempt. */
  protected edited(): void {
    this.attemptKey = null;
    this.attemptBody = null;
    this.sync();
    this.queueDraft();
  }

  private queueDraft(): void {
    const key = this.form()?.key;
    if (!key) return;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.account.saveDraft(key, this.values(), this.attemptKey), 400);
  }

  private restoreDraft(f: FormDefinition): void {
    const draft = this.account.draft(f.key);
    const el = this.formEl()?.nativeElement;
    if (!draft || !el) return;
    for (const field of f.fields) {
      if (field.type === 'file') continue;
      const v = draft.values[field.key];
      if (v === undefined || v === '' || v === false) continue;
      const inputs = Array.from(el.querySelectorAll<HTMLInputElement>(`[name="${CSS.escape(field.key)}"]`));
      for (const input of inputs) {
        if (input.type === 'checkbox' || input.type === 'radio') {
          input.checked = Array.isArray(v) ? v.includes(input.value) : v === true || String(v) === input.value;
        } else if (!input.value) {
          input.value = Array.isArray(v) ? String(v[0] ?? '') : String(v);
        }
      }
    }
    this.attemptKey = draft.attempt ?? null;
    this.sync();
  }
  /** The ICU bed request: its description is an emergency warning. */
  protected urgent = computed(() => this.form()?.type === 'icu_bed_request');

  protected fid(field: FormField): string {
    return `${this.idPrefix()}-${this.form()?.key}-${field.key}`;
  }

  protected describedBy(field: FormField): string | null {
    const ids = [];
    if (field.help) ids.push(this.fid(field) + '-help');
    if (this.errors()[field.key]) ids.push(this.fid(field) + '-err');
    return ids.length ? ids.join(' ') : null;
  }

  /** `validation` is `{}` or any of min / max / min_length / max_length. */
  protected v(field: FormField, key: string): string | null {
    const val = field.validation?.[key];
    return val === null || val === undefined ? null : String(val);
  }

  /** File fields carry `max_files`, `max_kb` and `accept` (extensions) on the field itself. */
  protected maxFiles(field: FormField): number {
    return field.max_files || 1;
  }

  protected accept(field: FormField): string | null {
    return field.accept?.length ? field.accept.map(ext => `.${ext.replace(/^./, '')}`).join(',') : null;
  }

  protected inputType(field: FormField): string {
    return { email: 'email', phone: 'tel', number: 'number' }[field.type] ?? 'text';
  }

  protected autocomplete(field: FormField): string | null {
    const map: Record<string, string> = {
      name: 'name',
      email: 'email',
      phone: 'tel',
      organization: 'organization',
      hospital: 'organization',
      job_title: 'organization-title',
      city: 'address-level2',
      country: 'country-name'
    };
    return map[field.key] ?? (field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : null);
  }

  protected isWide(field: FormField): boolean {
    return ['textarea', 'radio', 'multi_select', 'checkbox', 'file'].includes(field.type);
  }

  /** Conditional visibility (contract §8). Hidden fields are neither required
   *  nor sent — the API would ignore them anyway. */
  protected visible(field: FormField): boolean {
    const rule = field.visibility;
    if (!rule?.field) return true;
    const raw = this.values()[rule.field];
    const list = Array.isArray(raw) ? raw.map(String) : raw === undefined || raw === false || raw === '' ? [] : [String(raw)];
    const target = Array.isArray(rule.value) ? rule.value.map(String) : rule.value === undefined || rule.value === null ? [] : [String(rule.value)];
    switch (rule.operator) {
      case 'equals':
        return target.length > 0 && list.includes(target[0]);
      case 'not_equals':
        return !(target.length > 0 && list.includes(target[0]));
      case 'in':
        return list.some(x => target.includes(x));
      case 'not_in':
        return !list.some(x => target.includes(x));
      case 'filled':
        return list.length > 0;
      case 'empty':
        return list.length === 0;
      default:
        return true;
    }
  }

  protected started(): void {
    if (this.startedOnce) return;
    this.startedOnce = true;
    this.analytics.track('form_started', { form_key: this.form()?.key, cta_tracking_key: this.ctaKey() });
    // A request that can become a patient: the top of the website-to-patient funnel.
    if (this.mode() !== 'none') this.analytics.trackOnce('request_started', this.form()?.key ?? '', { form_key: this.form()?.key, cta_tracking_key: this.ctaKey() });
  }

  /** Mirrors the DOM values into a signal, for the visibility rules only. */
  protected sync(): void {
    const el = this.formEl()?.nativeElement;
    const f = this.form();
    if (!el || !f) return;
    const data = new FormData(el);
    const next: Values = {};
    for (const field of f.fields) {
      if (field.type === 'file') continue;
      const all = data.getAll(field.key).map(String);
      next[field.key] = field.type === 'multi_select' || (field.type === 'checkbox' && field.options?.length) ? all : (all[0] ?? '');
    }
    this.values.set(next);
  }

  private ctaKey(): string | null {
    return this.ctaTrackingKey() ?? this.host.nativeElement.closest('[data-cta]')?.getAttribute('data-cta') ?? null;
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const el = this.formEl()?.nativeElement;
    const f = this.form();
    if (!el || !f || this.sending()) return;
    this.sync();
    const data = new FormData(el);
    const errors: Record<string, string> = {};
    const fields: Record<string, unknown> = {};
    const files: Record<string, File[]> = {};
    const t = (k: Parameters<SiteStateService['t']>[0], n?: string | number) => this.state.t(k, n);

    for (const field of f.fields) {
      if (!this.visible(field)) continue;
      // Verified: the API fills the request's mobile from the account.
      if (this.isContinuing(field)) continue;
      if (field.type === 'file') {
        const input = el.querySelector<HTMLInputElement>(`[name="${CSS.escape(field.key)}"]`);
        const list = Array.from(input?.files ?? []);
        if (field.required && !list.length) errors[field.key] = t('fieldRequired');
        const exts = (field.accept ?? []).map(e => e.replace(/^./, '').toLowerCase());
        if (exts.length && list.some(file => !exts.includes((file.name.split('.').pop() || '').toLowerCase())))
          errors[field.key] = t('fileType', exts.join(', '));
        if (field.max_kb && list.some(file => file.size > field.max_kb! * 1024)) errors[field.key] = t('fileSize', field.max_kb);
        if (list.length > this.maxFiles(field)) errors[field.key] = t('fileCount', this.maxFiles(field));
        if (list.length) files[field.key] = list;
        continue;
      }
      const multi = field.type === 'multi_select' || (field.type === 'checkbox' && !!field.options?.length);
      if (multi) {
        const all = data.getAll(field.key).map(String);
        if (field.required && !all.length) errors[field.key] = t('fieldRequired');
        if (all.length) fields[field.key] = all;
        continue;
      }
      if (field.type === 'checkbox') {
        const on = data.has(field.key);
        if (field.required && !on) errors[field.key] = t('fieldRequired');
        fields[field.key] = on;
        continue;
      }
      const rules: Dict = field.validation ?? {};
      const raw = String(data.get(field.key) ?? '').trim();
      // Arabic keyboards type ٠١٢…: the API accepts them, so the check does too.
      const value = field.type === 'phone' ? latinDigits(raw) : raw;
      if (!value) {
        if (field.required) errors[field.key] = t('fieldRequired');
        continue;
      }
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.key] = t('invalidEmail');
      if (field.type === 'phone' && !/^\+?[\d\s()\-.]{6,}$/.test(value)) errors[field.key] = t('invalidPhone');
      if (rules['min_length'] && value.length < Number(rules['min_length'])) errors[field.key] = t('tooShort', rules['min_length']);
      if (rules['max_length'] && value.length > Number(rules['max_length'])) errors[field.key] = t('tooLong', rules['max_length']);
      if (field.type === 'number') {
        const n = Number(value);
        if (rules['min'] !== undefined && rules['min'] !== null && n < Number(rules['min'])) errors[field.key] = t('tooSmall', rules['min']);
        if (rules['max'] !== undefined && rules['max'] !== null && n > Number(rules['max'])) errors[field.key] = t('tooLarge', rules['max']);
        fields[field.key] = isNaN(n) ? value : n;
      } else {
        fields[field.key] = value;
      }
    }
    const consent = data.has('__consent');
    if (f.requires_consent && !consent) errors['consent'] = t('consentRequired');

    this.errors.set(errors);
    this.generalError.set(null);
    if (Object.keys(errors).length) {
      this.generalError.set(t('formError'));
      this.focusFirstError();
      return;
    }

    const honeypot = f.honeypot_field ? String(data.get(f.honeypot_field) ?? '') : null;
    const attribution = this.analytics.attribution({ cta_tracking_key: this.ctaKey() });
    let body: Dict | FormData;
    if (Object.keys(files).length) {
      // Multipart: the API reads files as `fields[key]` (contract §18.3).
      const fd = new FormData();
      for (const [k, val] of Object.entries(fields)) {
        if (Array.isArray(val)) val.forEach(x => fd.append(`fields[${k}][]`, String(x)));
        else fd.append(`fields[${k}]`, typeof val === 'boolean' ? (val ? '1' : '0') : String(val));
      }
      for (const [k, list] of Object.entries(files)) {
        const multiple = list.length > 1;
        list.forEach(file => fd.append(multiple ? `fields[${k}][]` : `fields[${k}]`, file, file.name));
      }
      fd.append('consent', consent ? '1' : '0');
      if (f.honeypot_field) fd.append(f.honeypot_field, honeypot ?? '');
      for (const [k, val] of Object.entries(attribution)) fd.append(`attribution[${k}]`, String(val));
      body = fd;
    } else {
      body = { fields, consent, attribution };
      if (f.honeypot_field) body[f.honeypot_field] = honeypot ?? '';
    }

    const phoneKey = this.phoneField()?.key;
    const phone = phoneKey && typeof fields[phoneKey] === 'string' ? latinDigits(fields[phoneKey] as string) : '';
    const nameValue = typeof fields['name'] === 'string' ? (fields['name'] as string) : typeof fields['full_name'] === 'string' ? (fields['full_name'] as string) : null;
    this.otpName.set(nameValue);
    this.otpPhone.set(phone);

    // Retrying an attempt whose answer was lost, nothing edited since.
    if (this.attemptKey && this.attemptBody) {
      this.send(f, this.attemptBody);
      return;
    }
    if (this.codeFirst() && phone) {
      // before_submit: the code first, then this very body goes with the session.
      this.pending = body;
      this.stage.set('otp');
      this.account.saveDraft(f.key, this.values(), this.attemptKey);
      return;
    }
    this.send(f, body);
  }

  /** The code was right: the session is stored, send what was waiting. */
  protected beforeVerified(): void {
    const f = this.form();
    if (f && this.pending) this.send(f, this.pending);
  }

  /** after_submit: the request is now in the account and trackable. */
  protected afterVerified(res: Dict): void {
    this.verifyAfter.set(null);
    this.accountReady.set(true);
    const acc = (res?.['account'] ?? {}) as Dict;
    this.hasPassword.set(typeof acc['has_password'] === 'boolean' ? (acc['has_password'] as boolean) : null);
  }

  /** "Change number", or a number the code endpoint refused. */
  protected backToForm(phoneError: string | null): void {
    this.stage.set('form');
    this.pending = null;
    const key = this.phoneField()?.key;
    if (phoneError && key) {
      this.errors.set({ ...this.errors(), [key]: phoneError });
      this.focusFirstError();
    } else if (key) {
      setTimeout(() => this.formEl()?.nativeElement.querySelector<HTMLElement>(`[name="${CSS.escape(key)}"]`)?.focus());
    }
  }

  /** SMS codes are off right now: never lose the request, send it as a plain lead. */
  protected otpOff(): void {
    this.otpDown.set(true);
    const f = this.form();
    if (f && this.pending) this.send(f, this.pending);
    else this.stage.set('form');
  }

  private send(f: FormDefinition, body: Dict | FormData): void {
    const t = (k: Parameters<SiteStateService['t']>[0], n?: string | number) => this.state.t(k, n);
    this.attemptKey ??= uuid();
    this.attemptBody = body;
    const headers: Record<string, string> = { 'Idempotency-Key': this.attemptKey };
    const token = this.mode() !== 'none' ? this.account.storedToken() : null;
    if (token) headers['X-Website-Session'] = token;
    this.account.saveDraft(f.key, this.values(), this.attemptKey);

    this.sending.set(true);
    this.generalError.set(null);
    this.api.submitForm(f.submit_endpoint, body, headers).subscribe({
      next: (res: Dict) => {
        const d = res?.['data'] ?? res;
        this.sending.set(false);
        this.attemptKey = null;
        this.attemptBody = null;
        this.pending = null;
        if (this.draftTimer) clearTimeout(this.draftTimer);
        this.draftTimer = null;
        this.account.clearDraft(f.key);
        const ref = str(d?.reference) || null;
        this.reference.set(ref);
        this.doneMessage.set(str(f.success_message, d?.message, res?.['message']));
        // `tracking` comes with the first answer only; a replay carries null.
        const tr = d?.tracking as RequestTrackingLink | null | undefined;
        if (tr?.token) {
          this.tracking.set(tr);
          if (ref) this.account.rememberRequest(ref, tr.token);
        } else if (ref && !this.tracking()) {
          const known = this.account.requestToken(ref);
          if (known) this.tracking.set({ token: known });
        }
        const acc = (d?.account ?? null) as Dict | null;
        if (acc?.['linked']) {
          this.accountReady.set(true);
          this.hasPassword.set(this.account.session()?.has_password ?? null);
        }
        const phone = this.otpPhone();
        if (this.mode() === 'after_submit' && acc?.['verification_pending'] && phone && ref && this.tracking()?.token) {
          this.verifyAfter.set({ phone, name: this.otpName(), request: { reference: ref, token: this.tracking()!.token } });
        }
        this.stage.set('form');
        this.done.set(true);
        this.tags.lead(d as Dict, this.form()?.key ?? null);
        // GA4 only: the API records the conversion itself on arrival.
        const event = FORM_EVENTS[str(f.type)];
        if (event) this.tags.formEvent(event, d as Dict, f.key);
        this.submitted.emit(d);
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        this.tags.formError(this.form()?.key ?? null, err.status);
        // A lost answer may have created the request: the retry must reuse the
        // key. A refusal (4xx) means nothing was created, so the next is new.
        if (err.status !== 0 && err.status < 500) {
          this.attemptKey = null;
          this.attemptBody = null;
        }
        this.account.saveDraft(f.key, this.values(), this.attemptKey);
        this.stage.set('form');
        if (err.status === 422 && err.error?.errors?.['verification']) {
          // before_submit without a (still valid) session: to the code step.
          if (token) this.account.forget(this.state.locale());
          const phone = this.otpPhone();
          if (phone && this.mode() === 'before_submit') {
            this.pending = body;
            this.stage.set('otp');
          } else {
            this.generalError.set(t('verifyFirst'));
            this.focusFirstError();
          }
          return;
        }
        if (err.status === 422 && err.error?.errors) {
          const mapped: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(err.error.errors as Record<string, string[]>)) {
            const k = key.replace(/^fields\./, '').split('.')[0];
            mapped[k] ??= Array.isArray(msgs) ? msgs[0] : String(msgs);
          }
          this.errors.set(mapped);
          // Errors on keys we do not render (e.g. attribution) still need a voice.
          const unknown = Object.keys(mapped).filter(k => k !== 'consent' && !f.fields.some(x => x.key === k));
          this.generalError.set(unknown.length ? mapped[unknown[0]] : err.error?.message || t('formError'));
          this.focusFirstError();
        } else if (err.status === 429) {
          this.generalError.set(t('rateLimited'));
        } else if (err.status === 0) {
          // The answer was lost, not necessarily the request: the retry reuses its key.
          this.generalError.set(t('connectionLost'));
        } else {
          this.generalError.set(err.error?.message || t('genericError'));
        }
      }
    });
  }

  private focusFirstError(): void {
    queueMicrotask(() =>
      setTimeout(() => this.formEl()?.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"], .has-error input, .has-error select, .has-error textarea')?.focus())
    );
  }
}
