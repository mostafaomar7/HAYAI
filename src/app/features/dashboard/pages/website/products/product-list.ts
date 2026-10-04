import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { Locale, WebsiteCategory, WebsiteMedia, WebsiteProduct } from '../../../../../core/services/website/website.models';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { pickLocalized } from '../shared/website-utils';
import { PRICED_TYPES, categoryName, enumLabel, priceDisplay } from './catalog-shared';

/**
 * The B2B catalog (products and services sold to hospitals).
 *
 * Products are edited live — there is no draft copy of a published product —
 * so this list is effectively what the site shows, minus drafts/archived and
 * anything whose price is private.
 */
@Component({
  selector: 'app-website-product-list',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './product-list.html',
  styleUrls: ['../shared/website.shared.css', './product-list.css']
})
export class ProductList {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  rows = signal<WebsiteProduct[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  total = signal(0);
  readonly perPage = 20;
  page = signal(1);

  q = signal('');
  status = signal('');
  categoryId = signal('');
  type = signal('');
  trashed = signal(false);

  statuses = signal<string[]>([]);
  categories = signal<WebsiteCategory[]>([]);

  canCreate = computed(() => this.ctx.can('products.create'));
  canDelete = computed(() => this.ctx.can('products.delete'));
  lang = computed<Locale>(() => (this.i18n.lang() === 'ar' ? 'ar' : 'en'));

  onSearch = debounce((v: string) => {
    this.q.set(v.trim());
    this.page.set(1);
    this.load();
  });

  onType = debounce((v: string) => {
    this.type.set(v.trim());
    this.page.set(1);
    this.load();
  });

  constructor() {
    this.load();
    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => this.statuses.set(e.product_statuses ?? []),
      error: () => {}
    });
    this.api.categories({ kind: 'product', per_page: 100 }).pipe(takeUntilDestroyed()).subscribe({
      next: r => this.categories.set(r.items),
      error: () => {}
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .products({
        page: this.page(),
        per_page: this.perPage,
        q: this.q() || undefined,
        status: this.status() || undefined,
        category_id: this.categoryId() || undefined,
        type: this.type() || undefined,
        trashed: this.trashed() ? 'only' : undefined
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
          this.loadError.set(errorMessage(err, 'web.products.load_failed'));
          this.loading.set(false);
        }
      });
  }

  setFilter(which: 'status' | 'categoryId', value: string): void {
    this[which].set(value);
    this.page.set(1);
    this.load();
  }

  toggleTrash(): void {
    this.trashed.update(v => !v);
    this.page.set(1);
    this.load();
  }

  goToPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  create(): void {
    this.router.navigate(['/dashboard/website/products/new']);
  }

  open(row: WebsiteProduct): void {
    // A trashed product cannot be edited until it is restored.
    if (row.deleted_at) return;
    this.router.navigate(['/dashboard/website/products', row.id]);
  }

  // ── display ─────────────────────────────────────────────────────

  name(row: WebsiteProduct): string {
    return pickLocalized(row.translations as any, 'name' as any, this.lang())
      || (typeof row['name'] === 'string' ? row['name'] : '')
      || row.sku
      || `#${row.id}`;
  }

  /** List rows may carry the media object or just a URL, depending on the resource. */
  thumb(row: WebsiteProduct): string | null {
    const m = row.featured_media as WebsiteMedia | null | undefined;
    const small = m?.variants?.length ? [...m.variants].sort((a, b) => a.width - b.width)[0].url : null;
    return small || m?.url || (typeof row['image_url'] === 'string' ? row['image_url'] : null);
  }

  category(row: WebsiteProduct): string {
    if (row.category) return categoryName(row.category, this.lang());
    const c = this.categories().find(x => x.id === row.category_id);
    return c ? categoryName(c, this.lang()) : '—';
  }

  price(row: WebsiteProduct): string {
    return priceDisplay(this.i18n, row, this.lang());
  }

  /** "Private" only matters when the type would otherwise show a figure. */
  isPrivate(row: WebsiteProduct): boolean {
    return !row.is_price_public && PRICED_TYPES.has(row.pricing_type);
  }

  label(group: string, value: string | null | undefined, apiLabel?: unknown): string {
    return enumLabel(this.i18n, group, value, apiLabel);
  }

  // ── trash / restore ─────────────────────────────────────────────

  async remove(row: WebsiteProduct): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.products.delete_title',
      text: 'web.products.delete_text',
      params: { name: this.name(row) },
      confirmText: 'web.products.move_to_trash',
      danger: true
    });
    if (!ok) return;
    this.api.deleteProduct(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.products.trashed_toast');
        if (this.rows().length === 1 && this.page() > 1) this.page.set(this.page() - 1);
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.products.delete_failed'))
    });
  }

  restore(row: WebsiteProduct): void {
    this.api.restoreProduct(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.products.restored_toast');
        if (this.rows().length === 1 && this.page() > 1) this.page.set(this.page() - 1);
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.products.restore_failed'))
    });
  }
}
