import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Dict, SiteCta } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteCtaService } from '../services/site-cta.service';
import { CtaButtonComponent } from './cta-button.component';
import { money, priceText, str } from '../site-utils';

/**
 * The product "buy box" — modelled on Amazon's: price, availability, plan
 * picker as radio cards ("One-time purchase / Subscribe & Save" style),
 * quantity stepper, then the primary Purchase button and a secondary contact
 * action. It sits in the sticky side column of the product layout (which
 * mirrors to the left in Arabic through logical CSS properties).
 *
 * Price, availability and every plan with its features are plain text in the
 * server HTML, so crawlers read them without running the picker.
 */
@Component({
  selector: 'site-buy-box',
  imports: [CtaButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="buy-box" id="buy">
      @if (showPrice() && displayPrice()) {
        <p class="buy-price">
          <span class="sr-only">{{ state.t('price') }}: </span>{{ displayPrice() }}
        </p>
        @if (compareAt()) {
          <p class="buy-compare"><s>{{ compareAt() }}</s></p>
        }
      } @else if (showPrice()) {
        <p class="buy-price buy-price-muted">{{ state.t('priceOnRequest') }}</p>
      }

      @if (availabilityLabel()) {
        <p class="avail" [attr.data-status]="availabilityStatus()">{{ availabilityLabel() }}</p>
      }

      @if (tiers().length) {
        <fieldset class="tiers">
          <legend>{{ state.t('choosePlan') }}</legend>
          @for (t of tiers(); track $index) {
            <label class="tier" [class.is-selected]="chosen() === $index">
              <input
                type="radio"
                [attr.name]="'tier-' + uid()"
                [attr.value]="t['id'] ?? $index"
                [attr.checked]="chosen() === $index ? '' : null"
                (change)="selected.set($index)"
              />
              <span class="tier-body">
                <span class="tier-head">
                  <span class="tier-name">{{ t['name'] }}</span>
                  @if (t['is_recommended']) {
                    <span class="badge-rec">{{ state.t('recommended') }}</span>
                  }
                </span>
                @if (showPrice() && price(t)) {
                  <span class="tier-price">{{ price(t) }}</span>
                }
                @if (features(t).length) {
                  <ul class="tier-features">
                    @for (f of features(t); track $index) {
                      <li>{{ f }}</li>
                    }
                  </ul>
                }
              </span>
            </label>
          }
        </fieldset>
      }

      @if (purchase()) {
        <div class="qty">
          <label [attr.for]="'qty-' + uid()">{{ state.t('quantity') }}</label>
          <div class="qty-ctrl">
            <button type="button" (click)="step(-1)" [disabled]="qty() <= min()" [attr.aria-label]="state.t('decrease')">−</button>
            <input
              [attr.id]="'qty-' + uid()"
              type="number"
              inputmode="numeric"
              [attr.min]="min()"
              [attr.max]="max()"
              [value]="qty()"
              (change)="setQty(+$any($event.target).value)"
            />
            <button type="button" (click)="step(1)" [disabled]="max() !== null && qty() >= max()!" [attr.aria-label]="state.t('increase')">+</button>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-block btn-lg" (click)="buy()">
          {{ primaryLabel() }}
        </button>
      }

      @for (c of secondary(); track $index) {
        <site-cta [cta]="c" placement="sidebar" size="block" />
      } @empty {
        <button type="button" class="btn btn-outline btn-block" (click)="contact()">{{ state.t('contactUs') }}</button>
      }
    </div>
  `
})
export class BuyBoxComponent {
  readonly product = input<Dict | null>(null);
  readonly purchaseInfo = input<Dict | null>(null);
  readonly ctas = input<SiteCta[]>([]);
  readonly showPrice = input(true);
  readonly primaryCta = input<SiteCta | null>(null);

  protected state = inject(SiteStateService);
  private ctaService = inject(SiteCtaService);

  /** Tier[] (§5.3): the block / product page attaches the live tiers to the product. */
  protected tiers = computed<Dict[]>(() => this.product()?.['tiers'] ?? []);
  protected selected = signal(-1);
  protected qtyOverride = signal<number | null>(null);

  protected uid = computed(() => String(this.product()?.['id'] ?? this.product()?.['slug'] ?? 'p'));
  protected purchase = computed(() => {
    const p = this.product();
    return this.purchaseInfo() ?? (p ? this.ctaService.purchaseInfo(p) : null);
  });
  protected min = computed(() => Math.max(1, Number(this.purchase()?.['min_quantity']) || 1));
  protected max = computed(() => Number(this.purchase()?.['max_quantity']) || null);
  protected qty = computed(() => this.qtyOverride() ?? this.min());

  /** Index of the plan shown as chosen: the user's pick, else the recommended one. */
  protected chosen = computed(() => {
    if (this.selected() >= 0) return this.selected();
    const rec = this.tiers().findIndex(t => t['is_recommended']);
    return rec >= 0 ? rec : this.tiers().length ? 0 : -1;
  });
  protected displayPrice = computed(() => {
    const t = this.tiers()[this.chosen()];
    return (t && priceText(t)) || priceText(this.product());
  });
  /** Struck-through price. Only set when higher than `price`, and sent as a raw
   *  decimal string with no `display`, so it is the one price formatted here. */
  protected compareAt = computed(() => {
    const pricing = this.product()?.['pricing'];
    return money(pricing?.compare_at_price, pricing?.currency, this.state.locale());
  });
  protected availabilityLabel = computed(() => str(this.product()?.['availability']?.label));
  protected availabilityStatus = computed(() => str(this.product()?.['availability']?.status));
  protected primaryLabel = computed(() => str(this.primaryCta()?.label) || this.state.t('purchase'));
  protected secondary = computed(() => this.ctas().filter(c => c?.action?.kind !== 'purchase'));

  protected price(t: Dict): string {
    return priceText(t);
  }

  protected features(t: Dict): string[] {
    return t['features'] ?? [];
  }

  protected step(delta: number): void {
    this.setQty(this.qty() + delta);
  }

  protected setQty(n: number): void {
    let v = Math.floor(n) || this.min();
    v = Math.max(this.min(), v);
    if (this.max() !== null) v = Math.min(this.max()!, v);
    this.qtyOverride.set(v);
  }

  protected buy(): void {
    const p = this.product();
    const info = this.purchase();
    if (!p || !info) return;
    const tier = this.tiers()[this.chosen()];
    this.ctaService.openPurchase(p, info, tier?.['id'] ?? null, this.qty(), str(this.primaryCta()?.tracking_key) || null);
  }

  protected contact(): void {
    this.ctaService.openForm(this.product()?.['purchase']?.fallback_form_key ?? 'purchase-inquiry');
  }
}
