import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AdminPharmaciesService,
  BulkMode,
  BulkPreview,
  BulkResult,
  PharmacyBranch,
  PharmacyProduct
} from '../../../../core/services/admin-pharmacies.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

type Tab = 'products' | 'branches' | 'upload';

interface ProductDraft {
  id: number | null;
  name: string;
  price: string;
  original_price: string;
  category: string;
  description: string;
  in_stock: boolean;
  prescription_required: boolean;
}

interface BranchDraft {
  id: number | null;
  name: string;
  city: string;
  area: string;
  address: string;
  hotline: string;
}

const emptyProduct = (): ProductDraft => ({
  id: null, name: '', price: '', original_price: '', category: '',
  description: '', in_stock: true, prescription_required: false
});
const emptyBranch = (): BranchDraft => ({ id: null, name: '', city: '', area: '', address: '', hotline: '' });

/**
 * Runs a pharmacy's catalogue and branches on its behalf.
 *
 * The bulk upload is deliberately two steps: a pharmacy's POS export names its
 * columns however it likes, and the preview is where a cost column pretending
 * to be a selling price gets caught — before it becomes the public price.
 */
@Component({
  selector: 'app-pharmacy-manage',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './pharmacy-manage.html',
  styleUrl: './pharmacy-manage.css'
})
export class PharmacyManage {
  private svc = inject(AdminPharmaciesService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  id = Number(this.route.snapshot.paramMap.get('id'));
  tab = signal<Tab>('products');

  // ---- products
  loading = signal(true);
  loadError = signal<string | null>(null);
  products = signal<PharmacyProduct[]>([]);
  total = signal(0);
  page = signal(1);
  readonly perPage = 25;
  search = signal('');
  productDraft = signal<ProductDraft | null>(null);
  saving = signal(false);
  errors = signal<Record<string, string>>({});

  // ---- branches
  branches = signal<PharmacyBranch[]>([]);
  branchesLoaded = signal(false);
  branchDraft = signal<BranchDraft | null>(null);

  // ---- upload
  file = signal<File | null>(null);
  uploadBranch = signal<string>('');
  mode = signal<BulkMode>('upsert');
  preview = signal<BulkPreview | null>(null);
  result = signal<BulkResult | null>(null);
  uploadError = signal<string | null>(null);
  uploading = signal(false);

  constructor() {
    this.loadProducts();
    this.loadBranches();
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  // --------------------------------------------------------------- products

  loadProducts(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.products(this.id, { page: this.page(), per_page: this.perPage, q: this.search() || undefined })
      .subscribe({
        next: r => {
          this.products.set(r.items);
          this.total.set(r.pagination?.total ?? r.items.length);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loadError.set(err.status === 404 ? 'pharm.not_a_pharmacy' : 'pharm.load_failed');
          this.loading.set(false);
        }
      });
  }

  onSearch = debounce((value: string) => {
    this.search.set(value);
    this.page.set(1);
    this.loadProducts();
  }, 350);

  goToPage(page: number): void {
    this.page.set(page);
    this.loadProducts();
  }

  addProduct(): void {
    this.errors.set({});
    this.productDraft.set(emptyProduct());
  }

  editProduct(row: PharmacyProduct): void {
    this.errors.set({});
    this.productDraft.set({
      id: row.id,
      name: row.name ?? '',
      price: row.price != null ? String(row.price) : '',
      original_price: row.original_price != null ? String(row.original_price) : '',
      category: row.category ?? '',
      description: row.description ?? '',
      in_stock: row.in_stock !== false,
      prescription_required: row.prescription_required === true
    });
  }

  setProduct<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]): void {
    this.productDraft.update(d => (d ? { ...d, [key]: value } : d));
  }

  saveProduct(): void {
    const d = this.productDraft();
    if (!d) return;
    const errors: Record<string, string> = {};
    if (!d.name.trim()) errors['name'] = 'pharm.required';
    const price = Number(d.price);
    if (d.price === '' || !isFinite(price) || price < 0) errors['price'] = 'pharm.price_invalid';
    this.errors.set(errors);
    if (Object.keys(errors).length) return;

    const body: Record<string, unknown> = {
      name: d.name.trim(),
      price,
      category: d.category.trim() || null,
      description: d.description.trim() || null,
      in_stock: d.in_stock,
      prescription_required: d.prescription_required
    };
    // Sent only when filled: an empty box means "no strikethrough price", not 0.
    if (d.original_price.trim()) body['original_price'] = Number(d.original_price);

    this.saving.set(true);
    const req = d.id === null
      ? this.svc.createProduct(this.id, body)
      : this.svc.updateProduct(this.id, d.id, body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.productDraft.set(null);
        this.dialog.toast('success', d.id === null ? 'pharm.product_added' : 'pharm.product_saved');
        this.loadProducts();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.applyServerErrors(err);
      }
    });
  }

  async removeProduct(row: PharmacyProduct): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'pharm.delete_product_title',
      text: 'pharm.delete_product_text',
      params: { name: row.name },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.svc.deleteProduct(this.id, row.id).subscribe({
      next: () => {
        this.dialog.toast('success', 'pharm.product_deleted');
        if (this.products().length === 1 && this.page() > 1) this.page.update(p => p - 1);
        this.loadProducts();
      },
      error: (err: HttpErrorResponse) =>
        this.dialog.error('common.error', err.error?.message ?? 'dialog.try_again')
    });
  }

  // --------------------------------------------------------------- branches

  loadBranches(): void {
    this.svc.branches(this.id).subscribe({
      next: rows => { this.branches.set(rows); this.branchesLoaded.set(true); },
      error: () => { this.branches.set([]); this.branchesLoaded.set(true); }
    });
  }

  addBranch(): void {
    this.errors.set({});
    this.branchDraft.set(emptyBranch());
  }

  editBranch(row: PharmacyBranch): void {
    this.errors.set({});
    this.branchDraft.set({
      id: row.id,
      name: row.name ?? '',
      city: row.city ?? '',
      area: row.area ?? '',
      address: row.address ?? '',
      hotline: row.hotline ?? ''
    });
  }

  setBranch<K extends keyof BranchDraft>(key: K, value: BranchDraft[K]): void {
    this.branchDraft.update(d => (d ? { ...d, [key]: value } : d));
  }

  saveBranch(): void {
    const d = this.branchDraft();
    if (!d) return;
    const errors: Record<string, string> = {};
    if (!d.name.trim()) errors['name'] = 'pharm.required';
    if (!d.address.trim()) errors['address'] = 'pharm.required';
    // The API requires a city unless a city_id is sent, and this form has no
    // city picker — so the text is required here too.
    if (!d.city.trim()) errors['city'] = 'pharm.required';
    this.errors.set(errors);
    if (Object.keys(errors).length) return;

    const body: Record<string, unknown> = {
      name: d.name.trim(),
      city: d.city.trim(),
      area: d.area.trim() || null,
      address: d.address.trim(),
      hotline: d.hotline.trim() || null
    };

    this.saving.set(true);
    const req = d.id === null
      ? this.svc.createBranch(this.id, body)
      : this.svc.updateBranch(this.id, d.id, body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.branchDraft.set(null);
        this.dialog.toast('success', d.id === null ? 'pharm.branch_added' : 'pharm.branch_saved');
        this.loadBranches();
      },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.applyServerErrors(err); }
    });
  }

  async removeBranch(row: PharmacyBranch): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'pharm.delete_branch_title',
      text: 'pharm.delete_branch_text',
      params: { name: row.name },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.svc.deleteBranch(this.id, row.id).subscribe({
      next: () => { this.dialog.toast('success', 'pharm.branch_deleted'); this.loadBranches(); },
      error: (err: HttpErrorResponse) =>
        this.dialog.error('common.error', err.error?.message ?? 'dialog.try_again')
    });
  }

  // ----------------------------------------------------------------- upload

  onFile(input: HTMLInputElement): void {
    this.file.set(input.files?.[0] ?? null);
    this.preview.set(null);
    this.result.set(null);
    this.uploadError.set(null);
  }

  runPreview(): void {
    const f = this.file();
    if (!f) return;
    this.uploading.set(true);
    this.uploadError.set(null);
    this.result.set(null);
    this.svc.previewUpload(this.id, f, this.uploadBranch() ? Number(this.uploadBranch()) : null)
      .subscribe({
        next: p => { this.uploading.set(false); this.preview.set(p); },
        error: (err: HttpErrorResponse) => {
          this.uploading.set(false);
          // A missing required column comes back as a full preview report, so
          // the mapping is shown rather than a bare error.
          const report = err.error?.errors as Partial<BulkPreview> | undefined;
          if (report?.headers) this.preview.set(report as BulkPreview);
          this.uploadError.set(err.error?.message ?? 'pharm.upload_failed');
        }
      });
  }

  async confirmUpload(): Promise<void> {
    const f = this.file();
    if (!f) return;
    // "Replace" deletes the current catalogue outright and there is no undo.
    // With a branch chosen the server only switches products off at that
    // branch, so the warning is limited to the whole-catalogue case.
    if (this.mode() === 'replace' && !this.uploadBranch() && this.total() > 0) {
      const ok = await this.dialog.confirm({
        title: 'pharm.replace_confirm_title',
        text: 'pharm.replace_confirm_text',
        params: { count: this.total() },
        confirmText: 'pharm.replace_confirm_ok',
        danger: true
      });
      if (!ok) return;
    }
    this.uploading.set(true);
    this.uploadError.set(null);
    this.svc.upload(this.id, f, this.mode(), this.uploadBranch() ? Number(this.uploadBranch()) : null)
      .subscribe({
        next: r => {
          this.uploading.set(false);
          this.result.set(r);
          this.preview.set(null);
          this.dialog.toast('success', 'pharm.upload_done');
          this.loadProducts();
        },
        error: (err: HttpErrorResponse) => {
          this.uploading.set(false);
          this.uploadError.set(err.error?.message ?? 'pharm.upload_failed');
        }
      });
  }

  resetUpload(): void {
    this.file.set(null);
    this.preview.set(null);
    this.result.set(null);
    this.uploadError.set(null);
  }

  detectedPairs(p: BulkPreview): { field: string; header: string }[] {
    return Object.entries(p.detected_columns ?? {}).map(([field, header]) => ({ field, header }));
  }

  ignoredPairs(p: BulkPreview): { field: string; header: string }[] {
    return Object.entries(p.ignored_columns ?? {}).map(([field, header]) => ({ field, header }));
  }

  isFuzzy(p: BulkPreview, field: string): boolean {
    return (p.fuzzy_columns ?? []).includes(field);
  }

  // ------------------------------------------------------------------ misc

  private applyServerErrors(err: HttpErrorResponse): void {
    const bag = err.error?.errors as Record<string, string[] | string> | undefined;
    if (err.status === 422 && bag) {
      this.errors.set(Object.fromEntries(
        Object.entries(bag).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])));
    } else {
      this.dialog.error('common.error', err.error?.message ?? 'dialog.try_again');
    }
  }

  back(): void {
    this.router.navigate(['/dashboard/pharmacies']);
  }
}
