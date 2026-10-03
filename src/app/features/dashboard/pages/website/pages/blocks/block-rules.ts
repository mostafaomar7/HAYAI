import { BlockDefinition, BlockField, Locale, PageSection } from '../../../../../../core/services/website/website.models';
import { wordCount } from '../../shared/website-utils';

/**
 * Pure helpers for the page builder: defaults, summaries, sanitising and the
 * client-side copy of the API's block rules (§3). The backend re-validates
 * everything; these exist so an admin sees the problem on the field while
 * typing instead of after a round trip.
 */

/** `sections.{i}.data` — the prefix every 422 key for one block's data starts with. */
export function dataPath(index: number): string {
  return `sections.${index}.data`;
}

/** Same rule as the API: lowercase, starts with a letter, then letters / digits / `-` / `_`. */
export const ANCHOR_RE = /^[a-z][a-z0-9_-]*$/;

/**
 * Link targets a block may use (§3 `url`): absolute https, a localized site
 * path (`/en/…`, `/ar/…`), an in-page `#anchor`, `mailto:` or `tel:`.
 */
const URL_RES = [
  /^https:\/\/[^\s/$.?#][^\s]*$/i,
  /^\/(en|ar)(\/[^\s]*)?$/,
  /^#[a-z][a-z0-9_-]*$/,
  /^mailto:[^\s@]+@[^\s@]+$/i,
  /^tel:\+?[0-9][0-9 ()-]{3,}$/i
];

export function isValidUrl(value: string): boolean {
  return URL_RES.some(re => re.test(value.trim()));
}

/** The answer of a `direct_answer` block must not lean on context the reader lacks. */
const VAGUE_STARTS = ['it', 'this', 'these', 'that', 'those', 'they', 'هذا', 'هذه', 'هؤلاء', 'ذلك', 'تلك', 'إنه', 'إنها', 'انه', 'انها'];

export function startsVague(text: string): boolean {
  const first = text.replace(/<[^>]*>/g, ' ').trim().split(/\s+/)[0]?.replace(/[^\p{L}]/gu, '').toLowerCase() ?? '';
  return !!first && VAGUE_STARTS.includes(first);
}

export const DIRECT_ANSWER_MIN = 40;
export const DIRECT_ANSWER_MAX = 60;

/** Value of an empty field of `type`, used for new blocks and new list items. */
export function emptyValue(field: BlockField): unknown {
  if (field.default !== undefined) return JSON.parse(JSON.stringify(field.default));
  switch (field.type) {
    case 'list':
    case 'string_list':
    case 'products':
    case 'faqs':
    case 'pages':
    case 'cells':
    case 'matrix':
      return [];
    case 'boolean':
      return false;
    case 'text':
    case 'textarea':
    case 'html':
    case 'url':
      return '';
    default:
      return null;
  }
}

export function emptyData(fields: BlockField[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of fields) data[f.key] = emptyValue(f);
  return data;
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.replace(/<[^>]*>/g, '').trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if ('cta_id' in o) return !o['cta_id'];
    return Object.values(o).every(v => isEmpty(v));
  }
  return false;
}

/** Keys tried, in order, for the one-line summary in a collapsed block header. */
const SUMMARY_KEYS = ['headline', 'heading', 'title', 'question', 'caption', 'label', 'eyebrow', 'name', 'quote', 'answer', 'text', 'body', 'content'];

export function summaryOf(data: Record<string, unknown> | null | undefined): string {
  if (!data) return '';
  for (const k of SUMMARY_KEYS) {
    const v = data[k];
    if (typeof v === 'string') {
      const plain = v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (plain) return plain.length > 90 ? plain.slice(0, 88) + '…' : plain;
    }
  }
  return '';
}

/**
 * Field visibility rules that depend on sibling values. `pricing` shows live
 * tiers from a product OR a manual `tiers[]` list, never both — so the manual
 * editor only appears while no product is chosen.
 */
export function isFieldVisible(blockType: string, field: BlockField, data: Record<string, unknown>): boolean {
  if (blockType === 'pricing' && field.key === 'tiers') return !data['product_id'];
  return true;
}

/** The columns a `cells` field must match: the parent block's `columns`. */
export function columnLabels(root: Record<string, unknown> | null | undefined, key = 'columns'): string[] {
  const cols = root?.[key];
  if (!Array.isArray(cols)) return [];
  return cols.map((c, i) => {
    if (typeof c === 'string') return c;
    if (c && typeof c === 'object') {
      const o = c as Record<string, unknown>;
      return String(o['label'] ?? o['title'] ?? o['name'] ?? o['heading'] ?? `#${i + 1}`);
    }
    return `#${i + 1}`;
  });
}

// ───────────────────────────── HTML sanitising ─────────────────────────────

/** Removed with their content: never meaningful inside a rich-text block. */
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'LINK', 'META', 'NOSCRIPT', 'SVG', 'MATH', 'TEMPLATE', 'FRAME', 'FRAMESET']);

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'A', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION', 'BLOCKQUOTE', 'CODE', 'PRE',
  'HR', 'SUB', 'SUP', 'SPAN', 'SMALL', 'MARK'
]);

const ALLOWED_ATTRS: Record<string, string[]> = {
  A: ['href', 'target', 'rel', 'title'],
  TH: ['colspan', 'rowspan', 'scope'],
  TD: ['colspan', 'rowspan'],
  OL: ['start'],
  '*': ['dir', 'lang']
};

/**
 * Client-side clean-up of rich text. The page owns the only `<h1>` (the hero),
 * so headings are capped at `<h2>`; scripts, iframes and event handlers are
 * dropped. The API sanitises again — this keeps what the admin sees in the
 * editor equal to what will be stored.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  cleanChildren(tpl.content);
  return tpl.innerHTML.replace(/(<p>(<br>)?<\/p>\s*)+$/i, '').trim();
}

function cleanChildren(parent: ParentNode): void {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.remove();
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    let el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (DROP_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    if (tag === 'H1') el = renameTag(el, 'h2');
    else if (tag === 'H5' || tag === 'H6') el = renameTag(el, 'h4');
    else if (tag === 'DIV') el = renameTag(el, 'p');
    cleanChildren(el);
    const finalTag = el.tagName.toUpperCase();
    if (!ALLOWED_TAGS.has(finalTag)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    const allowed = [...(ALLOWED_ATTRS[finalTag] ?? []), ...ALLOWED_ATTRS['*']];
    for (const attr of Array.from(el.attributes)) {
      if (!allowed.includes(attr.name.toLowerCase())) el.removeAttribute(attr.name);
    }
    if (finalTag === 'A') {
      const href = (el.getAttribute('href') ?? '').trim();
      if (/^\s*(javascript|data|vbscript):/i.test(href)) el.removeAttribute('href');
      if (el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

function renameTag(el: Element, tag: string): Element {
  const next = document.createElement(tag);
  for (const attr of Array.from(el.attributes)) next.setAttribute(attr.name, attr.value);
  next.append(...Array.from(el.childNodes));
  el.replaceWith(next);
  return next;
}

// ───────────────────────────── validation ─────────────────────────────

/**
 * Client copy of the API's block rules. Returns errors keyed exactly like a
 * 422 (`sections.{i}.data.{field}`, `sections.{i}.data.items.{j}.{field}`) so
 * one display path serves both. Values are i18n keys (or `key|{json params}`).
 */
export function validateSections(
  sections: PageSection[],
  catalogue: Map<string, BlockDefinition>,
  locale: Locale
): Record<string, string> {
  const errors: Record<string, string> = {};
  const anchors = new Map<string, number>();
  let h1Count = 0;

  sections.forEach((s, i) => {
    const def = catalogue.get(s.type);
    const data = s.data ?? {};
    const base = dataPath(i);

    const anchor = (s.anchor ?? '').trim();
    if (anchor) {
      if (!ANCHOR_RE.test(anchor)) errors[`sections.${i}.anchor`] = 'web.blocks.err.anchor_format';
      else if (anchors.has(anchor)) errors[`sections.${i}.anchor`] = 'web.blocks.err.anchor_duplicate';
      else anchors.set(anchor, i);
    }

    if (s.type === 'hero' && data['is_h1'] === true) {
      h1Count++;
      if (h1Count > 1) errors[`${base}.is_h1`] = 'web.blocks.err.one_h1';
    }

    if (!def) return;
    validateFields(def.fields, data, base, s.type, data, errors);

    if (s.type === 'direct_answer' && typeof data['answer'] === 'string' && data['answer'].trim()) {
      const n = wordCount(data['answer']);
      if (n < DIRECT_ANSWER_MIN || n > DIRECT_ANSWER_MAX) errors[`${base}.answer`] = 'web.blocks.err.answer_words';
      else if (startsVague(data['answer'])) errors[`${base}.answer`] = locale === 'ar' ? 'web.blocks.err.answer_vague_ar' : 'web.blocks.err.answer_vague';
    }

    if (s.type === 'comparison_table' && Array.isArray(data['rows'])) {
      const cols = columnLabels(data).length;
      (data['rows'] as Record<string, unknown>[]).forEach((row, j) => {
        const cells = row?.['cells'];
        if (Array.isArray(cells) && cells.length !== cols) errors[`${base}.rows.${j}.cells`] = 'web.blocks.err.cells_count';
      });
    }

    if (s.type === 'pricing' && !data['product_id'] && def.fields.some(f => f.key === 'tiers') && isEmpty(data['tiers'])) {
      errors[`${base}.tiers`] = 'web.blocks.err.pricing_source';
    }
  });

  return errors;
}

function validateFields(
  fields: BlockField[],
  data: Record<string, unknown>,
  path: string,
  blockType: string,
  root: Record<string, unknown>,
  errors: Record<string, string>
): void {
  for (const f of fields) {
    if (!isFieldVisible(blockType, f, root)) continue;
    const key = `${path}.${f.key}`;
    const v = data?.[f.key];
    if (f.required && isEmpty(v)) {
      errors[key] = 'common.required';
      continue;
    }
    if (isEmpty(v)) continue;
    if ((f.type === 'text' || f.type === 'textarea') && typeof v === 'string' && f.max && v.length > f.max) {
      errors[key] = 'web.blocks.err.too_long';
    }
    if (f.type === 'url' && typeof v === 'string' && !isValidUrl(v)) errors[key] = 'web.blocks.err.url';
    if (f.type === 'cta' && v && typeof v === 'object' && !('cta_id' in (v as object))) {
      const c = v as Record<string, unknown>;
      if (isEmpty(c['label'])) errors[`${key}.label`] = 'common.required';
      if (isEmpty(c['url'])) errors[`${key}.url`] = 'common.required';
      else if (!isValidUrl(String(c['url']))) errors[`${key}.url`] = 'web.blocks.err.url';
    }
    if ((f.type === 'integer' || f.type === 'number') && typeof v === 'number') {
      if (f.min !== undefined && v < f.min) errors[key] = 'web.blocks.err.min';
      if (f.max !== undefined && v > f.max) errors[key] = 'web.blocks.err.max';
    }
    if (f.type === 'list' && Array.isArray(v)) {
      if (f.max && v.length > f.max) errors[key] = 'web.blocks.err.too_many';
      v.forEach((item, j) => validateFields(f.item_fields ?? [], (item ?? {}) as Record<string, unknown>, `${key}.${j}`, blockType, root, errors));
    }
    if ((f.type === 'string_list' || f.type === 'products' || f.type === 'faqs' || f.type === 'pages') && Array.isArray(v) && f.max && v.length > f.max) {
      errors[key] = 'web.blocks.err.too_many';
    }
  }
}
