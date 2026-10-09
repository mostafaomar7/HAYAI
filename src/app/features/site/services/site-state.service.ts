import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_SITE_LOCALE, SiteLocale } from '../site-paths';
import { SiteStringKey, siteT } from '../i18n/site-strings';
import { Dict, FormDefinition, PagePayload, SeoAlternate, SiteCta, SiteData } from '../models/site.models';
import { ctasFor } from '../site-utils';

export type SiteModal =
  | { kind: 'form'; formKey: string; trackingKey?: string | null; title?: string | null }
  | {
      kind: 'purchase';
      product: Dict;
      purchase: Dict;
      tierId: number | null;
      quantity: number;
      trackingKey?: string | null;
    };

/**
 * Per-render state of the public website. Root-provided, which is safe on the
 * server because every SSR request bootstraps a fresh application (and so a
 * fresh root injector) — no state leaks between visitors.
 */
@Injectable({ providedIn: 'root' })
export class SiteStateService {
  readonly locale = signal<SiteLocale>(DEFAULT_SITE_LOCALE);
  readonly site = signal<SiteData | null>(null);
  /** hreflang alternates of the page on screen — drives the language switcher. */
  readonly alternates = signal<SeoAlternate[]>([]);
  /** The CMS page / product on screen: its forms, CTAs and id (attribution). */
  readonly page = signal<PagePayload | null>(null);
  /**
   * What the tag manager is told about the page on screen: its template
   * (`page_type`) and the API's `measurement` block. Kept apart from `page`
   * because listings, profiles and 404s have a classification too, and
   * without it an in-app move to the doctors index would report the safe
   * fallback instead of what the API said.
   */
  readonly tagPage = signal<{ pageType: string; measurement: Dict | null }>({ pageType: 'unknown', measurement: null });
  readonly fetchedForms = signal<Record<string, FormDefinition>>({});
  readonly modal = signal<SiteModal | null>(null);

  readonly dir = computed(() => (this.locale() === 'ar' ? 'rtl' : 'ltr'));
  readonly otherLocale = computed<SiteLocale>(() => (this.locale() === 'ar' ? 'en' : 'ar'));

  t(key: SiteStringKey, n?: string | number): string {
    return siteT(this.locale(), key, n);
  }

  form(key: string | null | undefined): FormDefinition | null {
    if (!key) return null;
    return this.page()?.forms?.[key] ?? this.fetchedForms()[key] ?? null;
  }

  rememberForm(def: FormDefinition): void {
    this.fetchedForms.update(m => ({ ...m, [def.key]: def }));
  }

  /** Sitewide CTAs (`/site.ctas`, attached to menus) for one placement. */
  siteCtas(placement: string): SiteCta[] {
    return ctasFor(this.site()?.ctas, placement);
  }

  /** Page CTAs for a placement, falling back to the sitewide ones. */
  ctas(placement: string): SiteCta[] {
    const own = ctasFor(this.page()?.ctas, placement);
    return own.length ? own : this.siteCtas(placement);
  }

  privacyUrl(): string | null {
    return this.site()?.legal?.privacy_url ?? null;
  }
}
