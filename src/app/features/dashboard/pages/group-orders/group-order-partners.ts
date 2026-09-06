import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DeviceCategory,
  DeviceGroupOrdersService,
  ShippingCompany,
  SpecField
} from '../../../../core/services/device-group-orders.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

type Kind = 'categories' | 'shipping-companies';

/** The field types the wizard knows how to render. */
export const SPEC_FIELD_TYPES: SpecField['type'][] = ['text', 'number', 'select', 'textarea'];

interface CategoryDraft {
  id: number | null;
  name_en: string;
  name_ar: string;
  slug: string;
  fields: SpecField[];
}

interface CompanyDraft {
  id: number | null;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  notes: string;
  is_active: boolean;
}

/**
 * The two reference lists the group-order flow depends on.
 *
 * One component for both, chosen by route `data`, because they are the same
 * screen: a table, a drawer, four verbs. What differs is the drawer body, and
 * that is one `@if`.
 *
 * The category editor is the more consequential of the two — `spec_schema` is
 * the template the add-device wizard builds step 2 from, so a category saved
 * with no fields produces a device with no specifications.
 */
@Component({
  selector: 'app-group-order-partners',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './group-order-partners.html',
  styleUrls: ['./group-orders.shared.css', './group-order-partners.css']
})
export class GroupOrderPartners {
  private svc = inject(DeviceGroupOrdersService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);

  readonly fieldTypes = SPEC_FIELD_TYPES;

  kind = signal<Kind>('categories');
  isCategories = computed(() => this.kind() === 'categories');

  categories = signal<DeviceCategory[]>([]);
  companies = signal<ShippingCompany[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);

  drawerOpen = signal(false);
  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  categoryDraft = signal<CategoryDraft | null>(null);
  companyDraft = signal<CompanyDraft | null>(null);

  isEdit = computed(() =>
    this.isCategories() ? this.categoryDraft()?.id != null : this.companyDraft()?.id != null
  );

  constructor() {
    // Watched rather than read once: Angular reuses the component instance when
    // navigating between the two routes, so a snapshot read would keep the
    // first list on screen forever.
    this.route.data.pipe(takeUntilDestroyed()).subscribe(data => {
      this.kind.set((data['kind'] as Kind) ?? 'categories');
      this.drawerOpen.set(false);
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    if (this.isCategories()) {
      this.svc.categories({ per_page: 200 }).subscribe({
        next: res => { this.categories.set(res.items); this.loading.set(false); },
        error: () => { this.loadError.set('gorders.load_failed'); this.loading.set(false); }
      });
    } else {
      this.svc.shippingCompanies({ per_page: 200 }).subscribe({
        next: res => { this.companies.set(res.items); this.loading.set(false); },
        error: () => { this.loadError.set('gorders.load_failed'); this.loading.set(false); }
      });
    }
  }

  // ------------------------------------------------------------------ drawer

  openNew(): void {
    this.fieldErrors.set({});
    this.formError.set(null);
    if (this.isCategories()) {
      this.categoryDraft.set({ id: null, name_en: '', name_ar: '', slug: '', fields: [] });
    } else {
      this.companyDraft.set({ id: null, name: '', contact_person: '', phone: '', email: '', notes: '', is_active: true });
    }
    this.drawerOpen.set(true);
  }

  editCategory(row: DeviceCategory): void {
    this.fieldErrors.set({});
    this.formError.set(null);
    this.categoryDraft.set({
      id: row.id,
      name_en: row.name_en ?? row.name ?? '',
      name_ar: row.name_ar ?? '',
      slug: row.slug ?? '',
      // Copied, not referenced: an abandoned drawer must not mutate the table.
      fields: (row.spec_schema ?? []).map(f => ({
        ...f,
        // Seed the editable English label from whichever the payload carries.
        label_en: f.label_en ?? f.label ?? ''
      }))
    });
    this.drawerOpen.set(true);
  }

  editCompany(row: ShippingCompany): void {
    this.fieldErrors.set({});
    this.formError.set(null);
    this.companyDraft.set({
      id: row.id,
      name: row.name ?? '',
      contact_person: row.contact_person ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      notes: row.notes ?? '',
      is_active: row.is_active ?? true
    });
    this.drawerOpen.set(true);
  }

  close(): void {
    this.drawerOpen.set(false);
  }

  // ------------------------------------------------------- category editing

  setCategory<K extends keyof CategoryDraft>(key: K, value: CategoryDraft[K]): void {
    this.categoryDraft.update(d => (d ? { ...d, [key]: value } : d));
  }

  addField(): void {
    this.categoryDraft.update(d =>
      d ? { ...d, fields: [...d.fields, { key: '', label: '', unit: '', type: 'text', required: false }] } : d
    );
  }

  setField(index: number, key: keyof SpecField, value: unknown): void {
    this.categoryDraft.update(d => {
      if (!d) return d;
      const fields = d.fields.map((f, i) => (i === index ? { ...f, [key]: value } : f));
      return { ...d, fields };
    });
  }

  removeField(index: number): void {
    this.categoryDraft.update(d => (d ? { ...d, fields: d.fields.filter((_, i) => i !== index) } : d));
  }

  setCompany<K extends keyof CompanyDraft>(key: K, value: CompanyDraft[K]): void {
    this.companyDraft.update(d => (d ? { ...d, [key]: value } : d));
  }

  // -------------------------------------------------------------------- save

  save(): void {
    this.fieldErrors.set({});
    this.formError.set(null);
    return this.isCategories() ? this.saveCategory() : this.saveCompany();
  }

  private saveCategory(): void {
    const d = this.categoryDraft();
    if (!d) return;

    const errors: Record<string, string> = {};
    if (!d.name_en.trim()) errors['name_en'] = 'gorders.required';
    // Required server-side, same as the device name.
    if (!d.name_ar.trim()) errors['name_ar'] = 'gorders.required';
    // A field with no key cannot be stored against a device, and two fields
    // with the same key would overwrite each other on save.
    const keys = d.fields.map(f => f.key.trim()).filter(Boolean);
    if (d.fields.some(f => !f.key.trim())) errors['fields'] = 'gorders.field_key_required';
    else if (new Set(keys).size !== keys.length) errors['fields'] = 'gorders.field_key_duplicate';
    if (Object.keys(errors).length) { this.fieldErrors.set(errors); return; }

    const body: Partial<DeviceCategory> = {
      name_en: d.name_en.trim(),
      name_ar: d.name_ar.trim(),
      spec_schema: d.fields.map(f => ({
        key: f.key.trim(),
        // The API requires label_en on every field and ignores `label`, which is
        // read-only and resolved per Accept-Language on the way back out.
        label_en: (f.label_en || f.label || '').trim() || f.key.trim(),
        label_ar: (f.label_ar || '').trim() || null,
        unit: (f.unit || '').trim() || null,
        type: f.type ?? 'text',
        required: !!f.required
      })) as SpecField[]
    };
    if (d.slug.trim()) body.slug = d.slug.trim();

    this.saving.set(true);
    const req = d.id ? this.svc.updateCategory(d.id, body) : this.svc.createCategory(body);
    req.subscribe({
      next: () => this.done(),
      error: err => this.handleError(err)
    });
  }

  private saveCompany(): void {
    const d = this.companyDraft();
    if (!d) return;

    const errors: Record<string, string> = {};
    if (!d.name.trim()) errors['name'] = 'gorders.required';
    if (!d.phone.trim()) errors['phone'] = 'gorders.required';
    if (Object.keys(errors).length) { this.fieldErrors.set(errors); return; }

    const body: Partial<ShippingCompany> = {
      name: d.name.trim(),
      contact_person: d.contact_person.trim() || null,
      phone: d.phone.trim(),
      email: d.email.trim() || null,
      notes: d.notes.trim() || null,
      is_active: d.is_active
    };

    this.saving.set(true);
    const req = d.id ? this.svc.updateShippingCompany(d.id, body) : this.svc.createShippingCompany(body);
    req.subscribe({
      next: () => this.done(),
      error: err => this.handleError(err)
    });
  }

  private done(): void {
    this.saving.set(false);
    this.drawerOpen.set(false);
    this.dialog.toast('success', 'common.saved');
    this.load();
  }

  private handleError(err: HttpErrorResponse): void {
    this.saving.set(false);
    const bag = err?.error?.errors as Record<string, string[]> | undefined;
    if (bag) {
      this.fieldErrors.set(
        Object.fromEntries(Object.entries(bag).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]))
      );
    }
    this.formError.set(err?.error?.message ?? 'gorders.save_failed');
  }

  // ------------------------------------------------------------------ delete

  async removeCategory(row: DeviceCategory): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'gorders.delete_category_title',
      text: 'gorders.delete_category_text',
      params: { name: row.name },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.svc.deleteCategory(row.id).subscribe({
      next: () => { this.dialog.toast('success', 'common.deleted'); this.load(); },
      // Refused while devices still reference it; the reason names them.
      error: err => this.dialog.error('common.error', err?.error?.message ?? 'gorders.delete_failed')
    });
  }

  async removeCompany(row: ShippingCompany): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'gorders.delete_company_title',
      text: 'gorders.delete_company_text',
      params: { name: row.name },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.svc.deleteShippingCompany(row.id).subscribe({
      next: () => { this.dialog.toast('success', 'common.deleted'); this.load(); },
      error: err => this.dialog.error('common.error', err?.error?.message ?? 'gorders.delete_failed')
    });
  }

  errorFor(key: string): string | null {
    return this.fieldErrors()[key] ?? null;
  }

  fieldCount(row: DeviceCategory): number {
    return row.spec_schema?.length ?? 0;
  }
}
