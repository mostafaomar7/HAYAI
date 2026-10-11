import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';
import { AccountDeleteResult } from './users.service';

export type DeletionRequestStatus = 'pending' | 'completed' | 'rejected';

/**
 * An account whose email or phone matches the request's `identifier`.
 *
 * There can be more than one — a phone number reused across a patient and a
 * provider account, say — which is why completing a request asks which one
 * rather than guessing. Deleting the wrong account cannot be undone.
 */
export interface MatchedAccount {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  user_type?: string | null;
}

export interface AccountDeletionRequest {
  id: number;
  status: DeletionRequestStatus;
  /** What the person typed as their email or phone. */
  identifier?: string | null;
  /** Why they asked, when they gave a reason. */
  reason?: string | null;
  matched_accounts?: MatchedAccount[] | null;
  handled_note?: string | null;
  handled_at?: string | null;
  created_at?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AccountDeletionRequestsService {
  private api = inject(ApiService);

  list(
    query: { status?: DeletionRequestStatus; page?: number; per_page?: number } = {}
  ): Observable<PagedResult<AccountDeletionRequest>> {
    return this.api.getPaged<AccountDeletionRequest>('/admin/account-deletion-requests', query);
  }

  /**
   * Carries out the deletion the person asked for.
   *
   * `confirm: 'DELETE'` is required by the API, the same lock the direct
   * account delete has. The result says whether the account was removed
   * outright or closed and wiped — the backend decides, by kind.
   */
  complete(
    id: number,
    body: { user_id: number; handled_note?: string }
  ): Observable<AccountDeleteResult> {
    return this.api.post<AccountDeleteResult>(`/admin/account-deletion-requests/${id}/complete`, {
      ...body,
      confirm: 'DELETE'
    });
  }

  /**
   * Refuses the request. Note this does not reopen an account the partner app
   * already closed on the person's own instruction — that is unblocked from
   * the account's own page.
   */
  reject(id: number, handled_note?: string): Observable<AccountDeletionRequest> {
    return this.api.patch<AccountDeletionRequest>(`/admin/account-deletion-requests/${id}`, {
      status: 'rejected',
      ...(handled_note ? { handled_note } : {})
    });
  }
}
