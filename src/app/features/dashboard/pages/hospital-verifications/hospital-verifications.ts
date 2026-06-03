import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  HospitalVerification,
  HospitalVerificationsService,
  VerificationStatus
} from '../../../../core/services/hospital-verifications.service';

@Component({
  selector: 'app-hospital-verifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hospital-verifications.html',
  styleUrl: './hospital-verifications.css'
})
export class HospitalVerifications {
  private svc = inject(HospitalVerificationsService);

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

  approve(id: number) {
    if (!confirm('Approve this hospital?')) return;
    this.svc.approve(id).subscribe(() => this.load());
  }

  reject(id: number) {
    const reason = prompt('Reason for rejection (optional):') ?? undefined;
    this.svc.reject(id, reason).subscribe(() => this.load());
  }
}
