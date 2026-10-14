import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { apiErrorText } from '../../../../shared/utils/api-error.util';
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
   * The account type, as the API spells it, beside the admin route this form
   * uses to list owners of that type. They are two different vocabularies and
   * neither is derivable from the other — `labs` lists from `/admin/labs` but
   * the account type is `labs_radiology`, and `medical-issuance` is
   * `medical_insurance`. The ids are the `id` column of
   * `GET /lookups/user-types`, read from it on 2026-10-13 rather than guessed.
   *
   * It was a one-way table of spelling variations before, used only to work
   * out which list to show on an edit. `provider_type` is now required when an
   * advert is created, and it has to be the owner's account type, so the same
   * pairing is needed in the other direction as well — hence one table read
   * both ways instead of a normaliser guessing at plurals.
   */
  private static readonly OWNER_TYPES: ReadonlyArray<{ api: string; resource: UserResource }> = [
    { api: 'doctor', resource: 'doctors' },
    { api: 'hospital', resource: 'hospitals' },
    { api: 'clinic', resource: 'clinics' },
    { api: 'pharmacies', resource: 'pharmacies' },
    { api: 'labs_radiology', resource: 'labs' },
    { api: 'medical_insurance', resource: 'medical-issuance' },
    { api: 'home_care', resource: 'home-care' },
    { api: 'physical_therapy', resource: 'physical-therapy' },
    { api: 'employment_office', resource: 'employment-offices' },
    { api: 'medical_devices', resource: 'medical-devices' }
  ];

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

  /**
   * The `status` the form was loaded with, and whether the dates already
   * explain it. Both exist for one reason — see `statusToSend`.
   */
  private loadedStatus: string | null = null;
  expiredByDate = signal(false);

  // For inline validation
  showValidation = signal(false);

  get ownerIdInvalid(): boolean {
    const c = this.form.controls.owner_id;
    return (c.touched || this.showValidation()) && c.invalid;
  }

  /**
   * The picture is required to create an advertisement and optional to change
   * one — an edit that leaves it alone keeps the picture already stored, which
   * is why the form only omits it rather than clearing it.
   *
   * The server has always enforced this; the form simply never said so, so the
   * only way to find out was to fill everything in, press save and read
   * "Validation failed".
   */
  get imageRequired(): boolean {
    return this.id() === null;
  }

  get imageInvalid(): boolean {
    return this.imageRequired && this.showValidation() && !this.uploadedImage();
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

  /** Today in UTC as `YYYY-MM-DD`, which is how the API compares these dates. */
  private todayUtc(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private endDateHasPassed(endDate: string): boolean {
    return !!endDate && endDate < this.todayUtc();
  }

  /**
   * What the status dropdown should show for a loaded advert.
   *
   * An advert whose `end_date` has passed reads `expired` whether or not an
   * admin ever stopped it, so showing `expired` there would put a choice in
   * front of the admin that they did not make. The control shows `active` in
   * that case and the date is explained beside it instead; `expired` is left
   * for the one thing it still means on its own — an admin stopped this.
   */
  private statusForControl(ad: { status?: string | null; end_date?: string | null }): string {
    const stored = ad.status ?? 'active';
    if (stored !== 'expired') return stored;
    return this.endDateHasPassed(ad.end_date ?? '') ? 'active' : 'expired';
  }

  /**
   * The `status` to put in the request, or `''` to leave it out.
   *
   * From 2026-10-14 the API recomputes `status` from the dates when an edit
   * sends new dates and no `status`, and keeps whatever it is given when one
   * is sent. A form that always posts back the status it loaded would
   * therefore re-send `expired` for a finished advert and pin it there — so
   * extending the end date of a finished advert, the obvious way to bring one
   * back, would silently do nothing. The field is sent only when the admin
   * moved it.
   *
   * On create there is nothing to compare against and the API needs a value,
   * so it always goes.
   */
  private statusToSend(current: string): string {
    if (!this.id()) return current;                       // create
    if (this.loadedStatus === null) return current;       // never loaded
    return current === this.loadedStatus ? '' : current;
  }

  private loadAd(id: number) {
    this.loading.set(true);
    this.ads.get(id).subscribe({
      next: ad => {
        this.form.patchValue({
          owner_id: ad.owner_id ?? null,
          redirect_link: ad.redirect_link,
          // `status` is not a stored fact any more. From the API change of
          // 2026-10-14 it reads `expired` when an admin stopped the advert OR
          // when `end_date` is in the past, and the two are indistinguishable
          // in the payload. Only the first is the admin's choice, so only the
          // first belongs in this control.
          status: this.statusForControl(ad),
          is_published: ad.is_published,
          start_date: ad.start_date ?? '',
          end_date: ad.end_date ?? ''
        });
        this.expiredByDate.set(this.endDateHasPassed(ad.end_date ?? ''));
        this.loadedStatus = this.statusForControl(ad);
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
    const match = AdvertisementsDetails.OWNER_TYPES.find(
      t => t.api === raw || t.resource === raw
    );
    return match ? match.resource : null;
  }

  /**
   * The account type to send for the currently picked owner type.
   *
   * `provider_type` is required when an advert is created and is checked
   * against the account behind `owner_id`: a mismatch is a 422 naming both.
   * We were sending neither, so every create from the dashboard was being
   * refused — measured against production on 2026-10-13, before this.
   */
  private apiProviderType(): string | null {
    const resource = this.ownerType();
    if (!resource) return null;
    const match = AdvertisementsDetails.OWNER_TYPES.find(t => t.resource === resource);
    return match ? match.api : null;
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

    if (this.form.invalid || this.imageInvalid) {
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
    // Sent together or not at all. The API reads them as a pair: an owner with
    // no type is refused, and a type that does not match the account behind the
    // owner is refused naming both. Omitting the pair on an edit is what leaves
    // an advert with the owner it already has.
    const providerType = this.apiProviderType();
    if (v.owner_id !== null && v.owner_id !== undefined && providerType) {
      form.append('owner_id', String(v.owner_id));
      form.append('provider_type', providerType);
    }
    form.append('redirect_link', (v.redirect_link ?? '').trim());
    const status = this.statusToSend(v.status ?? '');
    if (status) form.append('status', status);
    form.append('is_published', v.is_published ? '1' : '0');
    if (v.start_date) form.append('start_date', v.start_date);
    if (v.end_date) form.append('end_date', v.end_date);
    if (this.selectedFile) form.append('image', this.selectedFile);

    const id = this.id();
    const req$ = id ? this.ads.updateMultipart(id, form) : this.ads.create(form);
    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/dashboard/advertisements']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        // The field messages, not just the heading: a 422 here says
        // "Validation failed" at the top and names the field underneath.
        this.errorMessage.set(apiErrorText(err, this.i18n.translate('ads.save_failed')));
      }
    });
  }
}
