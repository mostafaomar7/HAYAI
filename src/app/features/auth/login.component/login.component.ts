import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TPipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  i18n = inject(I18nService);

  showPassword = false;
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  submit() {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.login(this.form.getRawValue() as { identifier: string; password: string }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.message ?? this.i18n.translate('login.failed'));
      }
    });
  }
}
