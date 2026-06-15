import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile {
  private auth = inject(AuthService);

  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  name = '';
  email = '';
  phone = '';
  country_code = '';
  governate = '';
  gender: 'male' | 'female' | '' = '';
  language = '';
  theme_mode: 'light' | 'dark' | '' = '';

  profileImage = signal<string | null>(null);
  selectedFile: File | null = null;

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.auth.me().subscribe({
      next: u => {
        this.name = u.name ?? '';
        this.email = u.email ?? '';
        this.phone = u.phone ?? '';
        this.country_code = u.country_code ?? '';
        this.profileImage.set(u.profile_image);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => this.profileImage.set(String(e.target?.result ?? ''));
    reader.readAsDataURL(file);
  }

  save() {
    this.saving.set(true);
    this.errorMsg.set(null);
    this.successMsg.set(null);

    const set = (form: FormData, k: string, v: string | null | undefined) => {
      if (v !== null && v !== undefined && v !== '') form.append(k, v);
    };

    const req$ = this.selectedFile
      ? (() => {
          const form = new FormData();
          set(form, 'name', this.name);
          set(form, 'email', this.email);
          set(form, 'phone', this.phone);
          set(form, 'country_code', this.country_code);
          set(form, 'governate', this.governate);
          set(form, 'gender', this.gender);
          set(form, 'language', this.language);
          set(form, 'theme_mode', this.theme_mode);
          form.append('profile_image', this.selectedFile!);
          return this.auth.updateProfileMultipart(form);
        })()
      : this.auth.updateProfile({
          name: this.name,
          email: this.email,
          phone: this.phone || null,
          country_code: this.country_code || null
        } as any);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.successMsg.set('Profile updated.');
        this.selectedFile = null;
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMsg.set(err.error?.message ?? 'Save failed.');
      }
    });
  }
}
