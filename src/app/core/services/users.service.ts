import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

export interface BaseUserListItem {
  id: number;
  name: string;
  email: string | null;
  phone?: string | null;
  profile_image?: string | null;
  logo?: string | null;
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
}

export interface PatientItem extends BaseUserListItem {
  governate: string | null;
  gender: 'male' | 'female' | null;
}

export interface TouristItem extends BaseUserListItem {
  gender: 'male' | 'female' | null;
}

export interface DoctorItem extends BaseUserListItem {
  plan: { id: number; name: string } | null;
  role: string | null;
  specialty: string | null;
  subspecialty: string | null;
}

export interface ProviderItem extends BaseUserListItem {
  plan: { id: number; name: string } | null;
  type?: string;
  org_type?: string;
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

export interface UserListQuery {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
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

  setStatus<T = ProviderItem>(
    resource: UserResource,
    id: number,
    status: 'active' | 'inactive' | 'blocked'
  ): Observable<T> {
    return this.api.patch<T>(`/admin/${resource}/${id}/status`, { status });
  }

  setPlan<T = ProviderItem>(resource: UserResource, id: number, planId: number): Observable<T> {
    return this.api.patch<T>(`/admin/${resource}/${id}/plan`, { plan_id: planId });
  }
}
