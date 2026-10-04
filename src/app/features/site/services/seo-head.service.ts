import { DOCUMENT, Injectable, Renderer2, RendererFactory2, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { SiteLocale } from '../site-paths';
import { Dict, SeoAlternate, SiteImage } from '../models/site.models';

export interface HeadInput {
  locale: SiteLocale;
  dir?: 'ltr' | 'rtl';
  title: string;
  description?: string | null;
  canonical?: string | null;
  robots?: string | null;
  alternates?: SeoAlternate[] | null;
  openGraph?: Dict | null;
  twitter?: Dict | null;
  jsonLd?: string | null;
  /** The LCP image: preloaded so the browser starts it before CSS/JS. */
  preloadImage?: SiteImage | null;
}

/** Marker on every tag this service owns, so a client-side navigation can
 *  remove the previous page's tags before adding the new ones. */
const MARK = 'data-site-head';

/**
 * Everything a crawler reads from `<head>`, written during the server render
 * (the DOM here is the server document) and rewritten on every client-side
 * navigation. All tags are created by this service only — never by
 * `Meta.addTag` elsewhere — which is what guarantees no duplicates.
 */
@Injectable({ providedIn: 'root' })
export class SeoHeadService {
  private document = inject(DOCUMENT);
  private title = inject(Title);
  private renderer: Renderer2 = inject(RendererFactory2).createRenderer(null, null);

  apply(input: HeadInput): void {
    const html = this.document.documentElement;
    html.setAttribute('lang', input.locale);
    html.setAttribute('dir', input.dir ?? (input.locale === 'ar' ? 'rtl' : 'ltr'));

    this.title.setTitle(input.title);
    this.clear();

    this.meta('name', 'description', input.description);
    this.meta('name', 'robots', input.robots);
    if (input.canonical) this.link({ rel: 'canonical', href: input.canonical });
    for (const alt of input.alternates ?? []) {
      if (alt?.href && alt.hreflang) this.link({ rel: 'alternate', hreflang: alt.hreflang, href: alt.href });
    }

    const og = input.openGraph ?? {};
    for (const [key, value] of Object.entries(og)) {
      if (key === 'image') {
        this.ogImage('og', value);
      } else if (key === 'alternate_locales' && Array.isArray(value)) {
        value.forEach(v => this.meta('property', 'og:locale:alternate', v));
      } else if (value !== null && value !== undefined && typeof value !== 'object') {
        this.meta('property', `og:${key}`, String(value));
      }
    }
    const tw = input.twitter ?? {};
    for (const [key, value] of Object.entries(tw)) {
      if (key === 'image') this.ogImage('twitter', value);
      else if (value !== null && value !== undefined && typeof value !== 'object') {
        this.meta('name', `twitter:${key}`, String(value));
      }
    }

    if (input.preloadImage?.url) {
      const attrs: Record<string, string> = {
        rel: 'preload',
        as: 'image',
        href: input.preloadImage.url,
        fetchpriority: 'high'
      };
      if (input.preloadImage.srcset) {
        attrs['imagesrcset'] = input.preloadImage.srcset;
        attrs['imagesizes'] = '100vw';
      }
      this.link(attrs);
    }

    if (input.jsonLd) {
      const script = this.renderer.createElement('script');
      this.renderer.setAttribute(script, 'type', 'application/ld+json');
      this.renderer.setAttribute(script, MARK, '');
      // `</script` inside a JSON string would end the element early; `<\/` is
      // the same JSON value, so the data stays byte-for-byte equivalent.
      script.textContent = input.jsonLd.replace(/<\/(script)/gi, '<\\/$1');
      this.renderer.appendChild(this.document.head, script);
    }
  }

  clear(): void {
    this.document.head.querySelectorAll(`[${MARK}]`).forEach(el => el.remove());
  }

  private ogImage(prefix: 'og' | 'twitter', value: unknown): void {
    if (!value) return;
    if (typeof value === 'string') {
      this.meta(prefix === 'og' ? 'property' : 'name', `${prefix}:image`, value);
      return;
    }
    const v = value as Dict;
    const attr = prefix === 'og' ? 'property' : 'name';
    this.meta(attr, `${prefix}:image`, v['url']);
    if (prefix === 'og') {
      if (v['width']) this.meta(attr, 'og:image:width', String(v['width']));
      if (v['height']) this.meta(attr, 'og:image:height', String(v['height']));
    }
    if (v['alt']) this.meta(attr, `${prefix}:image:alt`, v['alt']);
  }

  private meta(attr: 'name' | 'property', key: string, content: string | null | undefined): void {
    if (!content) return;
    const el = this.renderer.createElement('meta');
    this.renderer.setAttribute(el, attr, key);
    this.renderer.setAttribute(el, 'content', content);
    this.renderer.setAttribute(el, MARK, '');
    this.renderer.appendChild(this.document.head, el);
  }

  private link(attrs: Record<string, string>): void {
    const el = this.renderer.createElement('link');
    for (const [k, v] of Object.entries(attrs)) this.renderer.setAttribute(el, k, v);
    this.renderer.setAttribute(el, MARK, '');
    this.renderer.appendChild(this.document.head, el);
  }
}
