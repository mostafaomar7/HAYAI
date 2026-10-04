import { PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRouteSnapshot, RedirectCommand, ResolveFn, Router, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SiteApiService } from './services/site-api.service';
import { SiteStateService } from './services/site-state.service';
import { DEFAULT_SITE_LOCALE, SiteLocale, isSiteLocale } from './site-paths';
import { Dict, ResolveResult, ResolvedView, SiteData } from './models/site.models';
import { cleanQueryString, str } from './site-utils';

declare const ngDevMode: unknown;

/** Locale of the current URL: the `:locale` segment, or `?locale=` on /preview. */
export function localeOf(route: ActivatedRouteSnapshot): SiteLocale {
  for (const r of route.pathFromRoot) {
    const p = r.paramMap.get('locale');
    if (isSiteLocale(p)) return p;
  }
  const q = route.queryParamMap.get('locale');
  return isSiteLocale(q) ? q : DEFAULT_SITE_LOCALE;
}

/** Shell data: menus, organisation, sitewide CTAs (cached ~60 s on the server). */
export const siteDataResolver: ResolveFn<SiteData | null> = async route => {
  const state = inject(SiteStateService);
  const locale = localeOf(route);
  state.locale.set(locale);
  const site = await firstValueFrom(inject(SiteApiService).site(locale));
  state.site.set(site);
  return site;
};

/**
 * Sets the HTTP status (and Location) of the server response. `RESPONSE_INIT`
 * only exists while rendering on the server; in the browser this is a no-op.
 * A real 404 / 301 matters: a "soft 404" (a not-found page served with 200)
 * gets indexed, and a JavaScript redirect is not a redirect to a crawler.
 */
function setServerResponse(init: ResponseInit | null, status: number, headers: Record<string, string> = {}): void {
  if (!init) return;
  init.status = status;
  const h = init.headers;
  if (h instanceof Headers) {
    for (const [k, v] of Object.entries(headers)) h.set(k, v);
  } else {
    init.headers = { ...((h as Record<string, string>) ?? {}), ...headers };
  }
}

/** Which listing endpoint backs a `kind: listing` result. */
const LISTING_ENDPOINTS: Record<string, string> = {
  products: 'products',
  articles: 'articles',
  blog: 'articles',
  search: 'search',
  doctors: 'doctors',
  hospitals: 'hospitals'
};

/**
 * The query to fetch a listing with.
 *
 * A path facet — `/en/doctors/critical-care` — is `?specialty=critical-care`
 * to the listing endpoint, and resolve is the only thing that knows which
 * parameter the segment is. It says so in `data.query`, an object that is
 * `{}` when the path carries no facet. We merge it over the URL's own query,
 * and it wins on a clash, because the path facet is what the canonical is
 * built from: `?specialty=x` on `/doctors/y` must not quietly serve x under
 * y's canonical.
 */
function listingQuery(result: ResolveResult, qs: string): string {
  const facets = (result.data as Dict | null)?.['query'];
  if (!facets || typeof facets !== 'object' || Array.isArray(facets)) return qs;
  const params = new URLSearchParams(qs);
  for (const [k, v] of Object.entries(facets as Dict)) {
    if (v !== null && v !== undefined) params.set(k, String(v));
  }
  return params.toString();
}

/**
 * The catch-all page resolver: ONE `resolve` call per URL tells us what the
 * path is (page / product / author / listing / redirect / not found), and a
 * listing additionally fetches its items — all before the server serialises
 * the HTML, so the first response is complete.
 */
export const siteViewResolver: ResolveFn<ResolvedView | RedirectCommand> = async (route, routerState) => {
  const api = inject(SiteApiService);
  const router = inject(Router);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // Injected before the first `await`: inject() only works synchronously.
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  const locale = localeOf(route);
  const { path, qs } = splitUrl(router, routerState, locale);

  let result: ResolveResult;
  if (typeof ngDevMode !== 'undefined' && ngDevMode && path === '/__fixture') {
    // DEV-ONLY render check of every block type (`ng build -c development`).
    // `ngDevMode` is the constant `false` in production builds, so the
    // optimiser drops this branch and the fixture chunk is never emitted.
    const { pageFixture } = await import('./dev/page-fixture');
    result = { kind: 'page', status: 200, data: pageFixture(locale), redirect: null };
  } else {
    result = await firstValueFrom(api.resolve(locale, path, qs));
  }
  const view: ResolvedView = { locale, path, qs, result, listing: null };

  switch (result.kind) {
    case 'redirect': {
      const location = str(result.redirect?.location, result.redirect?.url);
      const status = Number(result.status || result.redirect?.status || result.redirect?.status_code) || 301;
      if (!location) break;
      if (!isBrowser) {
        // A real HTTP redirect from the server (the body is a fallback link).
        setServerResponse(responseInit, status, { Location: location, 'Cache-Control': 'public, max-age=300' });
        return view;
      }
      const internal = internalPath(location);
      if (internal) return new RedirectCommand(router.parseUrl(internal), { replaceUrl: true });
      location.startsWith('http') && window.location.replace(location);
      return view;
    }
    case 'not_found':
      setServerResponse(responseInit, 404);
      break;
    case 'error':
      // 503 tells crawlers "come back later" instead of dropping the URL.
      setServerResponse(responseInit, 503, { 'Retry-After': '120' });
      break;
    case 'listing': {
      const listingName = str(result.data?.listing);
      const endpoint = LISTING_ENDPOINTS[listingName];
      if (endpoint) {
        const query = listingQuery(result, qs);
        const res = await firstValueFrom(api.listing(locale, endpoint, query));
        if (!res) {
          setServerResponse(responseInit, 503, { 'Retry-After': '120' });
          view.result = { ...result, kind: 'error', status: 503 };
          break;
        }
        const data = res.data;
        view.listing = {
          kind: listingName,
          items: data,
          meta: res.meta ?? null,
          seo: res.meta?.['seo'] ?? data?.seo ?? null,
          query: parseQuery(query)
        };
      } else {
        view.listing = { kind: listingName, items: [], meta: null, seo: null, query: parseQuery(qs) };
      }
      break;
    }
    default:
      if (result.status && result.status !== 200) setServerResponse(responseInit, result.status);
  }
  return view;
};

/** `/preview?token=&locale=` — the dashboard's shareable draft link. */
export const previewResolver: ResolveFn<ResolvedView> = async route => {
  const locale = localeOf(route);
  const token = route.queryParamMap.get('token') ?? '';
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  const api = inject(SiteApiService);
  // Drafts must never be stored by a CDN or shared cache.
  setServerResponse(responseInit, 200, { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  const page = token ? await firstValueFrom(api.preview(token, locale)) : null;
  if (!page) {
    setServerResponse(responseInit, 404, { 'Cache-Control': 'no-store' });
    return { locale, path: '/preview', qs: '', result: { kind: 'not_found', status: 404, data: { preview: true }, redirect: null } };
  }
  return { locale, path: '/preview', qs: '', result: { kind: 'page', status: 200, data: { ...page, is_preview: true }, redirect: null } };
};

/** Path after the locale (decoded — Arabic slugs arrive percent-encoded) and
 *  the raw query string minus tracking parameters. */
function splitUrl(router: Router, state: RouterStateSnapshot, locale: SiteLocale): { path: string; qs: string } {
  const tree = router.parseUrl(state.url);
  const segments = tree.root.children['primary']?.segments.map(s => s.path) ?? [];
  const rest = segments[0] === locale ? segments.slice(1) : segments;
  const raw = state.url.split('#')[0];
  const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  return { path: '/' + rest.join('/'), qs: cleanQueryString(q) };
}

function parseQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URLSearchParams(qs).forEach((v, k) => (out[k] = v));
  return out;
}

/** Site-relative path for a redirect target on this site, else null. */
function internalPath(location: string): string | null {
  if (location.startsWith('/') && !location.startsWith('//')) return location;
  try {
    const u = new URL(location);
    const sameHost = typeof window !== 'undefined' && u.host === window.location.host;
    if (sameHost || /(^|\.)hayai\.app$/i.test(u.host)) return u.pathname + u.search + u.hash;
  } catch {}
  return null;
}
