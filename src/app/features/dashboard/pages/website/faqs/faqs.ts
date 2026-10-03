import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { Locale, LocaleInfo, WebsiteFaq } from '../../../../../core/services/website/website.models';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { nullIfEmpty } from '../shared/website-utils';

/** FAQs only have these two states (not the full page lifecycle). */
const FAQ_STATUSES = ['draft', 'published'];

interface FaqDraft {
  locale: Locale;
  question: string;
  answer: string;
  group_key: string;
  is_global: boolean;
  status: string;
  sort_order: string;
}

/**
 * FAQ library. One FAQ is one question in one language; pages and products
 * attach FAQs by id, and the published ones feed the page's FAQPage schema —
 * the answer text is what AI answer engines quote, so it is kept short and
 * self-contained.
 */
@Component({
  selector: 'app-website-faqs',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './faqs.html',
  styleUrls: ['../shared/website.shared.css', './faqs.css']
})
export class Faqs {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  readonly statuses = FAQ_STATUSES;

  rows = signal<WebsiteFaq[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  total = signal(0);
  readonly perPage = 20;
  page = signal(1);
  q = signal('');
  locale = signal('');
  status = signal('');
  global = signal('');
  groupKey = signal('');

  locales = signal<LocaleInfo[]>([
    { code: 'en', name: 'English', native: 'English', dir: 'ltr', hreflang: 'en', is_default: true },
    { code: 'ar', name: 'Arabic', native: 'العربية', dir: 'rtl', hreflang: 'ar', is_default: false }
  ]);

  open = signal(false);
  editing = signal<WebsiteFaq | null>(null);
  draft = signal<FaqDraft>(this.emptyDraft());
  saving = signal(false);
  formError = signal<string | null>(null);
  errors = signal<Record<string, string>>({});

  canCreate = computed(() => this.ctx.can('cms.create'));
  canUpdate = computed(() => this.ctx.can('cms.update'));
  canDelete = computed(() => this.ctx.can('cms.delete'));
  canSave = computed(() => (this.editing() ? this.canUpdate() : this.canCreate()));
  draftDir = computed(() => (this.draft().locale === 'ar' ? 'rtl' : 'ltr'));

  onSearch = debounce((v: string) => {
    this.q.set(v.trim());
    this.page.set(1);
    this.load();
  });

  onGroup = debounce((v: string) => {
    this.groupKey.set(v.trim());
    this.page.set(1);
    this.load();
  });

  constructor() {
    this.load();
    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => { if (e.locales?.length) this.locales.set(e.locales); },
      error: () => {}
    });
  }

  private emptyDraft(locale: Locale = 'en'): FaqDraft {
    return { locale, question: '', answer: '', group_key: '', is_global: false, status: 'draft', sort_order: '0' };
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .faqs({
        page: this.page(),
        per_page: this.perPage,
        q: this.q() || undefined,
        locale: this.locale() || undefined,
        status: this.status() || undefined,
        is_global: this.global() === '' ? undefined : Number(this.global()),
        group_key: this.groupKey() || undefined
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.rows.set(res.items);
          this.total.set(res.pagination.total);
          this.loading.set(false);
        },
        error: err => {
          this.rows.set([]);
          this.loadError.set(errorMessage(err, 'web.faqs.load_failed'));
          this.loading.set(false);
        }
      });
  }

  setFilter(which: 'locale' | 'status' | 'global', value: string): void {
    this[which].set(value);
    this.page.set(1);
    this.load();
  }

  goToPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  /** `used_by_*` is a list of attachments on some payloads and a count on others. */
  usedCount(v: unknown): number {
    if (Array.isArray(v)) return v.length;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  statusLabel(row: WebsiteFaq): string {
    const label = row['status_label'];
    if (typeof label === 'string' && label) return label;
    const key = `web.faqs.status_${row.status}`;
    const t = this.i18n.translate(key);
    return t === key ? row.status : t;
  }

  /** The answer may hold simple HTML; the list shows it as plain text. */
  plain(html: string | null | undefined): string {
    return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // ── editor ──────────────────────────────────────────────────────

  create(): void {
    this.editing.set(null);
    // New FAQs default to the language currently filtered, which is usually
    // the one the admin is filling in.
    this.draft.set(this.emptyDraft((this.locale() as Locale) || 'en'));
    this.openEditor();
  }

  edit(row: WebsiteFaq): void {
    this.editing.set(row);
    this.draft.set({
      locale: row.locale,
      question: row.question ?? '',
      answer: row.answer ?? '',
      group_key: row.group_key ?? '',
      is_global: !!row.is_global,
      status: row.status || 'draft',
      sort_order: String(row.sort_order ?? 0)
    });
    this.openEditor();
  }

  private openEditor(): void {
    this.errors.set({});
    this.formError.set(null);
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
  }

  set<K extends keyof FaqDraft>(key: K, value: FaqDraft[K]): void {
    this.draft.update(d => ({ ...d, [key]: value }));
  }

  errorFor(field: string): string | null {
    return this.errors()[field] ?? null;
  }

  save(): void {
    const d = this.draft();
    const body = {
      locale: d.locale,
      question: d.question.trim(),
      answer: d.answer.trim(),
      group_key: nullIfEmpty(d.group_key.trim()),
      is_global: d.is_global,
      status: d.status,
      sort_order: Number(d.sort_order) || 0
    };
    const local: Record<string, string> = {};
    if (!body.question) local['question'] = 'common.required';
    if (!body.answer) local['answer'] = 'common.required';
    this.errors.set(local);
    this.formError.set(null);
    if (Object.keys(local).length) return;

    this.saving.set(true);
    const existing = this.editing();
    const req = existing ? this.api.updateFaq(existing.id, body) : this.api.createFaq(body);
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.open.set(false);
        this.dialog.toast('success', 'common.saved');
        this.load();
      },
      error: err => {
        this.saving.set(false);
        if (err?.status === 422) {
          this.errors.set(fieldErrors(err));
          this.formError.set(errorMessage(err, 'web.faqs.save_failed'));
        } else {
          this.dialog.error('common.error', errorMessage(err, 'web.faqs.save_failed'));
        }
      }
    });
  }

  async remove(row: WebsiteFaq): Promise<void> {
    const pages = this.usedCount(row.used_by_pages);
    const products = this.usedCount(row.used_by_products);
    const ok = await this.dialog.confirm({
      title: 'web.faqs.delete_title',
      text: 'web.faqs.delete_text',
      params: { pages, products },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteFaq(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.faqs.deleted');
        if (this.rows().length === 1 && this.page() > 1) this.page.set(this.page() - 1);
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.faqs.delete_failed'))
    });
  }
}
