import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

export interface RenewalItem {
  id: number;
  user: {
    id: number;
    name: string;
    type: string;
    avatar: string | null;
  };
  plan: { id: number; name: string };
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
  all?: boolean;
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
