import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/** Login flag — whether the account can sign in at all. */
export type AccountStatus = 'active' | 'blocked';

/**
 * Approval lifecycle of a provider record. Distinct from `AccountStatus`:
 * a provider can be `approved` yet blocked, or `pending` yet able to sign in.
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'blocked' | 'closed';

export interface BaseUserListItem {
  id: number;
  name: string;
  email: string | null;
  phone?: string | null;
  profile_image?: string | null;
  logo?: string | null;
  created_at: string;
}

/** Patients and tourists have no approval flow — `status` is the login flag. */
export interface PatientItem extends BaseUserListItem {
  status: AccountStatus;
  governate: string | null;
  gender: 'male' | 'female' | null;
}

export interface TouristItem extends BaseUserListItem {
  status: AccountStatus;
  gender: 'male' | 'female' | null;
}

/**
 * Providers carry both states: `status` is the approval lifecycle and
 * `account_status` is the login flag.
 */
export interface ProviderItem extends BaseUserListItem {
  status: ApprovalStatus;
  account_status: AccountStatus;
  is_approved: boolean;
  rejection_reason: string | null;
  plan: { id: number; name: string } | null;
  type?: string;
  org_type?: string;
}

export interface DoctorItem extends ProviderItem {
  role: string | null;
  specialty: string | null;
  subspecialty: string | null;
}

export type UserResource =
  | 'patients'
  | 'tourists'
  | 'doctors'
  | 'hospitals'
  | 'clinics'
  | 'pharmacies'
  | 'labs'
  | 'medical-issuance'
  | 'home-care'
  | 'physical-therapy'
  | 'employment-offices'
  | 'medical-devices';

/** Only these two expose the dedicated block/unblock endpoints. */
export type BlockableResource = Extract<UserResource, 'patients' | 'tourists'>;

export interface UserListQuery {
  page?: number;
  per_page?: number;
  search?: string;
  /** Patients/tourists: an `AccountStatus`. Providers: an `ApprovalStatus`. */
  status?: string;
  /** Providers only — filters the login flag. */
  account_status?: string;
  // patient
  governate?: string;
  gender?: string;
  // doctor
  doctor_role_id?: number;
  specialty_id?: number;
  subspecialty_id?: number;
  // provider
  plan_id?: number;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private api = inject(ApiService);

  list<T = ProviderItem>(resource: UserResource, query: UserListQuery = {}): Observable<PagedResult<T>> {
    return this.api.getPaged<T>(`/admin/${resource}`, query);
  }

  get<T = ProviderItem>(resource: UserResource, id: number): Observable<T> {
    return this.api.get<T>(`/admin/${resource}/${id}`);
  }

  /**
   * Writes the login flag on a provider. `blocked` revokes their tokens, so
   * the session ends immediately. The response reports the resulting state
   * under `account_status` — `status` is the approval lifecycle.
   *
   * `inactive` is still accepted by the backend as a legacy alias for
   * `blocked`; we always send the explicit value.
   */
  setStatus(
    resource: UserResource,
    id: number,
    status: AccountStatus
  ): Observable<{ id: number; account_status: AccountStatus }> {
    return this.api.patch<{ id: number; account_status: AccountStatus }>(
      `/admin/${resource}/${id}/status`,
      { status }
    );
  }

  /** Blocks a patient/tourist — the backend also revokes their tokens. */
  block(resource: BlockableResource, id: number): Observable<{ id: number; status: AccountStatus }> {
    return this.api.post<{ id: number; status: AccountStatus }>(`/admin/${resource}/${id}/block`);
  }

  unblock(resource: BlockableResource, id: number): Observable<{ id: number; status: AccountStatus }> {
    return this.api.post<{ id: number; status: AccountStatus }>(`/admin/${resource}/${id}/unblock`);
  }

  setPlan<T = ProviderItem>(resource: UserResource, id: number, planId: number): Observable<T> {
    return this.api.patch<T>(`/admin/${resource}/${id}/plan`, { plan_id: planId });
  }
}
