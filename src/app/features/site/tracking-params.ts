/**
 * The query parameters that identify where a visitor came from.
 *
 * Deliberately dependency-free: the Node server imports this too, and must not
 * pull Angular into its startup path.
 *
 * Two rules depend on this list:
 *
 * - The language switcher carries them across `/en` ↔ `/ar`. Dropping an ad
 *   click id mid-visit is what the measurement spec forbids: before the
 *   visitor answers the consent banner nothing has stored it yet, so once it
 *   leaves the URL the click is unattributable.
 * - The server captures the first set it sees and keeps it for the visit, so
 *   a lead saved three pages later still knows which campaign paid for it.
 */
export const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid'] as const;

export const UTM_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content'
] as const;

export const ATTRIBUTION_PARAMS: readonly string[] = [...UTM_PARAMS, ...CLICK_ID_PARAMS];

/**
 * The attribution parameters present in `search`, as a `?…` string ready to
 * append, or `''`. Order follows `ATTRIBUTION_PARAMS` so the same visit always
 * produces the same URL.
 */
export function attributionQuery(search: string): string {
  const from = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of ATTRIBUTION_PARAMS) {
    const value = from.get(key);
    if (value) kept.set(key, value);
  }
  const qs = kept.toString();
  return qs ? `?${qs}` : '';
}

/**
 * `href` with this visit's attribution parameters added. Anything already on
 * `href` wins: the alternate URL is built by the API and its own parameters
 * are part of which page it is, not where the visitor came from.
 */
export function withAttribution(href: string, search: string): string {
  const extra = new URLSearchParams(attributionQuery(search));
  if (![...extra.keys()].length) return href;

  const [base, fragment = ''] = href.split('#');
  const [path, existing = ''] = base.split('?');
  const merged = new URLSearchParams(existing);
  for (const [key, value] of extra) {
    if (!merged.has(key)) merged.set(key, value);
  }
  const qs = merged.toString();
  return `${path}${qs ? `?${qs}` : ''}${fragment ? `#${fragment}` : ''}`;
}
