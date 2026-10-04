import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Dict, FormDefinition, FormField } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteApiService } from '../services/site-api.service';
import { SiteAnalyticsService } from '../services/site-analytics.service';
import { str } from '../site-utils';

type Values = Record<string, string | string[] | boolean>;

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (form(); as f) {
      @if (done()) {
        <div class="form-done" role="status" aria-live="polite">
          <p class="form-done-title">{{ state.t('thankYou') }}</p>
          <p>{{ doneMessage() }}</p>
          @if (reference()) {
            <p>{{ state.t('yourReference') }}: <strong dir="ltr">{{ reference() }}</strong></p>
          }
        </div>
      } @else {
        <form
          #formEl
          class="site-form"
          [attr.id]="anchorId() || null"
          novalidate
          (submit)="submit($event)"
          (input)="sync()"
          (change)="sync()"
          (focusin)="started()"
        >
          @if (showTitle() && f.name) {
            <h3 class="form-title">{{ f.name }}</h3>
          }
          @if (f.description) {
            <p class="muted">{{ f.description }}</p>
          }

          @for (field of f.fields; track field.key) {
            @if (visible(field)) {
              <div class="field" [class.has-error]="errors()[field.key]" [class.field-wide]="isWide(field)">
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

          <div class="form-actions-row">
            <button type="submit" class="btn btn-primary" [disabled]="sending()">
              {{ sending() ? state.t('sending') : f.submit_label || state.t('submit') }}
            </button>
          </div>
        </form>
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

  protected privacy = computed(() => this.form()?.privacy_url || this.state.privacyUrl());

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
      const value = String(data.get(field.key) ?? '').trim();
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

    this.sending.set(true);
    this.api.submitForm(f.submit_endpoint, body).subscribe({
      next: (res: Dict) => {
        const d = res?.['data'] ?? res;
        this.sending.set(false);
        this.reference.set(str(d?.reference) || null);
        this.doneMessage.set(str(f.success_message, d?.message, res?.['message']));
        this.done.set(true);
        this.submitted.emit(d);
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
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
