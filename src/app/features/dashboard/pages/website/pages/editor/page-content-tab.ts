import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../../core/services/website/website-context.service';
import {
  Locale, LocaleInfo, PageTranslationInput, PageUpdateInput, WebsiteAuthor, WebsiteCategory, WebsitePage, WebsitePageRow
} from '../../../../../../core/services/website/website.models';
import { MediaPicker } from '../../shared/media-picker';
import { nullIfEmpty, translationFor, wordCount } from '../../shared/website-utils';
import { PagePicker } from './page-picker';
import { SLUG_PATTERN, enumLabel, hasH1, reservedSegment, slugify, urlPreview } from './page-shared';

/** `settings` is a free object for the frontend template, capped by the API. */
const SETTINGS_MAX_BYTES = 5 * 1024;

interface TrDraft {
  title: string;
  slug: string;
  subtitle: string;
  excerpt: string;
  body: string;
  tags: string[];
  is_enabled: boolean;
}

interface PageDraft {
  type: string;
  template: string;
  parent_id: number | null;
  featured_media_id: number | null;
  is_featured: boolean;
  sort_order: string;
  author_id: string;
  category_id: string;
  settings: string;
}

/**
 * Content tab: one language's text (§2.5) and the page-level fields (§2.4).
 *
 * The two halves save separately because they are separate endpoints and
 * separate permissions in practice: a translator edits the Arabic copy without
 * touching the parent, template or author. Each half keeps its own dirty flag
 * so a save of one (which reloads the page) does not wipe pending edits in the
 * other.
 */
@Component({
  selector: 'app-page-content-tab',
  standalone: true,
  imports: [CommonModule, TPipe, MediaPicker, PagePicker],
  templateUrl: './page-content-tab.html',
  styleUrls: ['../../shared/website.shared.css', '../../shared/editor-panel.css', './editor-tabs.css']
})
export class PageContentTab {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  page = input.required<WebsitePage>();
  locale = input.required<Locale>();

  /** After any successful save / language delete — the editor reloads the page. */
  saved = output<void>();
  dirtyChange = output<boolean>();

  tr = signal<TrDraft>(this.emptyTr());
  tagInput = signal('');
  trDirty = signal(false);
  trSaving = signal(false);
  trErrors = signal<Record<string, string>>({});
  trError = signal<string | null>(null);

  pd = signal<PageDraft>(this.toPageDraft(null));
  pageDirty = signal(false);
  pageSaving = signal(false);
  pageErrors = signal<Record<string, string>>({});
  pageError = signal<string | null>(null);

  parentRow = signal<WebsitePageRow | null>(null);
  pageTypes = signal<string[]>([]);
  locales = signal<LocaleInfo[]>([]);
  reserved = signal<string[]>([]);
  authors = signal<WebsiteAuthor[]>([]);
  categories = signal<WebsiteCategory[]>([]);

  canUpdate = computed(() => this.ctx.can('cms.update'));
  isArticle = computed(() => this.page().type === 'article');
  current = computed(() => translationFor(this.page().translations, this.locale()));
  exists = computed(() => !!this.current());
  canDeleteLang = computed(() => this.exists() && this.page().translations.length > 1);
  otherLocale = computed<Locale | null>(() => {
    const other = this.page().translations.find(t => t.locale !== this.locale());
    return other ? other.locale : null;
  });
  localeName = computed(() => this.nameOf(this.locale()));
  dir = computed(() => this.locales().find(l => l.code === this.locale())?.dir ?? (this.locale() === 'ar' ? 'rtl' : 'ltr'));
  private lang = computed(() => this.i18n.lang() as Locale);

  parentPath = computed(() => translationFor(this.parentRow()?.translations, this.locale())?.path ?? '');
  effectiveSlug = computed(() => this.tr().slug.trim() || this.current()?.slug || slugify(this.tr().title));
  preview = computed(() => urlPreview(this.locale(), this.parentPath(), this.page().type === 'home' ? '' : this.effectiveSlug()));
  slugInvalid = computed(() => { const s = this.tr().slug.trim(); return !!s && !SLUG_PATTERN.test(s); });
  reservedHit = computed(() => reservedSegment(this.effectiveSlug(), this.parentPath(), this.reserved()));
  /** A live page whose slug changes gets an automatic 301 from the old URL at publish. */
  liveSlugChange = computed(() => {
    const c = this.current();
    return !!c?.published_path && !!this.tr().slug.trim() && this.tr().slug.trim() !== c.slug;
  });
  bodyH1 = computed(() => hasH1(this.tr().body));
  bodyWords = computed(() => wordCount(this.tr().body));
  missingAuthor = computed(() => this.isArticle() && !this.pd().author_id);
  settingsBytes = computed(() => new TextEncoder().encode(this.pd().settings.trim()).length);

  private lastPageId: number | null = null;
  private lastLocale: Locale | null = null;

  constructor() {
    effect(() => {
      const [page, locale] = [this.page(), this.locale()];
      untracked(() => this.sync(page, locale));
    });

    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => {
        this.pageTypes.set((e.page_types ?? []).filter(t => t !== 'article'));
        this.locales.set(e.locales ?? []);
        this.reserved.set(e.reserved_prefixes ?? []);
      },
      error: () => {}
    });
  }

  ngOnInit(): void {
    if (!this.isArticle()) return;
    this.api.authors({ per_page: 200 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => this.authors.set(res.items),
      error: () => this.authors.set([])
    });
    this.api.categories({ kind: 'article', per_page: 200 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => this.categories.set(res.items),
      error: () => this.categories.set([])
    });
  }

  /**
   * Re-seeds the drafts from a (re)loaded page. A switched language always
   * resets the language half (the editor already asked about unsaved edits);
   * a plain reload keeps whichever half still has unsaved edits.
   */
  private sync(page: WebsitePage, locale: Locale): void {
    const newEntity = page.id !== this.lastPageId;
    const newLocale = locale !== this.lastLocale;
    this.lastPageId = page.id;
    this.lastLocale = locale;

    if (newEntity || newLocale || !this.trDirty()) {
      const t = translationFor(page.translations, locale);
      this.tr.set(t ? {
        title: t.title ?? '', slug: t.slug ?? '', subtitle: t.subtitle ?? '', excerpt: t.excerpt ?? '',
        body: t.body ?? '', tags: [...(t.tags ?? [])], is_enabled: t.is_enabled !== false
      } : this.emptyTr());
      this.tagInput.set('');
      this.trDirty.set(false);
      this.trErrors.set({});
      this.trError.set(null);
    }
    if (newEntity || !this.pageDirty()) {
      this.pd.set(this.toPageDraft(page));
      this.pageDirty.set(false);
      this.pageErrors.set({});
      this.pageError.set(null);
      this.loadParent(page.parent_id);
    }
    this.emitDirty();
  }

  private loadParent(id: number | null): void {
    if (!id) { this.parentRow.set(null); return; }
    if (this.parentRow()?.id === id) return;
    this.api.page(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => this.parentRow.set(p),
      error: () => this.parentRow.set(null)
    });
  }

  private emptyTr(): TrDraft {
    return { title: '', slug: '', subtitle: '', excerpt: '', body: '', tags: [], is_enabled: true };
  }

  private toPageDraft(p: WebsitePage | null): PageDraft {
    return {
      type: p?.type ?? '',
      template: p?.template ?? 'default',
      parent_id: p?.parent_id ?? null,
      featured_media_id: p?.featured_media_id ?? null,
      is_featured: !!p?.is_featured,
      sort_order: String(p?.sort_order ?? 0),
      author_id: p?.author_id ? String(p.author_id) : '',
      category_id: p?.category_id ? String(p.category_id) : '',
      settings: p?.settings ? JSON.stringify(p.settings, null, 2) : ''
    };
  }

  private emitDirty(): void {
    this.dirtyChange.emit(this.trDirty() || this.pageDirty());
  }

  // ── language half ───────────────────────────────────────────────

  setTr<K extends keyof TrDraft>(key: K, value: TrDraft[K]): void {
    this.tr.update(d => ({ ...d, [key]: value }));
    this.trDirty.set(true);
    this.emitDirty();
  }

  /** Comma or Enter commits the typed tag; pasting "a, b, c" adds all three. */
  onTagInput(value: string): void {
    if (value.includes(',')) {
      const parts = value.split(',');
      const rest = parts.pop() ?? '';
      parts.forEach(p => this.addTag(p));
      this.tagInput.set(rest);
    } else {
      this.tagInput.set(value);
    }
  }

  commitTag(event: Event): void {
    event.preventDefault();
    this.addTag(this.tagInput());
    this.tagInput.set('');
  }

  addTag(raw: string): void {
    const tag = raw.trim();
    if (!tag || this.tr().tags.some(t => t.toLowerCase() === tag.toLowerCase())) return;
    this.setTr('tags', [...this.tr().tags, tag]);
  }

  removeTag(i: number): void {
    this.setTr('tags', this.tr().tags.filter((_, j) => j !== i));
  }

  /** Seeds a missing language from the other one so the translator starts from the structure. */
  copyFromOther(): void {
    const other = this.otherLocale();
    const src = other ? translationFor(this.page().translations, other) : undefined;
    if (!src) return;
    this.tr.set({
      title: src.title ?? '', slug: '', subtitle: src.subtitle ?? '', excerpt: src.excerpt ?? '',
      body: src.body ?? '', tags: [...(src.tags ?? [])], is_enabled: true
    });
    this.trDirty.set(true);
    this.emitDirty();
  }

  trErrorFor(field: string): string | null {
    const e = this.trErrors();
    return e[field] ?? e[`translations.${this.locale()}.${field}`] ?? null;
  }

  saveTranslation(): void {
    if (!this.canUpdate()) return;
    const d = this.tr();
    const errors: Record<string, string> = {};
    if (!d.title.trim()) errors['title'] = 'common.required';
    if (this.slugInvalid()) errors['slug'] = 'web.pages.slug_invalid';
    if (this.bodyH1()) errors['body'] = 'web.pages.body_no_h1';
    this.trErrors.set(errors);
    this.trError.set(null);
    if (Object.keys(errors).length) return;

    // An empty slug is left out rather than sent empty: the API then keeps the
    // current one (or derives it from the title for a new language).
    const pending = this.tagInput().trim();
    const tags = pending ? [...d.tags, pending] : d.tags;
    const body: PageTranslationInput = {
      title: d.title.trim(),
      subtitle: nullIfEmpty(d.subtitle.trim()),
      excerpt: nullIfEmpty(d.excerpt.trim()),
      body: nullIfEmpty(d.body.trim()),
      tags,
      is_enabled: d.is_enabled
    };
    if (d.slug.trim()) body.slug = d.slug.trim();

    const added = !this.exists();
    this.trSaving.set(true);
    this.api.savePageTranslation(this.page().id, this.locale(), body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.trSaving.set(false);
        this.trDirty.set(false);
        this.tagInput.set('');
        this.emitDirty();
        this.dialog.toast('success', added ? 'web.pages.language_added' : 'web.pages.content_saved');
        this.saved.emit();
      },
      error: err => {
        this.trSaving.set(false);
        this.trErrors.set(fieldErrors(err));
        this.trError.set(errorMessage(err, 'web.pages.save_failed'));
      }
    });
  }

  async deleteLanguage(): Promise<void> {
    if (!this.canDeleteLang() || !this.canUpdate()) return;
    const ok = await this.dialog.confirm({
      title: 'web.pages.delete_lang_title',
      text: 'web.pages.delete_lang_text',
      params: { lang: this.localeName() },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deletePageTranslation(this.page().id, this.locale()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.trDirty.set(false);
        this.emitDirty();
        this.dialog.toast('success', 'web.pages.language_deleted');
        this.saved.emit();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.pages.action_failed'))
    });
  }

  // ── page half ───────────────────────────────────────────────────

  setPage<K extends keyof PageDraft>(key: K, value: PageDraft[K]): void {
    this.pd.update(d => ({ ...d, [key]: value }));
    this.pageDirty.set(true);
    this.emitDirty();
  }

  pickParent(row: WebsitePageRow | null): void {
    this.parentRow.set(row);
    this.setPage('parent_id', row?.id ?? null);
  }

  pageErrorFor(field: string): string | null {
    return this.pageErrors()[field] ?? null;
  }

  savePage(): void {
    if (!this.canUpdate()) return;
    const d = this.pd();
    const errors: Record<string, string> = {};

    let settings: Record<string, any> | null = null;
    const raw = d.settings.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) errors['settings'] = 'web.pages.settings_object';
        else settings = parsed;
      } catch {
        errors['settings'] = 'web.pages.settings_invalid';
      }
      if (!errors['settings'] && this.settingsBytes() > SETTINGS_MAX_BYTES) errors['settings'] = 'web.pages.settings_too_big';
    }
    const sort = Number(d.sort_order);
    if (d.sort_order.trim() === '' || !Number.isInteger(sort)) errors['sort_order'] = 'web.pages.sort_order_invalid';
    this.pageErrors.set(errors);
    this.pageError.set(null);
    if (Object.keys(errors).length) return;

    const body: PageUpdateInput = {
      template: d.template.trim() || 'default',
      parent_id: d.parent_id,
      featured_media_id: d.featured_media_id,
      is_featured: d.is_featured,
      sort_order: sort,
      settings
    };
    // An article stays an article; only pages move between home / page / landing.
    if (!this.isArticle() && d.type && d.type !== this.page().type) body.type = d.type as PageUpdateInput['type'];
    if (this.isArticle()) {
      body.author_id = d.author_id ? Number(d.author_id) : null;
      body.category_id = d.category_id ? Number(d.category_id) : null;
    }

    this.pageSaving.set(true);
    this.api.updatePage(this.page().id, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.pageSaving.set(false);
        this.pageDirty.set(false);
        this.emitDirty();
        this.dialog.toast('success', 'web.pages.page_saved');
        this.saved.emit();
      },
      error: err => {
        this.pageSaving.set(false);
        this.pageErrors.set(fieldErrors(err));
        this.pageError.set(errorMessage(err, 'web.pages.save_failed'));
      }
    });
  }

  // ── display ─────────────────────────────────────────────────────

  nameOf(locale: Locale | null): string {
    if (!locale) return '';
    return this.locales().find(l => l.code === locale)?.native ?? locale.toUpperCase();
  }

  typeLabel(type: string): string {
    return enumLabel(this.i18n, 'page_type', type);
  }

  authorName(a: WebsiteAuthor): string {
    const name = (this.lang() === 'ar' ? a.name_ar : null) || a.name || a.name_en;
    return a.is_active === false ? `${name} (${this.i18n.translate('common.inactive')})` : name;
  }

  categoryName(c: WebsiteCategory): string {
    return (this.lang() === 'ar' ? c.name_ar : null) || c.name || c.name_en;
  }
}
