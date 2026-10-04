import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { Locale, WebsitePageRow } from '../../../../../../core/services/website/website.models';

/**
 * Helpers shared by the page list, the create form and the page editor tabs.
 */

export type PageKind = 'pages' | 'articles';

/** Route segment for a row: articles open under `/articles`, everything else under `/pages`. */
export function kindOf(type: WebsitePageRow['type'] | string | null | undefined): PageKind {
  return type === 'article' ? 'articles' : 'pages';
}

/** `under_review` → `Under review`: last-resort text when neither the API nor i18n has a label. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const s = value.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Display text for an enum value: the API's own `*_label` (already in the
 * request language), then our `web.enum.<group>.<value>` key, then the
 * humanized raw value so a value the backend adds later still reads sensibly.
 */
export function enumLabel(i18n: I18nService, group: string, value: string | null | undefined, apiLabel?: unknown): string {
  if (typeof apiLabel === 'string' && apiLabel) return apiLabel;
  if (!value) return '—';
  const key = `web.enum.${group}.${value}`;
  const text = i18n.translate(key);
  return text === key ? humanize(value) : text;
}

/**
 * The slug rule from the contract: lowercase latin letters, digits, hyphens or
 * Arabic letters. Arabic has no case, so the whole Arabic block is allowed and
 * the backend stays the judge of anything exotic inside it.
 */
export const SLUG_PATTERN = /^[a-z0-9؀-ۿ]+(?:-[a-z0-9؀-ۿ]+)*$/;

/**
 * What the backend will make from a title when the slug is left empty — shown
 * as the URL preview so the editor sees the address before it is created.
 * An approximation: the server's own slugger is authoritative.
 */
export function slugify(title: string | null | undefined): string {
  return (title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '') // latin accents, Arabic diacritics
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9؀-ۿ-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** `hospitals/partner-with-hayai` → `hospitals`; a top-level path → ''. */
export function parentPathOf(path: string | null | undefined): string {
  const p = (path ?? '').replace(/^\/+|\/+$/g, '');
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

/** `/{locale}/{parent path}/{slug}` — the public URL shape (§1.4). */
export function urlPreview(locale: Locale, parentPath: string, slug: string): string {
  return '/' + [locale, parentPath, slug].map(s => (s ?? '').replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
}

/** Reserved first segment, only meaningful for a top-level page. */
export function reservedSegment(slug: string, parentPath: string, reserved: string[] | null | undefined): string | null {
  if (parentPath) return null;
  const s = (slug ?? '').toLowerCase();
  return (reserved ?? []).find(r => r.toLowerCase() === s) ?? null;
}

/** Body HTML may not carry its own H1 — the page title is the only one. */
export function hasH1(html: string | null | undefined): boolean {
  return /<h1[\s>/]/i.test(html ?? '');
}

export type EditorTab = 'content' | 'blocks' | 'seo' | 'geo' | 'relations' | 'audit' | 'versions' | 'preview';

export interface PublishBlocker {
  key: string;
  /** i18n key of the friendly explanation. */
  text: string;
  locale: Locale | null;
  /** The backend's own wording, kept because it is the precise reason. */
  messages: string[];
  /** Where the editor can go to fix it. */
  tab: EditorTab | null;
}

/**
 * Turns `publish_errors` (`{ "translations.en.geo.direct_answer": [...] }`)
 * into friendly rows that say what is wrong and which tab fixes it.
 */
export function publishBlockers(errors: Record<string, string[] | string> | null | undefined): PublishBlocker[] {
  return Object.entries(errors ?? {}).map(([key, raw]) => {
    const messages = Array.isArray(raw) ? raw : [String(raw)];
    const m = /^translations\.(en|ar)(?:\.(.*))?$/.exec(key);
    const locale = (m?.[1] as Locale | undefined) ?? null;
    const rest = m ? m[2] ?? '' : key;
    const joined = (rest + ' ' + messages.join(' ')).toLowerCase();

    let text = 'web.pages.blocker.other';
    let tab: EditorTab | null = null;
    if (/geo|direct_answer/.test(rest)) { text = 'web.pages.blocker.direct_answer'; tab = 'geo'; }
    else if (/h1/.test(joined)) { text = 'web.pages.blocker.h1'; tab = 'blocks'; }
    else if (/^sections/.test(rest)) { text = 'web.pages.blocker.sections'; tab = 'blocks'; }
    else if (/^title/.test(rest)) { text = 'web.pages.blocker.title'; tab = 'content'; }
    else if (/^(slug|path|url)/.test(rest)) { text = 'web.pages.blocker.url'; tab = 'content'; }
    else if (/^seo/.test(rest)) { text = 'web.pages.blocker.seo'; tab = 'seo'; }
    else if (/^author/.test(rest)) { text = 'web.pages.blocker.author'; tab = 'content'; }
    else if (/^parent/.test(rest)) { text = 'web.pages.blocker.parent'; tab = 'content'; }
    else if (/^translations$/.test(key) || /^locale/.test(rest)) { text = 'web.pages.blocker.translations'; tab = 'content'; }
    else if (m) { tab = 'content'; }
    return { key, text, locale, messages, tab };
  });
}
