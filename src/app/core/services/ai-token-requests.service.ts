import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * Patients and tourists who ran out of their monthly AI allowance and asked
 * for more, from the app (backend brief of 2026-10-22).
 *
 * Approving is a real cost: it creates the same record a manual grant does
 * (`POST /admin/ai/allocations`), so an approved request also shows up in the
 * allocations list. Rejecting adds nothing. Either way the account is told,
 * and `admin_note` is what they are told — it is shown to the patient, not
 * kept internal.
 *
 * A request is reviewed once. There is no re-open, which is why a 409 here is
 * handled as "somebody got there first" rather than as an error.
 */

export type AiTokenRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AiRequestUser {
  id: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  user_type?: string | null;
}

/** What the account's allowance looked like **when the request was made**. */
export interface AiTokenRequest {
  id: number;
  status: AiTokenRequestStatus;
  /**
   * Optional on our side only. The API always sends it; this screen has never
   * run against a real response, and a row missing its account should render
   * as "#id" rather than throw in the middle of a queue of other people's
   * requests.
   */
  user?: AiRequestUser | null;
  note?: string | null;
  /** The month it was raised in, `2026-10`. */
  period?: string | null;
  /** `null` means this account type has no monthly cap at all. */
  monthly_limit?: number | null;
  monthly_used?: number | null;
  available_tokens?: number | null;
  /**
   * The account type's current monthly allowance, for pre-filling the amount.
   * Can be `null` (no cap set for that type — tourists are `null` today) or
   * `0`, so it is never assumed to be a usable number.
   */
  suggested_tokens?: number | null;
  granted_tokens?: number | null;
  allocation_id?: number | null;
  granted_until?: string | null;
  admin_note?: string | null;
  reviewed_by?: { id: number; name?: string | null } | string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  /** Detail only: the balance **now**, which may differ from the recorded one. */
  current_balance?: AiCurrentBalance | null;
}

export interface AiCurrentBalance {
  available_tokens?: number | null;
  from_allocations?: number | null;
  from_free_pool?: number | null;
  monthly_allowance?: {
    limit?: number | null;
    used?: number | null;
    remaining?: number | null;
    period?: string | null;
    resets_at?: string | null;
  } | null;
}

export interface AiTokenRequestQuery {
  status?: AiTokenRequestStatus;
  user_id?: number;
  page?: number;
  /** The API caps this at 50. */
  per_page?: number;
}

const BASE = '/admin/ai/token-requests';

@Injectable({ providedIn: 'root' })
export class AiTokenRequestsService {
  private api = inject(ApiService);

  /**
   * The list carries `meta.pending_count` beside the pagination — the number
   * for the sidebar badge, which is not the same as `pagination.total` once a
   * status filter is on.
   */
  list(query: AiTokenRequestQuery = {}): Observable<PagedResult<AiTokenRequest>> {
    return this.api.getPaged<AiTokenRequest>(BASE, query);
  }

  get(id: number): Observable<AiTokenRequest> {
    return this.api.get<AiTokenRequest>(`${BASE}/${id}`);
  }

  /**
   * `tokens` is required and at least 1. `ends_at` empty means the grant never
   * expires, so it is omitted rather than sent as null — a server that reads
   * the key as "set it" would otherwise get an expiry of nothing.
   */
  approve(
    id: number,
    body: { tokens: number; ends_at?: string | null; admin_note?: string }
  ): Observable<AiTokenRequest> {
    return this.api.post<AiTokenRequest>(`${BASE}/${id}/approve`, {
      tokens: body.tokens,
      ...(body.ends_at ? { ends_at: body.ends_at } : {}),
      ...(body.admin_note ? { admin_note: body.admin_note } : {})
    });
  }

  /** The note is the reason the patient is shown, so it is worth writing. */
  reject(id: number, admin_note?: string): Observable<AiTokenRequest> {
    return this.api.post<AiTokenRequest>(`${BASE}/${id}/reject`, {
      ...(admin_note ? { admin_note } : {})
    });
  }
}
