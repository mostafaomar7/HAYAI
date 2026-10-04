import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * Moderation inbox.
 *
 * The consequential part is a rating report: setting it to `actioned` does not
 * merely record a decision, it deletes the review from the app and recomputes
 * the business's average. That is why the screen labels its buttons by effect
 * and confirms before the destructive one.
 */

export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';
export type ReportTarget =
  | 'ai_answer' | 'ad' | 'job' | 'blood_request' | 'provider' | 'rating';
export type RatingSource =
  | 'doctor' | 'pharmacy' | 'lab' | 'home_care' | 'medical_device'
  | 'physical_therapy' | 'employment_office' | 'insurance';
export type ReportReason = 'offensive' | 'incorrect' | 'spam' | 'privacy' | 'other';

/** What the reported thing looked like when it was reported. */
export interface RatingSnapshot {
  rating_source?: RatingSource | string;
  reviewed_id?: number;
  reviewed_owner_user_id?: number | null;
  rating?: number;
  comment?: string | null;
  reviewer_user_id?: number | null;
  reviewer_name?: string | null;
  created_at?: string;
  [extra: string]: unknown;
}

export interface Report {
  id: number;
  status: ReportStatus;
  status_label?: string | null;
  target_type: ReportTarget | string;
  target_id?: number | null;
  reason: ReportReason | string;
  reason_label?: string | null;
  note?: string | null;
  admin_note?: string | null;
  /**
   * True when the business the review is about filed it. Allowed on purpose —
   * they spot a defamatory review first — but it is also the shape abuse takes,
   * so the moderator is told.
   */
  reporter_is_subject?: boolean;
  reporter?: { id: number; name?: string | null; user_type?: string | null } | null;
  target_snapshot?: RatingSnapshot | null;
  created_at: string;
  updated_at?: string | null;
}

/** `review_removed` only means something on a rating report set to `actioned`. */
export interface ReportDecision extends Report {
  review_removed?: boolean;
}

export interface ReportQuery {
  page?: number;
  per_page?: number;
  status?: ReportStatus | '';
  target_type?: ReportTarget | '';
  rating_source?: RatingSource | '';
  reason?: ReportReason | '';
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private api = inject(ApiService);

  list(query: ReportQuery = {}): Observable<PagedResult<Report>> {
    return this.api.getPaged<Report>('/admin/reports', query);
  }

  get(id: number): Observable<Report> {
    return this.api.get<Report>(`/admin/reports/${id}`);
  }

  /**
   * On a rating report, `actioned` removes the review for good and closes every
   * sibling report on the same review — so the caller reloads rather than
   * patching one row in place.
   */
  decide(id: number, status: ReportStatus, adminNote?: string): Observable<ReportDecision> {
    const body: Record<string, unknown> = { status };
    if (adminNote?.trim()) body['admin_note'] = adminNote.trim();
    return this.api.patch<ReportDecision>(`/admin/reports/${id}`, body);
  }
}
