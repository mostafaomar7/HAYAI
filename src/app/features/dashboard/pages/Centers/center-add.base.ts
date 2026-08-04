import { Directive, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CentersService, CenterCategory } from '../../../../core/services/centers.service';
import { ContactItem, DEFAULT_SCHEDULE, ScheduleSlot, WEEKDAYS, Weekday } from '../../../../core/models/scheduled-entity.model';
import {
  appendContacts,
  appendFile,
  appendScalar,
  appendSchedule,
  appendServices
} from '../../../../shared/utils/form-data.util';

@Directive()
export abstract class CenterAddBase {
  abstract category: CenterCategory;
  abstract listRoute: string;

  protected location = inject(Location);
  protected route = inject(ActivatedRoute);
  protected router = inject(Router);
  protected svc = inject(CentersService);

  id = signal<number | null>(null);
  isEdit = computed(() => this.id() !== null);
  loading = signal(false);
  saving = signal(false);
  loadFailed = signal(false);
  errorMessage = signal<string | null>(null);

  /**
   * The form must stay hidden until an edit target has actually been read.
   * Rendering it early hands the user a blank form over a real record, and
   * saving that would overwrite the name, description, services and contacts
   * with empty values.
   */
  ready = computed(() => !this.isEdit() || (!this.loading() && !this.loadFailed()));

  name = '';
  description = '';
  notes = '';
  status: 'Active' | 'Inactive' = 'Active';

  uploadedImage = signal<string | null>(null);
  selectedFile: File | null = null;

  days = signal<ScheduleSlot[]>(DEFAULT_SCHEDULE.map(s => ({ ...s })));

  newContactName = '';
  newContactPhone = '';
  contacts = signal<ContactItem[]>([]);

  newServiceName = '';
  services = signal<string[]>([]);

  init() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.id.set(id);
      this.load(id);
    }
  }

  private load(id: number) {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.svc.get(id).subscribe({
      next: c => {
        this.name = c.name;
        this.description = c.description ?? '';
        this.notes = c.notes ?? '';
        this.status = c.status === 'active' ? 'Active' : 'Inactive';
        this.uploadedImage.set(c.cover_image_url);
        // An existing centre with no saved schedule means every day is closed.
        // Falling back to DEFAULT_SCHEDULE here would silently switch all seven
        // days on the moment the record was opened for editing.
        this.days.set(this.normalizeSchedule(c.schedule ?? []));
        this.services.set(c.services ?? []);
        this.contacts.set(c.contacts ?? []);
        this.loading.set(false);
      },
      // `errorMessage` is reserved for save failures — the load failure has its
      // own message in the template, and showing both reads as two problems.
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      }
    });
  }

  private normalizeSchedule(raw: ScheduleSlot[]): ScheduleSlot[] {
    return WEEKDAYS.map(day => raw.find(s => s.day === day) ?? { day, active: false, from: '', to: '' });
  }

  /** i18n key for a weekday — the model stores the English name. */
  dayLabel(day: Weekday): string { return `days.${day}`; }

  setStatus(val: 'Active' | 'Inactive') { this.status = val; }

  goBack() { this.location.back(); }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => this.uploadedImage.set(String(e.target?.result ?? ''));
    reader.readAsDataURL(file);
  }

  removeImage() { this.uploadedImage.set(null); this.selectedFile = null; }

  toggleDay(index: number) {
    const arr = [...this.days()];
    arr[index] = { ...arr[index], active: !arr[index].active };
    this.days.set(arr);
  }

  updateDayField(index: number, field: 'from' | 'to', value: string) {
    const arr = [...this.days()];
    arr[index] = { ...arr[index], [field]: value };
    this.days.set(arr);
  }

  addContact() {
    if (!this.newContactName.trim() || !this.newContactPhone.trim()) return;
    this.contacts.set([
      ...this.contacts(),
      { title: this.newContactName.trim(), phone: this.newContactPhone.trim() }
    ]);
    this.newContactName = '';
    this.newContactPhone = '';
  }

  removeContact(index: number) {
    this.contacts.set(this.contacts().filter((_, i) => i !== index));
  }

  addService() {
    const v = this.newServiceName.trim();
    if (!v) return;
    this.services.set([...this.services(), v]);
    this.newServiceName = '';
  }

  removeService(index: number) {
    this.services.set(this.services().filter((_, i) => i !== index));
  }

  save() {
    // Never write back a form that has not finished loading its record.
    if (!this.ready()) return;
    if (!this.name.trim()) {
      this.errorMessage.set('centers.name_required');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const form = new FormData();
    appendScalar(form, 'category', this.category);
    appendScalar(form, 'name', this.name);
    appendScalar(form, 'status', this.status === 'Active' ? 'active' : 'inactive');
    appendScalar(form, 'description', this.description);
    appendScalar(form, 'notes', this.notes);
    appendFile(form, 'cover_image', this.selectedFile);
    appendSchedule(form, this.days());
    appendServices(form, this.services());
    appendContacts(form, this.contacts());

    const id = this.id();
    const req$ = id ? this.svc.updateMultipart(id, form) : this.svc.create(form);
    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate([this.listRoute]);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(err.error?.message ?? 'Save failed');
      }
    });
  }
}
