import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import {
  Locale, WebsiteCta, WebsiteForm, WebsitePageRow, WebsiteProduct
} from '../../../../../core/services/website/website.models';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { nullIfEmpty, pickLocalized } from '../shared/website-utils';

/** What the target section of the editor asks for, derived from the CTA type. */
type TargetKind = 'phone' | 'url' | 'page_or_url' | 'form' | 'product_or_url' | 'optional_form';

/**
 * Section 4 "What each type needs". Anything the backend adds later falls back
 * to a plain URL, which every type can render.
 */
const TARGET_BY_TYPE: Record<string, TargetKind> = {
  call: 'phone',
  whatsapp: 'phone',
  external_link: 'url',
  internal_page: 'page_or_url',
  custom_form: 'form',
  purchase: 'product_or_url',
  book: 'page_or_url',
  check_coverage: 'page_or_url',
  contact: 'optional_form',
  request_demo: 'optional_form',
  become_partner: 'optional_form'
};

const STYLES = ['primary', 'secondary', 'outline', 'link'];

interface CtaDraft {
  key: string;
  type: string;
  label_en: string;
  label_ar: string;
  sublabel_en: string;
  sublabel_ar: string;
  style: string;
  icon: string;
  placement: string;
  tracking_key: string;
  is_enabled: boolean;
  url: string;
  page_id: string;
  product_id: string;
  form_id: string;
  phone: string;
  message_en: string;
  message_ar: string;
}

function emptyDraft(): CtaDraft {
  return {
    key: '', type: '', label_en: '', label_ar: '', sublabel_en: '', sublabel_ar: '',
    style: 'primary', icon: '', placement: '', tracking_key: '', is_enabled: true,
    url: '', page_id: '', product_id: '', form_id: '', phone: '', message_en: '', message_ar: ''
  };
}

/**
 * CTA library. A CTA is defined once here and referenced by blocks, pages,
 * products and menus, so editing it changes every place it renders — which is
 * also why the backend refuses to delete one a block still points at.
 */
@Component({
  selector: 'app-website-ctas',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './ctas.html',
  styleUrls: ['../shared/website.shared.css', './ctas.css']
})
export class Ctas {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  readonly styles = STYLES;

  rows = signal<WebsiteCta[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  total = signal(0);
  readonly perPage = 20;
  page = signal(1);
  q = signal('');
  type = signal('');
  placement = signal('');

  ctaTypes = signal<string[]>([]);
  placements = signal<string[]>([]);

  // editor
  open = signal(false);
  editing = signal<WebsiteCta | null>(null);
  draft = signal<CtaDraft>(emptyDraft());
  locale = signal<Locale>('en');
  /** page / product types can point at an entity or at a URL; this is which. */
  targetMode = signal<'entity' | 'url'>('entity');
  saving = signal(false);
  formError = signal<string | null>(null);
  errors = signal<Record<string, string>>({});
  preview = signal<WebsiteCta['preview'] | null>(null);
  previewLoading = signal(false);

  pages = signal<WebsitePageRow[]>([]);
  forms = signal<WebsiteForm[]>([]);
  products = signal<WebsiteProduct[]>([]);
  private pickersLoaded = false;

  canCreate = computed(() => this.ctx.can('cms.create'));
  canUpdate = computed(() => this.ctx.can('cms.update'));
  canDelete = computed(() => this.ctx.can('cms.delete'));
  canSave = computed(() => (this.editing() ? this.canUpdate() : this.canCreate()));
  target = computed<TargetKind>(() => TARGET_BY_TYPE[this.draft().type] ?? 'url');
  lang = computed<Locale>(() => (this.i18n.lang() === 'ar' ? 'ar' : 'en'));

  onSearch = debounce((v: string) => {
    this.q.set(v.trim());
    this.page.set(1);
    this.load();
  });

  constructor() {
    this.load();
    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => {
        this.ctaTypes.set(e.cta_types ?? []);
        this.placements.set(e.cta_placements ?? []);
      },
      error: () => {}
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .ctas({
        page: this.page(),
        per_page: this.perPage,
        q: this.q() || undefined,
        type: this.type() || undefined,
        placement: this.placement() || undefined
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
          this.loadError.set(errorMessage(err, 'web.ctas.load_failed'));
          this.loading.set(false);
        }
      });
  }

  setFilter(which: 'type' | 'placement', value: string): void {
    this[which].set(value);
    this.page.set(1);
    this.load();
  }

  goToPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  /** Backend `*_label` first, then our fallback key, then the raw value. */
  enumLabel(group: string, value: string | null | undefined, label?: unknown): string {
    if (typeof label === 'string' && label) return label;
    if (!value) return '—';
    const key = `web.enum.${group}.${value}`;
    const t = this.i18n.translate(key);
    return t === key ? value : t;
  }

  // ── editor ──────────────────────────────────────────────────────

  create(): void {
    this.editing.set(null);
    this.draft.set(emptyDraft());
    this.preview.set(null);
    this.openEditor();
  }

  edit(row: WebsiteCta): void {
    this.editing.set(row);
    this.fill(row);
    this.openEditor();
    // The list row has no preview; the single endpoint renders it per language.
    this.previewLoading.set(true);
    this.api.cta(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: full => {
        this.editing.set(full);
        this.fill(full);
        this.preview.set(full.preview ?? null);
        this.previewLoading.set(false);
      },
      error: () => this.previewLoading.set(false)
    });
  }

  private fill(c: WebsiteCta): void {
    const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
    this.draft.set({
      key: s(c.key), type: s(c.type), label_en: s(c.label_en), label_ar: s(c.label_ar),
      sublabel_en: s(c.sublabel_en), sublabel_ar: s(c.sublabel_ar), style: s(c.style) || 'primary',
      icon: s(c.icon), placement: s(c.placement), tracking_key: s(c.tracking_key), is_enabled: !!c.is_enabled,
      url: s(c.url), page_id: s(c.page_id), product_id: s(c.product_id), form_id: s(c.form_id),
      phone: s(c.phone), message_en: s(c.message_en), message_ar: s(c.message_ar)
    });
    this.targetMode.set(c.page_id || c.product_id || !c.url ? 'entity' : 'url');
  }

  private openEditor(): void {
    this.locale.set('en');
    this.errors.set({});
    this.formError.set(null);
    this.open.set(true);
    this.loadPickers();
  }

  close(): void {
    this.open.set(false);
  }

  /** Pickers are only needed once the editor opens; fetched once per visit. */
  private loadPickers(): void {
    if (this.pickersLoaded) return;
    this.pickersLoaded = true;
    this.api.pages({ per_page: 100, status: 'published' }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: r => this.pages.set(r.items), error: () => {} });
    this.api.forms({ per_page: 100 }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: r => this.forms.set(r.items), error: () => {} });
    this.api.products({ per_page: 100 }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: r => this.products.set(r.items), error: () => {} });
  }

  set<K extends keyof CtaDraft>(key: K, value: CtaDraft[K]): void {
    this.draft.update(d => ({ ...d, [key]: value }));
  }

  pageTitle(p: WebsitePageRow): string {
    return pickLocalized(p.translations, 'title', this.lang()) || `#${p.id}`;
  }

  productName(p: WebsiteProduct): string {
    return pickLocalized(p.translations as any, 'name' as any, this.lang()) || p.sku || `#${p.id}`;
  }

  formName(f: WebsiteForm): string {
    return (this.lang() === 'ar' ? f.name_ar : null) || f.name || f.name_en || f.key;
  }

  errorFor(field: string): string | null {
    return this.errors()[field] ?? null;
  }

  /** Marks the EN / AR switch so an error on the hidden language is not missed. */
  localeHasError(l: Locale): boolean {
    const e = this.errors();
    return ['label_', 'sublabel_', 'message_'].some(p => !!e[p + l]);
  }

  /**
   * Builds the body. Target fields the chosen type does not use are sent as
   * null, otherwise switching a CTA from "WhatsApp" to "Internal page" would
   * keep the old phone number around and the backend would still see it.
   */
  private payload() {
    const d = this.draft();
    const t = this.target();
    const mode = this.targetMode();
    const id = (v: string) => (v ? Number(v) : null);
    const usesPage = t === 'page_or_url' && mode === 'entity';
    const usesProduct = t === 'product_or_url' && mode === 'entity';
    const usesUrl = t === 'url' || ((t === 'page_or_url' || t === 'product_or_url') && mode === 'url');
    return {
      key: d.key.trim(),
      type: d.type,
      label_en: d.label_en.trim(),
      label_ar: nullIfEmpty(d.label_ar),
      sublabel_en: nullIfEmpty(d.sublabel_en),
      sublabel_ar: nullIfEmpty(d.sublabel_ar),
      style: d.style || null,
      icon: nullIfEmpty(d.icon),
      placement: d.placement || null,
      tracking_key: nullIfEmpty(d.tracking_key),
      is_enabled: d.is_enabled,
      phone: t === 'phone' ? nullIfEmpty(d.phone) : null,
      message_en: t === 'phone' ? nullIfEmpty(d.message_en) : null,
      message_ar: t === 'phone' ? nullIfEmpty(d.message_ar) : null,
      url: usesUrl ? nullIfEmpty(d.url.trim()) : null,
      page_id: usesPage ? id(d.page_id) : null,
      product_id: usesProduct ? id(d.product_id) : null,
      form_id: t === 'form' || t === 'optional_form' ? id(d.form_id) : null
    };
  }

  /** Cheap checks that save a round trip; the backend re-validates everything. */
  private validate(body: ReturnType<Ctas['payload']>): Record<string, string> {
    const e: Record<string, string> = {};
    if (!body.key) e['key'] = 'common.required';
    if (!body.type) e['type'] = 'common.required';
    if (!body.label_en) e['label_en'] = 'common.required';
    const t = this.target();
    if (t === 'phone' && !body.phone) e['phone'] = 'common.required';
    if (t === 'url' && !body.url) e['url'] = 'common.required';
    if (t === 'url' && body.url && !/^https:\/\//i.test(String(body.url))) e['url'] = 'web.ctas.url_https';
    if (t === 'form' && !body.form_id) e['form_id'] = 'common.required';
    if ((t === 'page_or_url' || t === 'product_or_url') && this.targetMode() === 'url' && !body.url) e['url'] = 'common.required';
    if (t === 'page_or_url' && this.targetMode() === 'entity' && !body.page_id) e['page_id'] = 'common.required';
    if (t === 'product_or_url' && this.targetMode() === 'entity' && !body.product_id) e['product_id'] = 'common.required';
    return e;
  }

  save(): void {
    const body = this.payload();
    const local = this.validate(body);
    this.errors.set(local);
    this.formError.set(null);
    if (Object.keys(local).length) {
      if (local['label_en']) this.locale.set('en');
      return;
    }
    this.saving.set(true);
    const existing = this.editing();
    const req = existing ? this.api.updateCta(existing.id, body) : this.api.createCta(body);
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
          this.formError.set(errorMessage(err, 'web.ctas.save_failed'));
        } else {
          this.dialog.error('common.error', errorMessage(err, 'web.ctas.save_failed'));
        }
      }
    });
  }

  // ── preview ─────────────────────────────────────────────────────

  previewLocales(): Locale[] {
    const p = this.preview();
    return p ? (['en', 'ar'] as Locale[]).filter(l => p[l] !== undefined && p[l] !== null) : [];
  }

  /** The preview shape is not fixed by the contract; read the obvious keys if present. */
  mock(l: Locale): { label: string; sublabel: string; href: string; style: string } | null {
    const v = this.preview()?.[l] as Record<string, unknown> | undefined;
    if (!v || typeof v !== 'object') return null;
    const str = (x: unknown) => (typeof x === 'string' ? x : '');
    const label = str(v['label']) || str(v['text']);
    if (!label) return null;
    return {
      label,
      sublabel: str(v['sublabel']),
      href: str(v['href']) || str(v['url']),
      style: str(v['style']) || this.draft().style || 'primary'
    };
  }

  json(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  // ── delete ──────────────────────────────────────────────────────

  async remove(row: WebsiteCta): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.ctas.delete_title',
      text: 'web.ctas.delete_text',
      params: { key: row.key },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteCta(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.ctas.deleted');
        if (this.rows().length === 1 && this.page() > 1) this.page.set(this.page() - 1);
        this.load();
      },
      // A block still using the CTA blocks the delete. The backend names the
      // block; disabling hides the CTA everywhere without breaking that block.
      error: async err => {
        const msg = errorMessage(err, 'web.ctas.delete_failed');
        if (!row.is_enabled || !this.canUpdate() || (err?.status !== 409 && err?.status !== 422)) {
          this.dialog.error('common.error', msg);
          return;
        }
        const disable = await this.dialog.confirm({
          title: 'web.ctas.in_use_title',
          text: `${this.i18n.translate(msg)} ${this.i18n.translate('web.ctas.disable_instead')}`,
          confirmText: 'web.ctas.disable',
          icon: 'info'
        });
        if (disable) this.toggle(row, false);
      }
    });
  }

  toggle(row: WebsiteCta, enabled: boolean): void {
    this.api.updateCta(row.id, { is_enabled: enabled }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialog.toast('success', enabled ? 'web.ctas.enabled_toast' : 'web.ctas.disabled_toast');
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.ctas.save_failed'))
    });
  }
}
