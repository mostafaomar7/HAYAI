import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

export type PlanType =
  | 'hospital'
  | 'clinic'
  | 'doctor'
  | 'general_practitioner'
  | 'specialist'
  | 'consultant'
  | 'pharmacies'
  | 'labs_radiology'
  | 'medical_insurance'
  | 'home_care'
  | 'physical_therapy'
  | 'employment_office'
  | 'medical_devices';

export interface PlanModule {
  id?: number;
  module_name: string;
  module_key: string;
  included: boolean;
  description: string | null;
  limit?: number | null;
}

export interface PlanModuleCatalog {
  plan_type: PlanType;
  key: string;
  name: string;
  description: string | null;
}

export interface Plan {
  id: number;
  name: string;
  plan_type: PlanType;
  doctor_role_id: number | null;
  doctor_role?: { id: number; name: string } | null;
  price: number | string;
  months: number;
  discount: number;
  description: string | null;
  status: 'active' | 'inactive';
  modules: PlanModule[];
  created_at?: string;
  updated_at?: string;
}

export interface PlanListQuery {
  page?: number;
  per_page?: number;
  search?: string;
  plan_type?: PlanType;
  doctor_role_id?: number;
  status?: 'active' | 'inactive';
}

@Injectable({ providedIn: 'root' })
export class PlansService {
  private api = inject(ApiService);
  private path = '/admin/subscription/plans';

  list(query: PlanListQuery = {}): Observable<PagedResult<Plan>> {
    return this.api.getPaged<Plan>(this.path, query);
  }

  get(id: number): Observable<Plan> {
    return this.api.get<Plan>(`${this.path}/${id}`);
  }

  /** Module catalog is now scoped per plan type — pass the selected type. */
  modules(planType: PlanType): Observable<PlanModuleCatalog[]> {
    return this.api.get<PlanModuleCatalog[]>(`${this.path}/modules`, { plan_type: planType });
  }

  create(body: Partial<Plan>): Observable<Plan> {
    return this.api.post<Plan>(this.path, body);
  }

  update(id: number, body: Partial<Plan>): Observable<Plan> {
    return this.api.put<Plan>(`${this.path}/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.path}/${id}`);
  }
}
