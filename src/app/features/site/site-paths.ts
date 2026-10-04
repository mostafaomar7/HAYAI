/**
 * Which URLs belong to the public, server-rendered website (as opposed to the
 * admin dashboard SPA that shares this Angular app).
 *
 * Kept dependency-free on purpose: the root `App` component, the router and
 * `server.ts` all need the same answer, and none of them should pull the site
 * feature into the dashboard's initial bundle just to ask the question.
 */
export const SITE_LOCALES = ['en', 'ar'] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];
export const DEFAULT_SITE_LOCALE: SiteLocale = 'en';

export function isSiteLocale(value: unknown): value is SiteLocale {
  return value === 'en' || value === 'ar';
}

/** `/en`, `/ar/...` and the shareable `/preview?token=` link. */
export function isPublicSitePath(pathname: string): boolean {
  return /^\/(en|ar)(\/|$|\?|#)/.test(pathname) || /^\/preview(\/|$|\?)/.test(pathname);
}

/** Path where guests track a purchase request. `requests` is a prefix the CMS
 *  reserves (no editor page can ever claim it) and robots.txt already
 *  disallows it for every crawler — exactly right for a tokenised page. */
export const TRACK_ORDER_SEGMENTS = ['requests', 'track'] as const;
export function trackOrderPath(locale: SiteLocale): string {
  return `/${locale}/${TRACK_ORDER_SEGMENTS.join('/')}`;
}
