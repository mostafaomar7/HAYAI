import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';
import { ApprovalStatus, ProviderItem, UserResource } from './users.service';

/**
 * Providers are approved through three parallel endpoint families depending on
 * how the record is stored on the backend.
 */
export type ApprovalGroup = 'facilities' | 'doctors' | 'organizations';

/**
 * Maps a provider list resource onto its approval endpoint family. Patients and
 * tourists are absent — they have no approval lifecycle.
 */
export const APPROVAL_GROUP: Partial<Record<UserResource, ApprovalGroup>> = {
  hospitals: 'facilities',
  clinics: 'facilities',
  doctors: 'doctors',
  pharmacies: 'organizations',
  labs: 'organizations',
  'medical-issuance': 'organizations',
  'home-care': 'organizations',
  'physical-therapy': 'organizations',
  'employment-offices': 'organizations',
  'medical-devices': 'organizations'
};

export interface PendingQuery {
  page?: number;
  per_page?: number;
  search?: string;
  /** `facilities` only — `hospital` | `clinic`. */
  type?: string;
  /** `organizations` only. */
  org_type?: string;
}

@Injectable({ providedIn: 'root' })
export class ApprovalsService {
  private api = inject(ApiService);

  /**
   * `id` is the facility / doctor / organization id returned by the provider
   * lists — not the user id.
   */
  pending<T = ProviderItem>(group: ApprovalGroup, query: PendingQuery = {}): Observable<PagedResult<T>> {
    return this.api.getPaged<T>(`/admin/${group}/pending`, query);
  }

  approve<T = ProviderItem>(group: ApprovalGroup, id: number): Observable<T> {
    return this.api.patch<T>(`/admin/${group}/${id}/approve`, {});
  }

  reject<T = ProviderItem>(group: ApprovalGroup, id: number, rejectionReason: string): Observable<T> {
    return this.api.patch<T>(`/admin/${group}/${id}/reject`, { rejection_reason: rejectionReason });
  }

  block<T = ProviderItem>(group: ApprovalGroup, id: number): Observable<T> {
    return this.api.patch<T>(`/admin/${group}/${id}/block`, {});
  }
}

/** i18n key for an approval-status badge label. */
export function approvalStatusKey(status: ApprovalStatus | null | undefined): string {
  return status ? `approval.${status}` : 'common.no_data';
}
