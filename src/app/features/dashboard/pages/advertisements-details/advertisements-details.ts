import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdvertisementsService } from '../../../../core/services/advertisements.service';
import { ProviderItem, UserResource, UsersService } from '../../../../core/services/users.service';
import { httpUrlValidator } from '../../../../core/validators/url.validator';
import { I18nService } from '../../../../core/i18n/i18n.service';
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
  private i18n = inject(I18nService);

  id = signal<number | null>(null);
  isEdit = computed(() => this.id() !== null);
  loading = signal(false);
  saving = signal(false);
  errorMessage = signal<string | null>(null);
  /**
   * Set when the record behind this URL could not be read.
   *
   * A deleted advert's edit URL still resolves — the route does not know the
   * row is gone — and the API answers 404. Swallowing that left an empty form
   * that looked ready to fill in, and saving it would have created a second
   * advert rather than editing the one the URL names.
   */
  loadError = signal<string | null>(null);

  uploadedImage = signal<string | null>(null);
  selectedFile: File | null = null;

  // Owner picker state
  ownerType = signal<UserResource | ''>('');
  /**
   * True on an edit whose advert came back without an owner id — which is
   * every edit today. Drives the notice on the form, so an admin knows that
   * leaving the field alone keeps the current owner and that picking one
   * replaces it.
   */
  ownerUnknown = signal(false);
  ownersLoading = signal(false);
  ownerSearch = signal('');
  owners = signal<OwnerOption[]>([]);

  // The same keys the notification audience and the sidebar use, for the
  // same reason: an owner type should read the same wherever it appears,
  // and in Arabic these were thirteen English words in an Arabic form.
  readonly ownerTypeOptions: OwnerTypeOption[] = [
    { value: 'doctors', label: 'users.doctor.title' },
    { value: 'hospitals', label: 'users.hospital.title' },
    { value: 'clinics', label: 'users.clinic.title' },
    { value: 'pharmacies', label: 'users.pharmacy.title' },
    { value: 'labs', label: 'users.lab.title' },
    { value: 'medical-issuance', label: 'users.issuance.title' },
    { value: 'home-care', label: 'users.home_care.title' },
    { value: 'physical-therapy', label: 'users.therapy.title' },
    { value: 'employment-offices', label: 'users.employment.title' },
    { value: 'medical-devices', label: 'users.medical_devices.title' }
  ];

  /**
   * What the API calls this kind of owner, mapped to the value this form
   * uses. The two vocabularies do not line up: the API answers `doctor`,
   * `clinic`, `medical_insurance` and `pharmacies` — singular for most,
   * plural for one — while the owner picker is keyed by the admin route
   * names. Measured against live records rather than assumed.
   *
   * `normaliseType` below also strips separators and a trailing "s", so a
   * value nobody listed here still lands in the right place as long as the
   * word matches.
   */
  private static readonly PROVIDER_TYPE_ALIASES: Record<string, UserResource> = {
    doctor: 'doctors',
    hospital: 'hospitals',
    clinic: 'clinics',
    pharmacy: 'pharmacies',
    lab: 'labs',
    laboratory: 'labs',
    medicalinsurance: 'medical-issuance',
    medicalissuance: 'medical-issuance',
    homecare: 'home-care',
    physicaltherapy: 'physical-therapy',
    employmentoffice: 'employment-offices',
    medicaldevice: 'medical-devices'
  };

  form = this.fb.group({
    // Required on create. On edit it is left optional on purpose — see
    // `loadAd`: the API does not say who owns an advert, and an update that
    // omits `owner_id` keeps the owner it already has (verified against the
    // API). Forcing a choice here is how an advert quietly changes hands.
    owner_id: [null as number | null, Validators.required],
    redirect_link: ['', [Validators.required, httpUrlValidator()]],
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

  /**
   * Which message to show. "Required" and "that is not a link we will send
   * someone" are different mistakes and deserve different wording.
   */
  get redirectError(): string {
    const c = this.form.controls.redirect_link;
    return c.hasError('url') ? 'ads.redirect_invalid' : 'ads.redirect_required';
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

        // The field is `provider_type`, not `owner_type` — which is why the
        // picker came up blank on every edit. Measured on a live record:
        // GET /admin/advertisements/6 answers `"provider_type":"doctor"` and
        // carries no `owner_type` at all.
        const resource = this.normaliseType(ad.provider_type);
        if (resource) {
          this.ownerType.set(resource);
          this.loadOwners(resource);
        }

        // The owner itself cannot be prefilled: the advert payload names the
        // kind of owner but never which one — no `owner_id`, no `user_id`,
        // nothing. So on edit the field is optional, and an untouched one is
        // not sent, which leaves the owner as it was. Asked for in the
        // backend contract; until then this is the only answer that cannot
        // reassign somebody's advert by accident.
        this.ownerUnknown.set(ad.owner_id == null);
        if (ad.owner_id == null) {
          this.form.controls.owner_id.removeValidators(Validators.required);
          this.form.controls.owner_id.updateValueAndValidity();
        }
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadError.set(err.status === 404 ? 'ads.not_found' : 'ads.load_failed');
        this.loading.set(false);
      }
    });
  }

  /**
   * Turns whatever the API called the provider type into one of this form's
   * values. Case, separators and a trailing "s" are all ignored, because the
   * API is not consistent about any of them.
   */
  private normaliseType(raw: string | null | undefined): UserResource | null {
    if (!raw) return null;
    const direct = this.ownerTypeOptions.find(o => o.value === raw);
    if (direct) return direct.value;

    const key = raw.toLowerCase().replace(/[^a-z]/g, '');
    const alias = AdvertisementsDetails.PROVIDER_TYPE_ALIASES[key]
      ?? AdvertisementsDetails.PROVIDER_TYPE_ALIASES[key.replace(/s$/, '')];
    if (alias) return alias;

    const loose = this.ownerTypeOptions.find(
      o => o.value.replace(/[^a-z]/g, '') === key || o.value.replace(/[^a-z]/g, '') === key + 's'
    );
    return loose ? loose.value : null;
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
      // Only a provider that cleared registration and can still sign in may
      // own an ad. `status` is the approval lifecycle here — `active` belongs
      // to `account_status`.
      status: 'approved',
      account_status: 'active'
    }).subscribe({
      next: r => {
        // `user_id`, not `id`. A provider row is keyed by its own table —
        // doctor 20 is user 90 — and `owner_id` on an advert is a user id.
        // Sending the row id attached the advert to whoever happened to hold
        // that user id: measured on 2026-10-12, creating an advert with
        // owner_id=20 for a doctor stored it as `provider_type:
        // "medical_devices"`, while owner_id=90 stored it as `"doctor"`.
        //
        // A row without `user_id` is left out rather than falling back to
        // `id`, because the fallback is exactly the bug.
        this.owners.set(
          r.items
            .filter(u => u.user_id != null)
            .map(u => ({
              id: u.user_id as number,
              label: `${u.name}${u.email ? ' — ' + u.email : ''}`
            }))
        );
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
      this.errorMessage.set(this.i18n.translate('ads.fill_required'));
      return;
    }

    this.saving.set(true);

    const v = this.form.getRawValue();
    const form = new FormData();
    // Omitted when nothing was picked. On an edit that means the advert keeps
    // the owner it already has — verified against the API: an update carrying
    // only `redirect_link` left `provider_type` untouched.
    if (v.owner_id !== null && v.owner_id !== undefined) form.append('owner_id', String(v.owner_id));
    form.append('redirect_link', (v.redirect_link ?? '').trim());
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
