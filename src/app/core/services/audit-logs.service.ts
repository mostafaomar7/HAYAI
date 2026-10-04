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
   * Field names only — never values. That is deliberate: the log must not
   * become a second copy of the data it describes.
   */
  input_keys: string[] | null;
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
