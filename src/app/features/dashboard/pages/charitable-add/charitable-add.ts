import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CharitableService } from '../../../../core/services/charitable.service';
import { ContactItem, DEFAULT_SCHEDULE, ScheduleSlot, Weekday } from '../../../../core/models/scheduled-entity.model';
import {
  appendContacts,
  appendFile,
  appendScalar,
  appendSchedule,
  appendServices
} from '../../../../shared/utils/form-data.util';

@Component({
  selector: 'app-charitable-add',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './charitable-add.html',
  styleUrl: './charitable-add.css'
})
export class CharitableAdd {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(CharitableService);

  id = signal<number | null>(null);
  isEdit = computed(() => this.id() !== null);
  loading = signal(false);
  saving = signal(false);
  errorMessage = signal<string | null>(null);

  name = '';
  description = '';
  notes = '';
  isActive = true;
  uploadedImage = signal<string | null>(null);
  selectedFile: File | null = null;

  schedule = signal<ScheduleSlot[]>(DEFAULT_SCHEDULE.map(s => ({ ...s })));

  newServiceName = '';
  services = signal<string[]>([]);

  newContactName = '';
  newContactPhone = '';
  contacts = signal<ContactItem[]>([]);

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.id.set(id);
      this.load(id);
    }
  }

  private load(id: number) {
    this.loading.set(true);
    this.svc.get(id).subscribe({
      next: org => {
        this.name = org.name;
        this.description = org.description ?? '';
        this.notes = org.notes ?? '';
        this.isActive = org.status === 'active';
        this.uploadedImage.set(org.cover_image_url);
        if (org.schedule?.length) {
          this.schedule.set(this.normalizeSchedule(org.schedule));
        }
        this.services.set(org.services ?? []);
        this.contacts.set(org.contacts ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private normalizeSchedule(raw: ScheduleSlot[]): ScheduleSlot[] {
    const order: Weekday[] = ['saturday','sunday','monday','tuesday','wednesday','thursday','friday'];
    return order.map(day => raw.find(s => s.day === day) ?? { day, active: false, from: '', to: '' });
  }

  goBack() { this.location.back(); }

  setStatus(status: boolean) { this.isActive = status; }

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
    const arr = [...this.schedule()];
    arr[index] = { ...arr[index], active: !arr[index].active };
    this.schedule.set(arr);
  }

  updateScheduleField(index: number, field: 'from' | 'to', value: string) {
    const arr = [...this.schedule()];
    arr[index] = { ...arr[index], [field]: value };
    this.schedule.set(arr);
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

  save() {
    this.saving.set(true);
    this.errorMessage.set(null);

    const form = new FormData();
    appendScalar(form, 'name', this.name);
    appendScalar(form, 'status', this.isActive ? 'active' : 'inactive');
    appendScalar(form, 'description', this.description);
    appendScalar(form, 'notes', this.notes);
    appendFile(form, 'cover_image', this.selectedFile);
    appendSchedule(form, this.schedule());
    appendServices(form, this.services());
    appendContacts(form, this.contacts());

    const id = this.id();
    const req$ = id ? this.svc.updateMultipart(id, form) : this.svc.create(form);
    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/dashboard/charitable']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(err.error?.message ?? 'Save failed');
      }
    });
  }
}
