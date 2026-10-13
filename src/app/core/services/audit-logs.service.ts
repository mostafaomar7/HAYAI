import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * What every admin did, newest first. Read-only by design: the API exposes no
 * edit or delete, which is the point of an audit trail.
 */
export interface AuditLogEntry {
  id: number;
  admin: { id: number; name: string; email: string } | null;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | string;
  path: string;
  route: string | null;
  route_params: Record<string, string> | null;
  /**
   * The names of the fields the request carried, without their values. This is
   * what every row has; `old_values`/`new_values` below are richer but only
   * exist where the API recognised the write.
   */
  input_keys: string[] | null;
  /**
   * A readable name for what happened — `role.updated`, `settings.changed`,
   * `page.created`. Present on 216 of the 741 rows live on 2026-10-13, which
   * is every row the API classified; the rest are raw requests.
   */
  action: string | null;
  /** What was touched: `website_role`, `website_settings`, `page`. */
  entity_type: string | null;
  entity_id: number | string | null;
  /**
   * Before and after, keyed by field.
   *
   * An earlier comment here claimed the log never carries values and that this
   * was deliberate. That was wrong, and this screen threw the values away
   * because of it: measured across all 741 rows, 130 carry `old_values` and
   * 207 carry `new_values`. A create has no `old_values`, a delete no
   * `new_values`.
   */
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  status: number;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogQuery {
  page?: number;
  per_page?: number;
  admin_id?: number;
  method?: string;
  /** Matched as "contains". */
  path?: string;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogsService {
  private api = inject(ApiService);

  list(query: AuditLogQuery = {}): Observable<PagedResult<AuditLogEntry>> {
    return this.api.getPaged<AuditLogEntry>('/admin/audit-logs', query);
  }
}
