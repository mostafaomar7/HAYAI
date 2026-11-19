import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * Where a term stands relative to its end date, as the API reckons it:
 * `expiring` ends within the window, `grace` has ended but the account keeps
 * its features until `grace_ends_at`, `expired` is past both.
 */
export type RenewalPhase = 'expiring' | 'grace' | 'expired';

export interface RenewalItem {
  id: number;
  /** Null when the account was deleted after the subscription was sold. */
  user: {
    id: number;
    name: string;
    type: string;
    avatar: string | null;
    email?: string | null;
    phone?: string | null;
    country_code?: string | null;
  } | null;
  /**
   * Null when the subscription has no plan at all. A plan deleted from the
   * dashboard after the term began still comes back, with `is_deleted: true`
   * (plans are soft-deleted and their subscribers keep their term).
   */
  plan: { id: number; name: string; is_deleted?: boolean } | null;
  started_at: string;
  ended_at: string;
  status: 'active' | 'expired' | 'renewed' | 'cancelled';
  auto_renew: boolean;
  /** What was actually charged for this term, after any discount. */
  amount: string;
  /**
   * The plan's price and discount as they stood when the term started, so a
   * later change to the plan does not rewrite history. Both are null on terms
   * that began before the API started recording them (2026-10-14).
   */
  list_price?: string | null;
  discount_percent?: number | null;
  currency: string;
  phase?: RenewalPhase;
  /** Days to the end date: 0 on the last day, negative after it. */
  days_left?: number;
  /** Last day the account keeps its features. */
  grace_ends_at?: string | null;
}

export interface RenewalQuery {
  page?: number;
  per_page?: number;
  search?: string;
  user_type?: string;
  plan_id?: number;
}

export interface BulkRenewBody {
  subscription_ids?: number[];
  /**
   * Renew everything in the renewal list. Send the list's filters with it:
   * without them the backend renews every account in the list, not only the
   * ones the admin filtered down to.
   */
  all?: boolean;
  search?: string;
  user_type?: string;
  plan_id?: number;
  months?: number;
}

export interface BulkRenewResult {
  renewed: number;
  skipped: number;
  failed: { id: number; reason: string }[];
}

@Injectable({ providedIn: 'root' })
export class SubscriptionsService {
  private api = inject(ApiService);

  renewals(query: RenewalQuery = {}): Observable<PagedResult<RenewalItem>> {
    return this.api.getPaged<RenewalItem>('/admin/subscription/renewals', query);
  }

  renew(id: number, months?: number): Observable<RenewalItem> {
    return this.api.post<RenewalItem>(`/admin/subscription/${id}/renew`, months ? { months } : {});
  }

  renewBulk(body: BulkRenewBody): Observable<BulkRenewResult> {
    return this.api.post<BulkRenewResult>('/admin/subscription/renewals/renew-bulk', body);
  }
}
