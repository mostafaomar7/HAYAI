import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { BlockField as FieldDef, Locale } from '../../../../../../core/services/website/website.models';
import { MediaPicker } from '../../shared/media-picker';
import { wordCount } from '../../shared/website-utils';
import {
  DIRECT_ANSWER_MAX, DIRECT_ANSWER_MIN, columnLabels, emptyData, isValidUrl, startsVague, summaryOf
} from './block-rules';
import { BlockLookups, RefKind } from './block-lookups.service';
import { HtmlEditor } from './html-editor';
import { RefPicker } from './ref-picker';

/** Field types this editor knows; anything else falls back to a JSON textarea. */
const KNOWN = new Set([
  'text', 'textarea', 'html', 'url', 'media', 'cta', 'select', 'integer', 'number', 'boolean',
  'product', 'products', 'faqs', 'form', 'page', 'pages', 'category', 'author',
  'string_list', 'cells', 'matrix', 'list'
]);

/** Reference field type → picker kind and whether it holds a list. */
const REFS: Record<string, { kind: RefKind; multiple: boolean }> = {
  product: { kind: 'product', multiple: false },
  products: { kind: 'product', multiple: true },
  faqs: { kind: 'faq', multiple: true },
  form: { kind: 'form', multiple: false },
  page: { kind: 'page', multiple: false },
  pages: { kind: 'page', multiple: true },
  category: { kind: 'category', multiple: false },
  author: { kind: 'author', multiple: false }
};

/** Field types that need the whole row of the form grid. */
const WIDE = new Set(['textarea', 'html', 'list', 'matrix', 'cells', 'string_list', 'cta', 'products', 'faqs', 'pages', 'media', 'json']);

const CTA_STYLES = ['primary', 'secondary', 'outline', 'link'];
const CTA_TARGETS = ['_self', '_blank'];

/** A comparison-table cell: free text, a tick, a cross, or nothing. */
type CellMode = 'text' | 'yes' | 'no' | 'empty';

let uid = 0;

/**
 * One block field, built from the catalogue definition (`GET /blocks`), never
 * from a per-block form. `list` fields render their `item_fields` with this
 * same component, so nesting is unlimited.
 *
 * `path` is the field's 422 key (`sections.2.data.items.0.title`): errors from
 * the API and from the client rules use the same keys and land on the same
 * input. Content inputs take their direction from the content `locale`, not
 * from the dashboard language — an English admin can edit the Arabic page.
 */
@Component({
  selector: 'app-block-field',
  standalone: true,
  imports: [CommonModule, TPipe, MediaPicker, RefPicker, HtmlEditor],
  templateUrl: './block-field.html',
  styleUrls: ['./block-field.css'],
  host: { '[class.wide]': 'wide()' }
})
export class BlockField {
  private i18n = inject(I18nService);
  private lookups = inject(BlockLookups);

  field = input.required<FieldDef>();
  value = input<unknown>(null);
  locale = input.required<Locale>();
  path = input.required<string>();
  errors = input<Record<string, string>>({});
  /** The whole block's data — `cells` / `matrix` read their columns from it. */
  root = input<Record<string, unknown>>({});
  blockType = input('');
  disabled = input(false);

  valueChange = output<unknown>();

  readonly ctaStyles = CTA_STYLES;
  readonly ctaTargets = CTA_TARGETS;
  readonly id = `bf-${++uid}`;

  /** Local message for input the API would reject (bad URL, invalid JSON). */
  localError = signal<string | null>(null);

  kind = computed(() => {
    const t = this.field().type;
    return KNOWN.has(t) ? t : 'json';
  });
  ref = computed(() => REFS[this.field().type] ?? null);
  refKind = computed<RefKind>(() => this.ref()?.kind ?? 'page');
  wide = computed(() => WIDE.has(this.kind()));
  dir = computed<'ltr' | 'rtl'>(() => (this.locale() === 'ar' ? 'rtl' : 'ltr'));

  label = computed(() => fieldLabel(this.field(), this.i18n));
  help = computed(() => {
    const f = this.field();
    if (typeof f.help === 'string' && f.help) return f.help;
    const key = `web.blocks.help.${f.key}`;
    const t = this.i18n.translate(key);
    return t === key ? '' : t;
  });

  error = computed(() => this.errors()[this.path()] ?? this.localError());

  str = computed(() => (typeof this.value() === 'string' ? (this.value() as string) : this.value() == null ? '' : String(this.value())));
  arr = computed<unknown[]>(() => (Array.isArray(this.value()) ? (this.value() as unknown[]) : []));
  obj = computed<Record<string, unknown>>(() => {
    const v = this.value();
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  });

  // ── direct answer ──────────────────────────────────────────────
  isAnswer = computed(() => this.blockType() === 'direct_answer' && this.field().key === 'answer');
  words = computed(() => wordCount(this.str()));
  wordsOk = computed(() => this.words() >= DIRECT_ANSWER_MIN && this.words() <= DIRECT_ANSWER_MAX);
  vague = computed(() => startsVague(this.str()));
  readonly wordMin = DIRECT_ANSWER_MIN;
  readonly wordMax = DIRECT_ANSWER_MAX;

  // ── select ─────────────────────────────────────────────────────
  selectOptions = computed(() => {
    const raw = (this.field().options ?? []) as unknown[];
    return raw.map(o => {
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>;
        return { value: String(r['value'] ?? ''), label: String(r['label'] ?? r['value'] ?? '') };
      }
      const v = String(o);
      const key = `web.blocks.option.${v}`;
      const t = this.i18n.translate(key);
      return { value: v, label: t === key ? humanize(v) : t };
    });
  });

  // ── cta ────────────────────────────────────────────────────────
  ctaMode = computed<'library' | 'inline' | 'none'>(() => {
    const v = this.value();
    if (!v || typeof v !== 'object') return 'none';
    return 'cta_id' in (v as object) ? 'library' : 'inline';
  });

  // ── cells / matrix ─────────────────────────────────────────────
  columns = computed(() => columnLabels(this.root()));
  /** `table` takes its columns from `headers`; a free matrix sizes itself. */
  headerCols = computed(() => {
    const h = this.root()?.['headers'];
    return Array.isArray(h) ? columnLabels(this.root(), 'headers') : null;
  });
  matrixRows = computed<string[][]>(() =>
    this.arr().map(r => (Array.isArray(r) ? r.map(c => (c == null ? '' : String(c))) : []))
  );
  matrixCols = computed(() => {
    const fixed = this.headerCols();
    if (fixed) return fixed.length;
    return Math.max(1, ...this.matrixRows().map(r => r.length));
  });

  // ── list ───────────────────────────────────────────────────────
  itemFields = computed(() => this.field().item_fields ?? []);
  itemSummary(item: unknown, index: number): string {
    return summaryOf(item as Record<string, unknown>) || `#${index + 1}`;
  }

  emit(value: unknown): void {
    this.valueChange.emit(value);
  }

  // ── scalar inputs ──────────────────────────────────────────────

  onText(event: Event): void {
    this.emit((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  onUrl(event: Event): void {
    const v = (event.target as HTMLInputElement).value.trim();
    this.localError.set(v && !isValidUrl(v) ? 'web.blocks.err.url' : null);
    this.emit(v);
  }

  onNumber(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    if (raw === '') return this.emit(null);
    const n = Number(raw);
    this.emit(this.kind() === 'integer' ? Math.trunc(n) : n);
  }

  onBool(event: Event): void {
    this.emit((event.target as HTMLInputElement).checked);
  }

  onSelect(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    this.emit(v === '' ? null : v);
  }

  // ── cta ────────────────────────────────────────────────────────

  setCtaMode(mode: 'library' | 'inline' | 'none'): void {
    if (mode === this.ctaMode()) return;
    if (mode === 'none') this.emit(null);
    else if (mode === 'library') this.emit({ cta_id: null });
    else this.emit({ label: '', url: '', style: 'primary', target: '_self', tracking_key: '' });
  }

  setCta(key: string, value: unknown): void {
    this.emit({ ...this.obj(), [key]: value });
  }

  ctaPreview(): string {
    const id = Number(this.obj()['cta_id']);
    const c = id ? this.lookups.cta(id) : undefined;
    if (!c) return '';
    return [c.url, c.phone, c.placement].filter(Boolean).join(' · ');
  }

  ctaErr(key: string): string | null {
    return this.errors()[`${this.path()}.${key}`] ?? this.errors()[`${this.path()}.cta_id`] ?? null;
  }

  // ── string list ────────────────────────────────────────────────

  setLine(i: number, value: string): void {
    const list = this.arr().map(v => (v == null ? '' : String(v)));
    list[i] = value;
    this.emit(list);
  }

  addLine(): void {
    this.emit([...this.arr(), '']);
  }

  // ── shared list ops (string_list, list, matrix rows) ───────────

  removeAt(i: number): void {
    this.emit(this.arr().filter((_, j) => j !== i));
  }

  moveAt(i: number, delta: number): void {
    const list = [...this.arr()];
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.emit(list);
  }

  // ── list of groups ─────────────────────────────────────────────

  addItem(): void {
    this.emit([...this.arr(), emptyData(this.itemFields())]);
  }

  duplicateItem(i: number): void {
    const list = [...this.arr()];
    list.splice(i + 1, 0, JSON.parse(JSON.stringify(list[i] ?? {})));
    this.emit(list);
  }

  setItem(i: number, key: string, value: unknown): void {
    const list = [...this.arr()];
    list[i] = { ...((list[i] ?? {}) as Record<string, unknown>), [key]: value };
    this.emit(list);
  }

  itemValue(item: unknown, key: string): unknown {
    return item && typeof item === 'object' ? (item as Record<string, unknown>)[key] : null;
  }

  canAddItem(): boolean {
    const max = this.field().max;
    return !max || this.arr().length < max;
  }

  /** True when an error sits on this list item or anything inside it. */
  itemHasError(i: number): boolean {
    const prefix = `${this.path()}.${i}`;
    return Object.keys(this.errors()).some(k => k === prefix || k.startsWith(prefix + '.'));
  }

  // ── comparison-table cells ─────────────────────────────────────

  cellMode(i: number): CellMode {
    const v = this.arr()[i];
    if (v === true) return 'yes';
    if (v === false) return 'no';
    if (v === null || v === undefined || v === '') return 'empty';
    return 'text';
  }

  cellText(i: number): string {
    const v = this.arr()[i];
    return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
  }

  /** Always emits exactly one cell per column — the API rejects a ragged row. */
  setCell(i: number, value: unknown): void {
    const n = this.columns().length;
    const cells = Array.from({ length: n }, (_, j) => (j < this.arr().length ? this.arr()[j] : null));
    cells[i] = value;
    this.emit(cells);
  }

  setCellMode(i: number, mode: CellMode): void {
    this.setCell(i, mode === 'yes' ? true : mode === 'no' ? false : mode === 'empty' ? null : this.cellText(i) || '');
  }

  cellsMismatch = computed(() => this.arr().length > 0 && this.arr().length !== this.columns().length);

  // ── matrix ─────────────────────────────────────────────────────

  private normalized(rows: string[][], cols: number): string[][] {
    return rows.map(r => Array.from({ length: cols }, (_, j) => r[j] ?? ''));
  }

  setMatrix(r: number, c: number, value: string): void {
    const rows = this.normalized(this.matrixRows(), this.matrixCols());
    rows[r][c] = value;
    this.emit(rows);
  }

  addRow(): void {
    this.emit([...this.normalized(this.matrixRows(), this.matrixCols()), Array(this.matrixCols()).fill('')]);
  }

  addColumn(): void {
    this.emit(this.normalized(this.matrixRows(), this.matrixCols()).map(r => [...r, '']));
  }

  removeColumn(c: number): void {
    this.emit(this.normalized(this.matrixRows(), this.matrixCols()).map(r => r.filter((_, j) => j !== c)));
  }

  colIndexes = computed(() => Array.from({ length: this.matrixCols() }, (_, i) => i));

  // ── unknown type ───────────────────────────────────────────────

  json = computed(() => (this.value() === null || this.value() === undefined ? '' : JSON.stringify(this.value(), null, 2)));

  onJson(event: Event): void {
    const raw = (event.target as HTMLTextAreaElement).value.trim();
    if (!raw) {
      this.localError.set(null);
      return this.emit(null);
    }
    try {
      this.emit(JSON.parse(raw));
      this.localError.set(null);
    } catch {
      this.localError.set('web.blocks.err.json');
    }
  }

  errorAt(suffix: string): string | null {
    return this.errors()[`${this.path()}.${suffix}`] ?? null;
  }

  trackIndex(i: number): number {
    return i;
  }
}

/** Catalogue label → our translation → the key made readable. */
export function fieldLabel(f: FieldDef, i18n: I18nService): string {
  const key = `web.blocks.field.${f.key}`;
  const t = i18n.translate(key);
  // The catalogue is English; in the Arabic dashboard our translation reads better.
  if (i18n.lang() === 'ar' && t !== key) return t;
  if (typeof f.label === 'string' && f.label) return f.label;
  return t !== key ? t : humanize(f.key);
}

export function humanize(key: string): string {
  const s = key.replace(/_id(s)?$/, '').replace(/[_-]+/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : key;
}
