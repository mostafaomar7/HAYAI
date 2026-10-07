import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SiteStateService } from './site-state.service';
import { Dict } from '../models/site.models';

/**
 * The dataLayer the tag manager reads.
 *
 * Separate from SiteAnalyticsService on purpose. That one posts to HAYAI's own
 * `/events` endpoint and answers "what happened on the website". This one
 * answers "what should Google bid on", and the two are not the same list: the
 * API records every funnel step, while a conversion pushed twice teaches
 * Google Ads to pay twice for it.
 *
 * Browser-only by construction. A push during a server render would attribute
 * a crawler fetch to a campaign.
 */
@Injectable({ providedIn: 'root' })
export class TagLayerService {
  private state = inject(SiteStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private push(row: Dict): void {
    if (!this.isBrowser) return;
    const w = window as unknown as { dataLayer?: Dict[] };
    // The array may not exist yet on a page the server did not render the
    // install into; creating it is what the container's own snippet does.
    (w.dataLayer ??= []).push(row);
  }

  /**
   * The page classification, as it is at this moment.
   *
   * The server renders this once, before any tag loads. After hydration the
   * router takes over and no second render happens, so without this a visitor
   * who lands on the home page and then opens the emergency page still
   * carries `page_sensitivity: standard` — and the advertising tags, which
   * read exactly that key to decide whether they may fire, would fire on a
   * page the spec forbids them on.
   */
  private measurement(): Dict {
    const m = this.state.page()?.['measurement'];
    if (!m || typeof m !== 'object') {
      // Unknown is sensitive, never standard — the same asymmetry the server
      // applies. Suppressing ads on an ordinary page costs a little
      // attribution; firing them on an ICU page is the thing being prevented.
      return { page_sensitivity: 'sensitive' };
    }
    return { ...(m as Dict) };
  }

  /**
   * A route change inside the app. Not the first page — the server did that.
   *
   * Named `virtual_page_view`, not `page_view`: the container's trigger is
   * `CE - virtual_page_view`, and GA4's own history-based page view is turned
   * off so the two cannot double-count the same navigation.
   */
  virtualPageView(path: string): void {
    this.push({
      event: 'virtual_page_view',
      ...this.measurement(),
      page_location: this.href(path),
      page_title: this.state.page()?.['title'] ?? null
    });
  }

  /** Full URL, as the spec asks for, with the path the router settled on. */
  private href(path: string): string {
    if (!this.isBrowser) return path;
    try {
      return new URL(path, location.origin).href;
    } catch {
      return path;
    }
  }

  /**
   * A submitted form.
   *
   * `duplicate` is the API answering "you already sent me this one". A retry
   * within two minutes returns the first lead's reference rather than filing a
   * second, so pushing on a duplicate would count one patient twice. Google
   * Ads would de-duplicate on `transaction_id` anyway; GA4 would not.
   */
  lead(payload: Dict, formKey: string | null): void {
    if (payload['duplicate'] === true) return;
    this.push({
      event: 'generate_lead',
      ...this.measurement(),
      form_key: formKey,
      lead_type: payload['type'] ?? null,
      transaction_id: payload['reference'] ?? null
    });
  }

  /**
   * A submitted purchase request.
   *
   * `estimated_total` is a decimal string like "1350.00", as all money in this
   * API is. It is null when a line has no price, and that is sent as no value
   * at all rather than as zero: to a bidding model zero means "worthless",
   * which is a different claim from "not yet priced".
   */
  purchase(payload: Dict): void {
    if (payload['duplicate'] === true) return;
    const raw = payload['estimated_total'];
    const value = raw === null || raw === undefined ? null : Number(raw);
    this.push({
      event: 'purchase_submitted',
      ...this.measurement(),
      transaction_id: payload['reference'] ?? null,
      ...(value !== null && Number.isFinite(value) ? { value, currency: 'EGP' } : {})
    });
  }

  /** A click the client counts as a conversion: WhatsApp, phone, app store. */
  ctaClick(kind: string, trackingKey: string | null, placement: string): void {
    const event =
      kind === 'whatsapp' ? 'whatsapp_click' : kind === 'phone' ? 'phone_click' : 'cta_click';
    this.push({
      event,
      ...this.measurement(),
      cta_tracking_key: trackingKey,
      placement
    });
  }
}
