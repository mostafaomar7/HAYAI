import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import {
  ByLocale, GeoMeta, LOCALES, Locale, ProductInput, ProductRelationsInput, ProductTier, ProductTranslation,
  WebsiteCategory, WebsiteCta, WebsiteFaq, WebsiteMedia, WebsiteProduct, WebsiteSource
} from '../../../../../core/services/website/website.models';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { MediaPicker } from '../shared/media-picker';
import { SeoEditor } from '../shared/seo-editor';
import { GeoEditor } from '../shared/geo-editor';
import { VersionsPanel } from '../shared/versions-panel';
import { fmtMoney, joinLines, lines, nullIfEmpty, translationFor } from '../shared/website-utils';
import { PRICED_TYPES, enumLabel, periodSuffix, priceDisplay } from './catalog-shared';

type Tab = 'general' | 'pricing' | 'content' | 'seo' | 'geo' | 'relations' | 'versions' | 'preview';

/** The backend caps a purchase line at 50 units, so max_quantity above that can never be ordered. */
const MAX_PER_ORDER = 50;

/** Price-related fields: changing any of these on a published product changes the live site. */
const PRICE_KEYS: (keyof ProductInput)[] = ['pricing_type', 'price', 'compare_at_price', 'currency', 'billing_period', 'is_price_public'];

/** Which tab a 422 field path belongs to (the rest default to General). */
const PRICING_KEYS = new Set<string>(PRICE_KEYS as string[]);

interface GeneralDraft {
  type: string;
  sku: string;
  status: string;
  category_id: string;
  availability: string;
  is_featured: boolean;
  is_purchasable: boolean;
  min_quantity: string;
  max_quantity: string;
  subscription_plan_id: string;
  sort_order: string;
  featured_media_id: number | null;
  pricing_type: string;
  price: string;
  compare_at_price: string;
  currency: string;
  billing_period: string;
  is_price_public: boolean;
}

interface TransDraft {
  name: string;
  slug: string;
  short_description: string;
  description: string;
  features: { title: string; description: string }[];
  specifications: { label: string; value: string }[];
  is_enabled: boolean;
  /** Present on the server already (deleting it needs an API call). */
  saved: boolean;
}

interface TierDraft {
  id?: number;
  name_en: string;
  name_ar: string;
  price: string;
  billing_period: string;
  features_en: string;
  features_ar: string;
  is_recommended: boolean;
  is_active: boolean;
}

interface SourceDraft {
  locale: '' | Locale;
  title: string;
  url: string;
  organization: string;
  published_on: string;
  verified_on: string;
}

interface CtaRow {
  cta_id: string;
  placement: string;
  is_enabled: boolean;
}

function emptyGeneral(): GeneralDraft {
  return {
    type: 'service', sku: '', status: 'draft', category_id: '', availability: '',
    is_featured: false, is_purchasable: true, min_quantity: '1', max_quantity: '10',
    subscription_plan_id: '', sort_order: '0', featured_media_id: null,
    pricing_type: '', price: '', compare_at_price: '', currency: 'EGP', billing_period: '', is_price_public: false
  };
}

function emptyTrans(): TransDraft {
  return { name: '', slug: '', short_description: '', description: '', features: [], specifications: [], is_enabled: true, saved: false };
}

function emptyTier(): TierDraft {
  return { name_en: '', name_ar: '', price: '', billing_period: '', features_en: '', features_ar: '', is_recommended: false, is_active: true };
}

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const int = (v: string): number | null => (v.trim() === '' || isNaN(Number(v)) ? null : Math.trunc(Number(v)));
const money = (v: string): number | null => (v.trim() === '' || isNaN(Number(v)) ? null : Number(v));

/**
 * Product / service editor (`products/new`, `products/:id`).
 *
 * Unlike pages, products are edited live: saving a published product changes
 * the site immediately, and every save is snapshotted into the version
 * history instead. That is why a price change on a published product asks
 * first, and why the PATCH only carries what actually changed —
 * `translations`, `tiers` and `gallery` replace the stored list when present,
 * so they are sent whole, and only when they were touched.
 */
@Component({
  selector: 'app-website-product-editor',
  standalone: true,
  imports: [CommonModule, TPipe, MediaPicker, SeoEditor, GeoEditor, VersionsPanel],
  templateUrl: './product-editor.html',
  styleUrls: ['../shared/website.shared.css', './product-editor.css']
})
export class ProductEditor {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  readonly locales = LOCALES;
  readonly maxPerOrder = MAX_PER_ORDER;

  id = signal<number | null>(null);
  product = signal<WebsiteProduct | null>(null);
  loading = signal(false);
  loadError = signal<string | null>(null);
  tab = signal<Tab>('general');
  locale = signal<Locale>('en');

  // working copies
  general = signal<GeneralDraft>(emptyGeneral());
  trans = signal<Record<Locale, TransDraft | null>>({ en: emptyTrans(), ar: null });
  tiers = signal<TierDraft[]>([]);
  gallery = signal<number[]>([]);

  /** JSON of each body part as loaded, to send only what changed. */
  private baseline = signal<{ general: ProductInput; translations: string; tiers: string; gallery: string } | null>(null);

  saving = signal(false);
  formError = signal<string | null>(null);
  errors = signal<Record<string, string>>({});

  // enums / pickers
  statuses = signal<string[]>([]);
  pricingTypes = signal<string[]>([]);
  availabilities = signal<string[]>([]);
  billingPeriods = signal<string[]>([]);
  placements = signal<string[]>([]);
  categories = signal<WebsiteCategory[]>([]);

  // relations
  sources = signal<SourceDraft[]>([]);
  faqs = signal<WebsiteFaq[]>([]);
  ctaRows = signal<CtaRow[]>([]);
  private relBaseline = signal<{ sources: string; faqs: string; ctas: string }>({ sources: '[]', faqs: '[]', ctas: '[]' });
  relSaving = signal(false);
  relError = signal<string | null>(null);
  ctaOptions = signal<WebsiteCta[]>([]);
  faqResults = signal<WebsiteFaq[]>([]);
  faqSearching = signal(false);
  private faqQuery = '';
  private relPickersLoaded = false;

  // GEO saved during this visit (products have no GEO read endpoint)
  private geoSaved = signal<ByLocale<GeoMeta>>({});

  // preview
  preview = signal<any>(null);
  previewLoading = signal(false);
  previewError = signal<string | null>(null);
  previewLocale = signal<Locale>('en');

  // buy-box mock
  mockTier = signal<number>(-1);
  mockQty = signal(1);

  isNew = computed(() => this.id() === null);
  canEdit = computed(() => this.ctx.can(this.isNew() ? 'products.create' : 'products.update'));
  canUpdate = computed(() => this.ctx.can('products.update'));
  lang = computed<Locale>(() => (this.i18n.lang() === 'ar' ? 'ar' : 'en'));
  presentLocales = computed(() => LOCALES.filter(l => !!this.trans()[l]));
  current = computed(() => this.trans()[this.locale()]);

  title = computed(() => {
    const t = this.trans();
    const order: Locale[] = this.lang() === 'ar' ? ['ar', 'en'] : ['en', 'ar'];
    for (const l of order) if (t[l]?.name.trim()) return t[l]!.name.trim();
    return '';
  });

  /** Live URLs from the payload when available; otherwise the canonical shape. */
  publicUrl = computed(() => {
    const t = this.current();
    if (!t?.slug.trim()) return null;
    return `https://hayaihealthcare.com/${this.locale()}/products/${t.slug.trim()}`;
  });

  dirtyParts = computed(() => this.changedParts());
  dirty = computed(() => {
    if (this.isNew()) return true;
    const p = this.dirtyParts();
    return Object.keys(p.general).length > 0 || p.translations || p.tiers || p.gallery;
  });
  relDirty = computed(() => {
    const b = this.relBaseline();
    return {
      sources: JSON.stringify(this.sourcesBody()) !== b.sources,
      faqs: JSON.stringify(this.faqs().map(f => f.id)) !== b.faqs,
      ctas: JSON.stringify(this.ctasBody()) !== b.ctas
    };
  });

  /** A public figure needs both the flag and a type that carries a price. */
  priceShown = computed(() => this.general().is_price_public && PRICED_TYPES.has(this.general().pricing_type));

  constructor() {
    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => {
        this.statuses.set(e.product_statuses ?? []);
        this.pricingTypes.set(e.pricing_types ?? []);
        this.availabilities.set(e.availability ?? []);
        this.billingPeriods.set(e.billing_periods ?? []);
        this.placements.set(e.cta_placements ?? []);
        // Sensible defaults for a new product, taken from the enum, not hardcoded.
        if (this.isNew()) {
          this.general.update(g => ({
            ...g,
            pricing_type: g.pricing_type || (e.pricing_types ?? [])[0] || '',
            availability: g.availability || (e.availability ?? [])[0] || ''
          }));
        }
      },
      error: () => {}
    });
    this.api.categories({ kind: 'product', per_page: 100 }).pipe(takeUntilDestroyed()).subscribe({
      next: r => this.categories.set(r.items),
      error: () => {}
    });
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(pm => {
      const raw = pm.get('id');
      const id = raw && raw !== 'new' ? Number(raw) : null;
      this.id.set(id);
      this.tab.set('general');
      if (id) this.load();
    });
  }

  // ── load ────────────────────────────────────────────────────────

  load(): void {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.api.product(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => {
        this.fill(p);
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(errorMessage(err, 'web.products.load_failed'));
        this.loading.set(false);
      }
    });
  }

  private fill(p: WebsiteProduct): void {
    this.product.set(p);
    this.general.set({
      type: s(p.type), sku: s(p.sku), status: s(p.status) || 'draft', category_id: s(p.category_id),
      availability: s(p.availability), is_featured: !!p.is_featured, is_purchasable: !!p.is_purchasable,
      min_quantity: s(p.min_quantity ?? 1), max_quantity: s(p.max_quantity ?? ''),
      subscription_plan_id: s(p.subscription_plan_id), sort_order: s(p.sort_order ?? 0),
      featured_media_id: p.featured_media_id ?? (p.featured_media as WebsiteMedia | null | undefined)?.id ?? null,
      pricing_type: s(p.pricing_type), price: s(p.price), compare_at_price: s(p.compare_at_price),
      currency: s(p.currency) || 'EGP', billing_period: s(p.billing_period), is_price_public: !!p.is_price_public
    });

    const t: Record<Locale, TransDraft | null> = { en: null, ar: null };
    for (const l of LOCALES) {
      const row = translationFor(p.translations as ProductTranslation[] | ByLocale<ProductTranslation>, l);
      if (!row) continue;
      t[l] = {
        name: s(row.name), slug: s(row.slug), short_description: s(row.short_description), description: s(row.description),
        features: (row.features ?? []).map(f => ({ title: s(f.title), description: s(f.description) })),
        specifications: (row.specifications ?? []).map(x => ({ label: s(x.label), value: s(x.value) })),
        is_enabled: row.is_enabled !== false,
        saved: true
      };
    }
    this.trans.set(t);
    if (!t[this.locale()]) this.locale.set(LOCALES.find(l => !!t[l]) ?? 'en');

    this.tiers.set([...(p.tiers ?? [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(x => ({
        id: x.id, name_en: s(x.name_en), name_ar: s(x.name_ar), price: s(x.price), billing_period: s(x.billing_period),
        features_en: joinLines(x.features_en), features_ar: joinLines(x.features_ar),
        is_recommended: !!x.is_recommended, is_active: x.is_active !== false
      })));
    this.gallery.set((p.gallery ?? []).map(g => (typeof g === 'number' ? g : g.id)));

    this.baseline.set({
      general: this.generalBody(),
      translations: JSON.stringify(this.translationsBody()),
      tiers: JSON.stringify(this.tiersBody()),
      gallery: JSON.stringify(this.gallery())
    });

    this.sources.set((p.sources ?? []).map(x => ({
      locale: (x.locale ?? '') as SourceDraft['locale'], title: s(x.title), url: s(x.url), organization: s(x.organization),
      published_on: s(x.published_on).slice(0, 10), verified_on: s(x.verified_on).slice(0, 10)
    })));
    this.faqs.set([...(p.faqs ?? [])]);
    this.ctaRows.set((p.ctas ?? []).map(c => ({ cta_id: s(c.cta_id ?? c.cta?.id), placement: s(c.placement), is_enabled: c.is_enabled !== false })));
    this.relBaseline.set({
      sources: JSON.stringify(this.sourcesBody()),
      faqs: JSON.stringify(this.faqs().map(f => f.id)),
      ctas: JSON.stringify(this.ctasBody())
    });
    this.geoSaved.set({});
    this.mockTier.set(-1);
    this.mockQty.set(Math.max(1, int(this.general().min_quantity) ?? 1));
  }

  // ── draft setters ───────────────────────────────────────────────

  setG<K extends keyof GeneralDraft>(key: K, value: GeneralDraft[K]): void {
    this.general.update(g => ({ ...g, [key]: value }));
  }

  setT<K extends keyof TransDraft>(key: K, value: TransDraft[K]): void {
    const l = this.locale();
    this.trans.update(t => (t[l] ? { ...t, [l]: { ...t[l]!, [key]: value } } : t));
  }

  addLanguage(l: Locale): void {
    this.trans.update(t => ({ ...t, [l]: emptyTrans() }));
    this.locale.set(l);
  }

  addFeature(): void {
    this.setT('features', [...(this.current()?.features ?? []), { title: '', description: '' }]);
  }

  setFeature(i: number, key: 'title' | 'description', value: string): void {
    this.setT('features', (this.current()?.features ?? []).map((f, j) => (j === i ? { ...f, [key]: value } : f)));
  }

  removeFeature(i: number): void {
    this.setT('features', (this.current()?.features ?? []).filter((_, j) => j !== i));
  }

  addSpec(): void {
    this.setT('specifications', [...(this.current()?.specifications ?? []), { label: '', value: '' }]);
  }

  setSpec(i: number, key: 'label' | 'value', value: string): void {
    this.setT('specifications', (this.current()?.specifications ?? []).map((f, j) => (j === i ? { ...f, [key]: value } : f)));
  }

  removeSpec(i: number): void {
    this.setT('specifications', (this.current()?.specifications ?? []).filter((_, j) => j !== i));
  }

  moveRow<T>(list: T[], i: number, dir: -1 | 1): T[] {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const out = [...list];
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  }

  moveFeature(i: number, dir: -1 | 1): void {
    this.setT('features', this.moveRow(this.current()?.features ?? [], i, dir));
  }

  // tiers
  addTier(): void {
    this.tiers.update(list => [...list, emptyTier()]);
  }

  setTier<K extends keyof TierDraft>(i: number, key: K, value: TierDraft[K]): void {
    this.tiers.update(list => list.map((t, j) => {
      if (j === i) return { ...t, [key]: value };
      // Only one tier can be "recommended": ticking one clears the others.
      if (key === 'is_recommended' && value === true) return { ...t, is_recommended: false };
      return t;
    }));
  }

  moveTier(i: number, dir: -1 | 1): void {
    this.tiers.update(list => this.moveRow(list, i, dir));
  }

  removeTier(i: number): void {
    this.tiers.update(list => list.filter((_, j) => j !== i));
    this.mockTier.set(-1);
  }

  // ── bodies ──────────────────────────────────────────────────────

  private generalBody(): ProductInput {
    const g = this.general();
    return {
      type: g.type.trim(),
      sku: nullIfEmpty(g.sku.trim()),
      status: g.status as WebsiteProduct['status'],
      category_id: int(g.category_id),
      availability: g.availability,
      is_featured: g.is_featured,
      is_purchasable: g.is_purchasable,
      min_quantity: int(g.min_quantity) ?? 1,
      max_quantity: int(g.max_quantity) ?? undefined,
      subscription_plan_id: int(g.subscription_plan_id),
      sort_order: int(g.sort_order) ?? 0,
      featured_media_id: g.featured_media_id,
      pricing_type: g.pricing_type,
      price: money(g.price),
      compare_at_price: money(g.compare_at_price),
      currency: g.currency.trim().toUpperCase() || 'EGP',
      billing_period: g.billing_period || null,
      is_price_public: g.is_price_public
    };
  }

  private translationsBody(): ByLocale<ProductTranslation> {
    const out: ByLocale<ProductTranslation> = {};
    for (const l of LOCALES) {
      const t = this.trans()[l];
      if (!t) continue;
      out[l] = {
        name: t.name.trim(),
        // Empty slug → omitted, so the backend generates one from the name.
        slug: t.slug.trim() || undefined,
        short_description: nullIfEmpty(t.short_description),
        description: nullIfEmpty(t.description),
        features: t.features
          .filter(f => f.title.trim() || f.description.trim())
          .map(f => ({ title: f.title.trim(), description: nullIfEmpty(f.description.trim()) })),
        specifications: t.specifications
          .filter(x => x.label.trim() || x.value.trim())
          .map(x => ({ label: x.label.trim(), value: x.value.trim() })),
        is_enabled: t.is_enabled
      };
    }
    return out;
  }

  private tiersBody(): ProductTier[] {
    return this.tiers().map((t, i) => ({
      ...(t.id ? { id: t.id } : {}),
      name_en: t.name_en.trim(),
      name_ar: nullIfEmpty(t.name_ar.trim()),
      price: money(t.price),
      billing_period: t.billing_period || null,
      features_en: lines(t.features_en),
      features_ar: lines(t.features_ar),
      is_recommended: t.is_recommended,
      is_active: t.is_active,
      sort_order: i
    }));
  }

  private changedParts(): { general: ProductInput; translations: boolean; tiers: boolean; gallery: boolean } {
    const b = this.baseline();
    const g = this.generalBody();
    if (!b) return { general: g, translations: true, tiers: this.tiers().length > 0, gallery: this.gallery().length > 0 };
    const general: ProductInput = {};
    for (const k of Object.keys(g) as (keyof ProductInput)[]) {
      if (JSON.stringify(g[k] ?? null) !== JSON.stringify(b.general[k] ?? null)) (general as any)[k] = g[k];
    }
    return {
      general,
      translations: JSON.stringify(this.translationsBody()) !== b.translations,
      tiers: JSON.stringify(this.tiersBody()) !== b.tiers,
      gallery: JSON.stringify(this.gallery()) !== b.gallery
    };
  }

  // ── validation ──────────────────────────────────────────────────

  /** Cheap checks that save a round trip; the backend re-validates everything. */
  private validate(): Record<string, string> {
    const e: Record<string, string> = {};
    const g = this.general();
    if (!g.type.trim()) e['type'] = 'common.required';
    if (!g.pricing_type) e['pricing_type'] = 'common.required';
    if (!g.availability) e['availability'] = 'common.required';

    const min = int(g.min_quantity);
    const max = int(g.max_quantity);
    if (min === null || min < 1) e['min_quantity'] = 'web.products.err_min_qty';
    if (max !== null && max > MAX_PER_ORDER) e['max_quantity'] = 'web.products.err_max_qty';
    if (min !== null && max !== null && min > max) e['max_quantity'] = 'web.products.err_min_max';
    if (g.price.trim() && (money(g.price) ?? -1) < 0) e['price'] = 'web.products.err_price';
    if (g.compare_at_price.trim() && (money(g.compare_at_price) ?? -1) < 0) e['compare_at_price'] = 'web.products.err_price';
    if (g.subscription_plan_id.trim() && int(g.subscription_plan_id) === null) e['subscription_plan_id'] = 'web.products.err_number';

    const present = this.presentLocales();
    if (!present.length) e['translations'] = 'web.products.err_no_language';
    for (const l of present) {
      const t = this.trans()[l]!;
      if (!t.name.trim()) e[`translations.${l}.name`] = 'common.required';
      if (t.slug.trim() && !/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(t.slug.trim())) e[`translations.${l}.slug`] = 'web.products.err_slug';
      t.features.forEach((f, i) => {
        if (!f.title.trim() && f.description.trim()) e[`translations.${l}.features.${i}.title`] = 'common.required';
      });
      t.specifications.forEach((x, i) => {
        if (!x.label.trim() && x.value.trim()) e[`translations.${l}.specifications.${i}.label`] = 'common.required';
        if (x.label.trim() && !x.value.trim()) e[`translations.${l}.specifications.${i}.value`] = 'common.required';
      });
    }
    // Publishing needs at least one language the site can actually serve.
    if (g.status === 'published' && !present.some(l => this.trans()[l]!.is_enabled && this.trans()[l]!.name.trim())) {
      e['status'] = 'web.products.err_publish_language';
    }
    this.tiers().forEach((t, i) => {
      if (!t.name_en.trim()) e[`tiers.${i}.name_en`] = 'common.required';
      if (t.price.trim() && (money(t.price) ?? -1) < 0) e[`tiers.${i}.price`] = 'web.products.err_price';
    });
    return e;
  }

  // ── save ────────────────────────────────────────────────────────

  async save(): Promise<void> {
    if (!this.canEdit() || this.saving()) return;
    const local = this.validate();
    this.errors.set(local);
    this.formError.set(null);
    if (Object.keys(local).length) {
      this.formError.set('web.products.fix_errors');
      this.jumpToError(local);
      return;
    }

    const id = this.id();
    if (!id) {
      this.submit(null, {
        ...this.generalBody(),
        translations: this.translationsBody(),
        tiers: this.tiersBody(),
        gallery: this.gallery()
      });
      return;
    }

    const parts = this.changedParts();
    const body: ProductInput = { ...parts.general };
    if (parts.translations) body.translations = this.translationsBody();
    if (parts.tiers) body.tiers = this.tiersBody();
    if (parts.gallery) body.gallery = this.gallery();
    if (!Object.keys(body).length) {
      this.dialog.toast('info', 'web.products.nothing_changed');
      return;
    }

    // Products have no draft copy: a price edit on a published product is on
    // the site the moment it saves (and is audited as product.price_changed).
    const priceChanged = parts.tiers || PRICE_KEYS.some(k => k in parts.general);
    if (this.product()?.status === 'published' && priceChanged) {
      const ok = await this.dialog.confirm({
        title: 'web.products.price_confirm_title',
        text: 'web.products.price_confirm_text',
        confirmText: 'web.products.price_confirm_ok',
        icon: 'warning'
      });
      if (!ok) return;
    }
    this.submit(id, body);
  }

  private submit(id: number | null, body: ProductInput): void {
    this.saving.set(true);
    const req = id ? this.api.updateProduct(id, body) : this.api.createProduct(body);
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => {
        this.saving.set(false);
        this.dialog.toast('success', 'common.saved');
        if (!id) {
          this.router.navigate(['/dashboard/website/products', p.id]);
          return;
        }
        // Prefer the fresh payload; refetch if the update returned a partial row.
        if (p && p.translations) this.fill(p);
        else this.load();
      },
      error: err => {
        this.saving.set(false);
        if (err?.status === 422) {
          const fe = fieldErrors(err);
          this.errors.set(fe);
          this.formError.set(errorMessage(err, 'web.products.save_failed'));
          this.jumpToError(fe);
        } else {
          this.dialog.error('common.error', errorMessage(err, 'web.products.save_failed'));
        }
      }
    });
  }

  private tabOf(key: string): Tab {
    if (key.startsWith('translations')) return 'content';
    if (key.startsWith('tiers') || PRICING_KEYS.has(key)) return 'pricing';
    if (/^(sources|faq_ids|ctas)/.test(key)) return 'relations';
    return 'general';
  }

  /** Opens the first tab (and language) that has an error so it is not missed. */
  private jumpToError(errs: Record<string, string>): void {
    const keys = Object.keys(errs);
    if (!keys.length) return;
    const order: Tab[] = ['general', 'pricing', 'content', 'relations'];
    const first = order.find(t => keys.some(k => this.tabOf(k) === t));
    if (first) this.tab.set(first);
    if (first === 'content') {
      const m = keys.map(k => /^translations\.(en|ar)\./.exec(k)).find(Boolean);
      if (m && this.trans()[m[1] as Locale]) this.locale.set(m[1] as Locale);
    }
  }

  errorFor(field: string): string | null {
    return this.errors()[field] ?? null;
  }

  tErr(field: string): string | null {
    return this.errorFor(`translations.${this.locale()}.${field}`);
  }

  tabHasError(tab: Tab): boolean {
    return Object.keys(this.errors()).some(k => this.tabOf(k) === tab);
  }

  localeHasError(l: Locale): boolean {
    return Object.keys(this.errors()).some(k => k.startsWith(`translations.${l}.`));
  }

  /** Errors the inputs do not show (unknown paths), listed under the form error. */
  otherErrors = computed(() => {
    const shown = /^(type|sku|status|category_id|availability|min_quantity|max_quantity|subscription_plan_id|sort_order|featured_media_id|gallery|pricing_type|price|compare_at_price|currency|billing_period|translations\.(en|ar)\.|tiers\.\d+\.(name_en|name_ar|price|billing_period|features_en|features_ar))/;
    return Object.entries(this.errors()).filter(([k]) => !shown.test(k)).map(([k, v]) => ({ key: k, msg: v }));
  });

  // ── languages ───────────────────────────────────────────────────

  async deleteLanguage(): Promise<void> {
    const l = this.locale();
    const t = this.trans()[l];
    if (!t || this.presentLocales().length < 2) return;
    const id = this.id();
    if (!id || !t.saved) {
      // Never saved: drop it from the working copy only.
      this.trans.update(x => ({ ...x, [l]: null }));
      this.locale.set(this.presentLocales()[0]);
      return;
    }
    const ok = await this.dialog.confirm({
      title: 'web.products.delete_lang_title',
      text: 'web.products.delete_lang_text',
      params: { lang: this.i18n.translate(`web.products.lang_${l}`) },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteProductTranslation(id, l).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.products.lang_deleted');
        this.locale.set(LOCALES.find(x => x !== l) ?? 'en');
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.products.save_failed'))
    });
  }

  // ── SEO / GEO ───────────────────────────────────────────────────

  /**
   * GEO for the current language. There is no GEO GET for products: it rides
   * on the product payload, either on the translation or as a top-level
   * `geo` keyed by locale. A save during this visit wins over both.
   */
  geoFor(l: Locale): GeoMeta | null {
    const saved = this.geoSaved()[l];
    if (saved) return saved;
    const p = this.product();
    if (!p) return null;
    const onTrans = translationFor(p.translations as ProductTranslation[] | ByLocale<ProductTranslation>, l)?.geo;
    if (onTrans) return onTrans;
    const top = p['geo'] as ByLocale<GeoMeta> | null | undefined;
    return (top && typeof top === 'object' ? top[l] : null) ?? null;
  }

  onGeoSaved(l: Locale, geo: GeoMeta): void {
    this.geoSaved.update(g => ({ ...g, [l]: geo }));
  }

  // ── relations ───────────────────────────────────────────────────

  openTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'relations') this.loadRelPickers();
    if (t === 'preview' && !this.preview() && this.id()) this.loadPreview();
  }

  private loadRelPickers(): void {
    if (this.relPickersLoaded) return;
    this.relPickersLoaded = true;
    this.api.ctas({ per_page: 100 }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: r => this.ctaOptions.set(r.items), error: () => {} });
    this.searchFaqs('');
  }

  onFaqSearch = debounce((v: string) => this.searchFaqs(v.trim()));

  private searchFaqs(q: string): void {
    this.faqQuery = q;
    this.faqSearching.set(true);
    this.api.faqs({ q: q || undefined, per_page: 15 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        if (q !== this.faqQuery) return;
        this.faqResults.set(r.items);
        this.faqSearching.set(false);
      },
      error: () => this.faqSearching.set(false)
    });
  }

  isAttached(f: WebsiteFaq): boolean {
    return this.faqs().some(x => x.id === f.id);
  }

  attachFaq(f: WebsiteFaq): void {
    if (!this.isAttached(f)) this.faqs.update(list => [...list, f]);
  }

  detachFaq(i: number): void {
    this.faqs.update(list => list.filter((_, j) => j !== i));
  }

  moveFaq(i: number, dir: -1 | 1): void {
    this.faqs.update(list => this.moveRow(list, i, dir));
  }

  addSource(): void {
    this.sources.update(list => [...list, { locale: '', title: '', url: '', organization: '', published_on: '', verified_on: '' }]);
  }

  setSource<K extends keyof SourceDraft>(i: number, key: K, value: SourceDraft[K]): void {
    this.sources.update(list => list.map((x, j) => (j === i ? { ...x, [key]: value } : x)));
  }

  removeSource(i: number): void {
    this.sources.update(list => list.filter((_, j) => j !== i));
  }

  addCta(): void {
    this.ctaRows.update(list => [...list, { cta_id: '', placement: this.placements()[0] ?? '', is_enabled: true }]);
  }

  setCta<K extends keyof CtaRow>(i: number, key: K, value: CtaRow[K]): void {
    this.ctaRows.update(list => list.map((x, j) => (j === i ? { ...x, [key]: value } : x)));
  }

  removeCta(i: number): void {
    this.ctaRows.update(list => list.filter((_, j) => j !== i));
  }

  ctaLabel(c: WebsiteCta): string {
    const label = (this.lang() === 'ar' ? c.label_ar : null) || c.label_en;
    return `${c.key} — ${label}`;
  }

  private sourcesBody(): WebsiteSource[] {
    return this.sources().map(x => ({
      locale: x.locale || null,
      title: x.title.trim(),
      url: x.url.trim(),
      organization: nullIfEmpty(x.organization.trim()),
      published_on: x.published_on || null,
      verified_on: x.verified_on || null
    }));
  }

  private ctasBody(): { cta_id: number; placement: string; is_enabled: boolean }[] {
    return this.ctaRows().map(c => ({ cta_id: Number(c.cta_id), placement: c.placement, is_enabled: c.is_enabled }));
  }

  /** Sends only the relation lists that changed; each one replaces when present. */
  saveRelations(): void {
    const id = this.id();
    if (!id || !this.canUpdate()) return;
    const d = this.relDirty();
    const e: Record<string, string> = {};
    const sources = this.sourcesBody();
    if (d.sources) {
      sources.forEach((x, i) => {
        if (!x.title) e[`sources.${i}.title`] = 'common.required';
        if (!x.url) e[`sources.${i}.url`] = 'common.required';
        else if (!/^https?:\/\//i.test(x.url)) e[`sources.${i}.url`] = 'web.products.err_url';
      });
    }
    const ctas = this.ctasBody();
    if (d.ctas) {
      ctas.forEach((c, i) => {
        if (!c.cta_id) e[`ctas.${i}.cta_id`] = 'common.required';
        if (!c.placement) e[`ctas.${i}.placement`] = 'common.required';
      });
    }
    this.errors.set(e);
    this.relError.set(null);
    if (Object.keys(e).length) return;

    const body: ProductRelationsInput = {};
    if (d.sources) body.sources = sources;
    if (d.faqs) body.faq_ids = this.faqs().map(f => f.id);
    if (d.ctas) body.ctas = ctas;
    if (!Object.keys(body).length) {
      this.dialog.toast('info', 'web.products.nothing_changed');
      return;
    }
    this.relSaving.set(true);
    this.api.saveProductRelations(id, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.relSaving.set(false);
        this.relBaseline.set({
          sources: JSON.stringify(this.sourcesBody()),
          faqs: JSON.stringify(this.faqs().map(f => f.id)),
          ctas: JSON.stringify(this.ctasBody())
        });
        this.dialog.toast('success', 'common.saved');
      },
      error: err => {
        this.relSaving.set(false);
        if (err?.status === 422) {
          this.errors.set(fieldErrors(err));
          this.relError.set(errorMessage(err, 'web.products.save_failed'));
        } else {
          this.dialog.error('common.error', errorMessage(err, 'web.products.save_failed'));
        }
      }
    });
  }

  // ── preview ─────────────────────────────────────────────────────

  setPreviewLocale(l: Locale): void {
    this.previewLocale.set(l);
    this.loadPreview();
  }

  loadPreview(): void {
    const id = this.id();
    if (!id) return;
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.api.preview('products', id, this.previewLocale()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.preview.set(res ?? {});
        this.previewLoading.set(false);
      },
      error: err => {
        this.preview.set(null);
        this.previewError.set(errorMessage(err, 'web.products.preview_failed'));
        this.previewLoading.set(false);
      }
    });
  }

  /**
   * The preview is the public product payload. Its exact nesting is not fixed
   * by the contract (`{ product: … }`, `{ data: … }` or flat), so the obvious
   * keys are read defensively and the raw payload is shown underneath.
   */
  pv = computed(() => {
    const res = this.preview();
    if (!res) return null;
    const p = res.product ?? res.data ?? res.entity ?? res;
    const str = (x: unknown) => (typeof x === 'string' || typeof x === 'number' ? String(x) : '');
    const price = p.price;
    const priceText = str(p.price_display) || str(p.price_label)
      || (price && typeof price === 'object' ? str(price.display) || str(price.label) || str(price.formatted) : '')
      || (price !== null && price !== undefined && typeof price !== 'object'
        ? priceDisplay(this.i18n, { pricing_type: p.pricing_type, price, currency: p.currency, billing_period: p.billing_period }, this.previewLocale())
        : '');
    const schema = res.schema ?? res.json_ld ?? res.structured_data ?? p.schema ?? p.json_ld ?? res.seo?.schema ?? res.meta?.seo?.schema ?? null;
    return {
      name: str(p.name) || str(p.title),
      shortDescription: str(p.short_description),
      price: priceText,
      availability: str(p.availability_label) || (p.availability ? enumLabel(this.i18n, 'availability', p.availability) : ''),
      url: str(p.url) || str(res.url) || str(res.seo?.canonical),
      tiers: Array.isArray(p.tiers) ? p.tiers : [],
      schema
    };
  });

  json(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  // ── buy-box mock ────────────────────────────────────────────────

  activeTiers = computed(() => this.tiers().map((t, i) => ({ t, i })).filter(x => x.t.is_active));

  mockName = computed(() => {
    const l = this.locale();
    return this.trans()[l]?.name.trim() || this.title() || this.i18n.translate('web.products.untitled');
  });

  /** The headline price exactly as the public site would print it. */
  mockPrice = computed(() => {
    const g = this.general();
    if (!this.priceShown()) {
      return PRICED_TYPES.has(g.pricing_type)
        ? this.i18n.translate('web.products.mock_price_hidden')
        : enumLabel(this.i18n, 'pricing_type', g.pricing_type || null);
    }
    return priceDisplay(this.i18n, g, this.locale());
  });

  mockCompare = computed(() => {
    const g = this.general();
    if (!this.priceShown() || !g.compare_at_price.trim() || money(g.compare_at_price) === null) return '';
    if ((money(g.compare_at_price) ?? 0) <= (money(g.price) ?? 0)) return '';
    return fmtMoney(g.compare_at_price, g.currency || 'EGP', this.locale());
  });

  tierPrice(t: TierDraft): string {
    const g = this.general();
    if (!this.priceShown()) return '';
    if (!t.price.trim()) return enumLabel(this.i18n, 'pricing_type', 'contact_for_price');
    return fmtMoney(t.price, g.currency || 'EGP', this.locale()) + periodSuffix(this.i18n, t.billing_period || g.billing_period);
  }

  tierName(t: TierDraft): string {
    return (this.locale() === 'ar' ? t.name_ar.trim() : '') || t.name_en.trim() || '—';
  }

  tierFeatures(t: TierDraft): string[] {
    return lines(this.locale() === 'ar' && t.features_ar.trim() ? t.features_ar : t.features_en).slice(0, 4);
  }

  mockMin = computed(() => Math.max(1, int(this.general().min_quantity) ?? 1));
  mockMax = computed(() => Math.min(MAX_PER_ORDER, int(this.general().max_quantity) ?? MAX_PER_ORDER));

  stepQty(dir: -1 | 1): void {
    this.mockQty.update(q => Math.min(this.mockMax(), Math.max(this.mockMin(), q + dir)));
  }

  /** Purchase shows only when the product is purchasable and has a figure to buy at. */
  mockCanBuy = computed(() => this.general().is_purchasable && this.priceShown());

  // ── misc ────────────────────────────────────────────────────────

  label(group: string, value: string | null | undefined, apiLabel?: unknown): string {
    return enumLabel(this.i18n, group, value, apiLabel);
  }

  async back(): Promise<void> {
    if (this.dirty() && this.canEdit() && !this.isNew()) {
      const ok = await this.dialog.confirm({
        title: 'web.products.leave_title',
        text: 'web.products.leave_text',
        confirmText: 'web.products.leave_ok'
      });
      if (!ok) return;
    }
    this.router.navigate(['/dashboard/website/products']);
  }

  onRestored(): void {
    this.preview.set(null);
    this.load();
  }
}
