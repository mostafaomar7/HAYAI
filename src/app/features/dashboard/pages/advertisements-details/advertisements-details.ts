import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdvertisementsService } from '../../../../core/services/advertisements.service';

@Component({
  selector: 'app-advertisements-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './advertisements-details.html',
  styleUrl: './advertisements-details.css'
})
export class AdvertisementsDetails {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private ads = inject(AdvertisementsService);

  id = signal<number | null>(null);
  isEdit = computed(() => this.id() !== null);
  loading = signal(false);
  saving = signal(false);
  errorMessage = signal<string | null>(null);

  uploadedImage = signal<string | null>(null);
  selectedFile: File | null = null;

  form = this.fb.group({
    owner_id: [null as number | null, Validators.required],
    redirect_link: ['', [Validators.required]],
    status: ['active'],
    is_published: [true],
    start_date: [''],
    end_date: ['']
  });

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
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);

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
