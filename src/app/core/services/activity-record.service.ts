import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

/**
 * One record behind an activity row, in a shape that is identical for all 21
 * record types.
 *
 * The typed endpoints share almost nothing — measured across seven of them, 78
 * distinct fields with exactly four in common. Rendering those directly would
 * have meant a screen per type. This envelope is the backend's presenter over
 * the same data, so the dashboard reads one shape and draws one screen.
 */

/** Colours the status pill. Anything unrecognised falls back to `neutral`. */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface RecordStatus {
  /** Null on a record with no lifecycle — a favourite. The pill is skipped. */
  value: string | null;
  label: string | null;
  tone: StatusTone;
}

export interface RecordParty {
  role_label: string;
  name: string;
  /**
   * Always a `users` id, so it links straight to that account. Null when the
   * party is not a platform account — a walk-in name, a free-text hospital.
   */
  user_id: number | null;
  user_type: string | null;
  phone: string | null;
}

/**
 * A rendering hint, not a parser instruction: `value` already arrives formatted.
 * The list is open — an unknown type renders as `text` rather than breaking the
 * screen.
 */
export type FieldType =
  | 'text' | 'long_text' | 'date' | 'datetime' | 'phone' | 'email' | 'url' | 'money';

export interface RecordField {
  label: string;
  /** Display-ready. Never parse it back — `true` already arrives as "Yes". */
  value: string | null;
  type: FieldType | string;
}

/**
 * Both shapes carry all four keys; `type` is what decides which pair is real.
 * Switching on emptiness would misread a table whose rows happen to be empty.
 */
export interface RecordSection {
  title: string;
  type: 'fields' | 'table';
  fields: RecordField[];
  columns: string[];
  rows: string[][];
}

export interface RecordAmount {
  label: string;
  /** A JSON number: 143.00 arrives as 143, so it is formatted on display. */
  value: number;
  currency: string;
  /** At most one per record — the figure rendered large. */
  primary: boolean;
}

export interface RecordAttachment {
  label: string;
  url: string;
  /** Null when the stored file carries no extension. */
  mime: string | null;
}

export interface RecordEvent {
  at: string;
  label: string;
}

export interface ActivityRecord {
  type: string;
  type_label: string;
  id: number;
  /** Never null — a record with no name gets one built server-side. */
  title: string;
  status: RecordStatus;
  created_at: string;
  parties: RecordParty[];
  sections: RecordSection[];
  amounts: RecordAmount[];
  attachments: RecordAttachment[];
  /** Oldest first. Empty is normal, not an error. */
  timeline: RecordEvent[];
}

@Injectable({ providedIn: 'root' })
export class ActivityRecordService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  /**
   * `type` is the machine value straight off the timeline row. The `_received`
   * variants resolve to the same record server-side, so they are passed through
   * untouched rather than mapped here.
   */
  get(type: string, id: number): Observable<ActivityRecord> {
    return this.api.get<ActivityRecord>(
      `/admin/activity/${encodeURIComponent(type)}/${id}`
    );
  }

  /**
   * Attachments arrive as three different kinds of URL — public storage paths,
   * signed document links, and opaque `/files/` references that need the admin's
   * bearer token. A plain anchor carries no Authorization header, so the last
   * kind would 401 in a new tab. Fetching through `HttpClient` puts every one of
   * them through the auth interceptor and hands back something openable.
   */
  fetchAttachment(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }
}
