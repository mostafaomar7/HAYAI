import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SiteStateService } from './site-state.service';
import { SiteAnalyticsService } from './site-analytics.service';
import { SiteApiService } from './site-api.service';
import { Dict, SiteCta } from '../models/site.models';

/** What a CTA button needs, derived from a resolved CTA (website-public-blocks.md §5.2). */
export interface CtaView {
  label: string;
  sublabel: string;
  style: string;
  kind: string; // link | form | purchase | phone | whatsapp
  href: string;
  target: string | null;
  rel: string | null;
  formKey: string | null;
  product: Dict | null;
  trackingKey: string | null;
}

export function ctaView(cta: SiteCta | null | undefined): CtaView | null {
  if (!cta?.label) return null;
  const action = cta.action;
  // `tel` is tracked as phone_click, everything else by its own kind.
  const kind = action.kind === 'tel' ? 'phone' : action.kind;
  const formKey = action.form_key;
  const product = action.product;
  // Every CTA is a real `<a href>`, even the ones JavaScript intercepts: a
  // crawler (or a visitor before hydration) still gets a meaningful link —
  // the inline form's anchor, or the product page. A form CTA may have no href.
  let href = action.href ?? '';
  if (!href && kind === 'form' && formKey) href = `#form-${formKey}`;
  if (!href && kind === 'purchase') href = product?.path || '#buy';
  return {
    label: cta.label,
    sublabel: cta.sublabel ?? '',
    style: cta.style,
    kind,
    href: href || '#',
    target: action.target === '_blank' ? '_blank' : null,
    rel: action.rel,
    formKey,
    product,
    trackingKey: cta.tracking_key
  };
}

@Injectable({ providedIn: 'root' })
export class SiteCtaService {
  private state = inject(SiteStateService);
  private analytics = inject(SiteAnalyticsService);
  private api = inject(SiteApiService);
  private document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Click handler shared by every CTA button. */
  activate(cta: CtaView, placement: string, event: Event): void {
    if (!this.isBrowser) return;
    const base = { cta_tracking_key: cta.trackingKey, placement };
    this.analytics.track('cta_click', base);
    if (cta.kind === 'phone') this.analytics.track('phone_click', base);
    if (cta.kind === 'whatsapp') this.analytics.track('whatsapp_click', base);

    if (cta.kind === 'form' && cta.formKey) {
      event.preventDefault();
      this.openForm(cta.formKey, cta.trackingKey);
    } else if (cta.kind === 'purchase' && cta.product?.['id'] && this.purchaseInfo(cta.product)) {
      event.preventDefault();
      this.openPurchase(cta.product, this.purchaseInfo(cta.product)!, null, null, cta.trackingKey);
    }
    // Everything else is a normal link; internal ones are routed client-side
    // by the shell's link interceptor.
  }

  /** Scroll to the form when it is already on the page, else open it in a modal. */
  openForm(formKey: string, trackingKey: string | null = null): void {
    const inline = this.document.getElementById(`form-${formKey}`);
    if (inline) {
      inline.scrollIntoView({ behavior: 'smooth', block: 'start' });
      inline.querySelector<HTMLElement>('input:not([type=hidden]):not([tabindex="-1"]), select, textarea')?.focus({
        preventScroll: true
      });
      if (trackingKey) inline.setAttribute('data-cta', trackingKey);
      return;
    }
    if (!this.state.form(formKey)) {
      this.api.form(this.state.locale(), formKey).subscribe(def => {
        if (def) {
          this.state.rememberForm(def);
          this.state.modal.set({ kind: 'form', formKey, trackingKey });
        }
      });
      return;
    }
    this.state.modal.set({ kind: 'form', formKey, trackingKey });
  }

  openPurchase(product: Dict, purchase: Dict, tierId: number | null, quantity: number | null, trackingKey: string | null): void {
    const min = Number(purchase['min_quantity']) || 1;
    this.analytics.track('purchase_started', { cta_tracking_key: trackingKey, product_id: product['id'] ?? purchase['product_id'] });
    this.state.modal.set({ kind: 'purchase', product, purchase, tierId, quantity: quantity ?? min, trackingKey });
  }

  /** The product's PurchaseBox (§5.3), or one synthesised for the locale when a
   *  purchase CTA only carries `{ id, slug, path }`. `null` when disabled: the
   *  caller then opens the `purchase-inquiry` form instead. */
  purchaseInfo(product: Dict): Dict | null {
    const p = product['purchase'];
    if (p && typeof p === 'object') return p.enabled === false ? null : p;
    if (product['is_purchasable'] === false || !product['id']) return null;
    return {
      enabled: true,
      endpoint: `/api/v1/public/${this.state.locale()}/purchases`,
      product_id: product['id'],
      min_quantity: product['quantity']?.min ?? 1,
      max_quantity: product['quantity']?.max ?? null
    };
  }
}
