import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { Locale, WebsiteAuthor } from '../../../../../core/services/website/website.models';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { MediaPicker } from '../shared/media-picker';
import { joinLines, lines, nullIfEmpty } from '../shared/website-utils';

interface AuthorDraft {
  slug: string;
  name_en: string;
  name_ar: string;
  job_title_en: string;
  job_title_ar: string;
  credentials_en: string;
  credentials_ar: string;
  bio_en: string;
  bio_ar: string;
  photo_media_id: number | null;
  same_as: string;
  email: string;
  is_active: boolean;
}

function emptyDraft(): AuthorDraft {
  return {
    slug: '', name_en: '', name_ar: '', job_title_en: '', job_title_ar: '', credentials_en: '',
    credentials_ar: '', bio_en: '', bio_ar: '', photo_media_id: null, same_as: '', email: '', is_active: true
  };
}

/** Per-language fields, so the EN / AR switch can flag the hidden side's errors. */
const LOCALIZED = ['name_', 'job_title_', 'credentials_', 'bio_'];

/**
 * Article authors. Health content is judged on who wrote it (Google's E-E-A-T),
 * so every article is signed by a real, named person whose profile carries
 * credentials and external profiles (`same_as`) the site emits as schema.org
 * `Person.sameAs`.
 */
@Component({
  selector: 'app-website-authors',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent, MediaPicker],
  templateUrl: './authors.html',
  styleUrls: ['../shared/website.shared.css', './authors.css']
})
export class Authors {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  rows = signal<WebsiteAuthor[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  total = signal(0);
  readonly perPage = 20;
  page = signal(1);
  q = signal('');
  active = signal('');

  open = signal(false);
  editing = signal<WebsiteAuthor | null>(null);
  draft = signal<AuthorDraft>(emptyDraft());
  locale = signal<Locale>('en');
  saving = signal(false);
  formError = signal<string | null>(null);
  errors = signal<Record<string, string>>({});

  canCreate = computed(() => this.ctx.can('cms.create'));
  canUpdate = computed(() => this.ctx.can('cms.update'));
  canDelete = computed(() => this.ctx.can('cms.delete'));
  canSave = computed(() => (this.editing() ? this.canUpdate() : this.canCreate()));
  lang = computed<Locale>(() => (this.i18n.lang() === 'ar' ? 'ar' : 'en'));

  /** A brand is not an author; nudge before the backend or Google rejects it. */
  looksLikeTeam = computed(() => {
    const d = this.draft();
    return /\b(team|staff|editorial|admin)\b|فريق/i.test(`${d.name_en} ${d.name_ar}`);
  });
  sameAsCount = computed(() => lines(this.draft().same_as).length);

  onSearch = debounce((v: string) => {
    this.q.set(v.trim());
    this.page.set(1);
    this.load();
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .authors({
        page: this.page(),
        per_page: this.perPage,
        q: this.q() || undefined,
        is_active: this.active() === '' ? undefined : this.active() === '1' ? 1 : 0
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
          this.loadError.set(errorMessage(err, 'web.authors.load_failed'));
          this.loading.set(false);
        }
      });
  }

  setActive(v: string): void {
    this.active.set(v);
    this.page.set(1);
    this.load();
  }

  goToPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  photoUrl(a: WebsiteAuthor): string | null {
    const m = a.photo;
    if (!m) return null;
    return m.variants?.find(v => v.width <= 200)?.url ?? m.url;
  }

  publicPath(locale: Locale, slug: string): string {
    return `/${locale}/authors/${slug || '{slug}'}`;
  }

  // ── editor ──────────────────────────────────────────────────────

  create(): void {
    this.editing.set(null);
    this.draft.set(emptyDraft());
    this.openEditor();
  }

  edit(row: WebsiteAuthor): void {
    this.editing.set(row);
    this.fill(row);
    this.openEditor();
    // The list may omit long fields (bio) and the internal e-mail.
    this.api.author(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: full => {
        this.editing.set(full);
        this.fill(full);
      },
      error: () => {}
    });
  }

  private fill(a: WebsiteAuthor): void {
    const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
    this.draft.set({
      slug: s(a.slug), name_en: s(a.name_en), name_ar: s(a.name_ar),
      job_title_en: s(a.job_title_en), job_title_ar: s(a.job_title_ar),
      credentials_en: s(a.credentials_en), credentials_ar: s(a.credentials_ar),
      bio_en: s(a.bio_en), bio_ar: s(a.bio_ar),
      photo_media_id: a.photo_media_id ?? a.photo?.id ?? null,
      same_as: joinLines(a.same_as), email: s(a.email), is_active: !!a.is_active
    });
  }

  private openEditor(): void {
    this.locale.set('en');
    this.errors.set({});
    this.formError.set(null);
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
  }

  set<K extends keyof AuthorDraft>(key: K, value: AuthorDraft[K]): void {
    this.draft.update(d => ({ ...d, [key]: value }));
  }

  errorFor(field: string): string | null {
    return this.errors()[field] ?? null;
  }

  /** `same_as.2` errors point at a line of the textarea; show them together. */
  sameAsErrors(): string[] {
    return Object.entries(this.errors())
      .filter(([k]) => k === 'same_as' || k.startsWith('same_as.'))
      .map(([, v]) => v);
  }

  localeHasError(l: Locale): boolean {
    const e = this.errors();
    return LOCALIZED.some(p => !!e[p + l]);
  }

  save(): void {
    const d = this.draft();
    const body = {
      slug: d.slug.trim(),
      name_en: d.name_en.trim(),
      name_ar: nullIfEmpty(d.name_ar),
      job_title_en: nullIfEmpty(d.job_title_en),
      job_title_ar: nullIfEmpty(d.job_title_ar),
      credentials_en: nullIfEmpty(d.credentials_en),
      credentials_ar: nullIfEmpty(d.credentials_ar),
      bio_en: nullIfEmpty(d.bio_en),
      bio_ar: nullIfEmpty(d.bio_ar),
      photo_media_id: d.photo_media_id,
      same_as: lines(d.same_as),
      email: nullIfEmpty(d.email.trim()),
      is_active: d.is_active
    };

    const local: Record<string, string> = {};
    if (!body.slug) local['slug'] = 'common.required';
    if (!body.name_en) local['name_en'] = 'common.required';
    const badUrl = (body.same_as ?? []).findIndex(u => !/^https?:\/\//i.test(u));
    if (badUrl >= 0) local['same_as'] = 'web.authors.same_as_invalid';
    this.errors.set(local);
    this.formError.set(null);
    if (Object.keys(local).length) {
      if (local['name_en']) this.locale.set('en');
      return;
    }

    this.saving.set(true);
    const existing = this.editing();
    const req = existing ? this.api.updateAuthor(existing.id, body) : this.api.createAuthor(body);
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
          this.formError.set(errorMessage(err, 'web.authors.save_failed'));
        } else {
          this.dialog.error('common.error', errorMessage(err, 'web.authors.save_failed'));
        }
      }
    });
  }

  // ── delete / deactivate ─────────────────────────────────────────

  async remove(row: WebsiteAuthor): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.authors.delete_title',
      text: 'web.authors.delete_text',
      params: { name: row.name || row.name_en },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteAuthor(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.authors.deleted');
        if (this.rows().length === 1 && this.page() > 1) this.page.set(this.page() - 1);
        this.load();
      },
      // Refused while the author still signs articles: unsigning them would
      // strip the byline Google uses to judge the content, so offer to retire
      // the author instead (existing articles keep the signature).
      error: async err => {
        const msg = errorMessage(err, 'web.authors.delete_failed');
        if (!row.is_active || !this.canUpdate() || (err?.status !== 409 && err?.status !== 422)) {
          this.dialog.error('common.error', msg);
          return;
        }
        const deactivate = await this.dialog.confirm({
          title: 'web.authors.in_use_title',
          text: `${this.i18n.translate(msg)} ${this.i18n.translate('web.authors.deactivate_instead')}`,
          confirmText: 'web.authors.deactivate',
          icon: 'info'
        });
        if (deactivate) this.setActiveFlag(row, false);
      }
    });
  }

  setActiveFlag(row: WebsiteAuthor, active: boolean): void {
    this.api.updateAuthor(row.id, { is_active: active }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialog.toast('success', 'common.saved');
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.authors.save_failed'))
    });
  }
}
