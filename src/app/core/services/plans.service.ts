import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService, PagedResult } from './api.service';
import { UserResource } from './users.service';

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
  | 'medical_devices'
  /**
   * Patients hold a plan too now, and it decides which modules of the patient
   * app they can reach. Unlike the provider types it is free, and every account
   * falls back to whichever patient plan is flagged `is_default`.
   */
  | 'patient';

/** Single source for the plan-type dropdowns (list filter and the editor). */
export const PLAN_TYPE_OPTIONS: { value: PlanType; label: string }[] = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'general_practitioner', label: 'General Practitioner' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'pharmacies', label: 'Pharmacies' },
  { value: 'labs_radiology', label: 'Labs & Radiology' },
  { value: 'medical_insurance', label: 'Medical Insurance' },
  { value: 'home_care', label: 'Home Care' },
  { value: 'physical_therapy', label: 'Physical Therapy' },
  { value: 'employment_office', label: 'Employment Office' },
  { value: 'medical_devices', label: 'Medical Devices' },
  { value: 'patient', label: 'Patient' }
];

/**
 * Every field below `description` arrived with the feature-gating work and is
 * optional on purpose: the dashboard has to keep working against a server that
 * has not run the new migrations yet. Read them defensively.
 */
export interface PlanModule {
  id?: number;
  module_name: string;
  module_key: string;
  included: boolean;
  description: string | null;
  /** Row cap (not a monthly quota) — only meaningful when `supports_limit`. */
  limit?: number | null;
  name?: string;
  group?: string | null;
  supports_limit?: boolean;
  limit_unit?: string | null;
  /** `false` = the server never gates it (profile, notifications, …). */
  gateable?: boolean;
  /** `false` = key was removed from the code catalog; read-only leftover. */
  in_catalog?: boolean;
}

export interface PlanModuleCatalog {
  plan_type: PlanType;
  key: string;
  name: string;
  description: string | null;
  /** The patient catalog names this `group_name`; read whichever arrives. */
  group?: string | null;
  group_name?: string | null;
  group_label?: string | null;
  sort_order?: number;
  default_included?: boolean;
  supports_limit?: boolean;
  limit_unit?: string | null;
  gateable?: boolean;
  is_active?: boolean;
  /** `code` = redeployed each release, `custom` = created by an admin. */
  source?: 'code' | 'custom';
  is_customized?: boolean;
  /** Compared against `plan.modules_saved_at` to flag newly shipped features. */
  created_at?: string | null;
}

/** `meta.groups` from the catalog endpoint — order and labels come from the server. */
export interface ModuleGroup {
  key: string;
  label: string;
  sort_order?: number;
}

export interface ModuleCatalogResult {
  items: PlanModuleCatalog[];
  groups: ModuleGroup[];
}

export interface Plan {
  id: number;
  name: string;
  plan_type: PlanType;
  doctor_role_id: number | null;
  doctor_role?: { id: number; name: string } | null;
  price: number | string;
  /** Emitted as a constant ("EGP") today — read it rather than hardcoding. */
  currency: string;
  months: number;
  discount: number;
  description: string | null;
  status: 'active' | 'inactive';
  modules: PlanModule[];
  /** Live subscriber count — shown before destructive or wide-reaching edits. */
  subscribers_count?: number;
  /**
   * The one plan of this type every account falls back to. On the patient plan
   * that is the whole patient base, so `subscribers_count` counts every patient
   * rather than only the accounts that carry a subscription row.
   */
  is_default?: boolean;
  /** When the modules were last written; anything newer in the catalog is new. */
  modules_saved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Which plan types belong to each provider list. Assigning a hospital a
 * pharmacy plan is meaningless, so the pickers are scoped to the types that
 * actually apply to the record being edited.
 *
 * Doctors are the one resource with several: `plan_type` is flat, so a doctor
 * plan is filed under the seniority it targets rather than under `doctor` with
 * a separate role field.
 *
 * Patients and tourists have no subscription and so no entry.
 */
export const PLAN_TYPES_FOR_RESOURCE: Partial<Record<UserResource, PlanType[]>> = {
  hospitals: ['hospital'],
  clinics: ['clinic'],
  doctors: ['doctor', 'general_practitioner', 'specialist', 'consultant'],
  pharmacies: ['pharmacies'],
  labs: ['labs_radiology'],
  'medical-issuance': ['medical_insurance'],
  'home-care': ['home_care'],
  'physical-therapy': ['physical_therapy'],
  'employment-offices': ['employment_office'],
  'medical-devices': ['medical_devices'],
  patients: ['patient']
};

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

  /**
   * Module catalog for one plan type. Group order and labels come back in
   * `meta.groups` so the dashboard never hardcodes them; on a server that
   * predates that, `groups` is empty and the caller falls back to one section.
   */
  modules(planType: PlanType): Observable<ModuleCatalogResult> {
    return this.api
      .getWithMeta<PlanModuleCatalog[], { groups?: ModuleGroup[] }>(
        `${this.path}/modules`,
        { plan_type: planType }
      )
      .pipe(map(r => ({ items: r.data ?? [], groups: r.meta?.groups ?? [] })));
  }

  /** Admin-defined module. The server cannot gate it until a dev maps routes. */
  createModule(body: {
    plan_type: PlanType;
    key: string;
    name: string;
    description?: string | null;
    group?: string | null;
    default_included?: boolean;
  }): Observable<PlanModuleCatalog> {
    return this.api.post<PlanModuleCatalog>(`${this.path}/modules`, body);
  }

  updateModule(id: number, body: Partial<PlanModuleCatalog>): Observable<PlanModuleCatalog> {
    return this.api.patch<PlanModuleCatalog>(`${this.path}/modules/${id}`, body);
  }

  /** Custom modules only — code-owned keys are disabled via `is_active`. */
  deleteModule(id: number): Observable<void> {
    return this.api.delete<void>(`${this.path}/modules/${id}`);
  }

  /** Republishes the code catalog without waiting for a deploy. */
  syncModules(): Observable<unknown> {
    return this.api.post<unknown>(`${this.path}/modules/sync`);
  }

  create(body: Partial<Plan>): Observable<Plan> {
    return this.api.post<Plan>(this.path, body);
  }

  update(id: number, body: Partial<Plan>): Observable<Plan> {
    return this.api.put<Plan>(`${this.path}/${id}`, body);
  }

  /**
   * Promotes a plan to the fallback for its whole type — for `patient` that is
   * every patient account. Exclusive per type: promoting one demotes whoever
   * held it. The backend refuses an inactive plan with a 422.
   */
  setDefault(id: number): Observable<Plan> {
    return this.api.post<Plan>(`${this.path}/${id}/default`);
  }

  /**
   * Soft delete — the plan leaves every list and cannot be purchased, while
   * current subscribers keep it until their term ends. The response reports
   * how many were kept.
   */
  delete(id: number): Observable<{ subscribers_kept?: number } | null> {
    return this.api.delete<{ subscribers_kept?: number } | null>(`${this.path}/${id}`);
  }
}
