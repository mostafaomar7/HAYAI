import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import {
  LOCALES, Locale, LocaleInfo, PageListParams, PageTranslation, WebsiteAuthor, WebsiteCategory, WebsitePageRow
} from '../../../../../core/services/website/website.models';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { fmtDate, pickLocalized } from '../shared/website-utils';
import { PageKind, enumLabel, kindOf } from './editor/page-shared';

type SortKey = NonNullable<PageListParams['sort']>;

/**
 * Pages and articles list (§2.1, §9). One component serves both routes; the
 * route's `data.pageKind` decides which.
 *
 * Why the Pages list is not "everything except articles": `GET /pages` has no
 * "type is not article" filter, and filtering articles out client-side would
 * leave pages short or empty after pagination. So Pages lists every type with
 * a type filter (articles included, opening in the article editor), while the
 * Articles menu is the same list locked to `type=article` with the
 * article-only filters (author, category).
 */
@Component({
  selector: 'app-website-page-list',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './page-list.html',
  styleUrls: ['../shared/website.shared.css', './page-list.css']
})
export class PageList {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  readonly kind: PageKind = this.route.snapshot.data['pageKind'] === 'articles' ? 'articles' : 'pages';
  readonly isArticles = this.kind === 'articles';

  rows = signal<WebsitePageRow[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  total = signal(0);
  readonly perPage = 20;
  page = signal(1);

  q = signal('');
  type = signal('');
  status = signal('');
  locale = signal('');
  sort = signal<SortKey>('updated');
  authorId = signal('');
  categoryId = signal('');
  trash = signal(false);

  pageTypes = signal<string[]>([]);
  statuses = signal<string[]>([]);
  locales = signal<LocaleInfo[]>([]);
  authors = signal<WebsiteAuthor[]>([]);
  categories = signal<WebsiteCategory[]>([]);
  /** Rows with an action in flight, so a double click cannot fire twice. */
  busy = signal<Set<number>>(new Set());

  readonly sorts: SortKey[] = ['updated', 'created', 'published', 'sort_order'];
  readonly allLocales = LOCALES;

  canCreate = computed(() => this.ctx.can('cms.create'));
  canDelete = computed(() => this.ctx.can('cms.delete'));
  lang = computed(() => this.i18n.lang() as Locale);

  onSearch = debounce((value: string) => {
    this.q.set(value.trim());
    this.page.set(1);
    this.load();
  });

  constructor() {
    this.load();
    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => {
        this.pageTypes.set(e.page_types ?? []);
        this.statuses.set(e.content_statuses ?? []);
        this.locales.set(e.locales ?? []);
      },
      error: () => {}
    });
    if (this.isArticles) {
      // Unpaginated on purpose: these feed filter dropdowns, and a second page
      // would silently hide authors / categories from the filter.
      this.api.authors({ per_page: 200 }).pipe(takeUntilDestroyed()).subscribe({
        next: res => this.authors.set(res.items),
        error: () => this.authors.set([])
      });
      this.api.categories({ kind: 'article', per_page: 200 }).pipe(takeUntilDestroyed()).subscribe({
        next: res => this.categories.set(res.items),
        error: () => this.categories.set([])
      });
    }
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const params: PageListParams = {
      page: this.page(),
      per_page: this.perPage,
      q: this.q() || undefined,
      type: this.isArticles ? 'article' : this.type() || undefined,
      status: this.status() || undefined,
      locale: this.locale() || undefined,
      sort: this.sort(),
      trashed: this.trash() ? 'only' : undefined,
      author_id: this.isArticles && this.authorId() ? Number(this.authorId()) : undefined,
      category_id: this.isArticles && this.categoryId() ? Number(this.categoryId()) : undefined
    };
    this.api.pages(params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.rows.set(res.items);
        this.total.set(res.pagination.total);
        this.loading.set(false);
      },
      error: err => {
        this.rows.set([]);
        this.loadError.set(errorMessage(err, 'web.pages.load_failed'));
        this.loading.set(false);
      }
    });
  }

  setFilter(which: 'type' | 'status' | 'locale' | 'authorId' | 'categoryId', value: string): void {
    this[which].set(value);
    this.page.set(1);
    this.load();
  }

  setSort(value: string): void {
    this.sort.set(value as SortKey);
    this.page.set(1);
    this.load();
  }

  toggleTrash(on: boolean): void {
    if (this.trash() === on) return;
    this.trash.set(on);
    this.page.set(1);
    this.load();
  }

  goToPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  // ── display ─────────────────────────────────────────────────────

  title(row: WebsitePageRow): string {
    return pickLocalized(row.translations, 'title', this.lang()) || `#${row.id}`;
  }

  /** Translations in a fixed EN, AR order, so the language column lines up row to row. */
  langs(row: WebsitePageRow): PageTranslation[] {
    return LOCALES.map(l => row.translations.find(t => t.locale === l)).filter((t): t is PageTranslation => !!t);
  }

  trOf(row: WebsitePageRow, locale: Locale): PageTranslation | undefined {
    return row.translations.find(t => t.locale === locale);
  }

  /** Path as typed — `path` comes URL-decoded, which is what an editor reads. */
  pathOf(t: PageTranslation): string {
    return `/${t.locale}/${t.path ?? t.slug ?? ''}`.replace(/\/+$/, '');
  }

  typeLabel(type: string): string {
    return enumLabel(this.i18n, 'page_type', type);
  }

  statusLabel(row: WebsitePageRow): string {
    return enumLabel(this.i18n, 'content_status', row.status, row.status_label);
  }

  enumText(group: string, value: string): string {
    return enumLabel(this.i18n, group, value);
  }

  date(value: string | null | undefined, withTime = false): string {
    return fmtDate(value, this.lang(), withTime);
  }

  isBusy(row: WebsitePageRow): boolean {
    return this.busy().has(row.id);
  }

  // ── actions ─────────────────────────────────────────────────────

  create(): void {
    this.router.navigate(['/dashboard/website', this.kind, 'new']);
  }

  edit(row: WebsitePageRow): void {
    if (row.deleted_at) return;
    this.router.navigate(['/dashboard/website', kindOf(row.type), row.id]);
  }

  duplicate(row: WebsitePageRow): void {
    this.run(row, this.api.duplicatePage(row.id), copy => {
      this.dialog.toast('success', 'web.pages.duplicated');
      // The copy is a new draft; opening it is almost always the next step.
      this.router.navigate(['/dashboard/website', kindOf(copy.type), copy.id]);
    });
  }

  async remove(row: WebsitePageRow): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.pages.trash_title',
      text: 'web.pages.trash_text',
      params: { name: this.title(row) },
      confirmText: 'web.pages.move_to_trash',
      danger: true
    });
    if (!ok) return;
    // The backend refuses pages with children and the live home page; its
    // message names the reason, so it is shown as-is.
    this.run(row, this.api.deletePage(row.id), () => {
      this.dialog.toast('success', 'web.pages.trashed');
      this.afterRemoval();
    });
  }

  restore(row: WebsitePageRow): void {
    // Refused when the URL has since been taken by another page — again the
    // backend says which, so that message wins over a generic failure.
    this.run(row, this.api.restorePage(row.id), () => {
      this.dialog.toast('success', 'web.pages.restored');
      this.afterRemoval();
    });
  }

  /** Deleting / restoring the last row of a page would otherwise leave it empty. */
  private afterRemoval(): void {
    if (this.rows().length === 1 && this.page() > 1) this.page.set(this.page() - 1);
    this.load();
  }

  private run<T>(row: WebsitePageRow, call: Observable<T>, done: (res: T) => void): void {
    if (this.isBusy(row)) return;
    this.busy.update(s => new Set(s).add(row.id));
    const release = () => this.busy.update(s => { const n = new Set(s); n.delete(row.id); return n; });
    call.subscribe({
      next: res => { release(); done(res); },
      error: err => { release(); this.dialog.error('common.error', errorMessage(err, 'web.pages.action_failed')); }
    });
  }

  authorName(a: WebsiteAuthor): string {
    return (this.lang() === 'ar' ? a.name_ar : null) || a.name || a.name_en;
  }

  categoryName(c: WebsiteCategory): string {
    return (this.lang() === 'ar' ? c.name_ar : null) || c.name || c.name_en;
  }
}
