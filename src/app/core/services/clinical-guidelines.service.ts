import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * The doctor app's Clinical Guidelines, written here and read by the app.
 *
 * Nothing is seeded: until an admin adds one, doctors see an empty list. The
 * texts are clinical content, so whoever enters them owns them — which is why
 * `source` and `last_reviewed_at` are first-class fields, not afterthoughts.
 */

export interface GuidelineCategoryRef {
  id: number;
  name: string;
  name_en?: string;
  name_ar?: string;
}

/** One titled block of bullets, kept per language. */
export interface GuidelineSection {
  title_en: string | null;
  title_ar: string | null;
  items_en: string[];
  items_ar: string[];
}

export interface ClinicalGuideline {
  has_pdf?: boolean;
  /** Opens without a token. */
  pdf_url?: string | null;
  pdf_name?: string | null;
  pdf_size_bytes?: number | null;
  /** The server's own limit — read it rather than hard-coding 10 MB. */
  pdf_max_kb?: number | null;
  id: number;
  /** Localized for display; the editable pair is `title_en` / `title_ar`. */
  title: string;
  title_en: string | null;
  title_ar: string | null;
  summary_en: string | null;
  summary_ar: string | null;
  specialty_id: number | null;
  subspecialty_id: number | null;
  specialty: GuidelineCategoryRef | null;
  subspecialty: GuidelineCategoryRef | null;
  /** The subspecialty when there is one, otherwise the specialty. */
  category: GuidelineCategoryRef | null;
  sections: GuidelineSection[];
  sections_count: number;
  source: string | null;
  source_url: string | null;
  /** What the app shows as "Last updated"; falls back to the last edit. */
  last_reviewed_at: string | null;
  last_updated_at: string | null;
  is_published: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface GuidelinePayload {
  title_en: string | null;
  title_ar: string | null;
  summary_en: string | null;
  summary_ar: string | null;
  /** The backend fills the specialty in from this, so it is the one to send. */
  subspecialty_id: number | null;
  specialty_id: number | null;
  /** `[]` clears every section; blank bullets and empty sections are dropped server-side. */
  sections: GuidelineSection[];
  source: string | null;
  source_url: string | null;
  last_reviewed_at: string | null;
  is_published: boolean;
  sort_order: number | null;
}

export interface GuidelineQuery {
  page?: number;
  per_page?: number;
  search?: string;
  specialty_id?: number;
  subspecialty_id?: number;
  is_published?: 0 | 1;
}

const BASE = '/admin/doctor/clinical-guidelines';

@Injectable({ providedIn: 'root' })
export class ClinicalGuidelinesService {
  private api = inject(ApiService);

  list(query: GuidelineQuery = {}): Observable<PagedResult<ClinicalGuideline>> {
    return this.api.getPaged<ClinicalGuideline>(BASE, query);
  }

  get(id: number): Observable<ClinicalGuideline> {
    return this.api.get<ClinicalGuideline>(`${BASE}/${id}`);
  }

  create(body: GuidelinePayload): Observable<ClinicalGuideline> {
    return this.api.post<ClinicalGuideline>(BASE, body);
  }

  update(id: number, body: GuidelinePayload): Observable<ClinicalGuideline> {
    return this.api.put<ClinicalGuideline>(`${BASE}/${id}`, body);
  }

  /**
   * The PDF rides on a multipart POST — PHP does not parse a multipart PATCH
   * body, so an edit posts too. `clear_pdf` removes the stored file.
   */
  saveWithPdf(
    id: number | null,
    body: GuidelinePayload,
    pdf: File | null,
    clearPdf = false
  ): Observable<ClinicalGuideline> {
    const form = new FormData();
    for (const [key, value] of Object.entries(body)) {
      if (value === null || value === undefined) continue;
      // Multipart carries strings; sections are nested, so they go as JSON.
      form.append(key, key === 'sections' ? JSON.stringify(value) : String(value));
    }
    if (pdf) form.append('pdf', pdf);
    if (clearPdf) form.append('clear_pdf', 'true');
    return this.api.postMultipart<ClinicalGuideline>(id ? `${BASE}/${id}` : BASE, form);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${BASE}/${id}`);
  }
}
