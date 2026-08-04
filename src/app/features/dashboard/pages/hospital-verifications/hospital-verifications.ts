import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  HospitalVerification,
  HospitalVerificationsService,
  VerificationStatus
} from '../../../../core/services/hospital-verifications.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';

@Component({
  selector: 'app-hospital-verifications',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './hospital-verifications.html',
  styleUrl: './hospital-verifications.css'
})
export class HospitalVerifications {
  private svc = inject(HospitalVerificationsService);
  private dialog = inject(DialogService);

  loading = signal(true);
  items = signal<HospitalVerification[]>([]);
  total = signal(0);
  status = signal<VerificationStatus>('pending');

  readonly perPage = 15;
  page = signal(1);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list({
      verification_status: this.status(),
      page: this.page(),
      per_page: this.perPage
    }).subscribe({
      next: r => {
        // Approving/rejecting the last row of the last page leaves us past the end.
        if (!r.items.length && this.page() > 1) {
          this.page.update(p => p - 1);
          this.load();
          return;
        }
        this.items.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  goToPage(page: number) { this.page.set(page); this.load(); }

  /** i18n key for the verification badge — reuses the tab labels. */
  verificationLabel(status: VerificationStatus | null | undefined): string {
    return status ? `hospitals_verify.tab.${status}` : 'common.no_data';
  }

  setStatus(s: VerificationStatus) {
    this.status.set(s);
    // A different tab is a different result set — restart from page 1.
    this.page.set(1);
    this.load();
  }

  /** First two letters of the name (uppercased). */
  initials(name: string): string {
    if (!name) return '?';
    const cleaned = name.trim();
    if (!cleaned) return '?';
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return cleaned.slice(0, 2).toUpperCase();
  }

  /** Deterministic background color from the name. */
  avatarColor(name: string): string {
    const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    let h = 0;
    for (let i = 0; i < (name?.length ?? 0); i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  async approve(id: number) {
    const ok = await this.dialog.confirm({
      title: 'hospitals_verify.approve_title',
      icon: 'question',
      confirmText: 'common.approve'
    });
    if (!ok) return;
    this.svc.approve(id).subscribe({
      next: () => { this.dialog.toast('success', 'hospitals_verify.approved'); this.load(); },
      error: err => this.dialog.error('hospitals_verify.approve_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  async reject(id: number) {
    // The reason is optional here — unlike registration rejection.
    const reason = await this.dialog.prompt({
      title: 'hospitals_verify.reject_title',
      text: 'hospitals_verify.reject_text',
      placeholder: 'hospitals_verify.reject_placeholder',
      inputType: 'textarea',
      confirmText: 'common.reject'
    });
    if (reason === null) return;
    this.svc.reject(id, reason.trim() || undefined).subscribe({
      next: () => { this.dialog.toast('success', 'hospitals_verify.rejected'); this.load(); },
      error: err => this.dialog.error('hospitals_verify.reject_failed', err.error?.message ?? 'dialog.try_again')
    });
  }
}
