import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Dict } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteApiService } from '../services/site-api.service';
import { SiteAnalyticsService } from '../services/site-analytics.service';
import { TagLayerService } from '../services/tag-layer.service';
import { arr, money, priceText, str, uuid } from '../site-utils';
import { trackOrderPath } from '../site-paths';

/**
 * Hospital purchase request (contract §6 / §18.4). There is no payment step —
 * the API records a request that sales approve and invoice offline — so this
 * is a form, not a checkout. Prices are always computed by the server.
 */
@Component({
  selector: 'site-purchase-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (result(); as r) {
      <div class="form-done" role="status" aria-live="polite">
        <p class="form-done-title">{{ state.t('purchaseReceived') }}</p>
        <p>{{ state.t('yourReference') }}: <strong dir="ltr">{{ r.reference }}</strong></p>
        @if (r.has_unpriced_items) {
          <p class="note">{{ state.t('toBeQuoted') }}</p>
        } @else if (r.estimated_total) {
          <p>{{ state.t('estimatedTotal') }}: <strong dir="ltr">{{ money(r.estimated_total, r.currency, state.locale()) }}</strong></p>
        }
        @if (trackingUrl()) {
          <div class="tracking-box">
            <p class="note strong">{{ state.t('saveTrackingLink') }}</p>
            <a [attr.href]="trackingUrl()" class="track-link" dir="ltr">{{ trackingUrl() }}</a>
            <button type="button" class="btn btn-outline btn-sm" (click)="copy()">
              {{ copied() ? state.t('copied') : state.t('copyLink') }}
            </button>
          </div>
        }
      </div>
    } @else {
      <form #formEl class="site-form" novalidate (submit)="submit($event)">
        <div class="purchase-summary">
          <p class="purchase-product">{{ product()?.['name'] }}</p>
          @if (selectedPrice()) {
            <p class="price-sm">{{ selectedPrice() }}</p>
          }
        </div>

        @if (tiers().length) {
          <div class="field field-wide">
            <label [attr.for]="id('tier')">{{ state.t('plan') }}</label>
            <select [attr.id]="id('tier')" name="price_tier_id" (change)="pickedTier.set(+$any($event.target).value || null)">
              @for (t of tiers(); track t.id) {
                <option [attr.value]="t.id" [attr.selected]="t.id === tier() ? '' : null">
                  {{ t.name }}{{ tierPrice(t) ? ' — ' + tierPrice(t) : '' }}
                </option>
              }
            </select>
          </div>
        }
        <div class="field">
          <label [attr.for]="id('qty')">{{ state.t('quantity') }}</label>
          <input
            type="number"
            [attr.id]="id('qty')"
            name="quantity"
            [attr.min]="min()"
            [attr.max]="max()"
            [attr.value]="initialQuantity()"
            required
          />
          @if (errors()['quantity']) { <p class="error">{{ errors()['quantity'] }}</p> }
        </div>

        @for (f of fieldList; track f.key) {
          <div class="field" [class.field-wide]="f.key === 'notes'" [class.has-error]="errors()[f.key]">
            <label [attr.for]="id(f.key)">{{ state.t(f.label) }}@if (f.required) {<span class="req" aria-hidden="true"> *</span>}</label>
            @if (f.key === 'organization_type') {
              <select [attr.id]="id(f.key)" name="organization_type">
                @for (o of orgTypes; track o.value) {
                  <option [attr.value]="o.value">{{ state.t(o.label) }}</option>
                }
              </select>
            } @else if (f.key === 'notes') {
              <textarea [attr.id]="id(f.key)" name="notes" rows="3" maxlength="5000"></textarea>
            } @else {
              <input
                [attr.type]="f.type"
                [attr.id]="id(f.key)"
                [attr.name]="f.key"
                [attr.autocomplete]="f.autocomplete"
                [attr.dir]="f.type === 'email' || f.type === 'tel' ? 'ltr' : null"
                [attr.required]="f.required ? '' : null"
                [attr.aria-invalid]="errors()[f.key] ? 'true' : null"
                maxlength="191"
              />
            }
            @if (errors()[f.key]) { <p class="error">{{ errors()[f.key] }}</p> }
          </div>
        }

        <div class="field field-wide" [class.has-error]="errors()['consent']">
          <label class="choice consent">
            <input type="checkbox" name="consent" value="1" required />
            <span>
              {{ state.t('purchaseConsent') }}
              @if (state.privacyUrl()) {
                <a [attr.href]="state.privacyUrl()" target="_blank" rel="noopener">{{ state.t('privacyPolicy') }}</a>
              }
            </span>
          </label>
          @if (errors()['consent']) { <p class="error">{{ errors()['consent'] }}</p> }
        </div>

        @if (generalError()) {
          <p class="form-alert" role="alert">{{ generalError() }}</p>
        }
        <div class="form-actions-row">
          <button type="submit" class="btn btn-primary btn-block" [disabled]="sending()">
            {{ sending() ? state.t('sending') : state.t('submitPurchase') }}
          </button>
        </div>
      </form>
    }
  `
})
export class PurchaseFormComponent {
  readonly product = input<Dict | null>(null);
  readonly purchase = input<Dict | null>(null);
  readonly tierId = input<number | null>(null);
  readonly quantity = input<number | null>(null);
  readonly trackingKey = input<string | null>(null);

  protected state = inject(SiteStateService);
  protected money = money;
  private api = inject(SiteApiService);
  private analytics = inject(SiteAnalyticsService);
  private tags = inject(TagLayerService);
  private formEl = viewChild<ElementRef<HTMLFormElement>>('formEl');

  /** Plan picked in this form; until then the one chosen in the buy box,
   *  else the recommended plan. */
  protected pickedTier = signal<number | null>(null);
  protected tier = computed(
    () => this.pickedTier() ?? this.tierId() ?? (this.tiers().find(t => t['is_recommended']) ?? this.tiers()[0])?.['id'] ?? null
  );
  protected errors = signal<Record<string, string>>({});
  protected generalError = signal<string | null>(null);
  protected sending = signal(false);
  protected result = signal<any>(null);
  protected copied = signal(false);
  private idempotencyKey: string | null = null;

  protected readonly fieldList = [
    { key: 'organization_name', label: 'organizationName', type: 'text', required: true, autocomplete: 'organization' },
    { key: 'organization_type', label: 'organizationType', type: 'select', required: false, autocomplete: null },
    { key: 'contact_name', label: 'contactName', type: 'text', required: true, autocomplete: 'name' },
    { key: 'job_title', label: 'jobTitle', type: 'text', required: false, autocomplete: 'organization-title' },
    { key: 'email', label: 'email', type: 'email', required: true, autocomplete: 'email' },
    { key: 'phone', label: 'phone', type: 'tel', required: true, autocomplete: 'tel' },
    { key: 'country', label: 'country', type: 'text', required: false, autocomplete: 'country-name' },
    { key: 'city', label: 'city', type: 'text', required: false, autocomplete: 'address-level2' },
    { key: 'notes', label: 'notes', type: 'textarea', required: false, autocomplete: null }
  ] as const;

  protected readonly orgTypes = [
    { value: 'hospital', label: 'orgHospital' },
    { value: 'clinic', label: 'orgClinic' },
    { value: 'lab', label: 'orgLab' },
    { value: 'pharmacy', label: 'orgPharmacy' },
    { value: 'insurance', label: 'orgInsurance' },
    { value: 'other', label: 'orgOther' }
  ] as const;

  protected tiers = computed(() => arr<any>(this.product()?.['tiers']).filter(t => t?.['id']));
  protected min = computed(() => Number(this.purchase()?.['min_quantity']) || 1);
  protected max = computed(() => Number(this.purchase()?.['max_quantity']) || null);
  protected initialQuantity = computed(() => this.quantity() ?? this.min());
  protected selectedPrice = computed(() => {
    const t = this.tiers().find(x => x['id'] === this.tier());
    return (t && this.tierPrice(t)) || priceText(this.product());
  });
  protected trackingUrl = computed(() => {
    const r = this.result();
    const token = r?.['tracking']?.token;
    if (!r?.['reference'] || !token) return null;
    const origin = typeof location !== 'undefined' ? location.origin : '';
    return `${origin}${trackOrderPath(this.state.locale())}?ref=${encodeURIComponent(r['reference'])}&token=${encodeURIComponent(token)}`;
  });

  protected id(key: string): string {
    return `pf-${this.product()?.['id'] ?? 'x'}-${key}`;
  }

  protected tierPrice(t: Dict): string {
    return priceText(t);
  }

  protected copy(): void {
    const url = this.trackingUrl();
    if (url && navigator.clipboard) navigator.clipboard.writeText(url).then(() => this.copied.set(true), () => {});
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const el = this.formEl()?.nativeElement;
    if (!el || this.sending()) return;
    const data = new FormData(el);
    const get = (k: string) => String(data.get(k) ?? '').trim();
    const errors: Record<string, string> = {};
    for (const f of this.fieldList) if (f.required && !get(f.key)) errors[f.key] = this.state.t('fieldRequired');
    if (get('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get('email'))) errors['email'] = this.state.t('invalidEmail');
    if (get('phone') && !/^\+?[\d\s()\-.]{6,}$/.test(get('phone'))) errors['phone'] = this.state.t('invalidPhone');
    const qty = Math.floor(Number(get('quantity')));
    if (!qty || qty < this.min()) errors['quantity'] = this.state.t('tooSmall', this.min());
    else if (this.max() && qty > this.max()!) errors['quantity'] = this.state.t('tooLarge', this.max()!);
    if (!data.has('consent')) errors['consent'] = this.state.t('consentRequired');
    this.errors.set(errors);
    this.generalError.set(Object.keys(errors).length ? this.state.t('formError') : null);
    if (Object.keys(errors).length) return;

    const productId = this.purchase()?.['product_id'] ?? this.product()?.['id'];
    const body: Dict = {
      items: [{ product_id: productId, quantity: qty, price_tier_id: this.tier(), notes: null }],
      organization_name: get('organization_name'),
      organization_type: get('organization_type') || null,
      contact_name: get('contact_name'),
      email: get('email'),
      phone: get('phone'),
      job_title: get('job_title') || null,
      country: get('country') || null,
      city: get('city') || null,
      notes: get('notes') || null,
      consent: true,
      save_as_draft: false,
      attribution: this.analytics.attribution({ cta_tracking_key: this.trackingKey() })
    };
    // One key per attempt; a retry after a network failure reuses it so the
    // API can recognise the duplicate instead of filing two requests.
    this.idempotencyKey ??= uuid();
    this.sending.set(true);
    const endpoint = str(this.purchase()?.['endpoint']) || `/api/v1/public/${this.state.locale()}/purchases`;
    this.api.purchase(endpoint, body, this.idempotencyKey).subscribe({
      next: res => {
        this.sending.set(false);
        this.idempotencyKey = null;
        const done = ((res as Dict)?.['data'] ?? res) as Dict;
        this.result.set(done);
        this.tags.purchase(done);
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        if (err.status !== 0) this.idempotencyKey = null;
        if (err.status === 422 && err.error?.errors) {
          const mapped: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(err.error.errors as Record<string, string[]>)) {
            const k = key.startsWith('items.') ? 'quantity' : key.split('.')[0];
            mapped[k] ??= Array.isArray(msgs) ? msgs[0] : String(msgs);
          }
          this.errors.set(mapped);
          this.generalError.set(err.error?.message || this.state.t('formError'));
        } else if (err.status === 429) {
          this.generalError.set(this.state.t('rateLimited'));
        } else {
          this.generalError.set(err.error?.message || this.state.t('genericError'));
        }
      }
    });
  }
}
