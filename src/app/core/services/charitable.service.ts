import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';
import { ContactItem, ScheduleSlot } from '../models/scheduled-entity.model';

export interface CharitableOrganization {
  id: number;
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

export interface CharitableListQuery {
  page?: number;
  per_page?: number;
  search?: string;
  status?: 'active' | 'inactive';
}

@Injectable({ providedIn: 'root' })
export class CharitableService {
  private api = inject(ApiService);
  private path = '/admin/charitable-organizations';

  list(query: CharitableListQuery = {}): Observable<PagedResult<CharitableOrganization>> {
    return this.api.getPaged<CharitableOrganization>(this.path, query);
  }

  get(id: number): Observable<CharitableOrganization> {
    return this.api.get<CharitableOrganization>(`${this.path}/${id}`);
  }

  create(form: FormData): Observable<CharitableOrganization> {
    return this.api.postMultipart<CharitableOrganization>(this.path, form);
  }

  update(id: number, body: Partial<CharitableOrganization>): Observable<CharitableOrganization> {
    return this.api.put<CharitableOrganization>(`${this.path}/${id}`, body);
  }

  updateMultipart(id: number, form: FormData): Observable<CharitableOrganization> {
    return this.api.postMultipart<CharitableOrganization>(`${this.path}/${id}`, form);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.path}/${id}`);
  }
}
