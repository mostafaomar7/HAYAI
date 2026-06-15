import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdvertisementsService } from '../../../../core/services/advertisements.service';
import { ProviderItem, UserResource, UsersService } from '../../../../core/services/users.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

interface OwnerTypeOption {
  value: UserResource;
  label: string;
}

interface OwnerOption {
  id: number;
  label: string;
}

@Component({
  selector: 'app-advertisements-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TPipe],
  templateUrl: './advertisements-details.html',
  styleUrl: './advertisements-details.css'
})
export class AdvertisementsDetails {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private ads = inject(AdvertisementsService);
  private users = inject(UsersService);

  id = signal<number | null>(null);
  isEdit = computed(() => this.id() !== null);
  loading = signal(false);
  saving = signal(false);
  errorMessage = signal<string | null>(null);

  uploadedImage = signal<string | null>(null);
  selectedFile: File | null = null;

  // Owner picker state
  ownerType = signal<UserResource | ''>('');
  ownersLoading = signal(false);
  ownerSearch = signal('');
  owners = signal<OwnerOption[]>([]);

  readonly ownerTypeOptions: OwnerTypeOption[] = [
    { value: 'doctors', label: 'Doctor' },
    { value: 'hospitals', label: 'Hospital' },
    { value: 'clinics', label: 'Clinic' },
    { value: 'pharmacies', label: 'Pharmacy' },
    { value: 'labs', label: 'Lab / Radiology' },
    { value: 'medical-issuance', label: 'Medical Issuance' },
    { value: 'home-care', label: 'Home Care' },
    { value: 'physical-therapy', label: 'Physical Therapy' },
    { value: 'employment-offices', label: 'Employment Office' },
    { value: 'medical-devices', label: 'Medical Devices' }
  ];

  form = this.fb.group({
    owner_id: [null as number | null, Validators.required],
    redirect_link: ['', [Validators.required]],
    status: ['active'],
    is_published: [true],
    start_date: [''],
    end_date: ['']
  });

  // For inline validation
  showValidation = signal(false);

  get ownerIdInvalid(): boolean {
    const c = this.form.controls.owner_id;
    return (c.touched || this.showValidation()) && c.invalid;
  }

  get redirectInvalid(): boolean {
    const c = this.form.controls.redirect_link;
    return (c.touched || this.showValidation()) && c.invalid;
  }

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.id.set(id);
      this.loadAd(id);
    }
  }

  private loadAd(id: number) {
    this.loading.set(true);
    this.ads.get(id).subscribe({
      next: ad => {
        this.form.patchValue({
          owner_id: ad.owner_id ?? null,
          redirect_link: ad.redirect_link,
          status: ad.status,
          is_published: ad.is_published,
          start_date: ad.start_date ?? '',
          end_date: ad.end_date ?? ''
        });
        this.uploadedImage.set(ad.image_url);

        // If the API returns the owner type, prefill the type select and load that list.
        // Otherwise the user can still re-pick.
        const t = (ad as any).owner_type as UserResource | undefined;
        if (t) {
          this.ownerType.set(t);
          this.loadOwners(t);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onOwnerTypeChange(value: string) {
    this.ownerType.set(value as UserResource | '');
    this.form.patchValue({ owner_id: null });
    if (value) this.loadOwners(value as UserResource);
    else this.owners.set([]);
  }

  onOwnerSearch(value: string) {
    this.ownerSearch.set(value);
    if (this.ownerType()) this.loadOwners(this.ownerType() as UserResource);
  }

  onOwnerSelected(value: string) {
    this.form.patchValue({ owner_id: value ? Number(value) : null });
  }

  private loadOwners(resource: UserResource) {
    this.ownersLoading.set(true);
    this.users.list<ProviderItem>(resource, {
      per_page: 50,
      search: this.ownerSearch() || undefined,
      status: 'active'
    }).subscribe({
      next: r => {
        this.owners.set(r.items.map(u => ({
          id: u.id,
          label: `${u.name}${u.email ? ' — ' + u.email : ''}`
        })));
        this.ownersLoading.set(false);
      },
      error: () => {
        this.owners.set([]);
        this.ownersLoading.set(false);
      }
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => this.uploadedImage.set(String(e.target?.result ?? ''));
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.uploadedImage.set(null);
    this.selectedFile = null;
  }

  goBack() {
    this.location.back();
  }

  save() {
    this.showValidation.set(true);
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please fill in the required fields (Owner + Redirect link).');
      return;
    }

    this.saving.set(true);

    const v = this.form.getRawValue();
    const form = new FormData();
    if (v.owner_id !== null && v.owner_id !== undefined) form.append('owner_id', String(v.owner_id));
    form.append('redirect_link', v.redirect_link ?? '');
    if (v.status) form.append('status', v.status);
    form.append('is_published', v.is_published ? '1' : '0');
    if (v.start_date) form.append('start_date', v.start_date);
    if (v.end_date) form.append('end_date', v.end_date);
    if (this.selectedFile) form.append('image', this.selectedFile);

    const id = this.id();
    const req$ = id ? this.ads.updateMultipart(id, form) : this.ads.create(form);
    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/dashboard/Advertisements']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(err.error?.message ?? 'Save failed');
      }
    });
  }
}
