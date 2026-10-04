import { Dict, SiteCta, SiteImage } from './models/site.models';

/** First argument that is a non-empty array / string / object. */
export function arr<T = any>(...candidates: unknown[]): T[] {
  for (const c of candidates) if (Array.isArray(c) && c.length) return c as T[];
  return [];
}

export function str(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
    if (typeof c === 'number') return String(c);
  }
  return '';
}

/**
 * Resolved media (`{url,width,height,alt,srcset,variants}`) from whichever key
 * the API used for it. The block catalogue names fields by their editor id
 * (`image_media_id`, `media_id`, `poster_media_id`) and the public payload
 * resolves them to objects; we accept every reasonable spelling so a renamed
 * key degrades to "no image" instead of a crash.
 */
export function img(d: Dict | null | undefined, ...keys: string[]): SiteImage | null {
  if (!d) return null;
  for (const k of keys) {
    const v = d[k];
    if (v && typeof v === 'object' && typeof v.url === 'string' && v.url) return v as SiteImage;
    if (typeof v === 'string' && /^(https?:)?\/\//.test(v)) return { url: v };
  }
  return null;
}

/** Best href for a menu item / breadcrumb / list item: the site-relative path
 *  when the API gives one (keeps navigation on this host in any environment),
 *  else the absolute URL. */
export function hrefOf(item: Dict | null | undefined): string {
  if (!item) return '#';
  const p = str(item['path']);
  if (p) return p.startsWith('/') ? p : `/${p}`;
  return str(item['url'], item['href'], item['live_url']) || '#';
}

/** CTAs for one placement. The API sends them either grouped by placement
 *  (`{ sticky_mobile: [...] }`) or as a flat list carrying `placement`. */
export function ctasFor(ctas: unknown, placement: string): SiteCta[] {
  if (!ctas) return [];
  if (Array.isArray(ctas)) return ctas.filter((c: SiteCta) => c?.placement === placement);
  if (typeof ctas === 'object') {
    const list = (ctas as Record<string, SiteCta[]>)[placement];
    return Array.isArray(list) ? list : [];
  }
  return [];
}

/**
 * Human price text: a product's `pricing.display` or a tier's `display`, pre-formatted by the API in the page
 * language ("EGP 4,500 per month") and already respects `is_price_public` —
 * so it is the only thing printed; we never format a raw `price` ourselves,
 * because a private price must not leak into the HTML.
 */
export function priceText(x: Dict | null | undefined): string {
  if (!x) return '';
  return str(x['pricing']?.display, x['display']);
}

/**
 * Money the API sends only as a decimal string (purchase totals, line totals,
 * `compare_at_price`), formatted like its own `display` strings: "EGP 12,000",
 * decimals only when there are any. Prices that come with `display` use that.
 */
export function money(amount: string | number | null | undefined, currency: string | null | undefined, locale: string): string {
  if (amount === null || amount === undefined || amount === '') return '';
  const n = Number(amount);
  if (isNaN(n)) return '';
  const num = n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 });
  return currency ? `${currency} ${num}` : num;
}

export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || /^(mailto|tel|sms):/i.test(href);
}

export function uuid(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // RFC4122-ish fallback for older browsers; only used as an idempotency key.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * The page's JSON-LD. `schema_script` is printed exactly as the API built it —
 * it normally already carries the MedicalOrganization + WebSite nodes. Only if
 * those are missing do we merge the sitewide ones from `/site.schema`, so a
 * crawler always gets one coherent `@graph` and never two copies of the
 * organisation.
 */
export function buildJsonLd(schemaScript: string | null | undefined, siteSchema: Dict[] | null | undefined): string | null {
  const site = Array.isArray(siteSchema) ? siteSchema : [];
  if (!schemaScript) {
    if (!site.length) return null;
    return JSON.stringify({ '@context': 'https://schema.org', '@graph': site.map(stripContext) });
  }
  let parsed: any;
  try {
    parsed = JSON.parse(schemaScript);
  } catch {
    return schemaScript; // Not ours to fix; print as-is.
  }
  const graph: Dict[] = Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : Array.isArray(parsed) ? parsed : [parsed];
  const types = new Set<string>();
  const ids = new Set<string>();
  for (const node of graph) {
    const t = node?.['@type'];
    (Array.isArray(t) ? t : [t]).forEach((x: string) => x && types.add(x));
    if (node?.['@id']) ids.add(node['@id']);
  }
  const hasOrg = ['Organization', 'MedicalOrganization'].some(t => types.has(t));
  const hasSite = types.has('WebSite');
  const missing = site.filter(node => {
    if (node?.['@id'] && ids.has(node['@id'])) return false;
    const t = node?.['@type'];
    if (t === 'WebSite') return !hasSite;
    if (t === 'Organization' || t === 'MedicalOrganization') return !hasOrg;
    return false;
  });
  if (!missing.length) return schemaScript;
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [...missing.map(stripContext), ...graph.map(stripContext)] });
}

function stripContext(node: Dict): Dict {
  if (!node || typeof node !== 'object') return node;
  const { ['@context']: _ctx, ...rest } = node;
  return rest;
}

/** Tracking parameters are not part of a page's identity: sending them to the
 *  resolver would make it treat `?utm_source=x` as a filtered URL. */
const TRACKING_PARAMS = /^(utm_[a-z]+|gclid|fbclid|msclkid|ttclid|_ga)$/i;
export function cleanQueryString(qs: string): string {
  if (!qs) return '';
  return qs
    .split('&')
    .filter(part => part && !TRACKING_PARAMS.test(safeDecode(part.split('=')[0] || '')))
    .join('&');
}

export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}
