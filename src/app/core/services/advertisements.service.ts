import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * Who sees an advert in the patient app — the same field the Partner app
 * sends (2026-11-18). `patient`: every patient who is not a tourist.
 */
export type AdAudience = 'all' | 'patient' | 'tourist';
export const AD_AUDIENCES: AdAudience[] = ['all', 'patient', 'tourist'];

/** The advert's audience; a missing or unknown value reads as everyone. */
export function adAudience(v: string | null | undefined): AdAudience {
  return AD_AUDIENCES.includes(v as AdAudience) ? (v as AdAudience) : 'all';
}

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
  /** The owner's user id; `null` on a Hayai advert, which has no account. */
  owner_id?: number | null;
  /** These arrived with the API change we asked for; see the backend notes. */
  owner_name?: string | null;
  /**
   * The account type in words, already translated by `Accept-Language`.
   * Shown instead of `provider_type`, which is an account-type token and is
   * deliberately spelled as the apps' filter spells it — `pharmacies` plural
   * next to `doctor` singular. Nothing here should be tidying that up.
   */
  provider_type_label?: string | null;
  title?: string | null;
  description?: string | null;
  /** Absent on adverts from before the field existed: those reach everyone. */
  audience?: AdAudience | null;
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
