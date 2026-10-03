import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { Locale, WebsiteCategory } from '../../../../../core/services/website/website.models';
import { nullIfEmpty } from '../shared/website-utils';
import { categoryName } from '../products/catalog-shared';

type Kind = 'product' | 'article';

interface CategoryDraft {
  kind: Kind;
  name_en: string;
  name_ar: string;
  slug_en: string;
  slug_ar: string;
  description_en: string;
  description_ar: string;
  parent_id: string;
  sort_order: string;
  is_active: boolean;
}

function emptyDraft(kind: Kind): CategoryDraft {
  return {
    kind, name_en: '', name_ar: '', slug_en: '', slug_ar: '', description_en: '', description_ar: '',
    parent_id: '', sort_order: '0', is_active: true
  };
}

/**
 * The request body. `CategoryInput` is derived with `Omit` from a type that has
 * an index signature, which erases its named keys, so the body is typed here.
 */
interface CategoryBody {
  kind?: Kind;
  name_en: string;
  name_ar: string | null;
  slug_en: string | null;
  slug_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  parent_id: number | null;
  sort_order: number;
  is_active: boolean;
  [key: string]: unknown;
}

/** Rows shown under their parent, indented by depth. */
interface TreeRow {
  cat: WebsiteCategory;
  depth: number;
}

/**
 * Product and article categories. One table per kind: a category's kind is
 * fixed at creation (products and articles have separate URL spaces), and a
 * parent must be of the same kind. The backend refuses to delete a category
 * that is still in use, so the screen offers deactivating it instead.
 */
@Component({
  selector: 'app-website-categories',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './categories.html',
  styleUrls: ['../shared/website.shared.css', './categories.css']
})
export class Categories {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  readonly kinds: Kind[] = ['product', 'article'];

  kind = signal<Kind>('product');
  all = signal<WebsiteCategory[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  q = signal('');

  // editor
  open = signal(false);
  editing = signal<WebsiteCategory | null>(null);
  draft = signal<CategoryDraft>(emptyDraft('product'));
  locale = signal<Locale>('en');
  saving = signal(false);
  formError = signal<string | null>(null);
  errors = signal<Record<string, string>>({});

  canCreate = computed(() => this.ctx.can('cms.create'));
  canUpdate = computed(() => this.ctx.can('cms.update'));
  canDelete = computed(() => this.ctx.can('cms.delete'));
  canSave = computed(() => (this.editing() ? this.canUpdate() : this.canCreate()));
  lang = computed<Locale>(() => (this.i18n.lang() === 'ar' ? 'ar' : 'en'));

  /** Parent-first tree order; search flattens it to plain matches. */
  rows = computed<TreeRow[]>(() => {
    const list = this.all();
    const q = this.q().toLowerCase();
    if (q) {
      return list
        .filter(c => [c.name_en, c.name_ar, c.slug_en, c.slug_ar].some(v => (v ?? '').toLowerCase().includes(q)))
        .map(cat => ({ cat, depth: 0 }));
    }
    const ids = new Set(list.map(c => c.id));
    const byParent = new Map<number | null, WebsiteCategory[]>();
    for (const c of list) {
      // A parent outside this list (other kind / not loaded) is shown at the root.
      const p = c.parent_id && ids.has(c.parent_id) ? c.parent_id : null;
      byParent.set(p, [...(byParent.get(p) ?? []), c]);
    }
    const sortFn = (a: WebsiteCategory, b: WebsiteCategory) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) || categoryName(a, this.lang()).localeCompare(categoryName(b, this.lang()));
    const out: TreeRow[] = [];
    const seen = new Set<number>();
    const walk = (parent: number | null, depth: number) => {
      for (const c of [...(byParent.get(parent) ?? [])].sort(sortFn)) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        out.push({ cat: c, depth });
        walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  });

  /** Parents a category may take: same kind, not itself, not one of its descendants. */
  parentOptions = computed(() => {
    const self = this.editing();
    const list = this.all();
    if (!self) return list;
    const blocked = new Set<number>([self.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of list) {
        if (c.parent_id && blocked.has(c.parent_id) && !blocked.has(c.id)) {
          blocked.add(c.id);
          grew = true;
        }
      }
    }
    return list.filter(c => !blocked.has(c.id));
  });

  constructor() {
    this.load();
  }

  setKind(k: Kind): void {
    if (k === this.kind()) return;
    this.kind.set(k);
    this.q.set('');
    this.load();
  }

  /** Categories are a short list; one page of 100 covers it and feeds the parent picker. */
  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.categories({ kind: this.kind(), per_page: 100 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.all.set(res.items);
        this.loading.set(false);
      },
      error: err => {
        this.all.set([]);
        this.loadError.set(errorMessage(err, 'web.categories.load_failed'));
        this.loading.set(false);
      }
    });
  }

  name(c: WebsiteCategory): string {
    return categoryName(c, this.lang());
  }

  parentName(c: WebsiteCategory): string {
    if (!c.parent_id) return '—';
    const p = this.all().find(x => x.id === c.parent_id);
    return p ? this.name(p) : `#${c.parent_id}`;
  }

  // ── editor ──────────────────────────────────────────────────────

  create(): void {
    this.editing.set(null);
    this.draft.set(emptyDraft(this.kind()));
    this.openEditor();
  }

  edit(c: WebsiteCategory): void {
    const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
    this.editing.set(c);
    this.draft.set({
      kind: c.kind, name_en: s(c.name_en), name_ar: s(c.name_ar), slug_en: s(c.slug_en), slug_ar: s(c.slug_ar),
      description_en: s(c.description_en), description_ar: s(c.description_ar), parent_id: s(c.parent_id),
      sort_order: s(c.sort_order ?? 0), is_active: c.is_active !== false
    });
    this.openEditor();
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

  set<K extends keyof CategoryDraft>(key: K, value: CategoryDraft[K]): void {
    this.draft.update(d => ({ ...d, [key]: value }));
  }

  errorFor(field: string): string | null {
    return this.errors()[field] ?? null;
  }

  localeHasError(l: Locale): boolean {
    const e = this.errors();
    return ['name_', 'slug_', 'description_'].some(p => !!e[p + l]);
  }

  private payload(): CategoryBody {
    const d = this.draft();
    const body: CategoryBody = {
      name_en: d.name_en.trim(),
      name_ar: nullIfEmpty(d.name_ar.trim()),
      slug_en: nullIfEmpty(d.slug_en.trim()),
      slug_ar: nullIfEmpty(d.slug_ar.trim()),
      description_en: nullIfEmpty(d.description_en.trim()),
      description_ar: nullIfEmpty(d.description_ar.trim()),
      parent_id: d.parent_id ? Number(d.parent_id) : null,
      sort_order: d.sort_order.trim() === '' ? 0 : Math.trunc(Number(d.sort_order)) || 0,
      is_active: d.is_active
    };
    // Kind is set once; the backend does not accept changing it.
    if (!this.editing()) body.kind = d.kind;
    return body;
  }

  save(): void {
    if (!this.canSave() || this.saving()) return;
    const body = this.payload();
    const e: Record<string, string> = {};
    if (!body.name_en) e['name_en'] = 'common.required';
    const slug = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
    if (body.slug_en && !slug.test(body.slug_en)) e['slug_en'] = 'web.categories.err_slug';
    if (body.slug_ar && !slug.test(body.slug_ar)) e['slug_ar'] = 'web.categories.err_slug';
    this.errors.set(e);
    this.formError.set(null);
    if (Object.keys(e).length) {
      if (e['name_en'] || e['slug_en']) this.locale.set('en');
      else if (e['slug_ar']) this.locale.set('ar');
      return;
    }

    this.saving.set(true);
    const existing = this.editing();
    const req = existing ? this.api.updateCategory(existing.id, body) : this.api.createCategory(body);
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
          const fe = fieldErrors(err);
          this.errors.set(fe);
          this.formError.set(errorMessage(err, 'web.categories.save_failed'));
          if (Object.keys(fe).some(k => k.endsWith('_ar')) && !Object.keys(fe).some(k => k.endsWith('_en'))) this.locale.set('ar');
        } else {
          this.dialog.error('common.error', errorMessage(err, 'web.categories.save_failed'));
        }
      }
    });
  }

  // ── delete / activate ───────────────────────────────────────────

  async remove(c: WebsiteCategory): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.categories.delete_title',
      text: 'web.categories.delete_text',
      params: { name: this.name(c) },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteCategory(c.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.categories.deleted');
        this.load();
      },
      // Refused while products/articles (or child categories) still use it.
      // Deactivating hides it from the site without orphaning that content.
      error: async err => {
        const msg = errorMessage(err, 'web.categories.delete_failed');
        if (c.is_active === false || !this.canUpdate() || (err?.status !== 409 && err?.status !== 422)) {
          this.dialog.error('common.error', msg);
          return;
        }
        const deactivate = await this.dialog.confirm({
          title: 'web.categories.in_use_title',
          text: `${this.i18n.translate(msg)} ${this.i18n.translate('web.categories.deactivate_instead')}`,
          confirmText: 'web.categories.deactivate',
          icon: 'info'
        });
        if (deactivate) this.toggle(c, false);
      }
    });
  }

  toggle(c: WebsiteCategory, active: boolean): void {
    this.api.updateCategory(c.id, { is_active: active }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialog.toast('success', active ? 'web.categories.activated' : 'web.categories.deactivated');
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.categories.save_failed'))
    });
  }

  onSearch(v: string): void {
    this.q.set(v.trim());
  }
}
