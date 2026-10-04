import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DELIVERY_WINDOWS,
  DeliveryWindow,
  DeviceCategory,
  DeviceGroupOrdersService,
  ExternalDeviceEntry,
  SpecField,
  deliveryLabel
} from '../../../../core/services/device-group-orders.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

interface BasicDraft {
  name_en: string;
  name_ar: string;
  category_id: string;
  brand_model: string;
  manufacturer: string;
  country_of_origin: string;
  made_in: string;
  short_description_en: string;
  short_description_ar: string;
  cover: File | null;
  coverUrl: string | null;
}

interface RoundDraft {
  /** Named for the request field, so a server-side error binds to this input. */
  target_size: string;
  /** Index into DELIVERY_WINDOWS — the API stores a week range, not a label. */
  delivery: number;
  join_deadline: string;
  notes_for_users: string;
}

/**
 * Screens 2, 3 and 4 — the add-device wizard.
 *
 * Each step commits before the next one opens, because the device has to exist
 * before specifications can hang off it and before a round can be opened on it.
 * That also means a wizard abandoned at step 2 leaves a real device behind; it
 * shows in the catalogue with no round, which is a valid state (a device can sit
 * in the catalogue between rounds), so nothing needs cleaning up.
 */
@Component({
  selector: 'app-group-order-device-form',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './group-order-device-form.html',
  styleUrls: ['./group-orders.shared.css', './group-order-device-form.css']
})
export class GroupOrderDeviceForm {
  private svc = inject(DeviceGroupOrdersService);
  private dialog = inject(DialogService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly deliveryWindows = DELIVERY_WINDOWS;
  readonly deliveryLabel = deliveryLabel;

  step = signal<1 | 2 | 3>(1);
  saving = signal(false);
  loading = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  deviceId = signal<number | null>(null);
  /**
   * Whether this is the edit route, which is NOT the same as "a device id
   * exists": step 1 of the add wizard creates the device, so from step 2 onward
   * an add flow also has an id. Titling on the id made the add wizard call
   * itself "Edit Device" halfway through.
   */
  editingExisting = signal(false);
  /** An existing round means step 3 has already been done for this device. */
  hasRound = signal(false);

  categories = signal<DeviceCategory[]>([]);

  basic = signal<BasicDraft>({
    name_en: '', name_ar: '', category_id: '', brand_model: '', manufacturer: '',
    country_of_origin: '', made_in: '', short_description_en: '', short_description_ar: '',
    cover: null, coverUrl: null
  });

  /** Built from the chosen category's template, never hardcoded. */
  specFields = signal<SpecField[]>([]);
  specValues = signal<Record<string, string>>({});

  round = signal<RoundDraft>({
    target_size: '', delivery: 2, join_deadline: '', notes_for_users: ''
  });

  constructor() {
    this.svc.categories({ per_page: 200 }).pipe(takeUntilDestroyed()).subscribe({
      next: res => {
        this.categories.set(res.items);
        if (!res.items.length) {
          // Without the reference seeder there is no category and therefore no
          // specification template — the wizard cannot produce a usable device,
          // so it says so instead of failing at step 2 with an empty form.
          this.formError.set('gorders.no_categories');
        }
        this.syncSpecFields();
      },
      error: () => this.categories.set([])
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) { this.editingExisting.set(true); this.loadDevice(Number(id)); }
  }

  // ---------------------------------------------------------------- loading

  private loadDevice(id: number): void {
    this.loading.set(true);
    this.deviceId.set(id);
    this.svc.device(id).pipe(takeUntilDestroyed()).subscribe({
      next: d => { this.prefill(d); this.loading.set(false); },
      error: () => { this.formError.set('gorders.load_failed'); this.loading.set(false); }
    });
  }

  private prefill(d: ExternalDeviceEntry): void {
    this.basic.set({
      name_en: d.name_en ?? d.name ?? '',
      name_ar: d.name_ar ?? '',
      category_id: d.category_id != null ? String(d.category_id) : '',
      brand_model: d.brand_model ?? '',
      manufacturer: d.manufacturer ?? '',
      country_of_origin: d.country_of_origin ?? '',
      made_in: d.made_in ?? '',
      short_description_en: d.short_description_en ?? d.short_description ?? '',
      short_description_ar: d.short_description_ar ?? '',
      cover: null,
      coverUrl: d.cover_image_url
    });
    this.hasRound.set(!!d.active_group_order);
    this.syncSpecFields();
    const values: Record<string, string> = {};
    for (const s of d.specifications ?? []) values[s.key] = s.value == null ? '' : String(s.value);
    this.specValues.set(values);
  }

  // ------------------------------------------------------------ step 1 form

  setBasic<K extends keyof BasicDraft>(key: K, value: BasicDraft[K]): void {
    this.basic.update(b => ({ ...b, [key]: value }));
    if (key === 'category_id') this.syncSpecFields();
  }

  onCover(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.basic.update(b => ({ ...b, cover: file }));
  }

  /** Swaps the step-2 fields to whatever the chosen category declares. */
  private syncSpecFields(): void {
    const id = this.basic().category_id;
    const cat = this.categories().find(c => String(c.id) === id);
    const fields = cat?.spec_schema ?? [];
    this.specFields.set(fields);

    // Drop values belonging to a category that is no longer selected, so a
    // switched category cannot post fields its schema does not declare.
    const allowed = new Set(fields.map(f => f.key));
    this.specValues.update(v => {
      const next: Record<string, string> = {};
      for (const [k, val] of Object.entries(v)) if (allowed.has(k)) next[k] = val;
      return next;
    });

    // spec_schema may not be embedded in the list payload; fetch it if not.
    if (cat && !cat.spec_schema) {
      this.svc.category(cat.id).subscribe({
        next: full => {
          this.categories.update(list => list.map(c => (c.id === full.id ? full : c)));
          if (this.basic().category_id === String(full.id)) this.specFields.set(full.spec_schema ?? []);
        },
        error: () => {}
      });
    }
  }

  setSpec(key: string, value: string): void {
    this.specValues.update(v => ({ ...v, [key]: value }));
  }

  setRound<K extends keyof RoundDraft>(key: K, value: RoundDraft[K]): void {
    this.round.update(r => ({ ...r, [key]: value }));
  }

  // ------------------------------------------------------------ step moves

  saveBasic(): void {
    const b = this.basic();
    this.fieldErrors.set({});
    this.formError.set(null);

    const errors: Record<string, string> = {};
    if (!b.name_en.trim()) errors['name_en'] = 'gorders.required';
    // Both names are required server-side; leaving Arabic blank fails with a 422
    // after the form has already been filled in.
    if (!b.name_ar.trim()) errors['name_ar'] = 'gorders.required';
    // The app filters its External tab by category, so a device saved without
    // one is invisible there — the message says that rather than "required".
    if (!b.category_id) errors['category_id'] = 'gorders.category_required';
    if (Object.keys(errors).length) { this.fieldErrors.set(errors); return; }

    const form = new FormData();
    form.append('name_en', b.name_en.trim());
    form.append('name_ar', b.name_ar.trim());
    form.append('category_id', b.category_id);
    if (b.brand_model.trim()) form.append('brand_model', b.brand_model.trim());
    if (b.manufacturer.trim()) form.append('manufacturer', b.manufacturer.trim());
    if (b.country_of_origin.trim()) form.append('country_of_origin', b.country_of_origin.trim());
    if (b.made_in.trim()) form.append('made_in', b.made_in.trim());
    if (b.short_description_en.trim()) form.append('short_description_en', b.short_description_en.trim());
    if (b.short_description_ar.trim()) form.append('short_description_ar', b.short_description_ar.trim());
    if (b.cover) form.append('cover_image', b.cover);

    this.saving.set(true);
    const id = this.deviceId();
    const request = id ? this.svc.updateDevice(id, form) : this.svc.createDevice(form);
    request.subscribe({
      next: d => {
        this.deviceId.set(d.id);
        this.basic.update(x => ({ ...x, cover: null, coverUrl: d.cover_image_url ?? x.coverUrl }));
        this.saving.set(false);
        this.step.set(2);
      },
      error: err => this.handleError(err)
    });
  }

  saveSpecs(): void {
    const id = this.deviceId();
    if (!id) return;
    this.fieldErrors.set({});
    this.formError.set(null);

    const missing = this.specFields().filter(f => f.required && !(this.specValues()[f.key] ?? '').trim());
    if (missing.length) {
      this.fieldErrors.set(Object.fromEntries(missing.map(f => [f.key, 'gorders.required'])));
      return;
    }

    const specifications = this.specFields().map(f => ({
      key: f.key,
      value: (this.specValues()[f.key] ?? '').trim() || null
    }));

    this.saving.set(true);
    this.svc.saveSpecifications(id, specifications).subscribe({
      next: () => {
        this.saving.set(false);
        // In edit mode the round already exists and is managed from its own
        // screen, so there is no step 3 to advance into.
        if (this.editingExisting() && this.hasRound()) this.finishEdit();
        else this.step.set(3);
      },
      error: err => this.handleError(err)
    });
  }

  createRound(): void {
    const id = this.deviceId();
    if (!id) return;
    const r = this.round();
    this.fieldErrors.set({});
    this.formError.set(null);

    const errors: Record<string, string> = {};
    const size = Number(r.target_size);
    if (!r.target_size || !Number.isInteger(size) || size < 2) errors['target_size'] = 'gorders.target_size_invalid';
    const window: DeliveryWindow | undefined = DELIVERY_WINDOWS[r.delivery];
    if (!window) errors['delivery'] = 'gorders.required';
    // Required by the backend at publish, and it must be in the future — a round
    // with no deadline can never be swept and would sit open forever.
    if (!r.join_deadline) errors['join_deadline'] = 'gorders.required';
    else if (new Date(r.join_deadline).getTime() <= Date.now()) errors['join_deadline'] = 'gorders.deadline_past';
    if (Object.keys(errors).length) { this.fieldErrors.set(errors); return; }

    this.saving.set(true);
    this.svc
      .openGroupOrder(id, {
        target_size: size,
        delivery_weeks_min: window!.min,
        delivery_weeks_max: window!.max,
        join_deadline: r.join_deadline,
        notes_for_users: r.notes_for_users.trim() || null
      })
      .subscribe({
        next: order => {
          this.saving.set(false);
          this.dialog.toast('success', 'gorders.device_added');
          this.router.navigate(['/dashboard/group-orders', order.id]);
        },
        error: err => this.handleError(err)
      });
  }

  private finishEdit(): void {
    this.dialog.toast('success', 'gorders.device_saved');
    this.router.navigate(['/dashboard/group-orders/devices']);
  }

  /** Maps Laravel's 422 payload onto the fields; anything else is one banner. */
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

  // ------------------------------------------------------------- navigation

  back(): void {
    if (this.step() > 1) this.step.update(s => (s - 1) as 1 | 2 | 3);
    else this.router.navigate(['/dashboard/group-orders/devices']);
  }

  cancel(): void {
    this.router.navigate(['/dashboard/group-orders/devices']);
  }

  errorFor(key: string): string | null {
    return this.fieldErrors()[key] ?? null;
  }

  labelFor(field: SpecField): string {
    return field.label || field.key;
  }

  /**
   * A number input silently blanks a value it cannot parse, so a field declared
   * as `number` that already holds something like "20 – 1500" would come up
   * empty and be wiped on the next save. Where the stored value is not numeric,
   * the field is rendered as text and the value survives.
   */
  inputTypeFor(field: SpecField): 'number' | 'text' {
    if (field.type !== 'number') return 'text';
    const current = this.specValues()[field.key] ?? '';
    if (current === '' || !isNaN(Number(current))) return 'number';
    return 'text';
  }
}
