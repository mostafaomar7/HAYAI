import { DOCUMENT, Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SiteAnalyticsService } from './site-analytics.service';

/**
 * The App Store campaign provider token (`pt`), from App Store Connect →
 * App Analytics → Campaigns. Empty means App Store links are left alone; once
 * the owner sends it, setting it here is the whole change.
 */
export const APP_STORE_PROVIDER_TOKEN = '';

const PLAY_LINK = /^https:\/\/play\.google\.com\/store\/apps\/details\b/i;
const APP_STORE_LINK = /^https:\/\/apps\.apple\.com\//i;

/** What a store link carries: the visit's campaign, or the page it was tapped on. */
export interface StoreCampaign {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

/**
 * Carries the visit's campaign into the app stores, so an install can be
 * traced back to Instagram, search or WhatsApp instead of every install
 * looking the same.
 *
 * - Google Play: `&referrer=` holding `utm_source=…&utm_medium=…&utm_campaign=…`,
 *   URL-encoded. The app reads it on first open (Install Referrer API).
 * - App Store: `pt=<provider token>&ct=<campaign>`, only once the token is set.
 *
 * Store buttons come from CMS content, not from templates here, so this works
 * on whatever links are on the page: it rewrites them as they render, and once
 * more inside the tap itself in case a binding put the original back.
 *
 * A visit with no campaign keeps a referrer an editor typed into the CMS
 * link (the home hero has one); a visit that came from a campaign replaces
 * it, because the campaign is what the referrer exists to report.
 */
@Injectable({ providedIn: 'root' })
export class StoreLinksService {
  private analytics = inject(SiteAnalyticsService);
  private document = inject(DOCUMENT);
  private zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private installed = false;
  private pending = false;

  /** Once, from the shell. */
  install(): void {
    if (!this.isBrowser || this.installed) return;
    this.installed = true;
    this.zone.runOutsideAngular(() => {
      // Capture phase: runs before the tag manager's click trigger reads the URL.
      this.document.addEventListener('click', e => this.onClick(e), true);
      this.document.addEventListener('auxclick', e => this.onClick(e), true);
      // Content arrives after navigation and after hydration; one pass per frame.
      new MutationObserver(() => this.schedule()).observe(this.document.body, { childList: true, subtree: true });
      this.schedule();
    });
  }

  private schedule(): void {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.decorateAll();
    });
  }

  private decorateAll(): void {
    try {
      this.document
        .querySelectorAll<HTMLAnchorElement>('a[href*="play.google.com"], a[href*="apps.apple.com"]')
        .forEach(a => this.decorate(a));
    } catch {
      /* a referrer is a bonus; never break the page for it */
    }
  }

  private onClick(event: Event): void {
    const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (link) this.decorate(link);
  }

  private decorate(link: HTMLAnchorElement): void {
    try {
      const href = link.getAttribute('href') ?? '';
      const next = storeHref(href, this.analytics.campaign(), location.pathname, APP_STORE_PROVIDER_TOKEN);
      if (next !== href) link.setAttribute('href', next);
    } catch {
      /* see above */
    }
  }
}

/**
 * The store link with the campaign added. Anything that is not a store link
 * comes back unchanged, and so does a link that already says the same thing.
 */
export function storeHref(href: string, campaign: StoreCampaign, path: string, providerToken = ''): string {
  if (PLAY_LINK.test(href)) {
    const url = new URL(href);
    const hasCampaign = !!campaign.utm_source;
    // An editor's own referrer stays unless this visit has a campaign to report.
    if (!hasCampaign && url.searchParams.has('referrer')) return href;
    const inner = new URLSearchParams();
    if (hasCampaign) {
      inner.set('utm_source', campaign.utm_source!);
      if (campaign.utm_medium) inner.set('utm_medium', campaign.utm_medium);
      if (campaign.utm_campaign) inner.set('utm_campaign', campaign.utm_campaign);
    } else {
      inner.set('utm_source', 'website');
      inner.set('utm_medium', 'organic');
      inner.set('utm_campaign', path);
    }
    const value = inner.toString();
    if (url.searchParams.get('referrer') === value) return href;
    url.searchParams.set('referrer', value);
    return url.toString();
  }

  if (providerToken && APP_STORE_LINK.test(href)) {
    const url = new URL(href);
    // Apple caps the campaign name at 40 characters.
    const ct = (campaign.utm_campaign || campaign.utm_source || path).slice(0, 40);
    if (url.searchParams.get('pt') === providerToken && url.searchParams.get('ct') === ct) return href;
    url.searchParams.set('pt', providerToken);
    url.searchParams.set('ct', ct);
    return url.toString();
  }

  return href;
}
