import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  WebsiteApiService, errorMessage, fieldErrors
} from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import {
  Locale, ProductTier, StatusFlow, WebsiteAdmin, WebsiteProduct, WebsitePurchase
} from '../../../../../core/services/website/website.models';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { fmtDate, fmtMoney, nullIfEmpty, pickLocalized } from '../shared/website-utils';
import { adminLabel, enumLabel } from './sales-shared';

interface ItemDraft {
  product_id: string;
  price_tier_id: string;
  quantity: number;
}

interface OrderDraft {
  organization_name: string;
  organization_type: string;
  contact_name: string;
  email: string;
  phone: string;
  job_title: string;
  country: string;
  city: string;
  notes: string;
  locale: Locale;
  consent: boolean;
  items: ItemDraft[];
}

const emptyOrder = (): OrderDraft => ({
  organization_name: '', organization_type: '', contact_name: '', email: '', phone: '',
  job_title: '', country: '', city: '', notes: '', locale: 'en', consent: false,
  items: [{ product_id: '', price_tier_id: '', quantity: 1 }]
});

/**
 * Website purchase requests (quote / order requests from the public site).
 *
 * The status tabs come from `meta.counts`, so each one shows how many requests
 * sit in it without a second call. Drafts are carts a visitor never submitted:
 * the API leaves them out of every list except `status=draft`, which is why
 * "all" does not include them and they get a tab of their own at the end.
 */
@Component({
  selector: 'app-purchase-list',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './purchase-list.html',
  styleUrls: ['../shared/website.shared.css', './purchase-list.css']
})
export class PurchaseList {
  private api = inject(WebsiteApiService);
  readonly ctx = inject(WebsiteContextService);
  private i18n = inject(I18nService);
  private dialog = inject(DialogService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  rows = signal<WebsitePurchase[]>([]);
  counts = signal<Record<string, number>>({});
  flows = signal<StatusFlow[]>([]);
  admins = signal<WebsiteAdmin[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  total = signal(0);
  readonly perPage = 20;
  page = signal(1);

  status = signal('');
  search = signal('');
  from = signal('');
  to = signal('');
  assignedTo = signal('');

  private sub?: Subscription;

  /** "all" first, then every status the enum knows, drafts last (they are not real requests yet). */
  tabs = computed(() => {
    const values = this.flows().map(f => f.value);
    for (const k of Object.keys(this.counts())) {
      if (k !== 'all' && !values.includes(k)) values.push(k);
    }
    const ordered = values.filter(v => v !== 'draft');
    if (values.includes('draft')) ordered.push('draft');
    return ['', ...ordered];
  });

  readonly lang = this.i18n.lang;
  readonly adminLabel = adminLabel;

  onSearch = debounce((value: string) => {
    this.search.set(value.trim());
    this.page.set(1);
    this.load();
  });

  constructor() {
    this.load();
    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => this.flows.set(e.purchase_statuses ?? []),
      error: () => this.flows.set([])
    });
    // Needs roles.manage; without it the assignee filter simply is not offered.
    this.api.admins().pipe(takeUntilDestroyed()).subscribe({
      next: list => this.admins.set(list ?? []),
      error: () => this.admins.set([])
    });
  }

  load(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.sub = this.api
      .purchases({
        page: this.page(),
        per_page: this.perPage,
        status: this.status() || undefined,
        q: this.search() || undefined,
        from: this.from() || undefined,
        to: this.to() || undefined,
        assigned_to: this.assignedTo() || undefined
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.rows.set(res.items);
          this.counts.set(res.counts);
          this.total.set(res.pagination.total);
          this.loading.set(false);
        },
        error: err => {
          this.rows.set([]);
          this.loadError.set(errorMessage(err, 'web.purchases.load_failed'));
          this.loading.set(false);
        }
      });
  }

  setStatus(value: string): void {
    this.status.set(value);
    this.page.set(1);
    this.load();
  }

  setFilter(which: 'from' | 'to' | 'assignedTo', value: string): void {
    this[which].set(value);
    this.page.set(1);
    this.load();
  }

  clearFilters(): void {
    this.from.set('');
    this.to.set('');
    this.assignedTo.set('');
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  open(row: WebsitePurchase): void {
    this.router.navigate(['/dashboard/website/purchases', row.id]);
  }

  /** "all" may be missing from `counts`; then it is every non-draft bucket added up. */
  count(status: string): number | null {
    const c = this.counts();
    if (status === '') {
      if (typeof c['all'] === 'number') return c['all'];
      const keys = Object.keys(c).filter(k => k !== 'draft');
      return keys.length ? keys.reduce((s, k) => s + (c[k] ?? 0), 0) : null;
    }
    return typeof c[status] === 'number' ? c[status] : null;
  }

  tabLabel(status: string): string {
    return status === '' ? this.i18n.translate('common.all') : enumLabel(this.i18n, 'purchase_status', status);
  }

  statusLabel(row: WebsitePurchase): string {
    return enumLabel(this.i18n, 'purchase_status', row.status, row.status_label);
  }

  date(value: string | null | undefined): string {
    return fmtDate(value, this.lang());
  }

  money(row: WebsitePurchase): string {
    return fmtMoney(row.estimated_total, row.currency, this.lang());
  }

  itemsCount(row: WebsitePurchase): number {
    return (row.items ?? []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  }

  // ───────────────────────────── manual order ─────────────────────────────

  modalOpen = signal(false);
  saving = signal(false);
  draft = signal<OrderDraft>(emptyOrder());
  errors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);
  products = signal<WebsiteProduct[]>([]);
  productsLoading = signal(false);
  /** Tiers per product id; the list payload may omit them, so they are fetched on pick. */
  tiers = signal<Record<number, ProductTier[]>>({});

  openManual(): void {
    this.draft.set(emptyOrder());
    this.draft.update(d => ({ ...d, locale: this.lang() }));
    this.errors.set({});
    this.formError.set(null);
    this.modalOpen.set(true);
    if (!this.products().length) this.loadProducts();
  }

  closeManual(): void {
    if (!this.saving()) this.modalOpen.set(false);
  }

  private loadProducts(): void {
    this.productsLoading.set(true);
    this.api.products({ status: 'published', per_page: 100 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.products.set(res.items);
        const t: Record<number, ProductTier[]> = {};
        for (const p of res.items) if (p.tiers) t[p.id] = p.tiers;
        this.tiers.set(t);
        this.productsLoading.set(false);
      },
      error: err => {
        this.productsLoading.set(false);
        this.formError.set(errorMessage(err, 'web.purchases.products_failed'));
      }
    });
  }

  productName(p: WebsiteProduct): string {
    return pickLocalized(p.translations, 'name', this.lang()) || p.sku || `#${p.id}`;
  }

  tierName(t: ProductTier): string {
    const name = (this.lang() === 'ar' && t.name_ar) || t.name_en;
    return t.price !== null && t.price !== undefined && t.price !== ''
      ? `${name} — ${fmtMoney(t.price, undefined, this.lang())}`
      : name;
  }

  tiersFor(productId: string): ProductTier[] {
    if (!productId) return [];
    return (this.tiers()[Number(productId)] ?? []).filter(t => t.is_active !== false && t.id);
  }

  set<K extends keyof OrderDraft>(key: K, value: OrderDraft[K]): void {
    this.draft.update(d => ({ ...d, [key]: value }));
  }

  setItem(index: number, patch: Partial<ItemDraft>): void {
    this.draft.update(d => ({ ...d, items: d.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }));
  }

  pickProduct(index: number, productId: string): void {
    // A tier belongs to one product, so changing the product drops it.
    this.setItem(index, { product_id: productId, price_tier_id: '' });
    const id = Number(productId);
    if (id && !(id in this.tiers())) {
      this.api.product(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: p => this.tiers.update(t => ({ ...t, [id]: p.tiers ?? [] })),
        error: () => this.tiers.update(t => ({ ...t, [id]: [] }))
      });
    }
  }

  addItem(): void {
    this.draft.update(d => ({ ...d, items: [...d.items, { product_id: '', price_tier_id: '', quantity: 1 }] }));
  }

  removeItem(index: number): void {
    this.draft.update(d => ({ ...d, items: d.items.filter((_, i) => i !== index) }));
  }

  err(path: string): string | null {
    return this.errors()[path] ?? null;
  }

  submitManual(): void {
    const d = this.draft();
    const local: Record<string, string> = {};
    const required = 'web.purchases.required';
    if (!d.organization_name.trim()) local['organization_name'] = required;
    if (!d.contact_name.trim()) local['contact_name'] = required;
    if (!d.email.trim()) local['email'] = required;
    if (!d.consent) local['consent'] = 'web.purchases.consent_required';
    if (!d.items.length) local['items'] = 'web.purchases.items_required';
    d.items.forEach((it, i) => {
      if (!it.product_id) local[`items.${i}.product_id`] = required;
      if (!(Number(it.quantity) >= 1)) local[`items.${i}.quantity`] = 'web.purchases.quantity_min';
    });
    if (Object.keys(local).length) {
      this.errors.set(local);
      this.formError.set('web.purchases.fix_errors');
      return;
    }

    // Same body the public site posts (§18.4), so a phone/e-mail order runs
    // through the same pricing and validation as one placed on the website.
    const body: Record<string, unknown> = {
      organization_name: d.organization_name.trim(),
      organization_type: nullIfEmpty(d.organization_type),
      contact_name: d.contact_name.trim(),
      email: d.email.trim(),
      phone: nullIfEmpty(d.phone),
      job_title: nullIfEmpty(d.job_title),
      country: nullIfEmpty(d.country),
      city: nullIfEmpty(d.city),
      notes: nullIfEmpty(d.notes),
      locale: d.locale,
      consent: true,
      items: d.items.map(it => ({
        product_id: Number(it.product_id),
        price_tier_id: it.price_tier_id ? Number(it.price_tier_id) : null,
        quantity: Number(it.quantity)
      }))
    };

    this.saving.set(true);
    this.errors.set({});
    this.formError.set(null);
    this.api.createPurchase(body).subscribe({
      next: p => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.dialog.toast('success', 'web.purchases.created');
        this.router.navigate(['/dashboard/website/purchases', p.id]);
      },
      error: e => {
        this.saving.set(false);
        if (e?.status === 422) {
          this.errors.set(fieldErrors(e));
          this.formError.set(errorMessage(e, 'web.purchases.fix_errors'));
        } else {
          this.formError.set(errorMessage(e, 'web.purchases.create_failed'));
        }
      }
    });
  }
}
