import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { WebsiteApiService } from '../../../../../../core/services/website/website-api.service';
import {
  Locale, WebsiteAuthor, WebsiteCategory, WebsiteCta, WebsiteFaq, WebsiteForm, WebsitePageRow, WebsiteProduct
} from '../../../../../../core/services/website/website.models';
import { pickLocalized } from '../../shared/website-utils';

/** Everything a reference field can point at. */
export type RefKind = 'product' | 'faq' | 'form' | 'page' | 'category' | 'author' | 'cta';

/** One choosable entity, already labelled for the current languages. */
export interface RefOption {
  value: number | string;
  label: string;
  sub?: string;
}

/** Lists fetched in one go; anything beyond this is found by search (pages only). */
const PER_PAGE = 100;

/**
 * Cached lookups behind the block editor's pickers.
 *
 * Provided by `PageBlocks` itself, so every field of every block shares one
 * fetch per list while the editor is open, and a fresh editor visit sees CTAs
 * or FAQs created in the meantime. Pages are the exception: there can be many,
 * so they are searched (`pages({q})`) and titles of already-chosen ids are
 * resolved one by one and remembered.
 */
@Injectable()
export class BlockLookups {
  private api = inject(WebsiteApiService);
  private i18n = inject(I18nService);

  private cache = new Map<string, Observable<RefOption[]>>();
  private pageTitles = new Map<number, string>();
  private pageFetches = new Map<number, Observable<string>>();
  /** Raw CTA rows, for the inline preview next to a library CTA. */
  private ctaRows = new Map<number, WebsiteCta>();

  private get uiLang(): Locale {
    return this.i18n.lang() === 'ar' ? 'ar' : 'en';
  }

  /** Static list for `kind` (all kinds except `page`). FAQs are per content language. */
  options(kind: Exclude<RefKind, 'page'>, locale: Locale): Observable<RefOption[]> {
    const key = kind === 'faq' ? `faq:${locale}` : kind;
    let list$ = this.cache.get(key);
    if (!list$) {
      list$ = this.fetch(kind, locale).pipe(
        catchError(() => {
          // Let the next field retry instead of caching a failure for the visit.
          this.cache.delete(key);
          return of([] as RefOption[]);
        }),
        shareReplay(1)
      );
      this.cache.set(key, list$);
    }
    return list$;
  }

  cta(id: number): WebsiteCta | undefined {
    return this.ctaRows.get(id);
  }

  searchPages(q: string): Observable<RefOption[]> {
    return this.api.pages({ q: q || undefined, per_page: 20, sort: 'updated' }).pipe(
      map(res => res.items.map(p => this.pageOption(p))),
      catchError(() => of([] as RefOption[]))
    );
  }

  /** Title of a page id chosen earlier (falls back to `#id` until resolved). */
  pageTitle(id: number): Observable<string> {
    const known = this.pageTitles.get(id);
    if (known) return of(known);
    let req = this.pageFetches.get(id);
    if (!req) {
      req = this.api.page(id).pipe(
        map(p => this.pageOption(p).label),
        catchError(() => of(`#${id}`)),
        tap(label => this.pageTitles.set(id, label)),
        shareReplay(1)
      );
      this.pageFetches.set(id, req);
    }
    return req;
  }

  private pageOption(p: WebsitePageRow): RefOption {
    const label = pickLocalized(p.translations, 'title', this.uiLang) || `#${p.id}`;
    this.pageTitles.set(p.id, label);
    const path = pickLocalized(p.translations, 'path', this.uiLang);
    return { value: p.id, label, sub: [p.type, path].filter(Boolean).join(' · ') };
  }

  private fetch(kind: Exclude<RefKind, 'page'>, locale: Locale): Observable<RefOption[]> {
    const lang = this.uiLang;
    switch (kind) {
      case 'product':
        return this.api.products({ per_page: PER_PAGE }).pipe(map(r => r.items.map((p: WebsiteProduct) => ({
          value: p.id,
          label: pickLocalized(p.translations as any, 'name' as any, lang) || p.sku || `#${p.id}`,
          sub: [p.sku, p.status_label ?? p.status].filter(Boolean).join(' · ')
        }))));
      case 'faq':
        return this.api.faqs({ locale, per_page: PER_PAGE }).pipe(map(r => r.items.map((f: WebsiteFaq) => ({
          value: f.id,
          label: f.question,
          sub: [f.group_key, f.is_global ? this.i18n.translate('web.blocks.faq_global') : null].filter(Boolean).join(' · ')
        }))));
      case 'form':
        // Blocks reference forms by KEY (stable across environments), not id.
        return this.api.forms({ per_page: PER_PAGE }).pipe(map(r => r.items.map((f: WebsiteForm) => ({
          value: f.key,
          label: (lang === 'ar' ? f.name_ar : null) || f.name || f.name_en || f.key,
          sub: f.key
        }))));
      case 'category':
        return this.api.categories({ per_page: PER_PAGE }).pipe(map(r => r.items.map((c: WebsiteCategory) => ({
          value: c.id,
          label: (lang === 'ar' ? c.name_ar : null) || c.name || c.name_en,
          sub: c.kind
        }))));
      case 'author':
        return this.api.authors({ per_page: PER_PAGE }).pipe(map(r => r.items.map((a: WebsiteAuthor) => ({
          value: a.id,
          label: (lang === 'ar' ? a.name_ar : null) || a.name || a.name_en,
          sub: (lang === 'ar' ? a.job_title_ar : a.job_title_en) || undefined
        }))));
      case 'cta':
        return this.api.ctas({ per_page: PER_PAGE }).pipe(map(r => r.items.map((c: WebsiteCta) => {
          this.ctaRows.set(c.id, c);
          return {
            value: c.id,
            label: (locale === 'ar' ? c.label_ar : null) || c.label_en || c.key,
            sub: [c.key, c.type_label ?? c.type, c.is_enabled ? null : this.i18n.translate('web.blocks.cta_disabled')].filter(Boolean).join(' · ')
          };
        })));
    }
  }
}
