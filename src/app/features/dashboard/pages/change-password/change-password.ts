import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { DialogService } from '../../../../core/services/dialog.service';
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
  private access = inject(AdminAccessService);
  private dialog = inject(DialogService);
  private router = inject(Router);

  /**
   * Signed in with a temporary password — a new account, or one a
   * super-admin reset. Every other screen is closed until this is done
   * (`adminAreaGuard`), so the page says why the admin is here.
   */
  readonly forced = computed(() => !!this.auth.currentUser()?.must_change_password);

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
      this.errorMsg.set('password.err_required');
      return;
    }
    if (this.new_password.length < 8) {
      this.errorMsg.set('password.err_length');
      return;
    }
    if (this.new_password !== this.new_password_confirmation) {
      this.errorMsg.set('password.err_mismatch');
      return;
    }
    if (this.new_password === this.current_password) {
      this.errorMsg.set('password.err_same');
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
        if (this.forced()) {
          // The API has cleared the flag and signed out the admin's other
          // sessions; this one carries on. Clear it here too, re-read the
          // access, and open the dashboard the role allows.
          const user = this.auth.currentUser();
          if (user) this.auth.setUser({ ...user, must_change_password: false });
          this.access.refresh().subscribe();
          this.dialog.toast('success', 'password.changed');
          this.router.navigateByUrl('/dashboard');
          return;
        }
        this.successMsg.set('password.changed');
        this.current_password = '';
        this.new_password = '';
        this.new_password_confirmation = '';
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMsg.set(err.error?.message ?? 'password.err_failed');
      }
    });
  }
}
