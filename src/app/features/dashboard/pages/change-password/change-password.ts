import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css'
})
export class ChangePassword {
  private auth = inject(AuthService);

  current_password = '';
  new_password = '';
  new_password_confirmation = '';

  saving = signal(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  save() {
    this.errorMsg.set(null);
    this.successMsg.set(null);

    if (!this.current_password || !this.new_password || !this.new_password_confirmation) {
      this.errorMsg.set('All fields are required.');
      return;
    }
    if (this.new_password.length < 8) {
      this.errorMsg.set('New password must be at least 8 characters.');
      return;
    }
    if (this.new_password !== this.new_password_confirmation) {
      this.errorMsg.set('New password and confirmation do not match.');
      return;
    }
    if (this.new_password === this.current_password) {
      this.errorMsg.set('New password must differ from current.');
      return;
    }

    this.saving.set(true);
    this.auth.changePassword({
      current_password: this.current_password,
      new_password: this.new_password,
      new_password_confirmation: this.new_password_confirmation
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMsg.set('Password changed successfully.');
        this.current_password = '';
        this.new_password = '';
        this.new_password_confirmation = '';
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMsg.set(err.error?.message ?? 'Change password failed.');
      }
    });
  }
}
