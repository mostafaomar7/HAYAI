import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { ApiPagination } from '../models/api-response.model';
import { PlanStatus } from './users.service';

/** `outgoing` = the account did it. `incoming` = it was done to them. */
export type ActivityDirection = 'outgoing' | 'incoming';

/**
 * Which table the path id belongs to. Provider lists are keyed by organization
 * / facility / doctor id, none of which is a user id, so the endpoint has to be
 * told. Omitting it means "this is a user id".
 */
export type ActivityIdType = 'user' | 'organization' | 'facility' | 'doctor';

export interface ActivityRow {
  /** Machine value — safe to switch on. `label` is the localized display name. */
  type: string;
  label: string;
  direction: ActivityDirection;
  /** The record's id inside its own module, not a timeline id. */
  id: number;
  status: string | null;
  title: string | null;
  amount: number | null;
  happened_at: string | null;
}

export interface ActivityTypeOption {
  type: string;
  label: string;
  direction: ActivityDirection;
}

export interface ActivityUser {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  user_type: string;
  status: string;
  created_at: string;
  plan_status?: PlanStatus | null;
}

export interface ActivityMeta {
  user: ActivityUser;
  /** Differs per account — never hardcode the filter list from this. */
  available_types: ActivityTypeOption[];
  pagination: ApiPagination;
}

export interface ActivitySummary {
  total: number;
  by_type: { type: string; label: string; direction: ActivityDirection; count: number }[];
  /** Keyed by status; the key `none` means the record type carries no status. */
  by_status: Record<string, number>;
}

export interface ActivityQuery {
  page?: number;
  per_page?: number;
  /** Sent as a comma-separated list, which is what the endpoint expects. */
  type?: string[];
  direction?: ActivityDirection | '';
  status?: string;
  /** `YYYY-MM-DD`. */
  from?: string;
  to?: string;
  id_type?: ActivityIdType;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private api = inject(ApiService);

  list(id: number, query: ActivityQuery = {}): Observable<{ items: ActivityRow[]; meta: ActivityMeta }> {
    return this.api
      .getWithMeta<ActivityRow[], ActivityMeta>(`/admin/users/${id}/activity`, this.params(query))
      .pipe(map(r => ({ items: r.data ?? [], meta: r.meta as ActivityMeta })));
  }

  summary(id: number, query: ActivityQuery = {}): Observable<ActivitySummary> {
    return this.api.get<ActivitySummary>(`/admin/users/${id}/activity/summary`, this.params(query));
  }

  /**
   * `ApiService` expands arrays into `type[]=a&type[]=b`; this endpoint wants
   * `type=a,b`, so the list is flattened here rather than in the caller.
   */
  private params(query: ActivityQuery): Record<string, unknown> {
    const { type, ...rest } = query;
    return { ...rest, type: type?.length ? type.join(',') : undefined };
  }
}
