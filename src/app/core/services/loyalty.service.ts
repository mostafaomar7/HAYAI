import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * Hayai points, the loyalty program (backend contract of 2026-11-18).
 *
 * Members earn points for actions the server can see, turn them into a
 * voucher for one partner (a provider account that accepts points), and the
 * partner takes the amount off the bill. Hayai then owes the partner that
 * amount until an admin marks the voucher settled here.
 *
 * Every route is under `/admin/loyalty`, area `loyalty` (`view` to read,
 * `manage` for every write). Money is in EGP as plain numbers.
 */

const BASE = '/admin/loyalty';

// ---------------------------------------------------------------- overview

export interface LoyaltyAmount { count: number; amount: number; }

export interface LoyaltyEarnedByEvent {
  event: string;
  title_en?: string | null;
  title_ar?: string | null;
  points: number;
  times: number;
}

export interface LoyaltyOverview {
  from: string;
  to: string;
  enabled: boolean;
  currency: string;
  points: {
    earned: number; redeemed: number; refunded: number;
    expired: number; adjusted: number; members_earning: number;
  };
  earned_by_event: LoyaltyEarnedByEvent[];
  outstanding: { points: number; value: number };
  vouchers: Partial<Record<VoucherStatus, LoyaltyAmount>>;
  unsettled: LoyaltyAmount;
  partners_accepting: number;
  /** Points swapped for AI tokens in the period (already inside `points.redeemed`). */
  ai_exchanges?: { count: number; points: number; tokens: number; members: number } | null;
  /** Promo-code uses in the period (already inside `points.earned`). */
  promo_codes?: { redemptions: number; points: number; members: number; active_codes: number } | null;
}

// ---------------------------------------------------------------- settings

export interface LoyaltySettings {
  enabled: boolean;
  conversion_points: number;
  conversion_amount: number;
  currency: string;
  point_value: number;
  /** null: points never expire. */
  points_validity_days: number | null;
  min_redeem_points: number;
  /** null: no maximum. */
  max_redeem_points: number | null;
  voucher_validity_days: number;
  referral_window_days: number;
  terms_en: string | null;
  terms_ar: string | null;
  /** Points → AI tokens (2026-11-24). Off by default; pilot accounts can use it while off. */
  ai_exchange_enabled?: boolean;
  ai_exchange_points?: number;
  ai_exchange_tokens?: number;
  ai_exchange_min_points?: number;
  /** null: no maximum per exchange. */
  ai_exchange_max_points?: number | null;
  updated_by?: number | null;
  updated_at?: string | null;
}

export type LoyaltySettingsPatch = Partial<Omit<LoyaltySettings, 'currency' | 'point_value' | 'updated_by' | 'updated_at'>>;

// ------------------------------------------------------------------- rules

export type LoyaltyEventKind = 'once' | 'repeatable';
export type LoyaltyEventGroup = 'account' | 'engagement' | 'social' | 'orders' | 'medical_file';
export const LOYALTY_GROUPS: LoyaltyEventGroup[] = ['account', 'engagement', 'social', 'orders', 'medical_file'];

/** One action the server can see. The dashboard cannot invent one. */
export interface LoyaltyEvent {
  event: string;
  kind: LoyaltyEventKind;
  group: LoyaltyEventGroup | string;
  supports_amount: boolean;
  title_en: string;
  title_ar: string;
  description_en?: string | null;
  description_ar?: string | null;
}

export type LimitPeriod = 'day' | 'week' | 'month' | 'campaign';
export const LIMIT_PERIODS: LimitPeriod[] = ['day', 'week', 'month', 'campaign'];
export type RuleAudience = 'all' | 'patient' | 'tourist';
export const RULE_AUDIENCES: RuleAudience[] = ['all', 'patient', 'tourist'];
export type RuleStatus = 'active' | 'scheduled' | 'ended' | 'inactive';
export const RULE_STATUSES: RuleStatus[] = ['active', 'scheduled', 'ended', 'inactive'];

export interface LoyaltyRule {
  id: number;
  event: string;
  event_title_en?: string | null;
  event_title_ar?: string | null;
  kind: LoyaltyEventKind;
  supports_amount: boolean;
  title_en: string | null;
  title_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  points: number;
  points_per_egp: number | null;
  max_points: number | null;
  limit_count: number | null;
  limit_period: LimitPeriod | null;
  audience: RuleAudience;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  rule_status: RuleStatus;
  rule_status_label?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LoyaltyRuleBody {
  event: string;
  title_en: string | null;
  title_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  points: number;
  points_per_egp: number | null;
  max_points: number | null;
  limit_count: number | null;
  limit_period: LimitPeriod | null;
  audience: RuleAudience;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

// ---------------------------------------------------------------- partners

/** The `user_type` values `/partners` filters by — the API's own names. */
export const PARTNER_TYPES = [
  'pharmacies', 'labs_radiology', 'doctor', 'clinic', 'hospital', 'senior_care',
  'home_care', 'physical_therapy', 'medical_devices', 'medical_insurance', 'employment_office'
] as const;

export interface LoyaltyPartner {
  user_id: number;
  partner_id: number | null;
  account_name?: string | null;
  display_name?: string | null;
  image?: string | null;
  entities?: { type: string; id: number; name: string }[];
  email?: string | null;
  phone?: string | null;
  provider_type?: string | null;
  account_status?: string | null;
  accepts_points: boolean;
  max_voucher_amount: number | null;
  note: string | null;
  redeemed_amount: number;
  unsettled_amount: number;
  updated_at?: string | null;
}

export interface LoyaltyPartnerBody {
  accepts_points: boolean;
  max_voucher_amount: number | null;
  note: string | null;
}

// ---------------------------------------------------------------- accounts

export interface LoyaltyAccountRow {
  user_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  user_type: string | null;
  referral_code: string | null;
  balance: number;
  balance_value: number;
  earned: number;
  joined_at: string | null;
}

export interface LoyaltyAccount {
  user: { id: number; name?: string | null; email?: string | null; phone?: string | null; user_type?: string | null } | null;
  balance: number;
  balance_value: number;
  currency: string;
  expiring_soon: { points: number; expires_at: string } | null;
  lifetime: { earned: number; redeemed: number; refunded: number; expired: number; adjusted: number };
  referral_code: string | null;
  referred_by_user_id: number | null;
  referred_at: string | null;
  invited_count: number;
}

export type EntryType = 'earn' | 'redeem' | 'refund' | 'expire' | 'adjust';
export const ENTRY_TYPES: EntryType[] = ['earn', 'redeem', 'refund', 'expire', 'adjust'];

export interface LoyaltyEntry {
  id: number;
  type: EntryType;
  type_label?: string | null;
  /** Signed: negative for redeem / expire / a negative adjustment. */
  points: number;
  title?: string | null;
  title_en?: string | null;
  title_ar?: string | null;
  event?: string | null;
  remaining?: number | null;
  expires_at?: string | null;
  note?: string | null;
  voucher?: { id: number; amount: number; currency: string; status: VoucherStatus; status_label?: string | null } | null;
  rule_id?: number | null;
  created_by?: number | null;
  created_at: string;
}

// ---------------------------------------------------------------- vouchers

export type VoucherStatus = 'active' | 'redeemed' | 'cancelled' | 'expired';
export const VOUCHER_STATUSES: VoucherStatus[] = ['active', 'redeemed', 'cancelled', 'expired'];
export type SettlementStatus = 'settled' | 'unsettled';

export interface LoyaltyVoucher {
  id: number;
  code: string;
  points: number;
  amount: number;
  currency: string;
  status: VoucherStatus;
  status_label?: string | null;
  patient: { id: number; name?: string | null; phone?: string | null; user_type?: string | null } | null;
  partner: { user_id: number; name?: string | null; user_type?: string | null } | null;
  expires_at: string | null;
  redeemed_at: string | null;
  invoice_amount: number | null;
  invoice_reference: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  settlement_status: SettlementStatus | null;
  settlement_status_label?: string | null;
  settled_at: string | null;
  settlement_reference: string | null;
  created_at: string;
}

export interface VoucherTotals { count: number; amount: number; points: number; }

export interface SettleResult { settled_ids: number[]; skipped_ids: number[]; settled_amount: number; }

// ------------------------------------------------------------ AI exchanges

/** A member's points swapped for AI tokens, at the rate of that moment. Read-only. */
export interface LoyaltyAiExchange {
  id: number;
  points: number;
  tokens: number;
  rate: { points: number; tokens: number } | null;
  remaining_tokens: number | null;
  consumed_tokens: number | null;
  created_at: string;
  member: { id: number; name?: string | null; phone?: string | null; user_type?: string | null } | null;
  allocation_id?: number | null;
  loyalty_entry_id?: number | null;
}

// ------------------------------------------------------------- promo codes

export type PromoStatus = 'active' | 'scheduled' | 'ended' | 'used_up' | 'inactive';
export const PROMO_STATUSES: PromoStatus[] = ['active', 'scheduled', 'ended', 'used_up', 'inactive'];

/** A code an advertiser or influencer hands out; typing it in the app pays points. */
export interface LoyaltyPromoCode {
  id: number;
  code: string;
  owner_name: string;
  title_en: string | null;
  title_ar: string | null;
  points: number;
  /** null: no limit. */
  max_uses: number | null;
  uses_count: number;
  remaining_uses: number | null;
  points_awarded: number;
  last_used_at: string | null;
  /** null: any account. */
  max_account_age_days: number | null;
  audience: RuleAudience;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  promo_status: PromoStatus;
  note: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface LoyaltyPromoBody {
  code?: string | null;
  owner_name: string;
  points: number;
  max_uses: number | null;
  max_account_age_days: number | null;
  audience: RuleAudience;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  title_en: string | null;
  title_ar: string | null;
  note: string | null;
}

export interface LoyaltyPromoRedemption {
  id: number;
  points: number;
  created_at: string;
  member: { id: number; name?: string | null; phone?: string | null; user_type?: string | null; joined_at?: string | null } | null;
  loyalty_entry_id?: number | null;
}

type Query = Record<string, string | number | null | undefined>;

@Injectable({ providedIn: 'root' })
export class LoyaltyService {
  private api = inject(ApiService);

  overview(range: { from?: string; to?: string }): Observable<LoyaltyOverview> {
    return this.api.get<LoyaltyOverview>(`${BASE}/overview`, range);
  }

  settings(): Observable<LoyaltySettings> {
    return this.api.get<LoyaltySettings>(`${BASE}/settings`);
  }

  updateSettings(body: LoyaltySettingsPatch): Observable<LoyaltySettings> {
    return this.api.patch<LoyaltySettings>(`${BASE}/settings`, body);
  }

  events(): Observable<LoyaltyEvent[]> {
    return this.api.get<LoyaltyEvent[]>(`${BASE}/events`).pipe(map(r => r ?? []));
  }

  rules(q: Query): Observable<PagedResult<LoyaltyRule>> {
    return this.api.getPaged<LoyaltyRule>(`${BASE}/rules`, q);
  }

  createRule(body: LoyaltyRuleBody): Observable<LoyaltyRule> {
    return this.api.post<LoyaltyRule>(`${BASE}/rules`, body);
  }

  updateRule(id: number, body: Partial<LoyaltyRuleBody>): Observable<LoyaltyRule> {
    return this.api.patch<LoyaltyRule>(`${BASE}/rules/${id}`, body);
  }

  deleteRule(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/rules/${id}`);
  }

  partners(q: Query): Observable<PagedResult<LoyaltyPartner>> {
    return this.api.getPaged<LoyaltyPartner>(`${BASE}/partners`, q);
  }

  updatePartner(userId: number, body: LoyaltyPartnerBody): Observable<LoyaltyPartner> {
    return this.api.put<LoyaltyPartner>(`${BASE}/partners/${userId}`, body);
  }

  accounts(q: Query): Observable<PagedResult<LoyaltyAccountRow>> {
    return this.api.getPaged<LoyaltyAccountRow>(`${BASE}/accounts`, q);
  }

  account(userId: number): Observable<LoyaltyAccount> {
    return this.api.get<LoyaltyAccount>(`${BASE}/accounts/${userId}`);
  }

  entries(userId: number, q: Query): Observable<PagedResult<LoyaltyEntry>> {
    return this.api.getPaged<LoyaltyEntry>(`${BASE}/accounts/${userId}/entries`, q);
  }

  adjust(userId: number, body: { points: number; reason: string; never_expires: boolean }): Observable<{ entry: LoyaltyEntry; balance: number }> {
    return this.api.post(`${BASE}/accounts/${userId}/adjust`, body);
  }

  vouchers(q: Query): Observable<PagedResult<LoyaltyVoucher>> {
    return this.api.getPaged<LoyaltyVoucher>(`${BASE}/vouchers`, q);
  }

  cancelVoucher(id: number, reason: string): Observable<LoyaltyVoucher> {
    return this.api.post<LoyaltyVoucher>(`${BASE}/vouchers/${id}/cancel`, { reason });
  }

  settle(voucherIds: number[], reference: string | null): Observable<SettleResult> {
    return this.api.post<SettleResult>(`${BASE}/vouchers/settle`, { voucher_ids: voucherIds, settlement_reference: reference });
  }

  aiExchanges(q: Query): Observable<PagedResult<LoyaltyAiExchange>> {
    return this.api.getPaged<LoyaltyAiExchange>(`${BASE}/ai-exchanges`, q);
  }

  promoCodes(q: Query): Observable<PagedResult<LoyaltyPromoCode>> {
    return this.api.getPaged<LoyaltyPromoCode>(`${BASE}/promo-codes`, q);
  }

  /** Deleted (archived) codes too, for their history. */
  promoCode(id: number): Observable<LoyaltyPromoCode> {
    return this.api.get<LoyaltyPromoCode>(`${BASE}/promo-codes/${id}`);
  }

  createPromoCode(body: LoyaltyPromoBody): Observable<LoyaltyPromoCode> {
    return this.api.post<LoyaltyPromoCode>(`${BASE}/promo-codes`, body);
  }

  updatePromoCode(id: number, body: Partial<LoyaltyPromoBody>): Observable<LoyaltyPromoCode> {
    return this.api.patch<LoyaltyPromoCode>(`${BASE}/promo-codes/${id}`, body);
  }

  /** `purged: false` = it had been used, so it was archived (history kept). */
  deletePromoCode(id: number): Observable<{ purged?: boolean } | null> {
    return this.api.delete<{ purged?: boolean } | null>(`${BASE}/promo-codes/${id}`);
  }

  promoRedemptions(id: number, q: Query): Observable<PagedResult<LoyaltyPromoRedemption>> {
    return this.api.getPaged<LoyaltyPromoRedemption>(`${BASE}/promo-codes/${id}/redemptions`, q);
  }
}

/** What the server will store for a typed code: upper case, no spaces or dashes. */
export function normaliseCode(v: string): string {
  return v.toUpperCase().replace(/[\s-]+/g, '');
}

/** A 422's `errors` as one message per field, or null when it is not a 422. */
export function fieldErrorsOf(err: unknown): Record<string, string> | null {
  const e = err as { status?: number; error?: { errors?: Record<string, string[] | string> } };
  if (e?.status !== 422 || !e.error?.errors) return null;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.error.errors)) flat[k] = Array.isArray(v) ? v[0] : String(v);
  return flat;
}

/** The server's own sentence, or the given i18n key. */
export function messageOf(err: unknown, fallback: string): string {
  return (err as { error?: { message?: string } })?.error?.message || fallback;
}

/** `YYYY-MM-DD` in local time. */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
