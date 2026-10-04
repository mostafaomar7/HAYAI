import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../../core/services/website/website-context.service';
import {
  Locale, LocaleInfo, PageCreateInput, WebsiteAuthor, WebsiteCategory, WebsitePageRow
} from '../../../../../../core/services/website/website.models';
import { nullIfEmpty, translationFor } from '../../shared/website-utils';
import { PagePicker } from './page-picker';
import { PageKind, SLUG_PATTERN, enumLabel, reservedSegment, slugify, urlPreview } from './page-shared';

interface CreateDraft {
  type: string;
  template: string;
  locale: Locale;
  title: string;
  slug: string;
  excerpt: string;
  author_id: string;
  category_id: string;
}

/**
 * New page / article (§2.2). Asks only for what the URL and the first
 * language need; everything else is edited in the full editor the create call
 * lands on. New pages are always drafts, so nothing here touches the live site.
 */
@Component({
  selector: 'app-page-create',
  standalone: true,
  imports: [CommonModule, TPipe, PagePicker],
  templateUrl: './page-create.html',
  styleUrls: ['../../shared/website.shared.css', '../../shared/editor-panel.css', './editor-tabs.css']
})
export class PageCreate {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private i18n = inject(I18nService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  kind = input.required<PageKind>();

  draft = signal<CreateDraft>({
    type: '', template: 'default', locale: 'en', title: '', slug: '', excerpt: '', author_id: '', category_id: ''
  });
  parent = signal<WebsitePageRow | null>(null);
  saving = signal(false);
  formError = signal<string | null>(null);
  errors = signal<Record<string, string>>({});

  pageTypes = signal<string[]>([]);
  locales = signal<LocaleInfo[]>([]);
  reserved = signal<string[]>([]);
  /** Only one home page may exist; the option is disabled once there is one. */
  homeExists = signal(false);
  authors = signal<WebsiteAuthor[]>([]);
  categories = signal<WebsiteCategory[]>([]);

  isArticle = computed(() => this.kind() === 'articles');
  private lang = computed(() => this.i18n.lang() as Locale);

  /** Parent path in the chosen language ('' at the top level). */
  parentPath = computed(() => {
    const p = this.parent();
    if (!p) return '';
    return translationFor(p.translations, this.draft().locale)?.path ?? '';
  });
  /** The parent exists but not in this language — the URL would have no parent segment to hang from. */
  parentMissingLocale = computed(() => {
    const p = this.parent();
    return !!p && !translationFor(p.translations, this.draft().locale);
  });
  effectiveSlug = computed(() => this.draft().slug.trim() || slugify(this.draft().title));
  preview = computed(() => urlPreview(this.draft().locale, this.parentPath(), this.effectiveSlug()));
  slugInvalid = computed(() => {
    const s = this.draft().slug.trim();
    return !!s && !SLUG_PATTERN.test(s);
  });
  reservedHit = computed(() => reservedSegment(this.effectiveSlug(), this.parentPath(), this.reserved()));
  localeDir = computed(() => this.locales().find(l => l.code === this.draft().locale)?.dir ?? (this.draft().locale === 'ar' ? 'rtl' : 'ltr'));

  ngOnInit(): void {
    if (this.isArticle()) this.set('type', 'article');
    this.ctx.enums().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: e => {
        this.pageTypes.set((e.page_types ?? []).filter(t => t !== 'article'));
        this.locales.set(e.locales ?? []);
        this.reserved.set(e.reserved_prefixes ?? []);
        if (!this.isArticle() && !this.draft().type) this.set('type', this.pageTypes().includes('page') ? 'page' : this.pageTypes()[0] ?? '');
        const def = e.locales?.find(l => l.is_default)?.code;
        if (def) this.set('locale', def);
      },
      error: () => {}
    });
    if (this.isArticle()) {
      this.api.authors({ per_page: 200 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res => this.authors.set(res.items.filter(a => a.is_active !== false)),
        error: () => this.authors.set([])
      });
      this.api.categories({ kind: 'article', per_page: 200 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res => this.categories.set(res.items),
        error: () => this.categories.set([])
      });
    } else {
      this.api.pages({ type: 'home', per_page: 1 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res => this.homeExists.set(res.pagination.total > 0),
        error: () => {}
      });
    }
  }

  set<K extends keyof CreateDraft>(key: K, value: CreateDraft[K]): void {
    this.draft.update(d => ({ ...d, [key]: value }));
    if (Object.keys(this.errors()).length) {
      const field = key === 'title' || key === 'slug' || key === 'excerpt' ? `translations.${this.draft().locale}.${key}` : key;
      this.errors.update(e => { const n = { ...e }; delete n[field]; delete n[key]; return n; });
    }
  }

  typeLabel(type: string): string {
    return enumLabel(this.i18n, 'page_type', type);
  }

  authorName(a: WebsiteAuthor): string {
    return (this.lang() === 'ar' ? a.name_ar : null) || a.name || a.name_en;
  }

  categoryName(c: WebsiteCategory): string {
    return (this.lang() === 'ar' ? c.name_ar : null) || c.name || c.name_en;
  }

  errorFor(field: string): string | null {
    const e = this.errors();
    const l = this.draft().locale;
    return e[field] ?? e[`translations.${l}.${field}`] ?? null;
  }

  submit(): void {
    const d = this.draft();
    const errors: Record<string, string> = {};
    if (!d.type) errors['type'] = 'common.required';
    if (!d.title.trim()) errors['title'] = 'common.required';
    if (this.slugInvalid()) errors['slug'] = 'web.pages.slug_invalid';
    if (d.type === 'home' && this.homeExists()) errors['type'] = 'web.pages.home_exists';
    this.errors.set(errors);
    this.formError.set(null);
    if (Object.keys(errors).length) return;

    const body: PageCreateInput = {
      type: d.type as PageCreateInput['type'],
      template: d.template.trim() || 'default',
      parent_id: this.parent()?.id ?? null,
      translations: {
        [d.locale]: {
          title: d.title.trim(),
          slug: nullIfEmpty(d.slug.trim()),
          excerpt: nullIfEmpty(d.excerpt.trim())
        }
      }
    };
    if (this.isArticle()) {
      body.author_id = d.author_id ? Number(d.author_id) : null;
      body.category_id = d.category_id ? Number(d.category_id) : null;
    }

    this.saving.set(true);
    this.api.createPage(body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: page => {
        this.saving.set(false);
        this.router.navigate(['/dashboard/website', this.kind(), page.id], {
          queryParams: { locale: d.locale }
        });
      },
      error: err => {
        this.saving.set(false);
        this.errors.set(fieldErrors(err));
        this.formError.set(errorMessage(err, 'web.pages.create_failed'));
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/dashboard/website', this.kind()]);
  }
}
