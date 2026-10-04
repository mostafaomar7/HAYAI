import {
  Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, input, output, signal, untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, forkJoin } from 'rxjs';
import { TPipe } from '../../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../../core/services/website/website-context.service';
import {
  BlockDefinition, BlockField as FieldDef, Locale, PageSection, SectionSettings
} from '../../../../../../core/services/website/website.models';
import { clone } from '../../shared/website-utils';
import { BlockField, fieldLabel, humanize } from './block-field';
import { BlockLookups } from './block-lookups.service';
import { ANCHOR_RE, emptyData, isFieldVisible, summaryOf, validateSections } from './block-rules';

/** One block in the working copy; `uid` is local only (new blocks have no id yet). */
interface WorkingBlock {
  uid: number;
  section: PageSection;
  open: boolean;
}

const THEMES: NonNullable<SectionSettings['theme']>[] = ['default', 'light', 'dark', 'brand', 'muted'];
const SPACINGS: NonNullable<SectionSettings['spacing']>[] = ['none', 'compact', 'normal', 'spacious'];
const HIDE_ON: ('mobile' | 'desktop')[] = ['mobile', 'desktop'];

let nextUid = 0;

/**
 * Page builder (§2.6 / §3): the ordered list of content blocks of one page
 * translation, edited on a local working copy and saved in one go with the
 * "replace the whole list" endpoint — array order is display order, so moving
 * a block is just moving it in the array.
 *
 * Every field editor is generated from the block catalogue (`GET /blocks`), so
 * a new block type is a backend-only change. Embedded by the page editor,
 * which owns the locale switch and asks before switching away while
 * `dirtyChange` says there are unsaved edits.
 */
@Component({
  selector: 'app-page-blocks',
  standalone: true,
  imports: [CommonModule, TPipe, BlockField],
  providers: [BlockLookups],
  templateUrl: './page-blocks.html',
  styleUrls: ['../../shared/website.shared.css', './page-blocks.css']
})
export class PageBlocks {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private destroyRef = inject(DestroyRef);

  pageId = input.required<number>();
  locale = input.required<Locale>();
  readonly = input(false);

  saved = output<PageSection[]>();
  dirtyChange = output<boolean>();

  readonly themes = THEMES;
  readonly spacings = SPACINGS;
  readonly hideOn = HIDE_ON;

  catalogue = signal<BlockDefinition[]>([]);
  blocks = signal<WorkingBlock[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  saving = signal(false);
  dirty = signal(false);
  errors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);
  /** Last block the admin worked on — "Add block" inserts after it. */
  selectedUid = signal<number | null>(null);
  advancedOpen = signal<Set<number>>(new Set());

  // block picker
  pickerOpen = signal(false);
  pickerQuery = signal('');
  /** Index to insert at; null = after the selected block, else at the end. */
  private insertAt: number | null = null;

  // drag & drop
  dragUid = signal<number | null>(null);
  dropIndex = signal<number | null>(null);
  armedUid = signal<number | null>(null);

  private loadSub?: Subscription;

  locked = computed(() => this.readonly() || !this.ctx.can('cms.update'));
  dir = computed<'ltr' | 'rtl'>(() => (this.locale() === 'ar' ? 'rtl' : 'ltr'));
  byType = computed(() => new Map(this.catalogue().map(d => [d.type, d])));

  /** Picker groups: catalogue order kept, filtered by the search box. */
  groups = computed(() => {
    const q = this.pickerQuery().trim().toLowerCase();
    const out = new Map<string, BlockDefinition[]>();
    for (const d of this.catalogue()) {
      const hay = `${d.type} ${d.label} ${d.description} ${this.blockLabel(d.type)}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const list = out.get(d.category) ?? [];
      list.push(d);
      out.set(d.category, list);
    }
    return [...out.entries()].map(([category, items]) => ({ category, items }));
  });

  errorCount = computed(() => Object.keys(this.errors()).length);

  constructor() {
    // Reload whenever the page or content language changes. Asking about
    // unsaved edits first is the parent's job (it listens to `dirtyChange`).
    effect(() => {
      const id = this.pageId();
      const locale = this.locale();
      untracked(() => this.load(id, locale));
    });
  }

  /** Browsers show their own generic text; returning a value is what triggers it. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.dirty()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  // ── loading ─────────────────────────────────────────────────────

  load(id = this.pageId(), locale = this.locale()): void {
    this.loadSub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.errors.set({});
    this.formError.set(null);
    this.loadSub = forkJoin({ defs: this.ctx.blocks(), sections: this.api.sections(id, locale) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ defs, sections }) => {
          this.catalogue.set(defs ?? []);
          this.reset(sections ?? []);
          this.loading.set(false);
        },
        error: err => {
          this.loadError.set(errorMessage(err, 'web.blocks.load_failed'));
          this.loading.set(false);
        }
      });
  }

  private reset(sections: PageSection[]): void {
    const sorted = [...sections].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    this.blocks.set(sorted.map(s => ({ uid: ++nextUid, section: normalize(s), open: false })));
    this.selectedUid.set(null);
    this.advancedOpen.set(new Set());
    this.setDirty(false);
  }

  private setDirty(value: boolean): void {
    if (this.dirty() === value) return;
    this.dirty.set(value);
    this.dirtyChange.emit(value);
  }

  // ── labels ──────────────────────────────────────────────────────

  /** Catalogue label, or our translation in the Arabic dashboard (the catalogue is English). */
  blockLabel(type: string): string {
    const key = `web.blocks.type.${type}`;
    const t = this.i18n.translate(key);
    const fromApi = this.byType().get(type)?.label;
    if (this.i18n.lang() === 'ar' && t !== key) return t;
    return fromApi || (t !== key ? t : humanize(type));
  }

  blockDescription(d: BlockDefinition): string {
    const key = `web.blocks.desc.${d.type}`;
    const t = this.i18n.translate(key);
    if (this.i18n.lang() === 'ar' && t !== key) return t;
    return d.description || (t !== key ? t : '');
  }

  categoryLabel(category: string): string {
    const key = `web.blocks.category.${category}`;
    const t = this.i18n.translate(key);
    return t === key ? humanize(category) : t;
  }

  summary(b: WorkingBlock): string {
    return summaryOf(b.section.data);
  }

  fieldsOf(b: WorkingBlock): FieldDef[] {
    const def = this.byType().get(b.section.type);
    if (!def) return [];
    return def.fields.filter(f => isFieldVisible(b.section.type, f, b.section.data ?? {}));
  }

  isUnknownType(b: WorkingBlock): boolean {
    return !this.loading() && !this.byType().has(b.section.type);
  }

  /** The pricing block takes live tiers from a product or a manual list — say which. */
  pricingFromProduct(b: WorkingBlock): boolean {
    return b.section.type === 'pricing' && !!b.section.data?.['product_id'];
  }

  // ── editing ─────────────────────────────────────────────────────

  private patch(uid: number, fn: (s: PageSection) => PageSection): void {
    this.blocks.update(list => list.map(b => (b.uid === uid ? { ...b, section: fn(b.section) } : b)));
    this.setDirty(true);
  }

  setField(b: WorkingBlock, key: string, value: unknown): void {
    this.selectedUid.set(b.uid);
    // Only one hero per language may carry the page's <h1>: ticking one
    // unticks the others, and the admin is told why their other hero changed.
    if (b.section.type === 'hero' && key === 'is_h1' && value === true) {
      const others = this.blocks().filter(o => o.uid !== b.uid && o.section.type === 'hero' && o.section.data?.['is_h1'] === true);
      if (others.length) {
        this.blocks.update(list => list.map(o =>
          others.some(x => x.uid === o.uid) ? { ...o, section: { ...o.section, data: { ...o.section.data, is_h1: false } } } : o
        ));
        this.dialog.toast('info', 'web.blocks.h1_moved');
      }
    }
    this.patch(b.uid, s => ({ ...s, data: { ...s.data, [key]: value } }));
    this.clearError(this.indexOf(b), `data.${key}`);
  }

  setEnabled(b: WorkingBlock, enabled: boolean): void {
    this.patch(b.uid, s => ({ ...s, is_enabled: enabled }));
  }

  setAnchor(b: WorkingBlock, raw: string): void {
    const anchor = raw.trim();
    this.patch(b.uid, s => ({ ...s, anchor: anchor || null }));
    const i = this.indexOf(b);
    const key = `sections.${i}.anchor`;
    this.errors.update(e => {
      const next = { ...e };
      if (anchor && !ANCHOR_RE.test(anchor)) next[key] = 'web.blocks.err.anchor_format';
      else delete next[key];
      return next;
    });
  }

  setSetting<K extends keyof SectionSettings>(b: WorkingBlock, key: K, value: SectionSettings[K]): void {
    this.patch(b.uid, s => ({ ...s, settings: { ...(s.settings ?? {}), [key]: value } }));
  }

  toggleHideOn(b: WorkingBlock, device: 'mobile' | 'desktop', on: boolean): void {
    const cur = b.section.settings?.hide_on ?? [];
    const next = on ? [...new Set([...cur, device])] : cur.filter(d => d !== device);
    this.setSetting(b, 'hide_on', next);
  }

  hidden(b: WorkingBlock, device: 'mobile' | 'desktop'): boolean {
    return (b.section.settings?.hide_on ?? []).includes(device);
  }

  toggleOpen(b: WorkingBlock): void {
    this.selectedUid.set(b.uid);
    this.blocks.update(list => list.map(x => (x.uid === b.uid ? { ...x, open: !x.open } : x)));
  }

  setAllOpen(open: boolean): void {
    this.blocks.update(list => list.map(x => ({ ...x, open })));
  }

  toggleAdvanced(b: WorkingBlock): void {
    this.advancedOpen.update(s => {
      const next = new Set(s);
      next.has(b.uid) ? next.delete(b.uid) : next.add(b.uid);
      return next;
    });
  }

  indexOf(b: WorkingBlock): number {
    return this.blocks().findIndex(x => x.uid === b.uid);
  }

  move(b: WorkingBlock, delta: number): void {
    const i = this.indexOf(b);
    this.moveTo(i, i + delta);
    this.focusCard(b.uid);
  }

  private moveTo(from: number, to: number): void {
    const list = [...this.blocks()];
    if (from < 0 || to < 0 || to >= list.length || from === to) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    this.blocks.set(list);
    // Error keys are positional; they no longer point at the right block.
    this.errors.set({});
    this.setDirty(true);
  }

  duplicate(b: WorkingBlock): void {
    const copy = clone(b.section);
    delete copy.id;
    // Anchors must be unique on the page, and only one hero may be the <h1>.
    copy.anchor = null;
    if (copy.type === 'hero' && copy.data?.['is_h1']) copy.data['is_h1'] = false;
    const i = this.indexOf(b);
    const item: WorkingBlock = { uid: ++nextUid, section: copy, open: true };
    this.blocks.update(list => [...list.slice(0, i + 1), item, ...list.slice(i + 1)]);
    this.errors.set({});
    this.selectedUid.set(item.uid);
    this.setDirty(true);
    this.focusCard(item.uid);
  }

  async remove(b: WorkingBlock): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.blocks.delete_title',
      text: 'web.blocks.delete_text',
      params: { name: this.blockLabel(b.section.type) },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.blocks.update(list => list.filter(x => x.uid !== b.uid));
    this.errors.set({});
    if (this.selectedUid() === b.uid) this.selectedUid.set(null);
    this.setDirty(true);
  }

  async discard(): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.blocks.discard_title',
      text: 'web.blocks.discard_text',
      confirmText: 'web.blocks.discard',
      danger: true
    });
    if (ok) this.load();
  }

  // ── block picker ────────────────────────────────────────────────

  openPicker(afterIndex: number | null = null): void {
    this.insertAt = afterIndex;
    this.pickerQuery.set('');
    this.pickerOpen.set(true);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('.picker-search')?.focus());
  }

  closePicker(): void {
    this.pickerOpen.set(false);
  }

  addBlock(def: BlockDefinition): void {
    const list = this.blocks();
    let at = list.length;
    if (this.insertAt !== null) at = this.insertAt + 1;
    else if (this.selectedUid() !== null) {
      const i = list.findIndex(b => b.uid === this.selectedUid());
      if (i >= 0) at = i + 1;
    }
    const data = emptyData(def.fields);
    // A new hero must not steal the <h1> from an existing one.
    if (def.type === 'hero' && data['is_h1'] === true && list.some(b => b.section.type === 'hero' && b.section.data?.['is_h1'])) {
      data['is_h1'] = false;
    }
    const item: WorkingBlock = {
      uid: ++nextUid,
      section: { type: def.type, data, anchor: null, settings: {}, is_enabled: true },
      open: true
    };
    this.blocks.update(l => [...l.slice(0, at), item, ...l.slice(at)]);
    this.errors.set({});
    this.selectedUid.set(item.uid);
    this.setDirty(true);
    this.closePicker();
    this.focusCard(item.uid);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pickerOpen()) this.closePicker();
  }

  // ── drag & drop (native HTML5; buttons remain the keyboard path) ──

  /** Only the handle arms dragging, so text inside inputs stays selectable. */
  arm(b: WorkingBlock): void {
    if (!this.locked()) this.armedUid.set(b.uid);
  }

  disarm(): void {
    if (this.dragUid() === null) this.armedUid.set(null);
  }

  onDragStart(event: DragEvent, b: WorkingBlock): void {
    if (this.armedUid() !== b.uid) {
      event.preventDefault();
      return;
    }
    this.dragUid.set(b.uid);
    event.dataTransfer?.setData('text/plain', String(b.uid));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(event: DragEvent, index: number): void {
    if (this.dragUid() === null) return;
    event.preventDefault();
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    this.dropIndex.set(event.clientY < rect.top + rect.height / 2 ? index : index + 1);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const uid = this.dragUid();
    const target = this.dropIndex();
    if (uid !== null && target !== null) {
      const from = this.blocks().findIndex(b => b.uid === uid);
      const to = target > from ? target - 1 : target;
      this.moveTo(from, to);
    }
    this.onDragEnd();
  }

  onDragEnd(): void {
    this.dragUid.set(null);
    this.dropIndex.set(null);
    this.armedUid.set(null);
  }

  // ── errors ──────────────────────────────────────────────────────

  blockErrorCount(index: number): number {
    const prefix = `sections.${index}.`;
    return Object.keys(this.errors()).filter(k => k.startsWith(prefix)).length;
  }

  errorAt(index: number, suffix: string): string | null {
    return this.errors()[`sections.${index}.${suffix}`] ?? null;
  }

  /**
   * Errors for this block that no visible input will show (a field hidden by
   * a rule, a type-level message, an unknown key) — listed on the card so
   * nothing the API rejected is invisible.
   */
  orphanErrors(b: WorkingBlock, index: number): string[] {
    const prefix = `sections.${index}.`;
    const shown = new Set(this.fieldsOf(b).map(f => f.key));
    const out: string[] = [];
    for (const [k, msg] of Object.entries(this.errors())) {
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      if (rest === 'anchor' || rest.startsWith('settings')) continue;
      if (rest.startsWith('data.') && shown.has(rest.slice(5).split('.')[0])) continue;
      out.push(msg);
    }
    return out;
  }

  private clearError(index: number, suffix: string): void {
    const key = `sections.${index}.${suffix}`;
    if (!this.errors()[key]) return;
    this.errors.update(e => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  /** Opens the first block with an error (and its Advanced area if needed) and scrolls to it. */
  private revealFirstError(): void {
    const keys = Object.keys(this.errors());
    const indexes = keys.map(k => /^sections\.(\d+)\./.exec(k)?.[1]).filter((x): x is string => !!x).map(Number);
    if (!indexes.length) return;
    const first = Math.min(...indexes);
    const block = this.blocks()[first];
    if (!block) return;
    const needsAdvanced = keys.some(k => k === `sections.${first}.anchor` || k.startsWith(`sections.${first}.settings`));
    this.blocks.update(list => list.map((b, i) => (i === first ? { ...b, open: true } : b)));
    if (needsAdvanced) this.advancedOpen.update(s => new Set(s).add(block.uid));
    setTimeout(() => {
      const card = this.host.nativeElement.querySelector<HTMLElement>(`#blk-${block.uid}`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const bad = card?.querySelector<HTMLElement>('[aria-invalid="true"], .has-error input, .has-error textarea, .has-error select');
      bad?.focus({ preventScroll: true });
    }, 60);
  }

  // ── save ────────────────────────────────────────────────────────

  /**
   * The body for "save whole list". Array order is display order, so no
   * sort_order is sent. `id` is kept for existing blocks so the backend can
   * update rather than recreate them; new blocks go without one.
   */
  private payload(): PageSection[] {
    return this.blocks().map(({ section: s }) => {
      const settings: SectionSettings = {};
      if (s.settings?.hide_on?.length) settings.hide_on = s.settings.hide_on;
      if (s.settings?.theme && s.settings.theme !== 'default') settings.theme = s.settings.theme;
      if (s.settings?.spacing && s.settings.spacing !== 'normal') settings.spacing = s.settings.spacing;
      const out: PageSection = {
        type: s.type,
        data: s.data ?? {},
        anchor: s.anchor?.trim() || null,
        settings,
        is_enabled: s.is_enabled !== false
      };
      if (s.id) out.id = s.id;
      return out;
    });
  }

  save(): void {
    if (this.locked() || this.saving()) return;
    const sections = this.payload();
    const local = validateSections(sections, this.byType(), this.locale());
    this.errors.set(local);
    this.formError.set(null);
    if (Object.keys(local).length) {
      this.formError.set('web.blocks.fix_errors');
      this.revealFirstError();
      return;
    }
    this.saving.set(true);
    this.api.saveSections(this.pageId(), this.locale(), sections).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.saving.set(false);
        this.dialog.toast('success', 'common.saved');
        if (Array.isArray(res)) {
          this.reset(res);
          this.saved.emit(res);
        } else {
          // The response shape is the list per the contract; reload if it ever is not.
          this.setDirty(false);
          this.load();
          this.saved.emit(sections);
        }
      },
      error: err => {
        this.saving.set(false);
        if (err?.status === 422) {
          this.errors.set(fieldErrors(err));
          this.formError.set(errorMessage(err, 'web.blocks.save_failed'));
          this.revealFirstError();
        } else {
          this.dialog.error('common.error', errorMessage(err, 'web.blocks.save_failed'));
        }
      }
    });
  }

  private focusCard(uid: number): void {
    setTimeout(() => {
      const el = this.host.nativeElement.querySelector<HTMLElement>(`#blk-${uid}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 30);
  }

  fieldLabelFor(f: FieldDef): string {
    return fieldLabel(f, this.i18n);
  }

  themeOf(b: WorkingBlock): string {
    return b.section.settings?.theme ?? 'default';
  }

  spacingOf(b: WorkingBlock): string {
    return b.section.settings?.spacing ?? 'normal';
  }
}

/** Fills in what older rows may lack so the editor can treat every block alike. */
function normalize(s: PageSection): PageSection {
  return {
    ...s,
    data: s.data && typeof s.data === 'object' && !Array.isArray(s.data) ? clone(s.data) : {},
    anchor: s.anchor ?? null,
    settings: s.settings && typeof s.settings === 'object' && !Array.isArray(s.settings) ? clone(s.settings) : {},
    is_enabled: s.is_enabled !== false
  };
}
