import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * The verification badge is a separate feature from registration approval.
 * It lives on `hospitals.verification_status`, is keyed by the **hospital id**,
 * and has no bearing on whether the account can sign in — that is the approval
 * lifecycle on `facilities.status`, handled by `ApprovalsService`.
 */
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

/**
 * Hospitals and senior-care homes share this queue — a senior-care home is a
 * hospital profile with a different `facility_type`. Leaving the filter out
 * returns both, which is what the screen did before the type existed.
 */
export type VerificationFacilityType = 'hospital' | 'senior_care';

export interface HospitalVerification {
  id: number;
  name: string;
  email: string;
  phone: string;
  logo: string | null;
  verification_status: VerificationStatus;
  facility_type?: VerificationFacilityType;
  facility_type_label?: string;
  verification_documents: string[] | null;
  created_at: string;
  rejection_reason?: string | null;
}

@Injectable({ providedIn: 'root' })
export class HospitalVerificationsService {
  private api = inject(ApiService);

  list(query: {
    verification_status?: VerificationStatus;
    facility_type?: VerificationFacilityType;
    page?: number;
    per_page?: number;
    search?: string;
  } = {}): Observable<PagedResult<HospitalVerification>> {
    return this.api.getPaged<HospitalVerification>('/admin/hospitals/verifications', query);
  }

  /**
   * `id` is the **hospital-profile id** from this list, not the facility id the
   * accounts lists hand out. Both exist for the same home and they are not the
   * same number. That holds for senior care too: it goes through these same
   * `/admin/hospitals/...` endpoints, not through `/admin/senior-care/...`.
   */
  approve(id: number): Observable<HospitalVerification> {
    return this.api.patch<HospitalVerification>(`/admin/hospitals/${id}/approve`, {});
  }

  reject(id: number, reason?: string): Observable<HospitalVerification> {
    return this.api.patch<HospitalVerification>(`/admin/hospitals/${id}/reject`, { reason });
  }
}
