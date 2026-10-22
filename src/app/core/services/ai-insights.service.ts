import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * What the AI actually did, what it cost, and who was given tokens
 * (backend brief of 2026-10-22). Three endpoints that had been answering on
 * production with no screen in front of them.
 *
 * Everything here is reading, except `createAllocation`, which spends money.
 */

// ---------------------------------------------------------------- overview

export interface AiOverview {
  period?: { from?: string | null; to?: string | null } | null;
  requests?: number | null;
  /** What the provider counted. `billed_tokens` is what we charged for. */
  provider_tokens?: number | null;
  billed_tokens?: number | null;
  estimated_cost_usd?: number | null;
  emergencies_detected?: number | null;
  /** Anything that did not answer normally — refusals included. */
  failed_requests?: number | null;
  patients?: AiOverviewPatients | null;
  doctors?: AiOverviewDoctors | null;
}

export interface AiOverviewPatients {
  /** The shared pool. These three do **not** follow the date window. */
  free_pool_total?: number | null;
  free_pool_used?: number | null;
  free_pool_remaining?: number | null;
  active_patients?: number | null;
  /** Patients and tourists together. */
  tokens_used?: number | null;
  average_tokens_per_patient?: number | null;
  paid_allocation_tokens?: number | null;
}

export interface AiOverviewDoctors {
  active_doctors?: number | null;
  /**
   * Measured in the chosen window — unlike the two below it, which are the
   * lifetime of the doctors' grants. Our screen labels each one, because the
   * three together read as a contradiction otherwise: on production today the
   * last 30 days show `tokens_used: 0` beside 56,320 tokens missing from
   * `allocated - remaining`.
   */
  tokens_used?: number | null;
  allocated_tokens?: number | null;
  remaining_tokens?: number | null;
}

// ------------------------------------------------------------------- usage

export type AiUsageStatus =
  | 'ok'
  | 'quota_exceeded'
  | 'insufficient_data'
  | 'provider_error'
  | 'invalid_output'
  | 'blocked';

export interface AiUsageRow {
  id: number;
  /** The row carries an id and no name. */
  user_id?: number | null;
  module?: string | null;
  model?: string | null;
  input_tokens?: number | null;
  cached_input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  billed_tokens?: number | null;
  estimated_cost_usd?: number | null;
  /** `pool` the monthly allowance, `allocation` a grant, `none` not charged. */
  charged_to?: 'pool' | 'allocation' | 'none' | string | null;
  risk_level?: string | null;
  emergency_detected?: boolean | null;
  status?: AiUsageStatus | string | null;
  /** English only, from the API. We translate `status` ourselves instead. */
  status_label?: string | null;
  duration_ms?: number | null;
  created_at?: string | null;
}

export interface AiModuleSummaryRow {
  module?: string | null;
  requests?: number | null;
  billed_tokens?: number | null;
  average_response_tokens?: number | null;
  estimated_cost_usd?: number | null;
  errors?: number | null;
  /** 0–1, not a percentage. */
  error_rate?: number | null;
  emergencies_detected?: number | null;
}

export interface AiModule {
  key: string;
  name_en?: string | null;
  name_ar?: string | null;
  user_type?: string | null;
  enabled?: boolean | null;
}

export interface AiUsageQuery {
  from?: string;
  to?: string;
  user_id?: number;
  module?: string;
  status?: AiUsageStatus;
  page?: number;
  /** The API caps this at 100. */
  per_page?: number;
}

// ------------------------------------------------------------- allocations

export type AiAllocationSource = 'admin_grant' | 'purchase' | 'subscription';

export interface AiAllocation {
  id: number;
  user?: { id: number; name?: string | null; user_type?: string | null } | null;
  source?: AiAllocationSource | string | null;
  tokens?: number | null;
  consumed_tokens?: number | null;
  remaining_tokens?: number | null;
  starts_at?: string | null;
  /** `null` means it never expires. */
  ends_at?: string | null;
  is_active?: boolean | null;
  /** A grant made by approving a request starts with `Token request #<id>.` */
  notes?: string | null;
}

export interface AiAllocationQuery {
  user_id?: number;
  source?: AiAllocationSource;
  page?: number;
  /** The API caps this at 50. */
  per_page?: number;
}

export interface AiGrantBody {
  user_id: number;
  tokens: number;
  ends_at?: string | null;
  notes?: string | null;
}

const BASE = '/admin/ai';

@Injectable({ providedIn: 'root' })
export class AiInsightsService {
  private api = inject(ApiService);

  /** `from`/`to` are whole days, inclusive. Omitted means the last 30 days. */
  overview(range: { from?: string; to?: string } = {}): Observable<AiOverview> {
    return this.api.get<AiOverview>(`${BASE}/overview`, range);
  }

  usage(query: AiUsageQuery = {}): Observable<PagedResult<AiUsageRow>> {
    return this.api.getPaged<AiUsageRow>(`${BASE}/usage`, query);
  }

  /** One row per module. Not paginated — it comes back as a plain array. */
  usageSummary(range: { from?: string; to?: string } = {}): Observable<AiModuleSummaryRow[]> {
    return this.api.get<AiModuleSummaryRow[]>(`${BASE}/usage/summary`, range);
  }

  /**
   * The module catalog, for the filter. Each entry carries a lot more than we
   * need (suggested questions, model tiers); only the name is read here.
   */
  modules(): Observable<AiModule[]> {
    return this.api.get<AiModule[]>(`${BASE}/modules`);
  }

  allocations(query: AiAllocationQuery = {}): Observable<PagedResult<AiAllocation>> {
    return this.api.getPaged<AiAllocation>(`${BASE}/allocations`, query);
  }

  /**
   * Real AI spend, and it notifies nobody. A patient who asked through the app
   * should be answered by approving their request instead, which tells them.
   *
   * `ends_at` empty means it never expires, so the key is left out rather than
   * sent as null.
   */
  createAllocation(body: AiGrantBody): Observable<AiAllocation> {
    return this.api.post<AiAllocation>(`${BASE}/allocations`, {
      user_id: body.user_id,
      tokens: body.tokens,
      ...(body.ends_at ? { ends_at: body.ends_at } : {}),
      ...(body.notes ? { notes: body.notes } : {})
    });
  }
}
