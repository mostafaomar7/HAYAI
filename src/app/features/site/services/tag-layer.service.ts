import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SiteStateService } from './site-state.service';
import { Dict } from '../models/site.models';
import { careCategoryOf, safePageLocation } from '../tracking-params';

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
    const { pageType, measurement } = this.state.tagPage();
    const out: Dict = {
      page_type: pageType,
      page_language: this.state.locale(),
      ...(measurement ?? {})
    };
    // Unknown is sensitive, never standard — the same asymmetry the server
    // applies. Suppressing ads on an ordinary page costs a little
    // attribution; firing them on an ICU page is the thing being prevented.
    if (typeof out['page_sensitivity'] !== 'string' || !out['page_sensitivity']) out['page_sensitivity'] = 'sensitive';
    out['care_category'] ??= careCategoryOf(out['content_group']);
    return out;
  }

  /**
   * A route change inside the app. Not the first page — the server did that.
   *
   * Named `virtual_page_view`, not `page_view`: the container's trigger is
   * `CE - virtual_page_view`, and GA4's own history-based page view is turned
   * off so the two cannot double-count the same navigation.
   */
  virtualPageView(path: string): void {
    const measurement = this.measurement();
    const clarityAllowed = this.clarityAllowed(measurement);
    // The container starts Clarity once, on the first page load, and only
    // where the server said it may. In-app navigation never reloads, so a
    // recording that began on the home page would follow the visitor onto a
    // product or ICU page. Stop it there; it does not restart until a fresh
    // page load lands on an allowed page.
    if (!clarityAllowed) this.stopClarity();
    this.push({
      event: 'virtual_page_view',
      ...measurement,
      clarity_allowed: clarityAllowed,
      page_location: this.href(path),
      page_title: this.state.page()?.['title'] ?? null
    });
  }

  /** Same rule as `clarityAllowed()` in server.ts: a standard editorial page only. */
  private clarityAllowed(measurement: Dict): boolean {
    const page = this.state.page();
    return measurement['page_sensitivity'] === 'standard' && page?.['entity'] === 'page' && !page?.['is_preview'];
  }

  private stopClarity(): void {
    if (!this.isBrowser) return;
    const clarity = (window as unknown as { clarity?: (...args: unknown[]) => void }).clarity;
    try {
      clarity?.('stop');
    } catch {
      /* recording is optional; never let it break navigation */
    }
  }

  /** Full URL, as the spec asks for, with the path the router settled on. */
  private href(path: string): string {
    if (!this.isBrowser) return path;
    try {
      // Minus the search text and the order-tracking token: GA4 keeps the URL.
      return safePageLocation(new URL(path, location.origin).href);
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
    const reference = payload['reference'] ?? null;
    this.push({
      event: 'generate_lead',
      ...this.measurement(),
      // The spec's name. `form_key` stays alongside it for a container
      // already built on the earlier name.
      form_id: formKey,
      form_key: formKey,
      lead_type: payload['type'] ?? null,
      // One server id under both names: Google Ads de-duplicates on
      // transaction_id, Meta and TikTok match browser to server on event_id.
      transaction_id: reference,
      event_id: reference
      // No user_data: enhanced conversions are off by the client's decision,
      // so no e-mail or phone, hashed or not, ever enters the dataLayer.
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
      event_id: payload['reference'] ?? null,
      ...(value !== null && Number.isFinite(value) ? { value, currency: 'EGP' } : {})
    });
  }

  /**
   * A CMS button was clicked. Always `cta_click`, whatever it opens.
   *
   * WhatsApp and phone conversions are NOT pushed from here: the container
   * counts them with its link-click triggers (wa.me / tel:+20…), which see
   * every such link on the page, including the footer number that is not a
   * CMS button. Pushing `whatsapp_click` here as well would give the same
   * click two sources, and Google Ads would count it twice.
   */
  ctaClick(kind: string, trackingKey: string | null, placement: string): void {
    this.push({
      event: 'cta_click',
      ...this.measurement(),
      cta_kind: kind,
      cta_tracking_key: trackingKey,
      placement
    });
  }

  /**
   * A results page was shown: site search, or a directory / services index.
   *
   * The count only — never the query. Search is a sensitive page because what
   * a patient types is health information, and GA4 keeps whatever it is sent.
   * `no_results` follows on an empty set, so the gaps in the directory show up
   * as their own report rather than as a filter on this one.
   */
  resultsView(resultCount: number, area: string | null): void {
    const measurement = this.measurement();
    const base = { ...measurement, care_category: measurement['care_category'] ?? null, area };
    this.push({ event: 'search_results_view', ...base, result_count: resultCount });
    if (resultCount === 0) this.push({ event: 'no_results', ...base });
  }

  /**
   * The server refused a submit. Pushed only for what the server said, not for
   * the browser's own checks before sending: the spec asks how often a patient
   * who pressed "send" was turned away, and a required field caught before
   * the request is a different, already visible, problem.
   *
   * `error_type` is a category, never the message, which can echo the value
   * the patient typed.
   */
  formError(formId: string | null, status: number): void {
    const errorType = status === 422 ? 'validation' : status === 0 || status === 408 || status === 504 ? 'timeout' : 'server';
    this.push({ event: 'form_error', ...this.measurement(), form_id: formId, error_type: errorType });
  }
}
