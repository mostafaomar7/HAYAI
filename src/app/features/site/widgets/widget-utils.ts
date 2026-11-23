import { ChangeDetectionStrategy, Component, Directive, ElementRef, PLATFORM_ID, computed, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Dict } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';

/** A filter select that applies itself (the form's submit button is the no-JS path). */
export function submitOnChange(event: Event): void {
  const form = (event.target as HTMLSelectElement | HTMLInputElement | null)?.form;
  if (!form) return;
  if (typeof form.requestSubmit === 'function') form.requestSubmit();
  else form.submit();
}

/**
 * A GET filter form. Without JavaScript it submits natively (the server
 * renders the filtered page); once hydrated it navigates in the app instead,
 * dropping empty fields so URLs stay `?area=maadi`, not `?q=&area=maadi`.
 */
@Directive({
  selector: 'form[siteGetForm]',
  host: { '(submit)': 'onSubmit($event)' }
})
export class GetFormDirective {
  private router = inject(Router);
  private el = inject<ElementRef<HTMLFormElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected onSubmit(event: Event): void {
    if (!this.isBrowser) return;
    const form = this.el.nativeElement;
    const action = form.getAttribute('action') || location.pathname;
    let url: URL;
    try {
      url = new URL(action, location.href);
    } catch {
      return;
    }
    if (url.host !== location.host) return;
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(form).forEach((v, k) => {
      if (typeof v === 'string' && v.trim()) params.append(k, v.trim());
    });
    const qs = params.toString();
    this.router.navigateByUrl(url.pathname + (qs ? `?${qs}` : '') + url.hash);
  }
}

/** `?a=1&b=2` for a link, with `changes` applied (null/'' removes a key). */
export function withQuery(base: string, query: Record<string, string>, changes: Record<string, string | null>, hash = ''): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) p.set(k, v);
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === '') p.delete(k);
    else p.set(k, v);
  }
  // A new filter starts from the first page.
  if (!('page' in changes)) p.delete('page');
  const qs = p.toString();
  return base + (qs ? `?${qs}` : '') + hash;
}

/** `meta.pagination` (or a flat meta) of a listing response. */
export function pagination(meta: Dict | null | undefined): { page: number; last: number; total: number | null } {
  const p = meta?.['pagination'] ?? meta ?? {};
  const t = p['total'];
  return {
    page: Number(p['current_page']) || 1,
    last: Number(p['last_page']) || 1,
    total: t === undefined || t === null ? null : Number(t)
  };
}

/**
 * Numbered pager of real `<a href>` links (crawlable, works without JS),
 * from the API's `meta.pagination`. `#anchor` brings the reader back to the list.
 */
@Component({
  selector: 'site-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (p().last > 1) {
      <nav [attr.aria-label]="state.t('pagination')">
        <ul class="pager">
          @if (p().page > 1) {
            <li><a [attr.href]="href(p().page - 1)" rel="prev">{{ state.t('previous') }}</a></li>
          }
          @for (n of pages(); track n) {
            <li>
              @if (n === p().page) {
                <span aria-current="page">{{ n }}</span>
              } @else {
                <a [attr.href]="href(n)" [attr.aria-label]="state.t('pageN', n)">{{ n }}</a>
              }
            </li>
          }
          @if (p().page < p().last) {
            <li><a [attr.href]="href(p().page + 1)" rel="next">{{ state.t('next') }}</a></li>
          }
        </ul>
      </nav>
    }
  `
})
export class PagerComponent {
  readonly meta = input<Dict | null | undefined>(null);
  readonly base = input('');
  readonly query = input<Record<string, string>>({});
  readonly hash = input('');
  protected state = inject(SiteStateService);
  protected p = computed(() => pagination(this.meta()));
  protected pages = computed(() => {
    const out: number[] = [];
    const { page, last } = this.p();
    for (let i = Math.max(1, page - 3); i <= Math.min(last, page + 3); i++) out.push(i);
    return out;
  });

  protected href(n: number): string {
    return withQuery(this.base(), this.query(), { page: n > 1 ? String(n) : null }, this.hash());
  }
}

/** The current page's path (encoded) for form actions and pager links. */
export function pagePath(locale: string, path: string | undefined | null): string {
  const p = path || '/';
  const withLocale = p.startsWith(`/${locale}/`) || p === `/${locale}` ? p : `/${locale}${p === '/' ? '' : p}`;
  try {
    return encodeURI(decodeURI(withLocale));
  } catch {
    return withLocale;
  }
}
