import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface HospitalVerification {
  id: number;
  name: string;
  email: string;
  phone: string;
  logo: string | null;
  verification_status: VerificationStatus;
  verification_documents: string[] | null;
  created_at: string;
  rejection_reason?: string | null;
}

@Injectable({ providedIn: 'root' })
export class HospitalVerificationsService {
  private api = inject(ApiService);

  list(query: { verification_status?: VerificationStatus; page?: number; per_page?: number; search?: string } = {}): Observable<PagedResult<HospitalVerification>> {
    return this.api.getPaged<HospitalVerification>('/admin/hospitals/verifications', query);
  }

  approve(id: number): Observable<HospitalVerification> {
    return this.api.patch<HospitalVerification>(`/admin/hospitals/${id}/approve`, {});
  }

  reject(id: number, reason?: string): Observable<HospitalVerification> {
    return this.api.patch<HospitalVerification>(`/admin/hospitals/${id}/reject`, { reason });
  }
}
