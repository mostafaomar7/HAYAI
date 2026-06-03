import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

export interface Advertisement {
  id: number;
  image_url: string;
  image_path?: string;
  redirect_link: string;
  status: 'active' | 'expired';
  status_label?: string;
  is_published: boolean;
  start_date: string | null;
  end_date: string | null;
  published_at: string | null;
  views_count: number;
  clicks_count: number;
  provider_type?: string;
  owner_id?: number;
  created_at: string;
  updated_at: string;
}

export interface AdvertisementListQuery {
  page?: number;
  per_page?: number;
  search?: string;
  provider_type?: string;
  status?: string;
  is_published?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdvertisementsService {
  private api = inject(ApiService);
  private path = '/admin/advertisements';

  list(query: AdvertisementListQuery = {}): Observable<PagedResult<Advertisement>> {
    return this.api.getPaged<Advertisement>(this.path, query);
  }

  get(id: number): Observable<Advertisement> {
    return this.api.get<Advertisement>(`${this.path}/${id}`);
  }

  create(form: FormData): Observable<Advertisement> {
    return this.api.postMultipart<Advertisement>(this.path, form);
  }

  update(id: number, body: Partial<Advertisement>): Observable<Advertisement> {
    return this.api.put<Advertisement>(`${this.path}/${id}`, body);
  }

  updateMultipart(id: number, form: FormData): Observable<Advertisement> {
    return this.api.postMultipart<Advertisement>(`${this.path}/${id}`, form);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.path}/${id}`);
  }
}
