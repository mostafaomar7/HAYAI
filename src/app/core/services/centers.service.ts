import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';
import { ContactItem, ScheduleSlot } from '../models/scheduled-entity.model';

export type CenterCategory = 'dialysis' | 'hyperbaric_oxygen' | 'oncology';

export interface MedicalCenter {
  id: number;
  category: CenterCategory;
  name: string;
  status: 'active' | 'inactive';
  cover_image_url: string | null;
  location_label: string | null;
  description: string | null;
  notes: string | null;
  schedule: ScheduleSlot[];
  services: string[];
  contacts: ContactItem[];
  services_count: number;
  contacts_count: number;
  created_at: string;
  updated_at: string;
}

export interface CentersListQuery {
  category: CenterCategory;
  page?: number;
  per_page?: number;
  search?: string;
  status?: 'active' | 'inactive';
}

@Injectable({ providedIn: 'root' })
export class CentersService {
  private api = inject(ApiService);
  private path = '/admin/centers';

  list(query: CentersListQuery): Observable<PagedResult<MedicalCenter>> {
    return this.api.getPaged<MedicalCenter>(this.path, query);
  }

  get(id: number): Observable<MedicalCenter> {
    return this.api.get<MedicalCenter>(`${this.path}/${id}`);
  }

  create(form: FormData): Observable<MedicalCenter> {
    return this.api.postMultipart<MedicalCenter>(this.path, form);
  }

  update(id: number, body: Partial<MedicalCenter>): Observable<MedicalCenter> {
    return this.api.put<MedicalCenter>(`${this.path}/${id}`, body);
  }

  updateMultipart(id: number, form: FormData): Observable<MedicalCenter> {
    return this.api.postMultipart<MedicalCenter>(`${this.path}/${id}`, form);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.path}/${id}`);
  }
}
