import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../../core/services/website/website-context.service';
import {
  LOCALES, Locale, WebsiteCta, WebsiteFaq, WebsitePage, WebsiteSource
} from '../../../../../../core/services/website/website.models';
import { debounce } from '../../../../../../shared/utils/debounce.util';
import { clone, nullIfEmpty } from '../../shared/website-utils';
import { enumLabel } from './page-shared';

interface SourceDraft {
  locale: '' | Locale;
  title: string;
  url: string;
  organization: string;
  published_on: string;
  verified_on: string;
}

interface CtaDraft {
  cta_id: string;
  placement: string;
  is_enabled: boolean;
}

/**
 * Sources, FAQs and CTAs of a page (§2.7). Three independent lists, each
 * replaced wholesale by its own `PUT`, so each card saves on its own and a
 * failure in one never loses edits in the others.
 */
@Component({
  selector: 'app-page-relations-tab',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './page-relations-tab.html',
  styleUrls: ['../../shared/website.shared.css', '../../shared/editor-panel.css', './editor-tabs.css']
})
export class PageRelationsTab {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  page = input.required<WebsitePage>();
  saved = output<void>();
  dirtyChange = output<boolean>();

  readonly locales = LOCALES;
  canUpdate = computed(() => this.ctx.can('cms.update'));

  // sources
  sources = signal<SourceDraft[]>([]);
  sourcesDirty = signal(false);
  sourcesSaving = signal(false);
  sourcesErrors = signal<Record<string, string>>({});
  sourcesError = signal<string | null>(null);

  // FAQs
  faqs = signal<WebsiteFaq[]>([]);
  faqsDirty = signal(false);
  faqsSaving = signal(false);
  faqsError = signal<string | null>(null);
  faqQuery = signal('');
  faqLocale = signal<'' | Locale>('');
  faqResults = signal<WebsiteFaq[]>([]);
  faqSearching = signal(false);
  attachedIds = computed(() => new Set(this.faqs().map(f => f.id)));

  // CTAs
  ctas = signal<CtaDraft[]>([]);
  ctasDirty = signal(false);
  ctasSaving = signal(false);
  ctasErrors = signal<Record<string, string>>({});
  ctasError = signal<string | null>(null);
  ctaOptions = signal<WebsiteCta[]>([]);
  placements = signal<string[]>([]);

  private lastId: number | null = null;

  constructor() {
    effect(() => {
      const page = this.page();
      untracked(() => this.sync(page));
    });
    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => this.placements.set(e.cta_placements ?? []),
      error: () => {}
    });
    this.api.ctas({ per_page: 200 }).pipe(takeUntilDestroyed()).subscribe({
      next: res => this.ctaOptions.set(res.items),
      error: () => this.ctaOptions.set([])
    });
  }

  /** A reload keeps any list that still has unsaved edits. */
  private sync(page: WebsitePage): void {
    const fresh = page.id !== this.lastId;
    this.lastId = page.id;
    if (fresh || !this.sourcesDirty()) {
      this.sources.set((page.sources ?? []).map(s => ({
        locale: s.locale ?? '', title: s.title ?? '', url: s.url ?? '', organization: s.organization ?? '',
        published_on: s.published_on ?? '', verified_on: s.verified_on ?? ''
      })));
      this.sourcesDirty.set(false);
    }
    if (fresh || !this.faqsDirty()) {
      this.faqs.set(clone(page.faqs ?? []));
      this.faqsDirty.set(false);
    }
    if (fresh || !this.ctasDirty()) {
      this.ctas.set((page.ctas ?? []).map(c => ({
        cta_id: String(c.cta_id ?? c.cta?.id ?? ''), placement: c.placement ?? '', is_enabled: c.is_enabled !== false
      })));
      this.ctasDirty.set(false);
    }
    this.emitDirty();
  }

  private emitDirty(): void {
    this.dirtyChange.emit(this.sourcesDirty() || this.faqsDirty() || this.ctasDirty());
  }

  // ── sources ─────────────────────────────────────────────────────

  addSource(): void {
    this.sources.update(list => [...list, { locale: '', title: '', url: '', organization: '', published_on: '', verified_on: '' }]);
    this.markSources();
  }

  setSource<K extends keyof SourceDraft>(i: number, key: K, value: SourceDraft[K]): void {
    this.sources.update(list => list.map((s, j) => (j === i ? { ...s, [key]: value } : s)));
    this.markSources();
  }

  removeSource(i: number): void {
    this.sources.update(list => list.filter((_, j) => j !== i));
    this.markSources();
  }

  private markSources(): void {
    this.sourcesDirty.set(true);
    this.emitDirty();
  }

  sourceError(i: number, field: string): string | null {
    return this.sourcesErrors()[`sources.${i}.${field}`] ?? null;
  }

  saveSources(): void {
    const errors: Record<string, string> = {};
    this.sources().forEach((s, i) => {
      if (!s.title.trim()) errors[`sources.${i}.title`] = 'common.required';
      if (!s.url.trim()) errors[`sources.${i}.url`] = 'common.required';
      else if (!/^https?:\/\/\S+$/i.test(s.url.trim())) errors[`sources.${i}.url`] = 'web.pages.url_invalid';
    });
    this.sourcesErrors.set(errors);
    this.sourcesError.set(null);
    if (Object.keys(errors).length) return;

    const body: WebsiteSource[] = this.sources().map(s => ({
      locale: s.locale || null,
      title: s.title.trim(),
      url: s.url.trim(),
      organization: nullIfEmpty(s.organization.trim()),
      published_on: s.published_on || null,
      verified_on: s.verified_on || null
    }));
    this.sourcesSaving.set(true);
    this.api.savePageSources(this.page().id, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sourcesSaving.set(false);
        this.sourcesDirty.set(false);
        this.emitDirty();
        this.dialog.toast('success', 'web.pages.sources_saved');
        this.saved.emit();
      },
      error: err => {
        this.sourcesSaving.set(false);
        this.sourcesErrors.set(fieldErrors(err));
        this.sourcesError.set(errorMessage(err, 'web.pages.save_failed'));
      }
    });
  }

  // ── FAQs ────────────────────────────────────────────────────────

  onFaqSearch = debounce((value: string) => {
    this.faqQuery.set(value.trim());
    this.searchFaqs();
  }, 300);

  setFaqLocale(value: string): void {
    this.faqLocale.set(value as '' | Locale);
    this.searchFaqs();
  }

  searchFaqs(): void {
    this.faqSearching.set(true);
    this.api.faqs({ q: this.faqQuery() || undefined, locale: this.faqLocale() || undefined, per_page: 15 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { this.faqResults.set(res.items); this.faqSearching.set(false); },
        error: () => { this.faqResults.set([]); this.faqSearching.set(false); }
      });
  }

  attachFaq(f: WebsiteFaq): void {
    if (this.attachedIds().has(f.id)) return;
    this.faqs.update(list => [...list, f]);
    this.markFaqs();
  }

  moveFaq(i: number, delta: -1 | 1): void {
    const j = i + delta;
    const list = [...this.faqs()];
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.faqs.set(list);
    this.markFaqs();
  }

  detachFaq(i: number): void {
    this.faqs.update(list => list.filter((_, j) => j !== i));
    this.markFaqs();
  }

  private markFaqs(): void {
    this.faqsDirty.set(true);
    this.emitDirty();
  }

  saveFaqs(): void {
    this.faqsSaving.set(true);
    this.faqsError.set(null);
    this.api.savePageFaqs(this.page().id, this.faqs().map(f => f.id)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.faqsSaving.set(false);
        this.faqsDirty.set(false);
        this.emitDirty();
        this.dialog.toast('success', 'web.pages.faqs_saved');
        this.saved.emit();
      },
      error: err => {
        this.faqsSaving.set(false);
        this.faqsError.set(errorMessage(err, 'web.pages.save_failed'));
      }
    });
  }

  /** Answers are stored as HTML; the list only needs a one-line taste. */
  plain(html: string | null | undefined, max = 140): string {
    const text = (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  // ── CTAs ────────────────────────────────────────────────────────

  addCta(): void {
    this.ctas.update(list => [...list, { cta_id: '', placement: '', is_enabled: true }]);
    this.markCtas();
  }

  setCta<K extends keyof CtaDraft>(i: number, key: K, value: CtaDraft[K]): void {
    this.ctas.update(list => list.map((c, j) => (j === i ? { ...c, [key]: value } : c)));
    this.markCtas();
  }

  removeCta(i: number): void {
    this.ctas.update(list => list.filter((_, j) => j !== i));
    this.markCtas();
  }

  private markCtas(): void {
    this.ctasDirty.set(true);
    this.emitDirty();
  }

  ctaError(i: number, field: string): string | null {
    return this.ctasErrors()[`ctas.${i}.${field}`] ?? null;
  }

  saveCtas(): void {
    const errors: Record<string, string> = {};
    this.ctas().forEach((c, i) => {
      if (!c.cta_id) errors[`ctas.${i}.cta_id`] = 'common.required';
      if (!c.placement) errors[`ctas.${i}.placement`] = 'common.required';
    });
    this.ctasErrors.set(errors);
    this.ctasError.set(null);
    if (Object.keys(errors).length) return;

    const body = this.ctas().map(c => ({ cta_id: Number(c.cta_id), placement: c.placement, is_enabled: c.is_enabled }));
    this.ctasSaving.set(true);
    this.api.savePageCtas(this.page().id, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.ctasSaving.set(false);
        this.ctasDirty.set(false);
        this.emitDirty();
        this.dialog.toast('success', 'web.pages.ctas_saved');
        this.saved.emit();
      },
      error: err => {
        this.ctasSaving.set(false);
        this.ctasErrors.set(fieldErrors(err));
        this.ctasError.set(errorMessage(err, 'web.pages.save_failed'));
      }
    });
  }

  ctaLabel(c: WebsiteCta): string {
    const label = (this.i18n.lang() === 'ar' ? c.label_ar : null) || c.label_en;
    return `${label} · ${c.key}${c.is_enabled ? '' : ' (' + this.i18n.translate('common.inactive') + ')'}`;
  }

  placementLabel(value: string): string {
    return enumLabel(this.i18n, 'cta_placement', value);
  }
}
