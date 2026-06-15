import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  HospitalVerification,
  HospitalVerificationsService,
  VerificationStatus
} from '../../../../core/services/hospital-verifications.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-hospital-verifications',
  standalone: true,
  imports: [CommonModule, TPipe],
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

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list({ verification_status: this.status() }).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.pagination.total); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  setStatus(s: VerificationStatus) {
    this.status.set(s);
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
      title: 'Approve this hospital?',
      icon: 'question',
      confirmText: 'Approve'
    });
    if (!ok) return;
    this.svc.approve(id).subscribe({
      next: () => { this.dialog.toast('success', 'Hospital approved'); this.load(); },
      error: err => this.dialog.error('Approve failed', err.error?.message ?? 'Please try again.')
    });
  }

  async reject(id: number) {
    const reason = await this.dialog.prompt({
      title: 'Reject this hospital?',
      text: 'Optional rejection reason.',
      placeholder: 'e.g. License document is unclear',
      inputType: 'textarea',
      confirmText: 'Reject'
    });
    if (reason === null) return;
    this.svc.reject(id, reason || undefined).subscribe({
      next: () => { this.dialog.toast('success', 'Hospital rejected'); this.load(); },
      error: err => this.dialog.error('Reject failed', err.error?.message ?? 'Please try again.')
    });
  }
}
