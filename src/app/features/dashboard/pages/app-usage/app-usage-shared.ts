/**
 * Formatting shared by the App usage screens and the App card on the user
 * activity page.
 */

/** "3 days ago" / "منذ 3 أيام", from the timestamp, in the screen language. */
export function timeAgo(iso: string | null | undefined, lang: string, now = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  const sec = Math.round((t - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(sec / (86400 * 30)), 'month');
  return rtf.format(Math.round(sec / (86400 * 365)), 'year');
}

/** The colour dot beside a platform / store label. */
export function platformClass(platform: string | null | undefined): string {
  return ['android', 'ios', 'windows'].includes(platform ?? '') ? `pf-${platform}` : 'pf-unknown';
}

/** `1.5.0 (18)`, or whichever half is known, or ''. */
export function versionText(version: string | null | undefined, build: number | null | undefined): string {
  const v = (version ?? '').trim();
  const b = build === null || build === undefined ? '' : `(${build})`;
  return [v, b].filter(Boolean).join(' ');
}

/** Share of a whole as a whole percentage, or null when the whole is 0. */
export function pct(part: number | null | undefined, whole: number | null | undefined): number | null {
  if (!whole) return null;
  return Math.round(((part ?? 0) / whole) * 100);
}
